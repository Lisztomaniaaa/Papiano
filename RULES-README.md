# Firebase Security Rules — DRAFT (review & test before deploying)

These two files close the audit's **#1 finding**: today every authority decision
(admin access, role grants, moderation/ban, the admin "Reset Zone") is enforced
**only in client-side JavaScript**, so any signed-in user can bypass it from the
browser console. The repo had **no rules at all**.

- `firestore.rules` — profiles, chat, reports, donations
- `database.rules.json` — RTDB: roles, presence, rooms, moderation, bans, admin log

> ⚠️ **These are starting drafts, not a finished policy.** They lock the
> *critical* escalation paths while leaving normal room/chat flows permissive so
> the app keeps working. **Test every flow in the Firebase Rules Playground / the
> emulator before publishing** — any write path the app uses that isn't covered
> will start failing in production.

## Step 1 — Set the `admin` custom claim (REQUIRED first)

The rules trust `request.auth.token.admin == true`, **not** the email allow‑list
or `badgeId:'dev'`. If you publish the rules without setting this claim, the
admin panel can no longer write. Set it once per admin account with the Admin SDK:

```js
// run once, e.g. in a trusted Node script or a callable Cloud Function
const admin = require('firebase-admin');
admin.initializeApp();
const ADMIN_UIDS = ['<uid-of-utamairfan44>', '<uid-of-akunpolos0444000>', '<uid-of-papianobase>'];
await Promise.all(ADMIN_UIDS.map(uid => admin.auth().setCustomUserClaims(uid, { admin: true })));
```

The admin then signs out/in once (or call `getIdToken(true)`) to pick up the claim.

## Step 2 — Deploy

```bash
npm i -g firebase-tools
firebase login
# firebase.json should point at these files:
#   { "firestore": { "rules": "firestore.rules" },
#     "database": { "rules": "database.rules.json" } }
firebase deploy --only firestore:rules,database
```

## What the drafts lock vs. leave open

| Path | Policy |
|---|---|
| `profiles/{uid}` `badgeId`/`roleId`/`ownedRoles` | only **admin** can change (kills the self‑promote‑to‑dev hole) |
| RTDB `roles`, `bans`, `adminLog` | admin‑only write |
| RTDB `moderation/{room}` | **room owner or admin** only (was: anyone) |
| `deletedAccounts/{uid}` | the user themselves or admin |
| `reports`, `donations` (FS) | admin‑only read/write (donations world‑readable) |
| chat messages | author writes own; admin moderates any |
| rooms / players / seats / streams / presence | any signed‑in user (kept permissive so play works) |

## Still recommended after this (not covered by rules alone)

- **Room passwords are plaintext** in `rooms/{id}` and broadcast to everyone.
  Move join‑auth to a Cloud Function or store a hash the client can't read.
- **App Check** + **Email Enumeration Protection** in the Firebase console to
  curb abuse/brute‑force.
- Optionally enforce `request.auth.token.email_verified == true` on chat/room
  writes once you confirm all active accounts are verified.
