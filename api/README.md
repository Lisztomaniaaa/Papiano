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

- **`botchat.js`** — server side of the `/askpapiano` AI chatbot, triggered from
  chat when a message starts with `/askpapiano <prompt>` (global chat, VIP chat,
  or a multiplayer room), or when a reply with no prefix targets one of the
  bot's own prior messages (reply-to-continue — see below). `POST /api/botchat`
  with `{ idToken, roomId, prompt, priorBotText? }`.
  - Verifies the caller's Firebase ID token, then re-checks server-side that
    `roomId` is one of `'group_global'`, `'group_vip'` (caller must actually be
    VIP/admin-allowlisted), or a multiplayer room the caller has joined —
    never trusts the client's claimed room for a privileged write.
  - Per-uid throttle at `botThrottle/{uid}` (Admin-SDK-only) caps calls to one
    every 12s; returns `429` with `Retry-After` when exceeded.
  - Calls OpenRouter (`PAPIANOAI_API`) using the `@preset/papiano` preset
    (or `OPENROUTER_MODEL` override) — the preset on the OpenRouter dashboard
    owns the model choice, system prompt/persona, and sampling params, so none
    of that is duplicated server-side here.
  - **Reply-to-continue**: replying to one of the bot's own chat messages (no
    `/askpapiano` prefix needed) continues the conversation — the client sends
    the bot's immediately-prior reply text as `priorBotText` (light, single-hop
    context only; no multi-message history, no server-side fetches), and the
    server sends it to OpenRouter as one extra `assistant`-role turn ahead of
    the new prompt.
  - Writes the reply back as a synthetic `Papiano` sender via the Admin SDK
    (Firestore `chatRooms/{roomId}/messages` for global/VIP, RTDB
    `papianoOnlineBeta/messages/{roomId}` for multiplayer rooms), bypassing the
    normal sender-must-equal-auth-uid rules.

- **`transcribe.js`** — server-side proxy to the external audio-midi
  (Modal) transcription service for the visualizer's audio-to-notes
  pipeline. The browser never holds the Modal API key and never calls
  Modal directly.
  `POST /api/transcribe` with raw audio bytes, `Content-Type` set to the
  audio mime.
  - No rate-limiting/abuse gate currently — every request is forwarded to
    Modal as long as it passes the basic checks below. (Was previously
    gated by per-IP/per-uid throttling; removed at the project owner's
    request while iterating. Re-add before any wider rollout.)
  - Rejects audio over 15 MB and disallowed content types before ever
    contacting Modal.
  - Re-encodes the audio as `{ audio_base64 }` JSON and forwards it to
    `MODAL_TRANSCRIBE_URL` with header `X-API-Key: ${MODAL_API_KEY}`,
    matching the audio-midi service's contract (`POST /transcribe` ->
    `{ notes, pedals, midi_base64 }`), with a 45s timeout; upstream errors
    are logged server-side and returned to the client as a generic `502`,
    never leaking Modal's response body.

## Helpers

- **`_admin.js`** — lazily initialises the `firebase-admin` SDK once per warm
  instance and hands back the shared `admin` object.

## Required environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | The entire service-account `.json` (Firebase Console → Project settings → Service accounts → *Generate new private key*). Never commit it. `JSON.parse` handles the `\n` in `private_key` automatically. |
| `FIREBASE_DATABASE_URL` | `https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `PAPIANOAI_API` | Required for `botchat.js`. The OpenRouter API key, from the OpenRouter dashboard after topping up credit. Server-side only — never sent to or visible in the browser. |
| `OPENROUTER_MODEL` | Optional. Defaults to `@preset/papiano` (the OpenRouter preset that carries the model/persona/params). Override only to point at a different preset or a raw model slug. |
| `MODAL_TRANSCRIBE_URL` | Required for `transcribe.js`. The deployed Modal web endpoint for the audio-midi transcription service, e.g. `https://<workspace>--papiano-transcribe-web.modal.run/transcribe`. |
| `MODAL_API_KEY` | Required for `transcribe.js`. Sent as `X-API-Key: ${MODAL_API_KEY}` to the Modal endpoint — must match the shared secret the Modal app checks. Server-side only — never sent to or visible in the browser. |

Privileged functions verify the caller's Firebase ID token
(`admin.auth().verifyIdToken(idToken)`) before acting — never trust a UID sent
in the body on its own.
