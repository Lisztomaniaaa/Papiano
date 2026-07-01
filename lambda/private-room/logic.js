/*
 * Server-side gate for private multiplayer rooms. Ported from Firebase
 * Realtime Database to DynamoDB (papiano-rooms / papiano-room-secrets /
 * papiano-room-grants / papiano-room-throttle) as part of the Cognito/AWS
 * migration — same request/response contract as the old Vercel version.
 */
const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { verifyIdToken } = require('./_cognito');

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const T = {
  rooms: 'papiano-rooms',
  roomSecrets: 'papiano-room-secrets',
  roomGrants: 'papiano-room-grants',
  roomThrottle: 'papiano-room-throttle',
};

const FAILURE_THRESHOLD = 5;
const LOCKOUT_BASE_MS = 60_000;
const LOCKOUT_MAX_STEPS = 6;

function hashPassword(password, roomId) {
  return crypto.createHash('sha256').update(`${roomId}::${password}`).digest('hex');
}

async function checkLockoutSeconds(roomId, uid) {
  const r = await doc.send(new GetCommand({ TableName: T.roomThrottle, Key: { key: `${roomId}#${uid}` } }));
  const v = r.Item || {};
  const failures = Number(v.failures) || 0;
  const lastAt = Number(v.lastFailureAt) || 0;
  if (failures < FAILURE_THRESHOLD || !lastAt) return 0;
  const step = Math.min(failures - FAILURE_THRESHOLD, LOCKOUT_MAX_STEPS);
  const cooldownMs = LOCKOUT_BASE_MS * Math.pow(2, step);
  const elapsed = Date.now() - lastAt;
  return elapsed >= cooldownMs ? 0 : Math.ceil((cooldownMs - elapsed) / 1000);
}

async function recordFailure(roomId, uid) {
  const key = `${roomId}#${uid}`;
  const existing = await doc.send(new GetCommand({ TableName: T.roomThrottle, Key: { key } }));
  const failures = (Number(existing.Item?.failures) || 0) + 1;
  await doc.send(new PutCommand({ TableName: T.roomThrottle, Item: { key, failures, lastFailureAt: Date.now() } }));
}

async function clearThrottle(roomId, uid) {
  try { await doc.send(new DeleteCommand({ TableName: T.roomThrottle, Key: { key: `${roomId}#${uid}` } })); }
  catch (_e) { /* best-effort */ }
}

async function grantAccess(roomId, uid) {
  await doc.send(new PutCommand({ TableName: T.roomGrants, Item: { roomId, uid, grantedAt: Date.now() } }));
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

  try {
    const body = await readBody(req);
    const action = String(body?.action || '');
    const idToken = String(body?.idToken || '');
    const roomId = String(body?.roomId || '');
    const password = String(body?.password || '');
    if (!action || !idToken || !roomId) {
      return res.status(400).json({ ok: false, reason: 'missing fields' });
    }

    let uid;
    try {
      const decoded = await verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e) {
      return res.status(401).json({ ok: false, reason: 'bad token' });
    }

    const roomSnap = await doc.send(new GetCommand({ TableName: T.rooms, Key: { roomId } }));
    if (!roomSnap.Item) {
      return res.status(404).json({ ok: false, reason: 'room not found' });
    }
    const room = roomSnap.Item;

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
      await doc.send(new PutCommand({
        TableName: T.roomSecrets,
        Item: { roomId, passwordHash: hashPassword(password, roomId), ownerUid: uid, updatedAt: Date.now() },
      }));
      await grantAccess(roomId, uid);
      return res.status(200).json({ ok: true });
    }

    if (action === 'check') {
      if (room.ownerUid === uid || room.mode !== 'Private') {
        await grantAccess(roomId, uid);
        await clearThrottle(roomId, uid);
        return res.status(200).json({ ok: true });
      }
      if (password.length > 48) {
        return res.status(400).json({ ok: false, reason: 'password too long (max 48)' });
      }
      const retryAfter = await checkLockoutSeconds(roomId, uid);
      if (retryAfter > 0) {
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ ok: false, reason: 'too many attempts', retryAfter });
      }
      const secretSnap = await doc.send(new GetCommand({ TableName: T.roomSecrets, Key: { roomId } }));
      if (!secretSnap.Item) {
        return res.status(409).json({ ok: false, reason: 'room not initialized' });
      }
      if (hashPassword(password, roomId) !== secretSnap.Item.passwordHash) {
        await recordFailure(roomId, uid);
        return res.status(401).json({ ok: false, reason: 'wrong password' });
      }
      await grantAccess(roomId, uid);
      await clearThrottle(roomId, uid);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, reason: 'unknown action' });
  } catch (e) {
    console.error('private-room error', e?.message || e);
    return res.status(500).json({ ok: false, reason: 'server error' });
  }
};
