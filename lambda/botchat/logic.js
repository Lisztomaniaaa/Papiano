/*
 * Server side of the "/askpapiano" bot. Ported from Firebase (Firestore +
 * Realtime Database) to DynamoDB as part of the Cognito/AWS migration —
 * same request/response contract as the old Vercel version.
 */
const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { verifyIdToken } = require('./_cognito');

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const T = {
  profiles: 'papiano-profiles',
  chatRooms: 'papiano-chat-rooms',
  messages: 'papiano-messages',
  roomPlayers: 'papiano-room-players',
  roomMessages: 'papiano-room-messages',
  botThrottle: 'papiano-bot-throttle',
};

const PAPIANO_BOT_UID = 'papiano-bot';
const BOT_THROTTLE_MS = 12_000;
const PROMPT_MAX_LEN = 300;
const REPLY_MAX_LEN = 2000;
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

async function classifyRoom(roomId, uid, email) {
  if (roomId === 'group_global') return { ok: true, surface: 'chat' };
  if (roomId === 'group_vip') {
    const r = await doc.send(new GetCommand({ TableName: T.profiles, Key: { uid } }));
    const role = normalizeRole(r.Item?.role);
    if (role === 'vip' || ADMIN_GATE_EMAILS.has(String(email || '').toLowerCase())) {
      return { ok: true, surface: 'chat' };
    }
    return { ok: false, status: 403, reason: 'not vip' };
  }
  const r = await doc.send(new GetCommand({ TableName: T.roomPlayers, Key: { roomId, playerId: uid } }));
  if (r.Item) return { ok: true, surface: 'room' };
  return { ok: false, status: 403, reason: 'not in room' };
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

async function writeReply(surface, roomId, text) {
  const now = Date.now();
  const messageId = crypto.randomUUID();
  if (surface === 'chat') {
    await doc.send(new PutCommand({
      TableName: T.messages,
      Item: {
        roomId, createdAt: `${String(now).padStart(13, '0')}#${messageId}`, messageId,
        senderId: PAPIANO_BOT_UID, senderName: 'Papiano', senderUserId: null, senderPhotoURL: null,
        senderBadgeId: 'bot', text, imageURL: null, imagePath: null, replyTo: null,
        deletedForAll: false, updatedAt: now,
      },
    }));
    await doc.send(new UpdateCommand({
      TableName: T.chatRooms, Key: { roomId },
      UpdateExpression: 'SET lastMessage = :lm, lastSenderId = :ls, updatedAt = :u',
      ExpressionAttributeValues: { ':lm': text, ':ls': PAPIANO_BOT_UID, ':u': now },
    })).catch(() => {});
    return;
  }
  await doc.send(new PutCommand({
    TableName: T.roomMessages,
    Item: {
      roomId, createdAt: `${String(now).padStart(13, '0')}#${messageId}`, messageId,
      playerId: PAPIANO_BOT_UID, senderName: 'Papiano', senderPhotoURL: null, text,
    },
  }));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'POST only' });
  }
  if (!process.env.PAPIANOAI_API) {
    return res.status(503).json({ ok: false, reason: 'not configured' });
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
      const decoded = await verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email;
    } catch (e) {
      return res.status(401).json({ ok: false, reason: 'bad token' });
    }

    const classification = await classifyRoom(roomId, uid, email);
    if (!classification.ok) {
      return res.status(classification.status).json({ ok: false, reason: classification.reason });
    }

    const throttleSnap = await doc.send(new GetCommand({ TableName: T.botThrottle, Key: { uid } }));
    const lastAt = Number(throttleSnap.Item?.lastAt) || 0;
    const elapsed = Date.now() - lastAt;
    if (lastAt && elapsed < BOT_THROTTLE_MS) {
      const retryAfter = Math.ceil((BOT_THROTTLE_MS - elapsed) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ ok: false, reason: 'too many requests', retryAfter });
    }
    await doc.send(new PutCommand({ TableName: T.botThrottle, Item: { uid, lastAt: Date.now() } }));

    const reply = prompt ? await askOpenRouter(prompt, priorBotText) : EMPTY_PROMPT_REPLY;
    await writeReply(classification.surface, roomId, reply);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('botchat error', e?.message || e);
    return res.status(500).json({ ok: false, reason: 'server error' });
  }
};
