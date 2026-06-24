# Audio → MIDI transcription (visualizer import)

How the "paste a TikTok/Instagram link / upload a video·mp3" feature turns
sound into playable notes, what we learned from how Klangio works, and where
to push next.

## The pipeline today

All client-side, after `/api/extract-audio` returns raw audio bytes
(`visualizer.html`):

1. **Decode + resample** to 22.05 kHz mono (`audioBufferToMidiBase64`).
2. **Basic Pitch** (`@spotify/basic-pitch`, TF.js / WebGL) →
   per-frame `frames`, `onsets`, `contours`.
3. **`outputToNotesPoly(frames, onsets, 0.65, 0.4, 5, true, 4186, 27.5, false)`**
   — onset/frame thresholds raised above the solo-instrument defaults and the
   pitch range clamped to the piano (A0…C8 in Hz) so a full song mix doesn't
   surface every vocal/bass/drum transient as a note. The final `false` turns
   off `melodiaTrick` — read straight from the vendored package's real source
   (`@spotify/basic-pitch/esm/toMidi.js`, not just the minified bundle we
   ship): it greedily mines leftover spectral energy for *extra* notes with no
   real onset, built for monophonic melody continuation. On a full mix that
   leftover energy is just as likely another instrument bleeding through, so
   it's a direct route to inventing notes nobody played — disabling it costs
   zero extra inference (same model pass, same frames/onsets array).
4. **`mergeVizNotes`** post-processing:
   - **Polyphony cap (8)** — when a dense moment floods more simultaneous
     detections than a pianist could play, keep the loudest.
   - **Fragment merge (≤90 ms gap)** — stitch a sustain that Basic Pitch
     fragmented back into one note, so the soundfont voice rings instead of
     being re-triggered and cut off.
   - **Chord alignment (≤40 ms)** — snap near-simultaneous onsets to the
     cluster's median start so chords land together and the pulse reads tight.
   - **Overtone-ghost rejection** — within an aligned chord cluster, drop a
     note only when it sits at a harmonic interval (octave, octave+5th, ...)
     above a much louder note *and* is itself much quieter -- a piano string's
     own overtone misread as a separate key. Conservative on both axes so a
     real, intentionally quiet upper voice is never touched.
5. **`notesToMidiBase64`** — emits a standard format-0 MIDI routed through the
   same proven `parseMidi → midiToTimeline` playback path as an uploaded
   `.mid`. Velocity is mapped from the clip's *working* dynamic range (10th–90th
   percentile of detected amplitudes) over a musical span with a gentle curve,
   then blended toward a per-chord mean so a chord speaks as one gesture.

### What we deliberately do *not* do
- **No fabricated re-attacks.** A held piano note (often under pedal) is real;
  splitting long notes into invented repeats would *add* notes that were never
  played. "No notes added, no notes dropped" wins over hiding model droning.

## How Klangio works (researched + reasoned)

Klangio (klang.io) is a research company shipping **instrument-specific**
transcription models (e.g. *Piano2Notes*) rather than one generic detector.
Public material + sensible inference about the architecture:

- **Per-instrument models.** A model trained only on piano learns piano attack,
  decay and overtone structure, so it rejects what doesn't look like a piano —
  exactly the "extra notes from vocals/bass/drums" problem we fight with crude
  thresholds. This is their biggest edge over our generic Basic Pitch.
- **Polyphony-native.** Built to resolve chords/harmony, like Basic Pitch.
- **Almost certainly source separation first.** Their multi-instrument
  "Transcription Studio" transcribes several instruments at once in <30 s — that
  strongly implies a separation stage (Demucs/Spleeter-class) splitting the mix
  into stems, then the matching per-instrument model on each stem. Separation is
  the lever that turns a full song mix into a clean single-instrument signal.
- **Cloud GPU.** Heavy models run server-side; we run a small model in the
  browser for privacy (no audio leaves the device after extraction).

## Where to push next (highest leverage first)

1. **Source separation before transcription.** The single biggest quality jump.
   - Cheap, no-ML first step: **HPSS** (harmonic/percussive separation via a
     median-filtered STFT) to strip drums — kills most spurious percussive
     onsets with ~100 lines of DSP, no model download.
   - Bigger: a browser-runnable stem model (piano/other) before Basic Pitch.
2. **Dual-pass confidence cross-check.** We already have `frames`/`onsets` in
   memory after one model pass. A second, *free* (no re-inference) call to
   `outputToNotesPoly` at a stricter `onsetThresh` gives a "confident core" —
   borderline notes from the lenient pass that aren't confirmed there and
   have low standalone amplitude are the cheapest remaining signal we're not
   using yet to cut false positives further.
3. **Light rhythm grid.** Estimate tempo from the inter-onset histogram and
   snap with low strength — only once it can be trusted (a wrong grid is worse
   than none).

## Already shipped from this list
- ~~Onset-strength velocity~~ — superseded by percentile-normalized,
  chord-blended velocity (see above); revisit if real-clip listening still
  shows attack energy tracking better than frame amplitude.
- ~~Conservative overtone rejection~~ — done (harmonic-interval + amplitude-
  ratio gate inside chord clusters).

---

## ai-from-ai — a note to whoever (whatever) picks this up next

> Made by an AI, for the next AI working this file. Keep the fire.

- **Measure, don't assume.** The "notes fall too late" bug wasn't the geometry
  everyone theorised — a 30-second Playwright check proved the canvas already
  spanned the screen. Look before you cut.
- **Subtraction is a feature.** The best change here *removed* code: the fake
  re-attack splitter was adding notes the musician never played. Fewer, truer
  notes beat more, louder ones.
- **Fidelity is respect.** Someone hummed, played, or loved that clip. Don't add
  what they didn't play; don't drop what they did. Precision is how we honour it.
- **Take the risk that's worth it.** Reach for the hard lever (separation) — but
  ship the safe, tested win today, and leave the map for the next reach.

Play on. 🎹
