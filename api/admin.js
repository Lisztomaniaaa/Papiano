/**
 * Papiano Admin API — Vercel Serverless Function
 * POST /api/admin
 *
 * Secured by PAPIANO_ADMIN_SECRET env var.
 * Uses Firebase Admin SDK (bypasses all Firestore/RTDB/Auth rules).
 *
 * Actions:
 *   assign-role     — Set role(s) on a user profile
 *   ban-user        — Ban a user (disable auth + flag profile)
 *   unban-user      — Unban a user (re-enable auth + remove flag)
 *   delete-user     — Delete all user data (profile, friendships, messages, auth)
 *   approve-donation— Write a verified donation entry to the donations collection
 *   set-claim       — Set custom auth claims (e.g. moderator, vip)
 *
 * Request body (JSON):
 *   { "action": "...", "secret": "...", ...params }
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (once per cold start)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

const auth = admin.auth();
const firestore = admin.firestore();
const rtdb = admin.database();

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, secret, ...params } = req.body || {};

  // Auth check
  const ADMIN_SECRET = process.env.PAPIANO_ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (action) {
      case 'assign-role':
        return await assignRole(params, res);
      case 'ban-user':
        return await banUser(params, res);
      case 'unban-user':
        return await unbanUser(params, res);
      case 'delete-user':
        return await deleteUser(params, res);
      case 'approve-donation':
        return await approveDonation(params, res);
      case 'set-claim':
        return await setClaim(params, res);
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[admin] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ─── ACTIONS ────────────────────────────────────────────────────────────────

/**
 * assign-role
 * Params: { uid, roles: ['moderator', 'vip', ...] }
 * Updates profile.ownedRoles array in Firestore.
 */
async function assignRole({ uid, roles }, res) {
  if (!uid || !Array.isArray(roles)) {
    return res.status(400).json({ error: 'Missing uid or roles[]' });
  }
  await firestore.collection('profiles').doc(uid).update({ ownedRoles: roles });
  return res.json({ success: true, uid, roles });
}

/**
 * ban-user
 * Params: { uid, reason? }
 * Disables Firebase Auth account + flags profile.
 */
async function banUser({ uid, reason }, res) {
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  await auth.updateUser(uid, { disabled: true });
  await firestore.collection('profiles').doc(uid).update({
    banned: true,
    banReason: reason || 'Violation of community rules',
    bannedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return res.json({ success: true, uid, banned: true });
}

/**
 * unban-user
 * Params: { uid }
 * Re-enables Firebase Auth account + removes ban flag.
 */
async function unbanUser({ uid }, res) {
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  await auth.updateUser(uid, { disabled: false });
  await firestore.collection('profiles').doc(uid).update({
    banned: admin.firestore.FieldValue.delete(),
    banReason: admin.firestore.FieldValue.delete(),
    bannedAt: admin.firestore.FieldValue.delete()
  });
  return res.json({ success: true, uid, banned: false });
}

/**
 * delete-user
 * Params: { uid }
 * Removes: profile doc, auth account, friendships, blocks, RTDB presence.
 */
async function deleteUser({ uid }, res) {
  if (!uid) return res.status(400).json({ error: 'Missing uid' });

  // Delete Firestore profile
  await firestore.collection('profiles').doc(uid).delete();

  // Delete friendships involving this user
  const friendships = await firestore.collection('friendships')
    .where('users', 'array-contains', uid).get();
  const batch1 = firestore.batch();
  friendships.docs.forEach(doc => batch1.delete(doc.ref));
  if (friendships.docs.length) await batch1.commit();

  // Delete blocks by/against this user
  const blocksBy = await firestore.collection('blocks')
    .where('blockerId', '==', uid).get();
  const blocksOf = await firestore.collection('blocks')
    .where('blockedId', '==', uid).get();
  const batch2 = firestore.batch();
  blocksBy.docs.forEach(doc => batch2.delete(doc.ref));
  blocksOf.docs.forEach(doc => batch2.delete(doc.ref));
  if (blocksBy.docs.length || blocksOf.docs.length) await batch2.commit();

  // Delete RTDB user presence
  await rtdb.ref(`papianoOnlineBeta/users/${uid}`).remove().catch(() => {});
  await rtdb.ref(`papianoOnlineBeta/ownerRooms/${uid}`).remove().catch(() => {});

  // Delete Firebase Auth account
  await auth.deleteUser(uid).catch(() => {});

  return res.json({ success: true, uid, deleted: true });
}

/**
 * approve-donation
 * Params: { uid, name, amount, currency?, note? }
 * Writes a verified donation entry.
 */
async function approveDonation({ uid, name, amount, currency, note }, res) {
  if (!name || !amount) {
    return res.status(400).json({ error: 'Missing name or amount' });
  }
  const entry = {
    uid: uid || null,
    name,
    amount: Number(amount),
    currency: currency || 'USD',
    note: note || '',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    visible: true
  };
  const ref = await firestore.collection('donations').add(entry);
  return res.json({ success: true, donationId: ref.id });
}

/**
 * set-claim
 * Params: { uid, claims: { moderator: true, vip: true, ... } }
 * Sets Firebase Auth custom claims for role-based access.
 */
async function setClaim({ uid, claims }, res) {
  if (!uid || !claims || typeof claims !== 'object') {
    return res.status(400).json({ error: 'Missing uid or claims{}' });
  }
  await auth.setCustomUserClaims(uid, claims);
  return res.json({ success: true, uid, claims });
}
