/*
 * /api/dev-keys — admin-only issuing of API keys for fellow developers who
 * want to call /api/transcribe directly with their own quota, instead of
 * sharing the anonymous-IP / signed-in-user limits meant for end users.
 *
 *   POST { action:'create', idToken, label, dailyLimit }
 *     -> 200 { ok:true, key, keyId } — `key` (raw, "papi_dev_<hex>") is
 *        returned ONCE and never stored; only its SHA-256 hash is kept.
 *   POST { action:'list', idToken }
 *     -> 200 { ok:true, keys:[{keyId,label,dailyLimit,revoked,createdAt}] }
 *   POST { action:'revoke', idToken, keyId }
 *     -> 200 { ok:true }
 *
 * Caller must be an admin: email in ADMIN_GATE_EMAILS, or Firestore
 * profiles/{uid}.role (or legacy badgeId) is 'admin'/'dev' — the same gate
 * admin.html itself uses to grant access to the admin panel.
 */
const crypto = require('crypto');
const { getAdmin } = require('./_admin');

const ADMIN_GATE_EMAILS = new Set([
  'utamairfan44@gmail.com',
  'akunpolos0444000@gmail.com',
  'papianobase@gmail.com',
]);

const KEY_ROOT = 'devApiKeys';
const LABEL_MAX_LEN = 60;
const DEFAULT_DAILY_LIMIT = 20;
const MAX_DAILY_LIMIT = 5000;

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

function genKey() {
  return 'papi_dev_' + crypto.randomBytes(32).toString('hex');
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function isAdminCaller(admin, uid, email) {
  if (ADMIN_GATE_EMAILS.has(String(email || '').toLowerCase())) return true;
  const doc = await admin.firestore().collection('profiles').doc(uid).get();
  if (!doc.exists) return false;
  const data = doc.data() || {};
  const role = String(data.role || data.badgeId || '').toLowerCase();
  return role === 'admin' || role === 'dev';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'POST only' });
  }

  let admin;
  try { admin = getAdmin(); }
  catch {
    return res.status(500).json({ ok: false, reason: 'server not configured' });
  }

  try {
    const body = await readBody(req);
    const action = String(body?.action || '');
    const idToken = String(body?.idToken || '');
    if (!action || !idToken) {
      return res.status(400).json({ ok: false, reason: 'missing fields' });
    }

    let uid, email;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken, true);
      uid = decoded.uid;
      email = decoded.email;
    } catch {
      return res.status(401).json({ ok: false, reason: 'bad token' });
    }

    if (!(await isAdminCaller(admin, uid, email))) {
      return res.status(403).json({ ok: false, reason: 'admin only' });
    }

    const db = admin.database();

    if (action === 'create') {
      const label = String(body?.label || '').trim().slice(0, LABEL_MAX_LEN);
      if (!label) return res.status(400).json({ ok: false, reason: 'label required' });

      let dailyLimit = parseInt(body?.dailyLimit, 10);
      if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) dailyLimit = DEFAULT_DAILY_LIMIT;
      dailyLimit = Math.min(dailyLimit, MAX_DAILY_LIMIT);

      const rawKey = genKey();
      const hash = hashKey(rawKey);
      await db.ref(`${KEY_ROOT}/${hash}`).set({
        label,
        dailyLimit,
        revoked: false,
        createdAt: admin.database.ServerValue.TIMESTAMP,
        createdBy: uid,
      });
      return res.status(200).json({ ok: true, key: rawKey, keyId: hash });
    }

    if (action === 'list') {
      const snap = await db.ref(KEY_ROOT).get();
      const all = snap.val() || {};
      const keys = Object.entries(all)
        .map(([keyId, v]) => ({
          keyId,
          label: v.label,
          dailyLimit: v.dailyLimit,
          revoked: !!v.revoked,
          createdAt: v.createdAt || 0,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      return res.status(200).json({ ok: true, keys });
    }

    if (action === 'revoke') {
      const keyId = String(body?.keyId || '');
      if (!/^[0-9a-f]{64}$/i.test(keyId)) return res.status(400).json({ ok: false, reason: 'bad keyId' });
      const ref = db.ref(`${KEY_ROOT}/${keyId}`);
      const snap = await ref.get();
      if (!snap.exists()) return res.status(404).json({ ok: false, reason: 'not found' });
      await ref.update({ revoked: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, reason: 'unknown action' });
  } catch (e) {
    console.error('dev-keys error', e?.message || e);
    return res.status(500).json({ ok: false, reason: 'server error' });
  }
};
