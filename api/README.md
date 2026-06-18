# `/api` — Vercel Serverless Functions

Every file in this folder is auto-deployed by Vercel as an endpoint at
`/api/<filename>` — no extra config, no separate deploy step. Functions ship
together with the static site on every push to the connected GitHub repo.

Files are CommonJS (`module.exports = (req, res) => { ... }`) because the repo
has no root `package.json` with `"type": "module"`.

## Phase 1 (live now): `ping.js`

Health check that proves the pipeline works. No dependencies, no secrets:

```
GET https://<your-domain>/api/ping   ->   { "ok": true, ... }
```

If that returns JSON, Vercel Functions are live and later phases can build on it.

## Phase 2 (next): privileged functions

Anything that touches Firebase with **admin** rights (ban / delete user, set a
role, etc.) MUST run here — never in the browser — and MUST verify the caller
first. Pattern:

1. Add the dependency in a `package.json` at the repo root (Vercel installs it
   on build): `{ "dependencies": { "firebase-admin": "^12" } }`.
2. Set these in **Vercel dashboard → Settings → Environment Variables**. Never
   commit them and never send them to anyone — this is the security line:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (the service-account private key)
3. In the function: init `firebase-admin` from those env vars, read the
   `Authorization: Bearer <Firebase ID token>` header, call
   `admin.auth().verifyIdToken(token)`, confirm the caller is allowed, then act.

Shared helpers can live in files prefixed with `_` (e.g. `_admin.js`) — Vercel
does **not** expose underscore-prefixed files as public endpoints.
