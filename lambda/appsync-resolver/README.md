# `papiano-appsync-resolver` — AppSync Lambda data source

Single Lambda backing every field in `appsync/schema.graphql`. AppSync
invokes it with `{ info: { typeName, fieldName }, arguments, identity }`
(see `appsync/resolvers/invoke-lambda.js`) and `index.js` routes to the
matching function in `domains/`.

- `auth.js` — `isAdmin()` (hardcoded email allowlist, OR Cognito group
  `admin` via the `cognito:groups` claim), `owns()`, `requireSignedIn()`.
  `identity.sub` is the Cognito user's stable id.
- `dynamo.js` — shared DynamoDB Document Client + table name constants for
  all 26 `papiano-*` tables.
- `domains/rooms.js`, `players.js`, `seats.js`, `presence.js`,
  `roomMessages.js`, `streams.js`, `moderation.js`, `roles.js`, `grants.js`
  — the realtime domain (rooms, seats, presence, in-room chat, streams,
  moderation, per-uid role assignments, deleted/banned accounts, private-room
  join grants). Staleness windows (`PLAYER_STALE_MS`, `SEAT_STALE_MS` =
  45000ms, grant TTL = 60000ms) are just app-level TTL constants now, not
  ported from anywhere.
- `domains/profiles.js`, `chat.js`, `friendships.js`, `blocks.js`,
  `reports.js`, `donations.js`, `roleDefinitions.js`, `audit.js` — the
  persistent domain (user profiles, main-app chat rooms/messages,
  friendships, blocks, reports, donor ledger, the admin-panel role registry,
  and the admin action audit log). `voteProfile` uses `TransactWriteCommand`
  to atomically toggle a `papiano-profile-reactions` item and adjust the
  profile's `likes`/`dislikes` counters by exactly ±1.

## Redeploying after a code change

```bash
cd lambda/appsync-resolver
npm install --omit=dev
rm -f ../appsync-resolver.zip
zip -r -q ../appsync-resolver.zip . -x "*.zip"
aws lambda update-function-code --function-name papiano-appsync-resolver \
  --zip-file fileb://../appsync-resolver.zip --region ap-southeast-1
```

## Required IAM

- Execution role: `papiano-resolver-exec` (basic Lambda execution + inline
  policy granting full CRUD/Transact on `papiano-*` tables and their
  indexes).
- AppSync's data source assumes `papiano-appsync-invoke-lambda`, which only
  has `lambda:InvokeFunction` on this one function.
