/*
 * /api/extract-audio — server-side audio extraction for the "import from
 * video link" visualizer feature. Runs the vendored yt-dlp binary
 * (bin/yt-dlp) against an allow-list of platforms (TikTok, Instagram) and
 * streams back the best-audio track. The browser then forwards that audio
 * to /api/transcribe (the Modal audio-midi service) for note transcription
 * — no audio is ever stored beyond this request.
 *
 *   POST { url }
 *   -> 200, raw audio bytes, Content-Type matching the extracted container
 *   -> 4xx { error } on bad/unsupported URL or extraction failure
 *
 * YouTube is intentionally NOT supported here: it requires a JS runtime
 * (Deno) for signature deciphering plus PO tokens for most formats, which
 * is exactly the anti-bot arms race this project isn't trying to fight.
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

  execFile(YTDLP_BIN, [
    '--no-playlist',
    // TikTok/Instagram usually only serve muxed audio+video formats (no
    // audio-only stream), so 'bestaudio' alone finds nothing — fall back to
    // 'best' and let the browser's decodeAudioData() pull the audio track
    // out of the muxed container (no ffmpeg available to extract it here).
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
      return;
    }

    fs.readFile(path.join(dir, match), (readErr, data) => {
      cleanup();
      if (readErr) {
        res.status(422).json({ error: 'Could not read extracted audio.' });
        return;
      }
      const ext = match.split('.').pop();
      res.setHeader('Content-Type', EXT_TO_MIME[ext] || 'application/octet-stream');
      res.status(200).send(data);
    });
  });
};
