# AppSync — GraphQL API (replaces Firebase RTDB + Firestore)

- `schema.graphql` — the GraphQL contract, deployed to AppSync API `papiano-api`
  (apiId `bhplmwzkibh47i55zgf63wu24u`, Cognito User Pool auth against
  `ap-southeast-1_f0EEaeXA4`). Covers both the realtime domain (rooms,
  players, seats, presence, room chat, streams, moderation, roles,
  deletedAccounts) and the persistent domain (profiles, chat rooms/messages,
  friendships, blocks, reports, donations). `roomSecrets`/`roomGrants`/
  `roomThrottle`/`botThrottle` are intentionally NOT in the schema — they
  stay backend-only, mirroring their `.read: false, .write: false` rules in
  `rules/Realtimedatabase.rules.json` (the one exception, `myRoomGrant`, is a
  self-only read, matching that table's `.read` rule exactly).
- `resolvers/invoke-lambda.js` — one generic APPSYNC_JS resolver (request/
  response pass-through) attached to all 55 Query/Mutation fields. All
  authorization and business logic lives in plain Node.js in
  `lambda/appsync-resolver/` instead of resolver mapping templates, so the
  Firebase-rule logic being ported (TTL staleness windows, ±1 vote
  toggling, the friend-request state machine, transactional reaction
  counters) is regular testable code rather than VTL/JS snippets.
- Subscriptions fire automatically via `@aws_subscribe(mutations: [...])`
  directives in the schema — no separate subscription resolver code needed.

## Redeploying the schema after an edit

```bash
aws appsync start-schema-creation --api-id bhplmwzkibh47i55zgf63wu24u \
  --region ap-southeast-1 --definition fileb://appsync/schema.graphql
aws appsync get-schema-creation-status --api-id bhplmwzkibh47i55zgf63wu24u --region ap-southeast-1
```

## Redeploying a resolver after an edit to invoke-lambda.js

```bash
aws appsync update-resolver --api-id bhplmwzkibh47i55zgf63wu24u --region ap-southeast-1 \
  --type-name <Query|Mutation> --field-name <fieldName> --data-source-name papianoResolver \
  --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
  --code file://appsync/resolvers/invoke-lambda.js
```

See `lambda/appsync-resolver/README.md` for the actual logic and how to
redeploy that function.
