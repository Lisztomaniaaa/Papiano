# Papiano Admin API

Vercel Serverless Function for admin operations (assign roles, ban users, approve donations, etc.) using Firebase Admin SDK.

## Setup

### 1. Get Firebase Service Account Key

1. Go to **Firebase Console → Project Settings → Service Accounts**
2. Click **Generate New Private Key**
3. Download the JSON file

### 2. Set Environment Variables in Vercel

Go to **Vercel Dashboard → Papiano Project → Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Paste the **entire JSON content** of the service account key (single line) |
| `PAPIANO_ADMIN_SECRET` | A strong random string (your admin password for API calls) |
| `FIREBASE_DATABASE_URL` | `https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app` |

> **Tip:** To make the JSON single-line, run: `cat serviceAccountKey.json | jq -c .`

### 3. Deploy

Push to main — Vercel auto-deploys. The endpoint will be live at:
```
POST https://papiano.fun/api/admin
```

## Usage

All requests are `POST /api/admin` with JSON body:

```json
{
  "secret": "YOUR_PAPIANO_ADMIN_SECRET",
  "action": "action-name",
  ...params
}
```

## Actions

### assign-role
Set roles on a user profile.
```json
{
  "secret": "...",
  "action": "assign-role",
  "uid": "firebase-uid",
  "roles": ["moderator", "vip"]
}
```

### ban-user
Disable auth + flag profile as banned.
```json
{
  "secret": "...",
  "action": "ban-user",
  "uid": "firebase-uid",
  "reason": "Spam and harassment"
}
```

### unban-user
Re-enable auth + remove ban flag.
```json
{
  "secret": "...",
  "action": "unban-user",
  "uid": "firebase-uid"
}
```

### delete-user
Remove all user data (profile, friendships, blocks, RTDB presence, auth account).
```json
{
  "secret": "...",
  "action": "delete-user",
  "uid": "firebase-uid"
}
```

### approve-donation
Write a verified donation to the leaderboard.
```json
{
  "secret": "...",
  "action": "approve-donation",
  "uid": "firebase-uid-or-null",
  "name": "Donor Name",
  "amount": 5,
  "currency": "USD",
  "note": "Ko-fi"
}
```

### set-claim
Set Firebase Auth custom claims (role-based access tokens).
```json
{
  "secret": "...",
  "action": "set-claim",
  "uid": "firebase-uid",
  "claims": { "moderator": true, "vip": true }
}
```

## Testing with curl

```bash
curl -X POST https://papiano.fun/api/admin \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_SECRET","action":"assign-role","uid":"abc123","roles":["moderator"]}'
```

## Security

- All requests require `secret` field matching `PAPIANO_ADMIN_SECRET` env var
- Never expose the secret in client-side code
- Firebase Admin SDK bypasses all Firestore/RTDB rules (server-side only)
- Service account key is stored only in Vercel env vars (never committed to repo)
