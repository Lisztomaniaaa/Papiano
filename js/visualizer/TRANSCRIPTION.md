# Audio → MIDI transcription (visualizer import)

How the "paste a TikTok/Instagram link / upload a video·mp3" feature turns
sound into playable notes.

## The pipeline today

1. **Get raw audio bytes.** Link import: `/api/extract-audio` downloads the
   clip server-side (yt-dlp) and streams back the audio track. File upload:
   the browser reads the file directly.
2. **Decode + resample** to 22.05 kHz mono in the browser
   (`audioBufferToMidiBase64` in `visualizer.html`), then encode as a 16-bit
   PCM WAV (`encodeWavMono16`).
3. **Transcribe server-side.** The WAV is POSTed to `/api/transcribe`
   (`callTranscribeApi`), which is a Vercel function that gates abuse
   (per-IP/per-uid throttling, see `api/README.md`) and forwards the audio to
   a Modal-hosted piano-specific transcription model (repo:
   `Lisztomaniaaa/audio-midi`, app `papiano-transcribe`). The Modal API key
   never reaches the browser.
4. **Use the response directly.** `/api/transcribe` already returns a
   standard format-0 MIDI as `midi_base64`, routed through the same
   `parseMidi → midiToTimeline` playback path as an uploaded `.mid` file —
   no client-side post-processing needed.

Previously this ran an in-browser pipeline (HPSS source separation,
Spotify's Basic Pitch, and Magenta's Onsets & Frames, all via TensorFlow.js).
That was replaced with the server-side Modal model above for better accuracy
on piano-specific material; the vendored bundles and model checkpoints were
removed.
