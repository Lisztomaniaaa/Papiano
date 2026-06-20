// Writes build version to version.json and stamps CSS/JS URLs (runs on Vercel build)
const fs = require('fs');

const raw =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now());
const version = raw.slice(0, 12);

fs.writeFileSync('version.json', JSON.stringify({ version }) + '\n');
console.log(`version.json -> ${version}`);

// Stamp cache-bust in every HTML entry served by Vercel.
['index.html', 'multiplayer.html', 'solo.html'].forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/(bundle\.min\.css)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(sdk-loader\.min\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(edit-modal\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(app\.min\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(auth-email\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(updater\.min\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(engine\.min\.css)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(engine\/piano\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(solo\/boot\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(multiplayer\/boot\.js)\?v=[^"']*/g, '$1?v=' + version);
  fs.writeFileSync(file, html);
  console.log(`${file} stamped -> ?v=${version}`);
});
