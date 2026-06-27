/*
 * /api/transcribe — server-side proxy to the audio-midi transcription
 * service (Modal). The browser never holds the Modal API key and never
 * calls Modal directly: every request goes through this gate.
 *
 *   POST <raw audio bytes>
 *     headers: 'Content-Type' = audio mime
 *   -> 200 { notes:[{pitch,onset,offset,velocity}], pedals:[{onset,offset}], midi_base64 }
 *      (passed through as-is from the audio-midi Modal endpoint)
 *   -> 413 { error } on oversized audio
 *   -> 5xx { error } on server misconfiguration or upstream failure
 *
 * Forwarding to Modal: this endpoint re-encodes the audio as
 * { audio_base64 } JSON and sends it with an X-API-Key header, matching the
 * audio-midi service's contract (POST /transcribe).
 */
const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_CONTENT_TYPES = [
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/webm',
  'audio/opus', 'audio/ogg', 'audio/wav', 'application/octet-stream',
];

const UPSTREAM_TIMEOUT_MS = 45_000;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_AUDIO_BYTES) {
        reject(Object.assign(new Error('Audio too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    res.status(400).json({ error: 'Unsupported audio content type.' });
    return;
  }

  let audio;
  try {
    audio = await readRawBody(req);
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message || 'Bad audio body.' });
    return;
  }
  if (!audio.length) {
    res.status(400).json({ error: 'Empty audio body.' });
    return;
  }

  // audio-midi Modal contract: POST { audio_base64 } -> { notes, pedals, midi_base64 }
  const modalUrl = process.env.MODAL_TRANSCRIBE_URL;
  const modalKey = process.env.MODAL_API_KEY;
  if (!modalUrl || !modalKey) {
    res.status(500).json({ error: 'Transcription service not configured.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(modalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': modalKey,
      },
      body: JSON.stringify({ audio_base64: audio.toString('base64') }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error('Modal transcription failed:', upstream.status, text.slice(0, 500));
      res.status(502).json({ error: 'Transcription service failed.' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch (e) {
    console.error('Modal transcription request error:', e.message);
    res.status(e.name === 'AbortError' ? 504 : 502).json({ error: 'Transcription service unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
};
