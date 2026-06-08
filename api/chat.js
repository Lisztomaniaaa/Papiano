/**
 * Papiano Chat API — POST /api/chat
 * 
 * Admin actions (require PAPIANO_ADMIN_SECRET):
 *   delete-message   — Delete a specific message from any chat room
 *   clear-room       — Delete all messages in a chat room
 *   disable-room     — Lock a chat room (prevent new messages)
 *   enable-room      — Unlock a chat room
 *
 * User actions (require Firebase ID token via Authorization header):
 *   send-message     — Send message with server-side validation + rate limit
 *   delete-own       — Delete own message (soft delete)
 */
const { admin, firestore, rtdb } = require('./_lib/firebase');
const { cors, requireAdmin, verifyUser, rateLimit, auditLog } = require('./_lib/helpers');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const { action, secret, ...params } = req.body || {};

  try {
    // Admin actions
    if (['delete-message', 'clear-room', 'disable-room', 'enable-room'].includes(action)) {
      if (!requireAdmin(secret, res)) return;
      switch (action) {
        case 'delete-message': return await deleteMessage(params, res);
        case 'clear-room': return await clearRoom(params, res);
        case 'disable-room': return await disableRoom(params, res);
        case 'enable-room': return await enableRoom(params, res);
      }
    }

    // User actions (token auth)
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Invalid or missing auth token' });

    switch (action) {
      case 'send-message': return await sendMessage(user, params, res);
      case 'delete-own': return await deleteOwn(user, params, res);
      case 'edit-message': return await editMessage(user, params, res);
      case 'clear-room-messages': return await clearRoomMessages(user, params, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[chat] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ─── ADMIN ACTIONS ──────────────────────────────────────────────────────────

/**
 * delete-message
 * Params: { roomId, messageId }
 */
async function deleteMessage({ roomId, messageId }, res) {
  if (!roomId || !messageId) return res.status(400).json({ error: 'Missing roomId or messageId' });
  await firestore.collection('chatRooms').doc(roomId).collection('messages').doc(messageId).delete();
  await auditLog('chat-delete-message', { roomId, messageId });
  return res.json({ success: true, roomId, messageId });
}

/**
 * clear-room
 * Params: { roomId }
 * Deletes all messages in a chat room (batch delete).
 */
async function clearRoom({ roomId }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  const messagesRef = firestore.collection('chatRooms').doc(roomId).collection('messages');
  let deleted = 0;
  let batch = firestore.batch();
  let count = 0;

  // Firestore batch limit = 500
  const allMessages = await messagesRef.limit(500).get();
  while (allMessages.docs.length > 0 || count > 0) {
    const snap = count === 0 ? allMessages : await messagesRef.limit(500).get();
    if (snap.empty) break;
    batch = firestore.batch();
    snap.docs.forEach(doc => { batch.delete(doc.ref); deleted++; });
    await batch.commit();
    count++;
    if (count > 20) break; // Safety cap: max 10,000 messages
  }

  await auditLog('chat-clear-room', { roomId, deleted });
  return res.json({ success: true, roomId, deleted });
}

/**
 * disable-room
 * Params: { roomId, reason? }
 * Sets room as disabled in appConfig/disabledRooms.
 */
async function disableRoom({ roomId, reason }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  await rtdb.ref(`appConfig/disabledRooms/${roomId}`).set({
    disabled: true, reason: reason || 'Disabled by admin', disabledAt: Date.now()
  });
  await auditLog('chat-disable-room', { roomId, reason });
  return res.json({ success: true, roomId, disabled: true });
}

/**
 * enable-room
 * Params: { roomId }
 */
async function enableRoom({ roomId }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  await rtdb.ref(`appConfig/disabledRooms/${roomId}`).remove();
  await auditLog('chat-enable-room', { roomId });
  return res.json({ success: true, roomId, disabled: false });
}

// ─── USER ACTIONS ───────────────────────────────────────────────────────────

// Basic profanity list (extend as needed)
const BLOCKED_PATTERNS = [
  /n[i1]gg/i, /f[a@]gg/i, /\bkys\b/i, /\bkill\s*(your|ur)self/i,
  /\brape\b/i, /\bpedo\b/i, /\bnazi\b/i
];

function containsProfanity(text) {
  return BLOCKED_PATTERNS.some(p => p.test(text));
}

/**
 * send-message
 * Params: { roomId, text, replyTo? }
 * Server-validated, rate-limited message send.
 */
async function sendMessage(user, { roomId, text, replyTo, imageURL }, res) {
  if (!roomId || !text) return res.status(400).json({ error: 'Missing roomId or text' });
  if (typeof text !== 'string' || text.length > 500) return res.status(400).json({ error: 'Text too long (max 500)' });
  if (text.trim().length === 0) return res.status(400).json({ error: 'Empty message' });

  // Rate limit: 8 messages per 30 seconds per user
  if (!rateLimit(`chat:${user.uid}`, 8, 30000)) {
    return res.status(429).json({ error: 'Too many messages. Wait a moment.' });
  }

  // Check if room is disabled
  const disabledSnap = await rtdb.ref(`appConfig/disabledRooms/${roomId}`).once('value');
  if (disabledSnap.exists()) return res.status(403).json({ error: 'This room is currently disabled.' });

  // Check if user is banned/muted
  const profileSnap = await firestore.collection('profiles').doc(user.uid).get();
  if (profileSnap.exists) {
    const profile = profileSnap.data();
    if (profile.banned || profile.isBanned) return res.status(403).json({ error: 'Account banned.' });
    if (profile.shadowMuted || profile.isMuted) {
      // Shadow mute: accept but don't actually write (user thinks it sent)
      return res.json({ success: true, messageId: 'shadow_' + Date.now(), shadow: true });
    }
  }

  // Profanity check
  if (containsProfanity(text)) {
    return res.status(400).json({ error: 'Message contains inappropriate content.' });
  }

  // Get sender profile for message metadata
  const senderProfile = profileSnap.exists ? profileSnap.data() : {};

  // Write message
  const message = {
    senderId: user.uid,
    senderName: senderProfile.name || 'Papiano User',
    senderUserId: senderProfile.userId || '',
    senderPhotoURL: senderProfile.photoURL || '',
    senderBadgeId: senderProfile.roleId || senderProfile.badgeId || 'common',
    text: text.trim(),
    imageURL: imageURL || '',
    hiddenFor: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (replyTo) message.replyTo = replyTo;

  const ref = await firestore.collection('chatRooms').doc(roomId).collection('messages').add(message);

  // Update room metadata (last message, unread counts)
  const roomUpdate = {
    lastMessage: text.trim() || 'Photo',
    lastSenderId: user.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await firestore.collection('chatRooms').doc(roomId).set(roomUpdate, { merge: true });

  return res.json({ success: true, messageId: ref.id });
}

/**
 * delete-own
 * Params: { roomId, messageId }
 * User can soft-delete their own message.
 */
async function deleteOwn(user, { roomId, messageId }, res) {
  if (!roomId || !messageId) return res.status(400).json({ error: 'Missing roomId or messageId' });
  const msgRef = firestore.collection('chatRooms').doc(roomId).collection('messages').doc(messageId);
  const snap = await msgRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'Message not found' });
  if (snap.data().senderId !== user.uid) return res.status(403).json({ error: 'Not your message' });
  await msgRef.update({ deletedForAll: true, deletedAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ success: true, messageId });
}


/**
 * edit-message
 * Params: { roomId, messageId, text }
 * User can edit their own message text.
 */
async function editMessage(user, { roomId, messageId, text }, res) {
  if (!roomId || !messageId || !text) return res.status(400).json({ error: 'Missing roomId, messageId, or text' });
  if (typeof text !== 'string' || text.length > 500) return res.status(400).json({ error: 'Text too long (max 500)' });

  const msgRef = firestore.collection('chatRooms').doc(roomId).collection('messages').doc(messageId);
  const snap = await msgRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'Message not found' });
  if (snap.data().senderId !== user.uid) return res.status(403).json({ error: 'Not your message' });

  await msgRef.update({
    text: text.trim(),
    editedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return res.json({ success: true, messageId });
}

/**
 * clear-room-messages
 * Params: { roomId }
 * User can soft-delete all messages in a DM they participate in.
 */
async function clearRoomMessages(user, { roomId }, res) {
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

  // Verify user is participant
  const roomSnap = await firestore.collection('chatRooms').doc(roomId).get();
  if (!roomSnap.exists) return res.json({ success: true, cleared: 0 });
  const roomData = roomSnap.data();
  if (roomData.type === 'dm' && !roomData.participants?.includes(user.uid)) {
    return res.status(403).json({ error: 'Not your chat' });
  }

  // Soft-delete messages (batch)
  const messagesRef = firestore.collection('chatRooms').doc(roomId).collection('messages');
  let cleared = 0;
  let snap = await messagesRef.limit(500).get();
  while (!snap.empty) {
    const batch = firestore.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { deletedForAll: true, text: '', imageURL: '', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      cleared++;
    });
    await batch.commit();
    if (cleared >= 5000) break; // Safety cap
    snap = await messagesRef.where('deletedForAll', '!=', true).limit(500).get();
  }

  return res.json({ success: true, cleared });
}
