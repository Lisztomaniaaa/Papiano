/*
 * Papiano build version stamper.
 *
 * Runs automatically on Vercel (see vercel.json "buildCommand"). It writes the
 * current build version into version.json and into the APP_VERSION constant of
 * both HTML pages, using the git commit SHA so every deploy gets a unique
 * version with zero manual bumping.
 *
 * It is a no-op-safe regex replace, so the repo can still keep a literal
 * version for plain static hosting (e.g. GitHub Pages) where this script is
 * never executed.
 */
const fs = require('fs');

const raw =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now());
const version = raw.slice(0, 12);

function stampHtml(file) {
  try {
    let html = fs.readFileSync(file, 'utf8');
    const next = html.replace(/(var APP_VERSION = ')[^']*(';)/, `$1${version}$2`);
    if (next === html) {
      console.warn(`No APP_VERSION marker found in ${file}`);
      return;
    }
    fs.writeFileSync(file, next);
    console.log(`Stamped ${file} -> ${version}`);
  } catch (e) {
    console.error(`Skip ${file}: ${e.message}`);
  }
}

fs.writeFileSync('version.json', JSON.stringify({ version }) + '\n');
console.log(`Wrote version.json -> ${version}`);
stampHtml('index.html');
stampHtml('multiplayer.html');
