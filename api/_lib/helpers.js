/**
 * Shared helpers for all API routes:
 * - CORS handling
 * - Auth verification (admin secret OR Firebase ID token)
 * - Rate limiting (in-memory per cold start)
 * - Audit logging
 */
const { firestore, rtdb, admin } = require('./firebase');

// ─── CORS ───
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return true; }
  return false;
}

// ─── AUTH: Admin secret check ───
function requireAdmin(secret, res) {
  const ADMIN_SECRET = process.env.PAPIANO_ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ─── AUTH: Firebase ID token verification (for user-facing endpoints) ───
async function verifyUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const { auth } = require('./firebase');
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

// ─── RATE LIMITING (in-memory, resets on cold start) ───
const rateLimitStore = new Map();

function rateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.start > windowMs) {
    rateLimitStore.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  if (entry.count > maxRequests) return false;
  return true;
}

// ─── AUDIT LOG ───
async function auditLog(action, payload = {}, adminUid = 'system') {
  try {
    await rtdb.ref('adminLogs').push({
      action,
      payload,
      adminUid,
      createdAt: Date.now()
    });
  } catch {}
}

module.exports = { cors, requireAdmin, verifyUser, rateLimit, auditLog };
