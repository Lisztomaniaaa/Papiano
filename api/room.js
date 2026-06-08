/**
 * Papiano Room API — POST /api/room
 *
 * Admin actions (require PAPIANO_ADMIN_SECRET):
 *   delete-room      — Remove a multiplayer room entirely
 *   kick-player      — Remove a player from a room
 *   lock-room        — Lock room (prevent joins)
 *   unlock-room      — Unlock room
 *
 * User actions (require Firebase ID token):
 *   create-room      — Create a new multiplayer room (server-validated)
 *   join-room        — Join a room (with optional password)
 *   leave-room       — Leave current room
 *   set-room-key     — Set/change private room password (hashed)
 *   validate-key     — Check if provided key matches room password
 */
const crypto = require('crypto');
const { admin, firestore, rtdb } = require('./_lib/firebase');
const { cors, requireAdmin, verifyUser, rateLimit, auditLog } = require('./_lib/helpers');

const RTDB_ROOT = 'papianoOnlineBeta';

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const { action, secret, ...params } = req.body || {};

  try {
    // Admin actions
    if (['delete-room', 'kick-player', 'lock-room', 'unlock-room'].includes(action)) {
      if (!requireAdmin(secret, res)) return;
      switch (action) {
        case 'delete-room': return await deleteRoom(params, res);
        case 'kick-player': return await kickPlayer(params, res);
        case 'lock-room': return await lockRoom(params, res);
        case 'unlock-room': return await unlockRoom(params, res);
      }
    }

    // User actions
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Invalid or missing auth token' });

    switch (action) {
      case 'create-room': return await createRoom(user, params, res);
      case 'join-room': return await joinRoom(user, params, res);
      case 'leave-room': return await leaveRoom(user, params, res);
      case 'set-room-key': return await setRoomKey(user, params, res);
      case 'validate-key': return await validateKey(user, params, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[room] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function hashKey(password) {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// ─── ADMIN ACTIONS ──────────────────────────────────────────────────────────

async function deleteRoom({ roomId }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}`).remove();
  await rtdb.ref(`${RTDB_ROOT}/messages/${roomId}`).remove();
  await auditLog('room-delete', { roomId });
  return res.json({ success: true, roomId, deleted: true });
}

async function kickPlayer({ roomId, uid }, res) {
  if (!roomId || !uid) return res.status(400).json({ error: 'Missing roomId or uid' });
  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}/players/${uid}`).remove();
  await rtdb.ref(`${RTDB_ROOT}/users/${uid}/room`).remove();
  await auditLog('room-kick', { roomId, uid });
  return res.json({ success: true, roomId, kicked: uid });
}

async function lockRoom({ roomId, reason }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}/locked`).set({
    locked: true, reason: reason || 'Locked by admin', lockedAt: Date.now()
  });
  await auditLog('room-lock', { roomId, reason });
  return res.json({ success: true, roomId, locked: true });
}

async function unlockRoom({ roomId }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}/locked`).remove();
  await auditLog('room-unlock', { roomId });
  return res.json({ success: true, roomId, locked: false });
}

// ─── USER ACTIONS ───────────────────────────────────────────────────────────

/**
 * create-room
 * Params: { name, maxPlayers?, isPrivate?, password? }
 */
