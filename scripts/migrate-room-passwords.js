#!/usr/bin/env node
/*
 * scripts/migrate-room-passwords.js
 *
 * One-time backfill that closes the legacy plaintext-password leak.
 *
 * BACKGROUND
 * ----------
 * Older private rooms wrote their password as plaintext to
 *   papianoOnlineBeta/rooms/{roomId}/password
 * Every signed-in user can read that node (`rooms/.read: auth != null`),
 * so any registered account could harvest every private-room password
 * without ever attempting to join.
 *
 * The /api/private-room endpoint already migrates lazily — but only on the
 * first join attempt of each room. Until someone joins, the plaintext
 * stays exposed. This script does the migration eagerly for every room.
 *
 * WHAT IT DOES
 * ------------
 * For every room under papianoOnlineBeta/rooms with a non-empty `password`
 * field:
 *   1. If papianoOnlineBeta/roomSecrets/{roomId} is missing, write the
 *      SHA-256(roomId :: password) hash there (Admin-SDK only path, rules
 *      `.read: false` and `.write: false`).
 *   2. Wipe the plaintext at rooms/{roomId}/password = ''.
 *
 * The new RTDB rules also add `.validate: newData.val().length === 0` on
 * rooms/{id}/password, so no client can ever re-introduce a plaintext
 * password going forward.
 *
 * USAGE
 * -----
 *   FIREBASE_SERVICE_ACCOUNT='{...service account JSON...}' \
 *   FIREBASE_DATABASE_URL='https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app' \
 *   node scripts/migrate-room-passwords.js [--dry-run]
 *
 * Pass --dry-run to print what would change without touching the DB.
 *
 * The service account needs Realtime Database read/write — same role the
 * Vercel /api/private-room uses (FIREBASE_SERVICE_ACCOUNT).
 *
 * SAFE TO RE-RUN: the script is idempotent. Rooms that already have
 * empty password and an existing roomSecrets entry are skipped.
 */

const crypto = require('crypto');
const path = require('path');

// Reuse the same admin initializer the API uses, so this script picks up
// the same env vars and credentials as the deployed function.
const { getAdmin } = require(path.join('..', 'api', '_admin.js'));

const ROOM_ROOT = 'papianoOnlineBeta';
const DRY_RUN = process.argv.includes('--dry-run');

function hashPassword(password, roomId) {
  return crypto.createHash('sha256').update(`${roomId}::${password}`).digest('hex');
}

async function main() {
  const admin = getAdmin();
  const db = admin.database();

  const snap = await db.ref(`${ROOM_ROOT}/rooms`).get();
  if (!snap.exists()) {
    console.log('No rooms found. Nothing to migrate.');
    return;
  }
  const rooms = snap.val() || {};
  const roomIds = Object.keys(rooms);

  let scanned = 0;
  let migrated = 0;
  let wipedOnly = 0;
  let skipped = 0;

  for (const roomId of roomIds) {
    scanned += 1;
    const room = rooms[roomId] || {};
    const legacy = String(room.password || '');
    if (!legacy) { skipped += 1; continue; }

    const secretRef = db.ref(`${ROOM_ROOT}/roomSecrets/${roomId}`);
    const secretSnap = await secretRef.get();
    const secretExists = secretSnap.exists();

    if (DRY_RUN) {
      console.log(
        `[dry-run] room ${roomId}: ` +
        (secretExists ? 'wipe plaintext only' : 'bootstrap secret + wipe plaintext')
      );
      continue;
    }

    if (!secretExists) {
      // The legacy password was already truncated client-side at 48 chars
      // before being written to rooms/{id}/password, so hashing what's
      // there reproduces the same hash a fresh /api/private-room set
      // would produce for the same input.
      await secretRef.set({
        passwordHash: hashPassword(legacy.slice(0, 48), roomId),
        ownerUid: room.ownerUid || '',
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      });
      migrated += 1;
    } else {
      wipedOnly += 1;
    }

    await db.ref(`${ROOM_ROOT}/rooms/${roomId}/password`).set('');
  }

  console.log(JSON.stringify({
    scanned,
    migrated,         // rooms where roomSecrets was created from legacy plaintext
    wipedOnly,        // rooms where roomSecrets already existed; just wiped plaintext
    skipped,          // rooms with no legacy plaintext (already clean)
    dryRun: DRY_RUN,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('migration failed:', err && (err.stack || err.message || err));
    process.exit(1);
  });
