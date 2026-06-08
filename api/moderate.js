/**
 * Papiano Moderation API — POST /api/moderate
 *
 * Admin actions (require PAPIANO_ADMIN_SECRET):
 *   maintenance-on    — Enable maintenance mode
 *   maintenance-off   — Disable maintenance mode
 *   announce          — Post announcement to announcement room
 *   clear-reports     — Clear processed reports
 *
 * User actions (require Firebase ID token):
 *   report-user       — Submit a user report (rate limited)
 *   block-user        — Block another user (server-validated)
 *   unblock-user      — Unblock a user
 */
const { admin, firestore, rtdb } = require('./_lib/firebase');
const { cors, requireAdmin, verifyUser, rateLimit, auditLog } = require('./_lib/helpers');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const { action, secret, ...params } = req.body || {};

  try {
    // Admin actions
    if (['maintenance-on', 'maintenance-off', 'announce', 'clear-reports'].includes(action)) {
      if (!requireAdmin(secret, res)) return;
      switch (action) {
        case 'maintenance-on': return await maintenanceOn(params, res);
        case 'maintenance-off': return await maintenanceOff(res);
        case 'announce': return await announce(params, res);
        case 'clear-reports': return await clearReports(params, res);
      }
    }

    // User actions
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Invalid or missing auth token' });

    switch (action) {
      case 'report-user': return await reportUser(user, params, res);
      case 'block-user': return await blockUser(user, params, res);
      case 'unblock-user': return await unblockUser(user, params, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[moderate] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ─── ADMIN ACTIONS ──────────────────────────────────────────────────────────

async function maintenanceOn({ reason }, res) {
  await rtdb.ref('appConfig/maintenanceMode').set({
    enabled: true, reason: reason || 'Scheduled maintenance', enabledAt: Date.now()
  });
  await auditLog('maintenance-on', { reason });
  return res.json({ success: true, maintenance: true });
}

async function maintenanceOff(res) {
  await rtdb.ref('appConfig/maintenanceMode').remove();
  await auditLog('maintenance-off', {});
  return res.json({ success: true, maintenance: false });
}

/**
 * announce
 * Params: { text, imageUrl? }
 * Posts to Firestore chatRooms/group_announcements/messages.
 */
async function announce({ text, imageUrl }, res) {
  if (!text || text.length < 1) return res.status(400).json({ error: 'Missing announcement text' });
  if (text.length > 1000) return res.status(400).json({ error: 'Announcement too long (max 1000)' });

  const message = {
    senderId: 'system',
    senderName: 'Papiano',
    text: text.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtLocal: Date.now(),
    isAnnouncement: true
  };
  if (imageUrl) message.imageUrl = imageUrl;

  const ref = await firestore.collection('chatRooms').doc('group_announcements')
    .collection('messages').add(message);
  await auditLog('announce', { text: text.slice(0, 100) });
  return res.json({ success: true, messageId: ref.id });
}

async function clearReports({ status }, res) {
  const query = status
    ? firestore.collection('reports').where('status', '==', status)
    : firestore.collection('reports');
  const snap = await query.limit(500).get();
  const batch = firestore.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  if (snap.docs.length) await batch.commit();
  await auditLog('clear-reports', { count: snap.docs.length, status });
  return res.json({ success: true, deleted: snap.docs.length });
}

// ─── USER ACTIONS ───────────────────────────────────────────────────────────

/**
 * report-user
 * Params: { targetId, reason }
 * Rate limited: 5 reports per hour per user.
 */
async function reportUser(user, { targetId, reason }, res) {
  if (!targetId || !reason) return res.status(400).json({ error: 'Missing targetId or reason' });
  if (targetId === user.uid) return res.status(400).json({ error: 'Cannot report yourself' });
  if (reason.length > 500) return res.status(400).json({ error: 'Reason too long (max 500)' });

  // Rate limit: 5 reports per hour
  if (!rateLimit(`report:${user.uid}`, 5, 3600000)) {
    return res.status(429).json({ error: 'Too many reports. Try again later.' });
  }

  // Check if already reported this user recently
  const existing = await firestore.collection('reports')
    .where('reporterId', '==', user.uid)
    .where('targetId', '==', targetId)
    .limit(1).get();
  if (!existing.empty) {
    return res.status(400).json({ error: 'You already reported this user.' });
  }

  const report = {
    reporterId: user.uid,
    targetId,
    reason: reason.trim(),
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtLocal: Date.now()
  };

  const ref = await firestore.collection('reports').add(report);
  return res.json({ success: true, reportId: ref.id });
}

/**
 * block-user
 * Params: { targetId }
 * Server-validated block with duplicate prevention.
 */
async function blockUser(user, { targetId }, res) {
  if (!targetId) return res.status(400).json({ error: 'Missing targetId' });
  if (targetId === user.uid) return res.status(400).json({ error: 'Cannot block yourself' });

  // Rate limit: 20 blocks per hour
  if (!rateLimit(`block:${user.uid}`, 20, 3600000)) {
    return res.status(429).json({ error: 'Too many block actions.' });
  }

  const blockId = [user.uid, targetId].sort().join('_');

  // Check existing
  const existing = await firestore.collection('blocks').doc(blockId).get();
  if (existing.exists && existing.data().blockerId === user.uid) {
    return res.json({ success: true, alreadyBlocked: true });
  }

  await firestore.collection('blocks').doc(blockId).set({
    blockerId: user.uid,
    blockedId: targetId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Also remove any existing friendship
  const pairId = [user.uid, targetId].sort().join('_');
  await firestore.collection('friendships').doc(pairId).delete().catch(() => {});

  return res.json({ success: true, blocked: targetId });
}

/**
 * unblock-user
 * Params: { targetId }
 */
async function unblockUser(user, { targetId }, res) {
  if (!targetId) return res.status(400).json({ error: 'Missing targetId' });
  const blockId = [user.uid, targetId].sort().join('_');
  const doc = await firestore.collection('blocks').doc(blockId).get();
  if (!doc.exists) return res.json({ success: true, wasNotBlocked: true });
  if (doc.data().blockerId !== user.uid) return res.status(403).json({ error: 'Not your block' });
  await firestore.collection('blocks').doc(blockId).delete();
  return res.json({ success: true, unblocked: targetId });
}
