// Vercel build step: write the build version to version.json and refresh the
// ?v= cache-bust query on every local asset referenced by the HTML entry points.
const fs = require('fs');

const raw =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now());
const version = raw.slice(0, 12);

fs.writeFileSync('version.json', JSON.stringify({ version }) + '\n');
console.log(`version.json -> ${version}`);

// Assets stamped with ?v= in the HTML entry points below.
const STAMPED_ASSETS = [
  'bundle.min.css',
  'sdk-loader.min.js',
  'edit-modal.js',
  'app.min.js',
  'auth-email.js',
  'updater.min.js',
];

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

['index.html', 'multiplayer.html'].forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  for (const asset of STAMPED_ASSETS) {
    html = html.replace(new RegExp(`(${escapeRegExp(asset)})\\?v=[^"']*`, 'g'), `$1?v=${version}`);
  }
  fs.writeFileSync(file, html);
  console.log(`${file} stamped -> ?v=${version}`);
});
