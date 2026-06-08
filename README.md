# Papiano

Online piano for phone touch, MIDI controller, and QWERTY keyboard. Built with SoundFont instruments, falling notes, chord detection, profiles, chat, and multiplayer.

**Live:** https://papiano.fun

---

## Project Structure

```
Papiano/
├── index.html              # Main app (Solo Piano, Chat, Account)
├── multiplayer.html        # Multiplayer mode (rooms, live play)
├── adminpanel.html         # Admin panel (moderation, roles, donations)
├── api/
│   └── admin.js            # Vercel serverless function (Firebase Admin SDK)
├── vercel.json             # Vercel deployment config
├── package.json            # Dependencies (firebase-admin)
├── stamp-version.js        # Build script — writes version.json
├── version.json            # Auto-generated build version
├── firestore-rules.txt     # Firestore security rules (paste in Firebase Console)
├── rtdb-rules.txt          # Realtime Database rules (paste in Firebase Console)
└── supabase-storage-rules.txt  # Supabase Storage policies
```

## Tech Stack

| Layer | Service |
|---|---|
| Hosting | Vercel |
| Auth | Firebase Authentication (Google) |
| Database | Firestore + Firebase Realtime Database |
| Storage | Supabase Storage |
| Server Functions | Vercel Serverless (Node.js) |
| Icons | Material Symbols Rounded (Google Fonts CDN) |
| Fonts | Inter, Plus Jakarta Sans, Space Grotesk, Bricolage Grotesque, Anybody |

## Admin API

Server endpoint at `/api/admin` for operations requiring Firebase Admin SDK:

- **assign-role** — set user roles
- **ban-user** — disable auth + flag profile
- **unban-user** — re-enable auth
- **delete-user** — full data removal
- **approve-donation** — write verified donation
- **set-claim** — set Firebase Auth custom claims

See [`api/README.md`](api/README.md) for full docs.

## Environment Variables (Vercel)

| Variable | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON |
| `PAPIANO_ADMIN_SECRET` | Secret token for admin API auth |

## Security Rules

Rules files are reference copies — deploy by pasting into respective consoles:

- `firestore-rules.txt` → Firebase Console → Firestore → Rules
- `rtdb-rules.txt` → Firebase Console → Realtime Database → Rules
- `supabase-storage-rules.txt` → Supabase Dashboard → Storage → Policies

## License

All rights reserved. Papiano / Lisztomania © 2026
