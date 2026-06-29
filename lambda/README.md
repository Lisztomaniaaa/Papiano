# `/lambda` — AWS Lambda backend (replaces `/api` on Vercel)

Each subfolder is one Lambda function, invoked through a public Lambda
Function URL (not API Gateway — two of these functions run up to 60s, past
API Gateway's hard 29s integration timeout). The AWS Amplify app for this
repo rewrites `/api/<name>` to the matching Function URL (see the custom
rules on the Amplify app / `amplify.yml`), so frontend code is unchanged
from the Vercel version.

- `storage-presign/`, `botchat/`, `private-room/` — Firebase Admin SDK
  logic ported unchanged from the matching `api/*.js` file. Each carries its
  own copy of `_admin.js` and `shim.js` (small, kept per-function rather
  than in the shared layer for independent deploys).
- `transcribe/` — Modal proxy, no Firebase Admin needed.
- `extract-audio/` — needs the vendored `bin/yt-dlp` binary (tracked at the
  repo root, `bin/yt-dlp`) copied into its own package at deploy time; it's
  NOT committed inside `lambda/extract-audio/bin/` to avoid duplicating a
  39MB binary in git.
- `_shared/` — source of truth for `shim.js` and `_admin.js`; copy from here
  into each function folder when changed (deploy script does this too).
- `shim.js` — adapts the Vercel-style `(req, res) => {...}` handlers
  (`logic.js` in each folder) to run behind a Lambda Function URL: parses
  JSON bodies onto `req.body` the way Vercel does, and replays raw bytes via
  `req.on('data'|'end')` for handlers that stream (e.g. `transcribe`).

## Shared Lambda Layer

All 5 functions attach the `papiano-shared-deps` layer
(`firebase-admin`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
instead of bundling `node_modules` in each zip.

## Redeploying after a code change

```bash
# from repo root
for fn in storage-presign botchat private-room transcribe; do
  cp lambda/_shared/shim.js lambda/$fn/shim.js
  [ -f lambda/$fn/_admin.js ] && cp lambda/_shared/_admin.js lambda/$fn/_admin.js
  (cd lambda/$fn && zip -r -q ../$fn.zip .)
  aws lambda update-function-code --function-name papiano-$fn --zip-file fileb://lambda/$fn.zip --region ap-southeast-1
done

cp lambda/_shared/shim.js lambda/extract-audio/shim.js
mkdir -p lambda/extract-audio/bin && cp bin/yt-dlp lambda/extract-audio/bin/yt-dlp && chmod +x lambda/extract-audio/bin/yt-dlp
(cd lambda/extract-audio && zip -r -q ../extract-audio.zip .)
aws lambda update-function-code --function-name papiano-extract-audio --zip-file fileb://lambda/extract-audio.zip --region ap-southeast-1
rm -rf lambda/extract-audio/bin lambda/*.zip
```

## Required environment variables per function (same names/values as `api/README.md`)

| Function | Env vars |
| --- | --- |
| `papiano-storage-presign` | `AWS_S3_BUCKET`, (region comes from Lambda's built-in `AWS_REGION`) |
| `papiano-botchat` | `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_DATABASE_URL`, `PAPIANOAI_API`, `OPENROUTER_MODEL` (optional) |
| `papiano-private-room` | `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_DATABASE_URL` |
| `papiano-transcribe` | `MODAL_TRANSCRIBE_URL`, `MODAL_API_KEY` |
| `papiano-extract-audio` | none |

Set via:
```bash
aws lambda update-function-configuration --function-name papiano-<name> \
  --environment "Variables={KEY1=value1,KEY2=value2}" --region ap-southeast-1
```

## Resolved: Function URL 403 AccessDeniedException (new-account anti-abuse)

Public (`AuthType: NONE`) invocation initially returned `AccessDeniedException`
for every Function URL created via the IAM user's access key (CLI/SDK),
despite a fully correct resource policy and despite direct SDK
`aws lambda invoke` working fine. Root/console-created Function URLs (same
account, same region) worked immediately. Root cause confirmed via
CloudTrail: this AWS account's new-account anti-abuse system restricts
public Function URL creation to actions taken by the **root** identity;
the same action performed by an IAM user (any access key, regardless of
its attached IAM policies — this is not a permissions issue) is blocked
at the data-plane invoke level, account-wide.

Fix applied: for each of the 5 functions, the Function URL config (not the
function itself) was deleted and recreated via the AWS Console while
logged in as the **root** user. The resulting Function URLs are wired into
the Amplify app's custom rules (see `amplify.yml`'s app config / AWS
Console > Amplify > Custom rules). If a Function URL is ever recreated
again, it must be done as root via Console, not via CLI/IAM user — otherwise
the 403 returns.
