/*
 * Lambda port of api/private-room.js — server-side gate for private
 * multiplayer rooms. Logic is identical to the Vercel version; only the
 * require path for the admin helper differs.
 */
const crypto = require('crypto');
const { getAdmin } = require('./_admin');

const ROOM_ROOT = 'papianoOnlineBeta';

const FAILURE_THRESHOLD = 5;
const LOCKOUT_BASE_MS = 60_000;
const LOCKOUT_MAX_STEPS = 6;

function hashPassword(password, roomId) {
  return crypto.createHash('sha256').update(`${roomId}::${password}`).digest('hex');
}

function throttleRef(db, roomId, uid) {
  return db.ref(`${ROOM_ROOT}/roomThrottle/${roomId}/${uid}`);
}

async function checkLockoutSeconds(db, roomId, uid) {
  const snap = await throttleRef(db, roomId, uid).get();
  const v = snap.val() || {};
  const failures = Number(v.failures) || 0;
  const lastAt = Number(v.lastFailureAt) || 0;
  if (failures < FAILURE_THRESHOLD || !lastAt) return 0;
  const step = Math.min(failures - FAILURE_THRESHOLD, LOCKOUT_MAX_STEPS);
  const cooldownMs = LOCKOUT_BASE_MS * Math.pow(2, step);
  const elapsed = Date.now() - lastAt;
  return elapsed >= cooldownMs ? 0 : Math.ceil((cooldownMs - elapsed) / 1000);
}

async function recordFailure(db, roomId, uid) {
  const ref = throttleRef(db, roomId, uid);
  await ref.transaction(curr => ({
    failures: (Number(curr?.failures) || 0) + 1,
    lastFailureAt: Date.now(),
  }));
}

async function clearThrottle(db, roomId, uid) {
  try { await throttleRef(db, roomId, uid).remove(); }
  catch (_e) { /* best-effort */ }
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

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'POST only' });
  }

  let admin;
  try { admin = getAdmin(); }
  catch (e) {
    return res.status(500).json({ ok: false, reason: 'server not configured' });
  }

  try {
    const body = await readBody(req);
    const action = String(body?.action || '');
    const idToken = String(body?.idToken || '');
    const roomId = String(body?.roomId || '');
    const password = String(body?.password || '');
    if (!action || !idToken || !roomId) {
      return res.status(400).json({ ok: false, reason: 'missing fields' });
    }
    if (!/^room_[0-9a-z_]+$/i.test(roomId) || roomId.length > 80) {
      return res.status(400).json({ ok: false, reason: 'bad roomId' });
    }

    let uid;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken, true);
      uid = decoded.uid;
    } catch (e) {
      return res.status(401).json({ ok: false, reason: 'bad token' });
    }

    const db = admin.database();
    const roomSnap = await db.ref(`${ROOM_ROOT}/rooms/${roomId}`).get();
    if (!roomSnap.exists()) {
      return res.status(404).json({ ok: false, reason: 'room not found' });
    }
    const room = roomSnap.val() || {};

    if (action === 'set') {
      if (room.ownerUid !== uid) {
        return res.status(403).json({ ok: false, reason: 'not owner' });
      }
      if (room.mode !== 'Private') {
        return res.status(400).json({ ok: false, reason: 'not private' });
      }
      if (!password) return res.status(400).json({ ok: false, reason: 'empty password' });
      if (password.length > 48) {
        return res.status(400).json({ ok: false, reason: 'password too long (max 48)' });
      }
      await db.ref(`${ROOM_ROOT}/roomSecrets/${roomId}`).set({
        passwordHash: hashPassword(password, roomId),
        ownerUid: uid,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      });
      try { await db.ref(`${ROOM_ROOT}/rooms/${roomId}/password`).set(''); }
      catch (e) { /* best-effort cleanup */ }
      await db.ref(`${ROOM_ROOT}/roomGrants/${roomId}/${uid}`).set({
        grantedAt: admin.database.ServerValue.TIMESTAMP,
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'check') {
      if (room.ownerUid === uid || room.mode !== 'Private') {
        await db.ref(`${ROOM_ROOT}/roomGrants/${roomId}/${uid}`).set({
          grantedAt: admin.database.ServerValue.TIMESTAMP,
        });
        await clearThrottle(db, roomId, uid);
        return res.status(200).json({ ok: true });
      }
      if (password.length > 48) {
        return res.status(400).json({ ok: false, reason: 'password too long (max 48)' });
      }
      const retryAfter = await checkLockoutSeconds(db, roomId, uid);
      if (retryAfter > 0) {
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ ok: false, reason: 'too many attempts', retryAfter });
      }
      const secretSnap = await db.ref(`${ROOM_ROOT}/roomSecrets/${roomId}`).get();
      if (!secretSnap.exists()) {
        const legacy = String(room.password || '');
        if (!legacy) {
          return res.status(409).json({ ok: false, reason: 'room not initialized' });
        }
        if (legacy !== password) {
          await recordFailure(db, roomId, uid);
          return res.status(401).json({ ok: false, reason: 'wrong password' });
        }
        await db.ref(`${ROOM_ROOT}/roomSecrets/${roomId}`).set({
          passwordHash: hashPassword(legacy, roomId),
          ownerUid: room.ownerUid || '',
          updatedAt: admin.database.ServerValue.TIMESTAMP,
        });
        try { await db.ref(`${ROOM_ROOT}/rooms/${roomId}/password`).set(''); }
        catch (e) { /* best-effort cleanup */ }
        await db.ref(`${ROOM_ROOT}/roomGrants/${roomId}/${uid}`).set({
          grantedAt: admin.database.ServerValue.TIMESTAMP,
        });
        await clearThrottle(db, roomId, uid);
        return res.status(200).json({ ok: true });
      }
      const secret = secretSnap.val() || {};
      if (hashPassword(password, roomId) !== secret.passwordHash) {
        await recordFailure(db, roomId, uid);
        return res.status(401).json({ ok: false, reason: 'wrong password' });
      }
      await db.ref(`${ROOM_ROOT}/roomGrants/${roomId}/${uid}`).set({
        grantedAt: admin.database.ServerValue.TIMESTAMP,
      });
      await clearThrottle(db, roomId, uid);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, reason: 'unknown action' });
  } catch (e) {
    console.error('private-room error', e?.message || e);
    return res.status(500).json({ ok: false, reason: 'server error' });
  }
};
