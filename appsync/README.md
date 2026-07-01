# AppSync — GraphQL API

This is the app's only backend data API (originally built to replace
Firebase RTDB + Firestore during the AWS migration; that migration is done —
there is no Firebase fallback anywhere).

- `schema.graphql` — the GraphQL contract, deployed to AppSync API `papiano-api`
  (apiId `bhplmwzkibh47i55zgf63wu24u`, Cognito User Pool auth against
  `ap-southeast-1_f0EEaeXA4`). Covers the realtime domain (rooms, players,
  seats, presence, room chat, streams, moderation, per-uid roles,
  deletedAccounts), the persistent domain (profiles, chat rooms/messages,
  friendships, blocks, reports, donations), and the admin domain (role
  registry, banned-accounts list, audit log, admin dashboard stats).
  `roomSecrets`/`roomGrants`/`roomThrottle`/`botThrottle` are intentionally
  NOT in the schema — those DynamoDB tables are only ever touched directly
  by the standalone Lambda Function URLs (`lambda/private-room`,
  `lambda/botchat`), never through GraphQL (the one exception, `myRoomGrant`,
  is a self-only read of `roomGrants` for the frontend to check its own
  join-grant status).
- `resolvers/invoke-lambda.js` — one generic APPSYNC_JS resolver (request/
  response pass-through) attached to every Query/Mutation field in the
  schema. All authorization and business logic lives in plain Node.js in
  `lambda/appsync-resolver/` instead of resolver mapping templates (±1 vote
  toggling, the friend-request state machine, transactional reaction
  counters, etc. are regular testable code rather than VTL/JS snippets).
  **Adding a field to the schema does not wire it up** — you still have to
  `aws appsync create-resolver` for the new field name (see below) and add
  a handler in `lambda/appsync-resolver/index.js`, or it 404s with
  "No resolver for Query.yourField".
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