async function createRoom(user, { name, maxPlayers, isPrivate, password }, res) {
  if (!name || name.length < 2 || name.length > 30) {
    return res.status(400).json({ error: 'Room name must be 2-30 chars' });
  }

  // Rate limit: 3 room creates per 5 minutes
  if (!rateLimit(`room-create:${user.uid}`, 3, 300000)) {
    return res.status(429).json({ error: 'Too many rooms created. Wait a few minutes.' });
  }

  // Check if user already owns a room
  const existingSnap = await rtdb.ref(`${RTDB_ROOT}/ownerRooms/${user.uid}`).once('value');
  if (existingSnap.exists()) {
    return res.status(400).json({ error: 'You already own a room. Delete it first.' });
  }

  const roomId = `room_${Date.now()}_${user.uid.slice(0, 6)}`;
  const roomData = {
    id: roomId,
    name: name.trim(),
    ownerId: user.uid,
    maxPlayers: Math.min(Math.max(Number(maxPlayers) || 4, 2), 6),
    isPrivate: Boolean(isPrivate),
    createdAt: Date.now(),
    players: { [user.uid]: { joinedAt: Date.now(), role: 'owner' } }
  };

  if (isPrivate && password) {
    roomData.passwordHash = hashKey(password);
  }

  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}`).set(roomData);
  await rtdb.ref(`${RTDB_ROOT}/ownerRooms/${user.uid}`).set({
    roomId, ownerUid: user.uid, createdAt: Date.now()
  });

  return res.json({ success: true, roomId, room: { ...roomData, passwordHash: undefined } });
}

/**
 * join-room
 * Params: { roomId, password? }
 */
async function joinRoom(user, { roomId, password }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

  // Rate limit: 10 joins per minute
  if (!rateLimit(`room-join:${user.uid}`, 10, 60000)) {
    return res.status(429).json({ error: 'Too many join attempts.' });
  }

  const roomSnap = await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}`).once('value');
  if (!roomSnap.exists()) return res.status(404).json({ error: 'Room not found' });

  const room = roomSnap.val();

  // Check locked
  if (room.locked) return res.status(403).json({ error: 'Room is locked.' });

  // Check capacity
  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= (room.maxPlayers || 6)) {
    return res.status(400).json({ error: 'Room is full.' });
  }

  // Check private + password
  if (room.isPrivate && room.passwordHash) {
    if (!password || hashKey(password) !== room.passwordHash) {
      return res.status(403).json({ error: 'Incorrect room password.' });
    }
  }

  // Check banned from room
  const bannedSnap = await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}/banned/${user.uid}`).once('value');
  if (bannedSnap.exists()) return res.status(403).json({ error: 'You are banned from this room.' });

  // Join
  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}/players/${user.uid}`).set({
    joinedAt: Date.now(), role: 'player'
  });
  await rtdb.ref(`${RTDB_ROOT}/users/${user.uid}/room`).set(roomId);

  return res.json({ success: true, roomId, joined: true });
}

/**
 * leave-room
 * Params: { roomId }
 */
async function leaveRoom(user, { roomId }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}/players/${user.uid}`).remove();
  await rtdb.ref(`${RTDB_ROOT}/users/${user.uid}/room`).remove();
  return res.json({ success: true, roomId, left: true });
}

/**
 * set-room-key
 * Params: { roomId, password }
 * Only room owner can set password.
 */
async function setRoomKey(user, { roomId, password }, res) {
  if (!roomId || !password) return res.status(400).json({ error: 'Missing roomId or password' });
  if (password.length < 3 || password.length > 32) {
    return res.status(400).json({ error: 'Password must be 3-32 chars' });
  }

  const roomSnap = await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}`).once('value');
  if (!roomSnap.exists()) return res.status(404).json({ error: 'Room not found' });
  if (roomSnap.val().ownerId !== user.uid) return res.status(403).json({ error: 'Only owner can set password' });

  await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}`).update({
    isPrivate: true, passwordHash: hashKey(password)
  });

  return res.json({ success: true, roomId, isPrivate: true });
}

/**
 * validate-key
 * Params: { roomId, password }
 * Returns whether password matches (without revealing hash).
 */
async function validateKey(user, { roomId, password }, res) {
  if (!roomId || !password) return res.status(400).json({ error: 'Missing roomId or password' });

  const roomSnap = await rtdb.ref(`${RTDB_ROOT}/rooms/${roomId}`).once('value');
  if (!roomSnap.exists()) return res.status(404).json({ error: 'Room not found' });

  const room = roomSnap.val();
  const valid = room.passwordHash && hashKey(password) === room.passwordHash;

  return res.json({ success: true, valid });
}
