/*
 * Shared firebase-admin initializer. Vercel does NOT expose files whose name
 * starts with `_` as endpoints, so this is a safe helper module.
 *
 * Expects two env vars in the Vercel dashboard:
 *   - FIREBASE_SERVICE_ACCOUNT  (full service-account JSON as a string)
 *   - FIREBASE_DATABASE_URL     (e.g. https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app)
 *
 * Reuses the same admin app across warm invocations so cold start is paid once.
 */
const admin = require('firebase-admin');

let initError = null;

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    initError = new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
    throw initError;
  }
  let svc;
  try { svc = JSON.parse(raw); }
  catch (e) {
    initError = new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    throw initError;
  }
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
