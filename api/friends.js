/**
 * Papiano Friends API — POST /api/friends
 *
 * User actions (require Firebase ID token):
 *   send-request     — Send friend request (validated, anti-spam)
 *   accept-request   — Accept pending friend request
 *   reject-request   — Reject/cancel friend request
 *   unfriend         — Remove friendship + cleanup DM
 */
const { admin, firestore } = require('./_lib/firebase');
const { cors, verifyUser, rateLimit, auditLog } = require('./_lib/helpers');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const { action, ...params } = req.body || {};

  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Invalid or missing auth token' });

    switch (action) {
      case 'send-request': return await sendRequest(user, params, res);
      case 'accept-request': return await acceptRequest(user, params, res);
      case 'reject-request': return await rejectRequest(user, params, res);
      case 'unfriend': return await unfriend(user, params, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[friends] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

function buildPairId(a, b) { return [a, b].filter(Boolean).sort().join('_'); }

/**
 * send-request
 * Params: { targetId }
 */
async function sendRequest(user, { targetId }, res) {
  if (!targetId) return res.status(400).json({ error: 'Missing targetId' });
  if (targetId === user.uid) return res.status(400).json({ error: 'Cannot add yourself' });

  // Rate limit: 10 requests per 5 minutes
  if (!rateLimit(`friend-req:${user.uid}`, 10, 300000)) {
    return res.status(429).json({ error: 'Too many friend requests. Wait a moment.' });
  }

  // Check block exists
  const blockId1 = `${user.uid}_${targetId}`;
  const blockId2 = `${targetId}_${user.uid}`;
  const [b1, b2] = await Promise.all([
    firestore.collection('blocks').doc(blockId1).get(),
    firestore.collection('blocks').doc(blockId2).get()
  ]);
  if (b1.exists || b2.exists) return res.status(403).json({ error: 'Blocked' });

  // Check existing friendship
  const pairId = buildPairId(user.uid, targetId);
  const existing = await firestore.collection('friendships').doc(pairId).get();
  if (existing.exists) {
    const status = existing.data()?.status;
    if (status === 'accepted') return res.json({ success: true, alreadyFriends: true });
    return res.json({ success: true, alreadyPending: true });
  }

  // Create friendship request
  await firestore.collection('friendships').doc(pairId).set({
    users: [user.uid, targetId],
    requesterId: user.uid,
    receiverId: targetId,
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return res.json({ success: true, pairId });
}

/**
 * accept-request
 * Params: { pairId } or { targetId }
 */
async function acceptRequest(user, { pairId, targetId }, res) {
  const id = pairId || (targetId ? buildPairId(user.uid, targetId) : null);
  if (!id) return res.status(400).json({ error: 'Missing pairId or targetId' });

  const ref = firestore.collection('friendships').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Request not found' });
  
  const data = snap.data();
  if (data.receiverId !== user.uid) return res.status(403).json({ error: 'Not your request to accept' });
  if (data.status === 'accepted') return res.json({ success: true, alreadyAccepted: true });

  await ref.update({ status: 'accepted', acceptedAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.json({ success: true, accepted: true, pairId: id });
}

/**
 * reject-request
 * Params: { pairId } or { targetId }
 */
async function rejectRequest(user, { pairId, targetId }, res) {
  const id = pairId || (targetId ? buildPairId(user.uid, targetId) : null);
  if (!id) return res.status(400).json({ error: 'Missing pairId or targetId' });

  const ref = firestore.collection('friendships').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Request not found' });

  const data = snap.data();
  // Either receiver can reject, or requester can cancel
  if (data.receiverId !== user.uid && data.requesterId !== user.uid) {
    return res.status(403).json({ error: 'Not your request' });
  }

  await ref.delete();
  return res.json({ success: true, deleted: true, pairId: id });
}

/**
 * unfriend
 * Params: { targetId }
 */
async function unfriend(user, { targetId }, res) {
  if (!targetId) return res.status(400).json({ error: 'Missing targetId' });
  
  const pairId = buildPairId(user.uid, targetId);
  const ref = firestore.collection('friendships').doc(pairId);
  const snap = await ref.get();
  if (!snap.exists) return res.json({ success: true, wasNotFriends: true });

  const data = snap.data();
  if (!data.users?.includes(user.uid)) return res.status(403).json({ error: 'Not your friendship' });

  // Delete friendship
  await ref.delete();

  // Cleanup DM room
  const dmId = `dm_${pairId}`;
  await firestore.collection('chatRooms').doc(dmId).set({
    clearedBy: admin.firestore.FieldValue.arrayUnion(user.uid),
    hiddenFolderFor: admin.firestore.FieldValue.arrayUnion(user.uid),
    lastMessage: '', lastSenderId: '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  return res.json({ success: true, unfriended: targetId, pairId });
}
