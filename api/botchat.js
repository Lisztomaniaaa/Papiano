/*
 * /api/botchat — server-side endpoint for the "/askpapiano" AI chatbot.
 * Triggered from chat when a message starts with "/askpapiano <prompt>" (global
 * chat, VIP chat, or a multiplayer room), or when a reply with no prefix
 * targets one of the bot's own prior messages (reply-to-continue). Calls
 * OpenRouter using the @preset/papiano preset (model/persona/params
 * configured there, not here) and writes the reply back as a synthetic
 * "Papiano" sender via the Admin SDK, which bypasses the normal
 * sender-must-equal-auth-uid write rules.
 *
 *   POST { idToken, roomId, prompt, priorBotText? }
 *   -> 200 { ok:true } — reply lands via the existing realtime listeners
 *   -> 4xx/5xx { ok:false, reason } on auth/validation/throttle failure
 *
 * priorBotText is optional light context: when the client is continuing a
 * conversation via reply-to-continue, it carries the bot's own immediately-
 * prior reply text, sent to OpenRouter as one extra assistant-role turn.
 *
 * roomId must be one of: 'group_global', 'group_vip', or a multiplayer room
 * id matching /^room_[0-9a-z_]+$/i — anything else is rejected. VIP and
 * room-membership are re-checked server-side (defense in depth; never trust
 * the client's claimed roomId for a privileged write).
 */
const { getAdmin } = require('./_admin');

const BOT_ROOT = 'papianoOnlineBeta';
const PAPIANO_BOT_UID = 'papiano-bot';
const BOT_THROTTLE_MS = 12_000;
const PROMPT_MAX_LEN = 300;
const REPLY_MAX_LEN = 400;
const OPENROUTER_TIMEOUT_MS = 20_000;
const DEFAULT_MODEL = '@preset/papiano';
const EMPTY_PROMPT_REPLY = "Hi! Ask me anything about Papiano — try \"/askpapiano how do I join a room?\"";
const FALLBACK_REPLY = "Sorry, I couldn't come up with a reply just now — try again in a bit.";

const ADMIN_GATE_EMAILS = new Set([
  'utamairfan44@gmail.com',
  'akunpolos0444000@gmail.com',
  'papianobase@gmail.com',
]);

function normalizeRole(value) {
  return String(value || 'player').trim().toLowerCase().slice(0, 40) || 'player';
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function timeLabel(now) {
  const date = new Date(now);
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

async function classifyRoom(admin, roomId, uid, email) {
  if (roomId === 'group_global') return { ok: true, surface: 'firestore' };
  if (roomId === 'group_vip') {
    const doc = await admin.firestore().collection('profiles').doc(uid).get();
    const role = normalizeRole(doc.exists ? doc.data().role : '');
    if (role === 'vip' || ADMIN_GATE_EMAILS.has(String(email || '').toLowerCase())) {
      return { ok: true, surface: 'firestore' };
    }
    return { ok: false, status: 403, reason: 'not vip' };
  }
  if (/^room_[0-9a-z_]+$/i.test(roomId) && roomId.length <= 80) {
    const snap = await admin.database().ref(`${BOT_ROOT}/roomPlayers/${roomId}/${uid}`).get();
    if (snap.exists()) return { ok: true, surface: 'rtdb' };
    return { ok: false, status: 403, reason: 'not in room' };
  }
  return { ok: false, status: 400, reason: 'bad roomId' };
}

async function askOpenRouter(prompt, priorBotText) {
  try {
    const messages = priorBotText
      ? [{ role: 'assistant', content: priorBotText }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAPIANOAI_API}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages,
      }),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    });
    if (!response.ok) return FALLBACK_REPLY;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const text = String(content || '').trim();
    return text ? text.slice(0, REPLY_MAX_LEN) : FALLBACK_REPLY;
  } catch (e) {
    return FALLBACK_REPLY;
  }
}

async function writeReply(admin, surface, roomId, text) {
  if (surface === 'firestore') {
    const roomRef = admin.firestore().collection('chatRooms').doc(roomId);
    await roomRef.collection('messages').doc().set({
      senderId: PAPIANO_BOT_UID,
      senderName: 'Papiano',
      senderUserId: '',
      senderPhotoURL: '',
      senderBadgeId: 'bot',
      text,
      imageURL: '',
      imagePath: '',
      replyTo: null,
      hiddenFor: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await roomRef.set({
      lastMessage: text,
      lastSenderId: PAPIANO_BOT_UID,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  const now = Date.now();
  await admin.database().ref(`${BOT_ROOT}/messages/${roomId}`).push({
    playerId: PAPIANO_BOT_UID,
    text,
    createdAt: now,
    time: timeLabel(now),
    replyTo: null,
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'POST only' });
  }
  if (!process.env.PAPIANOAI_API) {
    return res.status(503).json({ ok: false, reason: 'not configured' });
  }

  let admin;
  try { admin = getAdmin(); }
  catch (e) {
    return res.status(500).json({ ok: false, reason: 'server not configured' });
  }

  try {
    const body = await readBody(req);
    const idToken = String(body?.idToken || '');
    const roomId = String(body?.roomId || '');
    const prompt = String(body?.prompt || '').trim();
    const priorBotText = String(body?.priorBotText || '').trim().slice(0, 200);
    if (!idToken || !roomId) {
      return res.status(400).json({ ok: false, reason: 'missing fields' });
    }
    if (prompt.length > PROMPT_MAX_LEN) {
      return res.status(400).json({ ok: false, reason: 'prompt too long' });
    }

    let uid, email;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken, true);
      uid = decoded.uid;
      email = decoded.email;
    } catch (e) {
      return res.status(401).json({ ok: false, reason: 'bad token' });
    }

    const classification = await classifyRoom(admin, roomId, uid, email);
    if (!classification.ok) {
      return res.status(classification.status).json({ ok: false, reason: classification.reason });
    }

    const db = admin.database();
    const throttleRef = db.ref(`${BOT_ROOT}/botThrottle/${uid}`);
    const throttleSnap = await throttleRef.get();
    const lastAt = Number(throttleSnap.val()?.lastAt) || 0;
    const elapsed = Date.now() - lastAt;
    if (lastAt && elapsed < BOT_THROTTLE_MS) {
      const retryAfter = Math.ceil((BOT_THROTTLE_MS - elapsed) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ ok: false, reason: 'too many requests', retryAfter });
    }
    await throttleRef.set({ lastAt: Date.now() });

    const reply = prompt ? await askOpenRouter(prompt, priorBotText) : EMPTY_PROMPT_REPLY;
    await writeReply(admin, classification.surface, roomId, reply);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('botchat error', e?.message || e);
    return res.status(500).json({ ok: false, reason: 'server error' });
  }
};
