/*
 * Shared firebase-admin initializer for Lambda functions (mirrors api/_admin.js).
 *
 * Expects two env vars:
 *   - FIREBASE_SERVICE_ACCOUNT  (full service-account JSON as a string)
 *   - FIREBASE_DATABASE_URL     (e.g. https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app)
 *
 * Reuses the same admin app across warm invocations so cold start is paid once.
 */
const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  let svc;
  try { svc = JSON.parse(raw); }
  catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON'); }
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    'https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app';
  admin.initializeApp({
    credential: admin.credential.cert(svc),
    databaseURL,
  });
  return admin;
}

module.exports = { getAdmin };
