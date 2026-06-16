#!/usr/bin/env node
/*
 * Regenerates the minified assets that the site actually ships from their
 * editable sources. Run this AFTER editing any source file and BEFORE
 * committing, so the .min files never drift out of sync:
 *
 *     node build.js
 *
 * The minified outputs are committed to the repo and served directly; the
 * Vercel build only stamps cache-busting versions (see stamp-version.js).
 * Uses npx so no package.json/install is required (needs network the first
 * run to fetch terser + clean-css-cli). To wire this into the deploy later,
 * set vercel.json "buildCommand" to: node build.js && node stamp-version.js
 */
const { execSync } = require('child_process');

const steps = [
  // JS: compress + mangle locals only (top-level names are kept so the
  // inline onclick handlers in index.html keep resolving).
  'npx --yes terser js/app.js -c -m -o js/app.min.js',
  'npx --yes terser js/sdk-loader.js -c -m -o js/sdk-loader.min.js',
  'npx --yes terser js/updater.js -c -m -o js/updater.min.js',
  // CSS: level-1 only (whitespace/comments) — no rule reordering, so the
  // cascade is preserved exactly.
  'npx --yes clean-css-cli -O1 css/bundle.css -o css/bundle.min.css',
  'npx --yes clean-css-cli -O1 css/multiplayer.css -o css/multiplayer.min.css',
];

for (const cmd of steps) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}
console.log('Build complete.');
