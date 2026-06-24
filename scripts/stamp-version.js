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
['index.html', 'multiplayer.html', 'solo.html', 'visualizer.html', 'visualizer-stage.html'].forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  // Cache-bust every versioned asset. Paths are folder-specific so each
  // area (app / solo / multiplayer / shared) is stamped unambiguously.
  html = html.replace(/(app\/bundle\.min\.css)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(app\/app\.min\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(app\/sdk-loader\.min\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(app\/auth-email\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(app\/edit-modal\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(shared\/updater\.min\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(solo\/piano\.min\.css)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(multiplayer\/piano\.min\.css)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(solo\/piano\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(multiplayer\/piano\.js)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(visualizer\/piano\.min\.css)\?v=[^"']*/g, '$1?v=' + version);
  html = html.replace(/(visualizer\/piano\.js)\?v=[^"']*/g, '$1?v=' + version);
  fs.writeFileSync(file, html);
  console.log(`${file} stamped -> ?v=${version}`);
});
