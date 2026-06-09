// Writes build version to version.json and stamps CSS URLs (runs on Vercel build)
const fs = require('fs');

const raw =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now());
const version = raw.slice(0, 12);

fs.writeFileSync('version.json', JSON.stringify({ version }) + '\n');
console.log(`version.json -> ${version}`);

// Stamp CSS cache-bust in index.html and multiplayer.html
['index.html', 'multiplayer.html'].forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/bundle\.min\.css\?v=[^"']*/g, 'bundle.min.css?v=' + version);
  fs.writeFileSync(file, html);
  console.log(`${file} CSS stamped -> ?v=${version}`);
});
