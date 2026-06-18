# `/api` — Vercel Serverless Functions

Every file in this folder is auto-deployed by Vercel as an endpoint at
`/api/<filename>` — no extra config, no separate deploy step. Functions ship
together with the static site on every push to the connected GitHub repo.

Files are CommonJS (`module.exports = (req, res) => { ... }`) because the repo
has no root `package.json` with `"type": "module"`.

## Live now (no dependencies, no secrets needed)

- **`ping.js`** — health check that proves the pipeline works:
  `GET /api/ping` → `{ "ok": true, ... }`
- **`firebase-check.js`** — confirms the `FIREBASE_SERVICE_ACCOUNT` env var is
  set correctly: `GET /api/firebase-check` → `{ "ok": true, ... }`. It only
  inspects the shape of the credential and never returns any secret. Temporary
  diagnostic — safe to delete once it returns `ok: true`.

## The secret: `FIREBASE_SERVICE_ACCOUNT`

Privileged functions (ban / delete user, etc.) need Firebase Admin access. The
whole service-account JSON is stored as a SINGLE environment variable:

- **Where:** Vercel dashboard → Settings → Environment Variables (Production +
  Preview). **Never** commit it; never paste it anywhere it gets logged.
- **Name:** `FIREBASE_SERVICE_ACCOUNT`
- **Value:** the entire contents of the service-account `.json` file downloaded
  from Firebase Console → Project settings → Service accounts → *Generate new
  private key*.

In code, parse it once and init the Admin SDK:

```js
const admin = require('firebase-admin');
const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(svc) });
}
```

`JSON.parse` handles the `\n` inside `private_key` automatically — no manual
escaping needed.

## Next phase: privileged functions

When a real admin function lands, add `firebase-admin` to a root `package.json`
(Vercel installs it on build), verify the caller's Firebase ID token
(`Authorization: Bearer <token>` → `admin.auth().verifyIdToken(...)`), confirm
they're allowed, then act. Shared helpers can live in `_`-prefixed files, which
Vercel does not expose as public endpoints.
