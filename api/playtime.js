/**
 * Papiano Play Time API — POST /api/playtime
 *
 * User action (requires Firebase ID token):
 *   update   — Update play time with server-side anti-cheat validation
 *
 * Anti-cheat measures:
 * - Max increment per request: 5 minutes (300 seconds)
 * - Rate limit: 1 update per 60 seconds per user
 * - Server tracks lastUpdateTime to prevent time skipping
 * - Rejects impossibly large jumps
 */
const { admin, firestore } = require('./_lib/firebase');
const { cors, verifyUser, rateLimit } = require('./_lib/helpers');

const MAX_INCREMENT_SECONDS = 300; // 5 minutes max per update
const MIN_INTERVAL_MS = 55000;     // At least ~1 min between updates

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const { action, ...params } = req.body || {};

  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Invalid or missing auth token' });

    switch (action) {
      case 'update': return await updatePlayTime(user, params, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(`[playtime] ${action} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * update
 * Params: { seconds }
 * Adds seconds to user's playTimeSeconds (server-validated).
 */
async function updatePlayTime(user, { seconds }, res) {
  const increment = Number(seconds);

  // Validate increment
  if (!increment || increment <= 0 || !Number.isFinite(increment)) {
    return res.status(400).json({ error: 'Invalid seconds value' });
  }
  if (increment > MAX_INCREMENT_SECONDS) {
    return res.status(400).json({ error: `Max increment is ${MAX_INCREMENT_SECONDS}s per update` });
  }

  // Rate limit: 1 update per minute per user
  if (!rateLimit(`playtime:${user.uid}`, 1, MIN_INTERVAL_MS)) {
    return res.status(429).json({ error: 'Too frequent. Update every 60s.' });
  }

  // Read current profile
  const profileRef = firestore.collection('profiles').doc(user.uid);
  const snap = await profileRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'Profile not found' });

  const profile = snap.data();
  const currentTotal = Number(profile.playTimeSeconds) || 0;
  const lastUpdate = Number(profile.playTimeLastUpdate) || 0;
  const now = Date.now();

  // Anti-cheat: if lastUpdate is very recent (less than 50s ago), reject
  if (lastUpdate && now - lastUpdate < 50000) {
    return res.status(429).json({ error: 'Update too soon after last sync' });
  }

  // Apply increment
  const newTotal = currentTotal + Math.floor(increment);

  await profileRef.update({
    playTimeSeconds: newTotal,
    playTimeLastUpdate: now
  });

  return res.json({ success: true, playTimeSeconds: newTotal });
}
