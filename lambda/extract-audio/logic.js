/*
 * Lambda port of api/extract-audio.js — extracts audio from TikTok/Instagram
 * links via the vendored yt-dlp binary. Logic is unchanged from the Vercel
 * version; the binary ships in this function's own deployment package
 * (not the shared layer) since it's only used here.
 */
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const YTDLP_BIN = path.join(process.cwd(), 'bin', 'yt-dlp');

const ALLOWED_HOSTS = [
  'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
  'instagram.com',
];

const EXT_TO_MIME = {
  m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac',
  webm: 'audio/webm', opus: 'audio/opus', ogg: 'audio/ogg', mp3: 'audio/mpeg',
};

function isAllowedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { url } = req.body || {};
  if (typeof url !== 'string' || !isAllowedUrl(url)) {
    res.status(400).json({ error: 'Only TikTok and Instagram links are supported.' });
    return;
  }

  const jobId = `viz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const outTemplate = path.join(os.tmpdir(), `${jobId}.%(ext)s`);

  await new Promise((resolve) => {
    execFile(YTDLP_BIN, [
      '--no-playlist',
      '-f', 'bestaudio/best',
      '--max-filesize', '50M',
      '--match-filter', 'duration<300',
      '--socket-timeout', '20',
      '-o', outTemplate,
      url,
    ], { timeout: 45000, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      const dir = os.tmpdir();
      const match = fs.readdirSync(dir).find(f => f.startsWith(jobId + '.'));

      const cleanup = () => { if (match) fs.unlink(path.join(dir, match), () => {}); };

      if (err || !match) {
        console.error('yt-dlp failed:', stderr || (err && err.message));
        cleanup();
        res.status(422).json({ error: 'Could not extract audio from that link.' });
        return resolve();
      }

      fs.readFile(path.join(dir, match), (readErr, data) => {
        cleanup();
        if (readErr) {
          res.status(422).json({ error: 'Could not read extracted audio.' });
          return resolve();
        }
        const ext = match.split('.').pop();
        res.setHeader('Content-Type', EXT_TO_MIME[ext] || 'application/octet-stream');
        res.status(200).send(data);
        resolve();
      });
    });
  });
};
