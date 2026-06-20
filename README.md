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
| `/solo` | `solo.html` | Solo piano — boots the shared engine offline (no network) |
| `/multiplayer` | `multiplayer.html` | Realtime multiplayer rooms |
| `/admin` | `admin.html` | Admin panel (noindex) |

**Solo and multiplayer are separate entry points that share one engine.**
`js/engine/piano.js` is the shared piano engine; it does NOT decide the mode.
Each page loads the engine, then its own tiny boot file:
`js/solo/boot.js` (solo, offline) or `js/multiplayer/boot.js` (rooms + chat +
Firebase). Neither the engine nor a single file does "both functions".

## Folders

```
api/        Vercel serverless functions (see api/README.md)
css/        Stylesheets — *.css are the editable sources, *.min.css are served
js/         App scripts — *.js are sources, *.min.js are served
  app.js            main app (home/profile/chat)  -> app.min.js
  auth-email.js     email/password auth (served as-is)
  edit-modal.js     shared edit modal (served as-is)
  sdk-loader.js     lazy Firebase SDK loader      -> sdk-loader.min.js
  updater.js        version/cache refresh (all 3 pages) -> updater.min.js
  engine/piano.js   shared piano engine, used by solo + multiplayer (served as-is)
  solo/boot.js      solo entry — boots the engine offline (served as-is)
  multiplayer/boot.js  multiplayer entry — boots engine + rooms/chat/Firebase
css/        Stylesheets — *.css sources, *.min.css served
  bundle.css        styles for the main app (index.html)
  engine.css        styles for the shared piano engine (solo + multiplayer)
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
