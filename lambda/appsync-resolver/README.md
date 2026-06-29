# `papiano-appsync-resolver` — AppSync Lambda data source

Single Lambda backing every field in `appsync/schema.graphql`. AppSync
invokes it with `{ info: { typeName, fieldName }, arguments, identity }`
(see `appsync/resolvers/invoke-lambda.js`) and `index.js` routes to the
matching function in `domains/`.

- `auth.js` — `isAdmin()` (hardcoded email allowlist ported verbatim from
  `rules/Realtimedatabase.rules.json` / `rules/firestore.rules`, OR Cognito
  group `admin`), `owns()`, `requireSignedIn()`. `identity.sub` is the
  Cognito user's stable id, equivalent to Firebase's `auth.uid`.
- `dynamo.js` — shared DynamoDB Document Client + table name constants for
  all 24 `papiano-*` tables.
- `domains/rooms.js`, `players.js`, `seats.js`, `presence.js`,
  `roomMessages.js`, `streams.js`, `moderation.js`, `roles.js`, `grants.js`
  — the Realtime-Database-derived domain. Staleness windows (`PLAYER_STALE_MS`,
  `SEAT_STALE_MS` = 45000ms, grant TTL = 60000ms) match the original RTDB
  rules' `now - 45000` / `now - 60000` checks.
- `domains/profiles.js`, `chat.js`, `friendships.js`, `blocks.js`,
  `reports.js`, `donations.js` — the Firestore-derived domain.
  `voteProfile` uses `TransactWriteCommand` to atomically toggle a
  `papiano-profile-reactions` item and adjust the profile's `likes`/
  `dislikes` counters by exactly ±1, replacing the Firestore transaction
  that did the same thing.

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
