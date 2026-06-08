/**
 * Papiano Admin API — POST /api/admin
 * Secured by PAPIANO_ADMIN_SECRET.
 * Uses Firebase Admin SDK (bypasses all rules).
 */
const { admin, auth, firestore, rtdb } = require('./_lib/firebase');
const { cors, requireAdmin, auditLog } = require('./_lib/helpers');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const { action, secret, ...params } = req.body || {};
  if (!requireAdmin(secret, res)) return;

  try {
    switch (action) {
      case 'assign-role': return await assignRole(params, res);
      case 'ban-user': return await banUser(params, res);
      case 'unban-user': return await unbanUser(params, res);
      case 'delete-user': return await deleteUser(params, res);
      case 'approve-donation': return await approveDonation(params, res);
      case 'set-claim': return await setClaim(params, res);
      case 'search-users': return await searchUsers(params, res);
      case 'create-role': return await createRole(params, res);
      case 'delete-role': return await deleteRole(params, res);
      case 'gift-badge': return await giftBadge(params, res);
      case 'create-badge': return await createBadge(params, res);
      case 'delete-badge': return await deleteBadge(params, res);
      case 'admin-stats': return await adminStats(params, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[admin] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ─── EXISTING ACTIONS ───────────────────────────────────────────────────────

async function assignRole({ uid, roles }, res) {
  if (!uid || !Array.isArray(roles)) return res.status(400).json({ error: 'Missing uid or roles[]' });
  await firestore.collection('profiles').doc(uid).update({ ownedRoles: roles });
  await auditLog('assign-role', { uid, roles });
  return res.json({ success: true, uid, roles });
}

async function banUser({ uid, reason }, res) {
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  await auth.updateUser(uid, { disabled: true });
  await firestore.collection('profiles').doc(uid).update({
    banned: true, banReason: reason || 'Violation of community rules',
    bannedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await auditLog('ban-user', { uid, reason });
  return res.json({ success: true, uid, banned: true });
}

async function unbanUser({ uid }, res) {
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  await auth.updateUser(uid, { disabled: false });
  await firestore.collection('profiles').doc(uid).update({
    banned: admin.firestore.FieldValue.delete(),
    banReason: admin.firestore.FieldValue.delete(),
    bannedAt: admin.firestore.FieldValue.delete()
  });
  await auditLog('unban-user', { uid });
  return res.json({ success: true, uid, banned: false });
}

async function deleteUser({ uid }, res) {
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  await firestore.collection('profiles').doc(uid).delete();
  const friendships = await firestore.collection('friendships').where('users', 'array-contains', uid).get();
  const batch1 = firestore.batch();
  friendships.docs.forEach(doc => batch1.delete(doc.ref));
  if (friendships.docs.length) await batch1.commit();
  const blocksBy = await firestore.collection('blocks').where('blockerId', '==', uid).get();
  const blocksOf = await firestore.collection('blocks').where('blockedId', '==', uid).get();
  const batch2 = firestore.batch();
  blocksBy.docs.forEach(doc => batch2.delete(doc.ref));
  blocksOf.docs.forEach(doc => batch2.delete(doc.ref));
  if (blocksBy.docs.length || blocksOf.docs.length) await batch2.commit();
  await rtdb.ref(`papianoOnlineBeta/users/${uid}`).remove().catch(() => {});
  await rtdb.ref(`papianoOnlineBeta/ownerRooms/${uid}`).remove().catch(() => {});
  await auth.deleteUser(uid).catch(() => {});
  await auditLog('delete-user', { uid });
  return res.json({ success: true, uid, deleted: true });
}

async function approveDonation({ uid, name, amount, currency, note }, res) {
  if (!name || !amount) return res.status(400).json({ error: 'Missing name or amount' });
  const entry = {
    uid: uid || null, name, amount: Number(amount),
    currency: currency || 'USD', note: note || '',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(), visible: true
  };
  const ref = await firestore.collection('donations').add(entry);
  await auditLog('approve-donation', { uid, name, amount });
  return res.json({ success: true, donationId: ref.id });
}

async function setClaim({ uid, claims }, res) {
  if (!uid || !claims || typeof claims !== 'object') return res.status(400).json({ error: 'Missing uid or claims{}' });
  await auth.setCustomUserClaims(uid, claims);
  await auditLog('set-claim', { uid, claims });
  return res.json({ success: true, uid, claims });
}

// ─── NEW ACTIONS ────────────────────────────────────────────────────────────

/**
 * search-users
 * Params: { query, limit? }
 * Searches profiles by name, email, UID, or publicId.
 */
async function searchUsers({ query: q, limit: max }, res) {
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query too short (min 2 chars)' });
  const lim = Math.min(Number(max) || 20, 50);
  const results = [];

  // Search by UID exact match
  const byUid = await firestore.collection('profiles').doc(q).get();
  if (byUid.exists) results.push({ uid: byUid.id, ...byUid.data() });

  // Search by publicId (numeric)
  if (/^\d+$/.test(q)) {
    const byPublicId = await firestore.collection('profiles')
      .where('publicId', '==', Number(q)).limit(5).get();
    byPublicId.docs.forEach(doc => {
      if (!results.find(r => r.uid === doc.id)) results.push({ uid: doc.id, ...doc.data() });
    });
  }

  // Search by name prefix
  const searchName = q.toLowerCase().slice(0, 24);
  const byName = await firestore.collection('profiles')
    .orderBy('searchName').startAt(searchName).endAt(searchName + '\uf8ff').limit(lim).get();
  byName.docs.forEach(doc => {
    if (!results.find(r => r.uid === doc.id)) results.push({ uid: doc.id, ...doc.data() });
  });

  // Search Firebase Auth by email
  try {
    const userRecord = await auth.getUserByEmail(q);
    if (userRecord && !results.find(r => r.uid === userRecord.uid)) {
      const profile = await firestore.collection('profiles').doc(userRecord.uid).get();
      results.push({ uid: userRecord.uid, email: userRecord.email, ...(profile.exists ? profile.data() : {}) });
    }
  } catch {}

  return res.json({ success: true, results: results.slice(0, lim) });
}

/**
 * create-role
 * Params: { id, label, rarity?, color?, permissions? }
 * Writes role definition to RTDB roles/{id}.
 */
async function createRole({ id, label, rarity, color, permissions }, res) {
  if (!id || !label) return res.status(400).json({ error: 'Missing id or label' });
  const roleData = {
    label, rarity: rarity || 'common', color: color || '#60738e',
    permissions: permissions || [], createdAt: Date.now()
  };
  await rtdb.ref(`roles/${id}`).set(roleData);
  await auditLog('create-role', { id, label });
  return res.json({ success: true, id, role: roleData });
}

/**
 * delete-role
 * Params: { id }
 * Removes role from RTDB and strips it from all users who have it.
 */
async function deleteRole({ id }, res) {
  if (!id) return res.status(400).json({ error: 'Missing role id' });
  await rtdb.ref(`roles/${id}`).remove();
  // Remove role from users who have it in ownedRoles
  const usersWithRole = await firestore.collection('profiles')
    .where('ownedRoles', 'array-contains', id).get();
  const batch = firestore.batch();
  usersWithRole.docs.forEach(doc => {
    const current = doc.data().ownedRoles || [];
    batch.update(doc.ref, { ownedRoles: current.filter(r => r !== id) });
  });
  if (usersWithRole.docs.length) await batch.commit();
  await auditLog('delete-role', { id, affectedUsers: usersWithRole.docs.length });
  return res.json({ success: true, id, removedFrom: usersWithRole.docs.length });
}

/**
 * gift-badge
 * Params: { uid, roleId, expireAt? }
 * Adds a role/badge to user's ownedRoles array.
 */
async function giftBadge({ uid, roleId, expireAt }, res) {
  if (!uid || !roleId) return res.status(400).json({ error: 'Missing uid or roleId' });
  const profileRef = firestore.collection('profiles').doc(uid);
  const snap = await profileRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'User not found' });
  const current = snap.data().ownedRoles || [];
  if (!current.includes(roleId)) current.push(roleId);
  const update = { ownedRoles: current };
  if (expireAt) update[`roleExpiry_${roleId}`] = expireAt;
  await profileRef.update(update);
  await auditLog('gift-badge', { uid, roleId, expireAt });
  return res.json({ success: true, uid, roleId, ownedRoles: current });
}

/**
 * create-badge (alias for create-role with badge context)
 * Params: { id, label, rarity?, color? }
 */
async function createBadge({ id, label, rarity, color }, res) {
  return createRole({ id, label, rarity: rarity || 'rare', color, permissions: [] }, res);
}

/**
 * delete-badge (alias for delete-role)
 * Params: { id }
 */
async function deleteBadge({ id }, res) {
  return deleteRole({ id }, res);
}

/**
 * admin-stats
 * Returns dashboard statistics.
 */
async function adminStats(params, res) {
  const profilesSnap = await firestore.collection('profiles').get();
  const now = Date.now();
  const fiveMin = 5 * 60 * 1000;
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayMs = dayStart.getTime();

  let total = 0, online = 0, activeToday = 0, banned = 0, muted = 0, newToday = 0;
  profilesSnap.docs.forEach(doc => {
    const d = doc.data();
    total++;
    const lastSeen = d.lastSeenLocal || d.updatedAtLocal || 0;
    if (now - lastSeen < fiveMin) online++;
    if (lastSeen > dayMs) activeToday++;
    if (d.banned || d.isBanned) banned++;
    if (d.shadowMuted || d.isMuted) muted++;
    const created = d.createdAtLocal || d.createdAt?.toMillis?.() || 0;
    if (created > dayMs) newToday++;
  });

  const rolesSnap = await rtdb.ref('roles').once('value');
  const roleCount = Object.keys(rolesSnap.val() || {}).length;

  return res.json({
    success: true,
    stats: { total, online, activeToday, banned, muted, newToday, roleCount }
  });
}
