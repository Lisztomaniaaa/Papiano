# `/api` — Vercel Serverless Functions

Every file in this folder is auto-deployed by Vercel as an endpoint at
`/api/<filename>` — no extra config, no separate deploy step. Functions ship
together with the static site on every push to the connected GitHub repo.

Files are CommonJS (`module.exports = ...`). Files whose name starts with `_`
are **helpers**, not endpoints — Vercel does not expose them publicly.

## Endpoints

- **`private-room.js`** — server-side gate for private multiplayer rooms.
  `POST /api/private-room` with `{ action, idToken, roomId, password }`.
  - `action:'set'` — owner stores the SHA-256 password hash at
    `roomSecrets/{roomId}` (Admin-SDK-only) and wipes any legacy plaintext.
  - `action:'check'` — verifies the caller's Firebase ID token and password,
    then mints a short-lived grant at `roomGrants/{roomId}/{uid}` that the RTDB
    rules require before a join write into `roomPlayers` is allowed.

## Helpers

- **`_admin.js`** — lazily initialises the `firebase-admin` SDK once per warm
  instance and hands back the shared `admin` object.

## Required environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | The entire service-account `.json` (Firebase Console → Project settings → Service accounts → *Generate new private key*). Never commit it. `JSON.parse` handles the `\n` in `private_key` automatically. |
| `FIREBASE_DATABASE_URL` | `https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app` |

Privileged functions verify the caller's Firebase ID token
(`admin.auth().verifyIdToken(idToken)`) before acting — never trust a UID sent
in the body on its own.
