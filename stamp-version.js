/*
 * Papiano build version stamper.
 *
 * Runs automatically on Vercel (see vercel.json "buildCommand").
 * Writes the current build version into version.json using the git commit SHA,
 * so every deploy gets a unique version with zero manual bumping.
 *
 * The HTML pages fetch version.json at runtime — no hardcoded values needed.
 */
const fs = require('fs');

const raw =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now());
const version = raw.slice(0, 12);

fs.writeFileSync('version.json', JSON.stringify({ version }) + '\n');
console.log(`Wrote version.json -> ${version}`);
