# Firebase Security Rules

Two files:

- `firestore.rules` — profiles, chat, friendships, blocks, reports, donations
- `database.rules.json` — Realtime Database (roles, presence, rooms, moderation, bans, admin log, donations)

## Admins

Admins are matched by email inside the rules, so the admin panel works with no
extra setup. The allowed accounts are:

- `utamairfan44@gmail.com`
- `akunpolos0444000@gmail.com`
- `papianobase@gmail.com`

To change the admin list, edit the email arrays in `firestore.rules` and
`database.rules.json` (and re-deploy). A `request.auth.token.admin == true`
custom claim is also accepted if you prefer claims later.

## Deploy

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules,database
```

## What is enforced

- A user can edit their own profile but cannot grant themselves a role: `badgeId`
  and `roleId` may only be set to a role already in their `ownedRoles`, and
  `ownedRoles` is admin-only. This closes the self-promote-to-admin path.
- `roles`, `bans`, `adminLog` and donations are admin-only writes.
- Room moderation (`moderation/{roomId}`) is limited to the room owner or an admin.
- Likes/dislikes, friends, blocks, DM clearing and chat all work for any signed-in
  user, which keeps the profile and chat features functional.

Room passwords are still stored in plaintext under `rooms/{id}`; move join-auth to
a Cloud Function if that matters for your threat model.
