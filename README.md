# Papiano

Online piano for phone touch, MIDI, and QWERTY — with profiles, chat, friends,
and realtime multiplayer rooms. Static site + Vercel serverless functions,
backed by Firebase (Auth, Firestore, Realtime Database).

## Entry pages (served from the web root)

Vercel serves these from the repo root with `cleanUrls`, so the file
`solo.html` is reachable at `/solo`. They **must stay at the root** — the URLs,
`vercel.json` redirects, and `sitemap.xml` all depend on it.

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` | Home, profile, chat, friends, account |
| `/solo` | `solo.html` | Solo piano — its own offline engine, no network |
| `/multiplayer` | `multiplayer.html` | Realtime multiplayer rooms |
| `/admin` | `admin.html` | Admin panel (noindex) |

**Solo and multiplayer are fully independent.** Each has its OWN copy of the
piano engine and its OWN stylesheet, so editing one never affects the other:
`js/solo/piano.js` + `css/solo.css` (solo, offline) vs.
`js/multiplayer/piano.js` + `css/multiplayer.css` (rooms + chat + Firebase).
Each engine file self-boots its single mode — no shared file, no mode branch.
(Trade-off: a piano-engine fix that should apply to both must be made in both
copies.)

## Folders

```
api/        Vercel serverless functions (see api/README.md)
js/         App scripts — *.js are sources, *.min.js are served
  app.js               main app (home/profile/chat)  -> app.min.js
  auth-email.js        email/password auth (served as-is)
  edit-modal.js        shared edit modal (served as-is)
  sdk-loader.js        lazy Firebase SDK loader      -> sdk-loader.min.js
  updater.js           version/cache refresh (all 3 pages) -> updater.min.js
  solo/piano.js        SOLO piano engine — independent copy (served as-is)
  multiplayer/piano.js MULTIPLAYER piano engine — independent copy (served as-is)
css/        Stylesheets — *.css sources, *.min.css served
  bundle.css           styles for the main app (index.html)
  solo.css             SOLO piano-engine styles (independent copy)
  multiplayer.css      MULTIPLAYER piano-engine styles (independent copy)
rules/      Firebase security rules
  firestore.rules        Firestore rules
  database.rules.json    Realtime Database rules (multiplayer)
fonts/      Self-hosted icon font
```

Root config: `vercel.json` (hosting/redirects/headers), `firebase.json` +
`.firebaserc` (Firebase project), `manifest.json`, `robots.txt`, `sitemap.xml`,
`version.json`.

## Build

The site ships **minified** assets. After editing any `css/*.css` or `js/*.js`
source, regenerate the bundles before committing:

```bash
node build.js          # terser (JS) + clean-css (CSS) -> the *.min.* outputs
```

On deploy, Vercel runs `node stamp-version.js` to write `version.json` and
cache-bust the asset URLs.

## Deploying Firebase rules

Rules live in `rules/` and are referenced by `firebase.json`:

```bash
firebase deploy --only firestore        # Firestore rules
firebase deploy --only database         # Realtime Database rules
```

> The RTDB instance is in `asia-southeast1`. If your network/tooling can't
> reach that host, paste `rules/database.rules.json` into Firebase Console →
> Realtime Database → Rules and publish.
