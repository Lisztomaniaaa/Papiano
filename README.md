# Papiano

Online piano for phone touch, MIDI controller, and QWERTY keyboard.
Built with SoundFont instruments, falling notes, chord detection, profiles, chat, and multiplayer.

**Live:** https://papiano.fun

---

## Project Structure

```
Papiano/
│
├── index.html                  ← Main app (Solo Piano, Chat, Account)
├── multiplayer.html            ← Multiplayer mode (rooms, live play)
├── adminpanel.html             ← Admin panel (moderation, roles, donations)
│
├── api/
│   ├── admin.js                ← Vercel serverless function (Firebase Admin SDK)
│   └── README.md               ← API documentation
│
├── rules/
│   ├── firestore-rules.txt     ← Firestore security rules
│   ├── rtdb-rules.txt          ← Realtime Database rules
│   └── supabase-storage-rules.txt  ← Supabase Storage policies
│
├── vercel.json                 ← Vercel deployment config
├── package.json                ← Dependencies (firebase-admin)
├── stamp-version.js            ← Build script (writes version.json)
└── version.json                ← Auto-generated build version
```

---

## Tech Stack

| Layer | Service |
|---|---|
| Hosting | Vercel |
| Auth | Firebase Authentication (Google) |
| Database | Firestore + Firebase Realtime Database |
| Storage | Supabase Storage |
| Server Functions | Vercel Serverless (Node.js) |
| Icons | Material Symbols Rounded (Google Fonts CDN) |

---

## Pages

| File | URL | Description |
|---|---|---|
| `index.html` | `/` | Main app — piano, chat, account |
| `multiplayer.html` | `/multiplayer` | Multiplayer rooms |
| `adminpanel.html` | `/adminpanel` | Admin moderation panel |

---

## Admin API (`/api/admin`)

Server endpoint for operations requiring Firebase Admin SDK (bypasses rules):

| Action | Description |
|---|---|
| `assign-role` | Set user roles |
| `ban-user` | Disable auth + flag profile |
| `unban-user` | Re-enable auth |
| `delete-user` | Full data removal |
| `approve-donation` | Write verified donation |
| `set-claim` | Set Firebase Auth custom claims |

See [`api/README.md`](api/README.md) for usage.

---

## Environment Variables (Vercel Dashboard)

| Variable | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON |
| `PAPIANO_ADMIN_SECRET` | Secret token for admin API auth |

---

## Security Rules

Reference files in `rules/` folder — deploy by copy-pasting into respective consoles:

| File | Deploy to |
|---|---|
| `rules/firestore-rules.txt` | Firebase Console → Firestore → Rules |
| `rules/rtdb-rules.txt` | Firebase Console → Realtime Database → Rules |
| `rules/supabase-storage-rules.txt` | Supabase Dashboard → Storage → Policies |

---

## License

All rights reserved. Papiano / Lisztomania © 2026
