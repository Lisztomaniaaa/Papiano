# Papiano Backend API

Vercel Serverless Functions with Firebase Admin SDK.

## Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/admin` | Admin secret | User management, roles, badges, donations, stats |
| `POST /api/chat` | Admin secret / ID token | Chat message management, room control |
| `POST /api/room` | Admin secret / ID token | Multiplayer room CRUD, private keys |
| `POST /api/moderate` | Admin secret / ID token | Reports, blocks, maintenance, announcements |
| `POST /api/playtime` | ID token | Anti-cheat play time tracking |

## Authentication

### Admin actions
Require `secret` field in request body matching `PAPIANO_ADMIN_SECRET` env var.

### User actions
Require `Authorization: Bearer <firebase-id-token>` header.
Client gets token via `firebase.auth().currentUser.getIdToken()`.

---

## `/api/admin` — Admin Operations

All require `secret`.

| Action | Params | Description |
|---|---|---|
| `assign-role` | `uid, roles[]` | Set user's ownedRoles |
| `ban-user` | `uid, reason?` | Disable auth + flag profile |
| `unban-user` | `uid` | Re-enable auth + remove flag |
| `delete-user` | `uid` | Full data removal |
| `approve-donation` | `uid?, name, amount, currency?, note?` | Write donation entry |
| `set-claim` | `uid, claims{}` | Set Firebase Auth custom claims |
| `search-users` | `query, limit?` | Search by name/email/UID/publicId |
| `create-role` | `id, label, rarity?, color?, permissions?` | Create role in RTDB |
| `delete-role` | `id` | Delete role + strip from users |
| `gift-badge` | `uid, roleId, expireAt?` | Add role to user |
| `create-badge` | `id, label, rarity?, color?` | Alias for create-role |
| `delete-badge` | `id` | Alias for delete-role |
| `admin-stats` | — | Dashboard statistics |

---

## `/api/chat` — Chat Operations

### Admin (require `secret`)

| Action | Params | Description |
|---|---|---|
| `delete-message` | `roomId, messageId` | Delete specific message |
| `clear-room` | `roomId` | Delete all messages in room |
| `disable-room` | `roomId, reason?` | Lock chat room |
| `enable-room` | `roomId` | Unlock chat room |

### User (require ID token)

| Action | Params | Description |
|---|---|---|
| `send-message` | `roomId, text, replyTo?` | Validated + rate-limited send |
| `delete-own` | `roomId, messageId` | Soft-delete own message |

Rate limit: 8 messages per 30 seconds.
Includes profanity filter + shadow mute support.

---

## `/api/room` — Multiplayer Room Operations

### Admin (require `secret`)

| Action | Params | Description |
|---|---|---|
| `delete-room` | `roomId` | Remove room + messages |
| `kick-player` | `roomId, uid` | Remove player from room |
| `lock-room` | `roomId, reason?` | Prevent joins |
| `unlock-room` | `roomId` | Allow joins |

### User (require ID token)

| Action | Params | Description |
|---|---|---|
| `create-room` | `name, maxPlayers?, isPrivate?, password?` | Create room (max 1 per user) |
| `join-room` | `roomId, password?` | Join with capacity + password check |
| `leave-room` | `roomId` | Leave room |
| `set-room-key` | `roomId, password` | Set/change private password (SHA-256 hashed) |
| `validate-key` | `roomId, password` | Check if password matches |

Rate limits: 3 creates/5min, 10 joins/min.

---

## `/api/moderate` — Moderation Operations

### Admin (require `secret`)

| Action | Params | Description |
|---|---|---|
| `maintenance-on` | `reason?` | Enable maintenance mode |
| `maintenance-off` | — | Disable maintenance mode |
| `announce` | `text, imageUrl?` | Post announcement |
| `clear-reports` | `status?` | Clear processed reports |

### User (require ID token)

| Action | Params | Description |
|---|---|---|
| `report-user` | `targetId, reason` | Submit report (5/hour limit) |
| `block-user` | `targetId` | Block user + remove friendship |
| `unblock-user` | `targetId` | Unblock user |

---

## `/api/playtime` — Play Time Tracking

### User (require ID token)

| Action | Params | Description |
|---|---|---|
| `update` | `seconds` | Add play time (max 300s/request, 1 req/min) |

Anti-cheat: server-side timestamp tracking, max increment cap, rate limiting.

---

## Environment Variables (Vercel)

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | Firebase service account JSON |
| `PAPIANO_ADMIN_SECRET` | ✅ | Admin auth token |
| `FIREBASE_DATABASE_URL` | ❌ | Override RTDB URL (has default) |

---

## Example Usage

### Admin (from browser console on admin panel)
```js
fetch('/api/admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ secret: 'YOUR_SECRET', action: 'ban-user', uid: 'abc123', reason: 'spam' })
}).then(r => r.json()).then(console.log)
```

### User (from app with Firebase auth)
```js
const token = await firebase.auth().currentUser.getIdToken();
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ action: 'send-message', roomId: 'group_global', text: 'Hello!' })
}).then(r => r.json()).then(console.log)
```
