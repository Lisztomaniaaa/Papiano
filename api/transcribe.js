/*
 * /api/transcribe — server-side proxy to the audio-midi transcription
 * service (Modal). The browser never holds the Modal API key and never
 * calls Modal directly: every request goes through this gate.
 *
 * Abuse control is tiered:
 *   - Anonymous callers get a small daily allowance per IP
 *     (ANON_DAILY_LIMIT). Once spent, the endpoint returns 401 with
 *     needsLogin:true instead of forwarding to Modal.
 *   - Once signed in (Firebase idToken in the X-Auth-Token header), the
 *     caller gets a per-uid minimum gap between calls plus a higher daily
 *     cap, the same shape as botchat.js's botThrottle.
 *
 *   POST <raw audio bytes>
 *     headers: 'Content-Type' = audio mime, optional 'X-Auth-Token' = Firebase
 *     ID token
 *   -> 200 { notes:[{pitch,onset,offset,velocity}], pedals:[{onset,offset}], midi_base64 }
 *      (passed through as-is from the audio-midi Modal endpoint)
 *   -> 401 { error, needsLogin:true } once the anonymous IP allowance is used up
 *   -> 413/429 { error } on oversized audio / throttle
 *   -> 5xx { error } on server misconfiguration or upstream failure
 *
 * Forwarding to Modal: this endpoint re-encodes the audio as
 * { audio_base64 } JSON and sends it with an X-API-Key header, matching the
 * audio-midi service's contract (POST /transcribe).
 */
const crypto = require('crypto');
const { getAdmin } = require('./_admin');

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_CONTENT_TYPES = [
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/webm',
  'audio/opus', 'audio/ogg', 'audio/wav', 'application/octet-stream',
];

const ANON_ROOT = 'transcribeThrottle';
const ANON_DAILY_LIMIT = 3;

const USER_ROOT = 'transcribeUserThrottle';
const USER_MIN_GAP_MS = 20_000;
const USER_DAILY_LIMIT = 50;

const UPSTREAM_TIMEOUT_MS = 45_000;

function dayKey(now) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function clientIpHash(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd) || req.socket?.remoteAddress || 'unknown';
  const ip = raw.split(',')[0].trim();
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_AUDIO_BYTES) {
        reject(Object.assign(new Error('Audio too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function checkAnonThrottle(db, req) {
  const ipHash = clientIpHash(req);
  const ref = db.ref(`${ANON_ROOT}/${ipHash}/${dayKey(Date.now())}`);
  const snap = await ref.get();
  const count = Number(snap.val()) || 0;
  if (count >= ANON_DAILY_LIMIT) {
    return { ok: false, status: 401, body: { error: 'Free transcription limit reached. Please sign in to continue.', needsLogin: true } };
  }
  await ref.set(count + 1);
  return { ok: true };
}

async function checkUserThrottle(admin, db, idToken) {
  let uid;
  try {
    ({ uid } = await admin.auth().verifyIdToken(String(idToken)));
  } catch {
    return { ok: false, status: 401, body: { error: 'Invalid session, please sign in again.' } };
  }
  const ref = db.ref(`${USER_ROOT}/${uid}/${dayKey(Date.now())}`);
  const snap = await ref.get();
  const data = snap.val() || {};
  const lastAt = Number(data.lastAt) || 0;
  const count = Number(data.count) || 0;
  const elapsed = Date.now() - lastAt;

  if (lastAt && elapsed < USER_MIN_GAP_MS) {
    return { ok: false, status: 429, body: { error: 'Too many requests, slow down.', retryAfter: Math.ceil((USER_MIN_GAP_MS - elapsed) / 1000) } };
  }
  if (count >= USER_DAILY_LIMIT) {
    return { ok: false, status: 429, body: { error: 'Daily transcription limit reached.' } };
  }
  await ref.set({ count: count + 1, lastAt: Date.now() });
  return { ok: true };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    res.status(400).json({ error: 'Unsupported audio content type.' });
    return;
  }

  let admin;
  try { admin = getAdmin(); }
  catch {
    res.status(500).json({ error: 'Server not configured.' });
    return;
  }
  const db = admin.database();

  const idToken = req.headers['x-auth-token'];
  try {
    const gate = idToken
      ? await checkUserThrottle(admin, db, idToken)
      : await checkAnonThrottle(db, req);
    if (!gate.ok) {
      res.status(gate.status).json(gate.body);
      return;
    }
  } catch (e) {
    console.error('transcribe throttle check failed:', e.message);
    res.status(500).json({ error: 'Server error, try again.' });
    return;
  }

  let audio;
  try {
    audio = await readRawBody(req);
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message || 'Bad audio body.' });
    return;
  }
  if (!audio.length) {
    res.status(400).json({ error: 'Empty audio body.' });
    return;
  }

  // audio-midi Modal contract: POST { audio_base64 } -> { notes, pedals, midi_base64 }
  const modalUrl = process.env.MODAL_TRANSCRIBE_URL;
  const modalKey = process.env.MODAL_API_KEY;
  if (!modalUrl || !modalKey) {
    res.status(500).json({ error: 'Transcription service not configured.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(modalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': modalKey,
      },
      body: JSON.stringify({ audio_base64: audio.toString('base64') }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error('Modal transcription failed:', upstream.status, text.slice(0, 500));
      res.status(502).json({ error: 'Transcription service failed.' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch (e) {
    console.error('Modal transcription request error:', e.message);
    res.status(e.name === 'AbortError' ? 504 : 502).json({ error: 'Transcription service unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
};
