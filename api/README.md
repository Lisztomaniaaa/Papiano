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

- **`botchat.js`** — server side of the `/papiano` AI chatbot, triggered from
  chat when a message starts with `/papiano <prompt>` (global chat, VIP chat,
  or a multiplayer room). `POST /api/botchat` with `{ idToken, roomId, prompt }`.
  - Verifies the caller's Firebase ID token, then re-checks server-side that
    `roomId` is one of `'group_global'`, `'group_vip'` (caller must actually be
    VIP/admin-allowlisted), or a multiplayer room the caller has joined —
    never trusts the client's claimed room for a privileged write.
  - Per-uid throttle at `botThrottle/{uid}` (Admin-SDK-only) caps calls to one
    every 12s; returns `429` with `Retry-After` when exceeded.
  - Calls OpenRouter (`OPENROUTER_API_KEY`) using the `@preset/papiano` preset
    (or `OPENROUTER_MODEL` override) — the preset on the OpenRouter dashboard
    owns the model choice, system prompt/persona, and sampling params, so none
    of that is duplicated server-side here.
  - Writes the reply back as a synthetic `Papiano` sender via the Admin SDK
    (Firestore `chatRooms/{roomId}/messages` for global/VIP, RTDB
    `papianoOnlineBeta/messages/{roomId}` for multiplayer rooms), bypassing the
    normal sender-must-equal-auth-uid rules.

## Helpers

- **`_admin.js`** — lazily initialises the `firebase-admin` SDK once per warm
  instance and hands back the shared `admin` object.

## Required environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | The entire service-account `.json` (Firebase Console → Project settings → Service accounts → *Generate new private key*). Never commit it. `JSON.parse` handles the `\n` in `private_key` automatically. |
| `FIREBASE_DATABASE_URL` | `https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `OPENROUTER_API_KEY` | Required for `botchat.js`. From the OpenRouter dashboard after topping up credit. Server-side only — never sent to or visible in the browser. |
| `OPENROUTER_MODEL` | Optional. Defaults to `@preset/papiano` (the OpenRouter preset that carries the model/persona/params). Override only to point at a different preset or a raw model slug. |

Privileged functions verify the caller's Firebase ID token
(`admin.auth().verifyIdToken(idToken)`) before acting — never trust a UID sent
in the body on its own.
