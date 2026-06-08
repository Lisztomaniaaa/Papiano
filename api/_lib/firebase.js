/**
 * Shared Firebase Admin initialization — imported by all API routes.
 */
const admin = require('firebase-admin');

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

module.exports = { admin, auth, firestore, rtdb };
