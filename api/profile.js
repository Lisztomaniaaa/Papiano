/**
 * Papiano Profile API — POST /api/profile
 *
 * User actions (require Firebase ID token):
 *   update           — Update profile (server-validated, strips ownedRoles)
 *   sync-playtime    — Sync play time with anti-cheat (alias for /api/playtime)
 */
const { admin, firestore } = require('./_lib/firebase');
const { cors, verifyUser, rateLimit } = require('./_lib/helpers');

// Basic profanity check for names
const NAME_BLOCKED = [
  /n[i1]gg/i, /f[a@]gg/i, /\bkys\b/i, /\brape\b/i, /\bpedo\b/i,
  /\bnazi\b/i, /admin/i, /moderator/i, /papiano\s*(team|staff|dev)/i
];

function isNameClean(name) {
  return !NAME_BLOCKED.some(p => p.test(name));
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const { action, ...params } = req.body || {};

  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Invalid or missing auth token' });

    switch (action) {
      case 'update': return await updateProfile(user, params, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[profile] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * update
 * Params: { name, desc?, roleId?, photoURL?, countryCode? }
 * Server validates all fields. Strips ownedRoles, playTimeSeconds, and admin fields.
 */
async function updateProfile(user, { name, desc, roleId, photoURL, countryCode }, res) {
  // Rate limit: 5 profile updates per minute
  if (!rateLimit(`profile:${user.uid}`, 5, 60000)) {
    return res.status(429).json({ error: 'Too many updates. Wait a moment.' });
  }

  // Validate name
  const cleanName = String(name || '').trim().slice(0, 24);
  if (cleanName.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
  if (!isNameClean(cleanName)) return res.status(400).json({ error: 'Name contains inappropriate content' });

  // Validate desc
  const cleanDesc = String(desc || '').trim().slice(0, 160);

  // Validate countryCode
  const cleanCountry = String(countryCode || '').toUpperCase().slice(0, 2);
  if (cleanCountry && !/^[A-Z]{2}$/.test(cleanCountry)) {
    return res.status(400).json({ error: 'Invalid country code' });
  }

  // Validate photoURL
  const cleanPhoto = String(photoURL || '').trim().slice(0, 512);
  if (cleanPhoto && !cleanPhoto.startsWith('https://')) {
    return res.status(400).json({ error: 'Photo URL must be HTTPS' });
  }

  // Validate roleId against user's ownedRoles
  const profileRef = firestore.collection('profiles').doc(user.uid);
  const existing = await profileRef.get();
  const existingData = existing.exists ? existing.data() : {};
  const ownedRoles = existingData.ownedRoles || ['common'];
  const safeRoleId = ownedRoles.includes(roleId) ? roleId : 'common';

  // Build safe update (NEVER allow client to set ownedRoles, playTimeSeconds, banned, etc.)
  const update = {
    name: cleanName,
    searchName: cleanName.toLowerCase(),
    desc: cleanDesc,
    roleId: safeRoleId,
    badgeId: safeRoleId,
    countryCode: cleanCountry || (existingData.countryCode || ''),
    photoURL: cleanPhoto || (existingData.photoURL || ''),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await profileRef.set(update, { merge: true });

  return res.json({ success: true, profile: { ...update, uid: user.uid, ownedRoles } });
}
