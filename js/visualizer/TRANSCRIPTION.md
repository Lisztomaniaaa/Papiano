# Audio → MIDI transcription (visualizer import)

How the "paste a TikTok/Instagram link / upload a video·mp3" feature turns
sound into playable notes, what we learned from how Klangio works, and where
to push next.

## The pipeline today

All client-side, after `/api/extract-audio` returns raw audio bytes
(`visualizer.html`):

1. **Decode + resample** to 22.05 kHz mono (`audioBufferToMidiBase64`).
2. **Source separation (HPSS)** — median-filter Harmonic/Percussive Source
   Separation (`harmonicSeparate`) runs on the resampled signal *before* the
   model. A per-bin median across time isolates sustained tonal content; a
   per-frame median across frequency isolates broadband transients (drums,
   hats, sibilance); a soft Wiener mask keeps the harmonic part. The model then
   only ever sees the pitched signal, so most non-instrument "ghost" notes are
   gone before detection. Pure DSP (own radix-2 FFT) — ~12 s for a 60 s clip,
   the CPU-for-quality trade the user OK'd. `VIZ_USE_HPSS` toggles it.
   Verified by unit tests: FFT round-trip exact, sine retained, clicks
   suppressed, mixed signal favours tone.
3. **Basic Pitch** (`@spotify/basic-pitch`, TF.js / WebGL) →
   per-frame `frames`, `onsets`, `contours`. (`evaluateModel` accepts a raw
   `Float32Array`, so the separated signal is passed straight in.)
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
4. **Recall-recovery second pass** (`mergeRecall`) — the strict thresholds above
   keep a full mix from hallucinating, but they also drop the fast, quiet inner
   notes of arpeggios and glissandi (the "banyak nada hilang" complaint). So we
   run `outputToNotesPoly` a *second* time at lenient thresholds
   (`0.40 / 0.25`, minLen 3) — **free**, it reuses the frames/onsets already in
   memory, no second inference — and fold in only notes that (a) aren't already
   covered by a confident note of the same pitch and (b) sit amid already-confident
   playing (a confident note within 0.5 s). That confines recovery to dense
   passages where notes are genuinely missed *between* confident ones, and never
   lights up a vocal-only or silent stretch with invented pitches.
5. **`mergeVizNotes`** post-processing:
   - **Polyphony cap (8)** — when a dense moment floods more simultaneous
     detections than a pianist could play, keep the loudest.
   - **Fragment merge (≤90 ms gap)** — stitch a sustain that Basic Pitch
     fragmented back into one note, so the soundfont voice rings instead of
     being re-triggered and cut off.
   - **Chord alignment (≤40 ms), run-aware** — snap near-simultaneous onsets to
     the cluster's median start so chords land together — *except* when the
     cluster is a fast **run/glissando** (4+ notes in a monotonic, small-step
     pitch sweep). Collapsing a run to one start would pile its notes on a single
     tick and erase the motion the pianist played, so runs keep their distinct
     onsets while genuine chords (incl. wide-interval broken chords) still snap.
   - **Overtone-ghost rejection (two passes)** — drop a note only when it sits
     at a harmonic interval (octave, octave+5th, ...) above a much louder note
     *and* is itself much quieter -- a piano string's own overtone misread as a
     separate key. Pass 1 catches ghosts inside a chord cluster (same onset);
     pass 2 catches *temporal* ghosts whose onset crosses threshold mid-sustain
     while a louder fundamental a harmonic below is still ringing. Conservative
     on both axes so a real, intentionally quiet upper voice is never touched.
   - **Note-length refinement** (`extendDurations`) — follow each note's own
     per-frame activation past its detected end down to a lower release
     threshold, recovering the natural piano tail Basic Pitch clips short.
     Hard-capped and never allowed to reach the next same-pitch onset, so it
     can't fabricate a sustain that swallows a real repeated note.
6. **`notesToMidiBase64`** — emits a standard format-0 MIDI routed through the
   same proven `parseMidi → midiToTimeline` playback path as an uploaded
   `.mid`. Velocity is mapped from the clip's *working* dynamic range (10th–90th
   percentile of detected amplitudes) over a musical span with a gentle curve.
   Chord coherence is **humanised, not flattened**: each note is pulled only
   gently toward the chord mean (outliers tamed, real dynamics kept), and the
   top voice of each chord gets a small lift so the melody sings through the way
   a pianist voices it — the over-aggressive mean-pull was what read as robotic.

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

## The real ceiling: the engine (researched candidates for 90 %+)

Honest framing: Basic Pitch is a *generic* multi-instrument detector. All the
post-processing here pushes its **precision** up, but its **recall on hard
classical** (fast arpeggios, glissandi, dense pedalled passages) is capped by
the model itself. To reliably clear 90 %+ note-F1 on that material the lever is
a **piano-specific** model. Browser-deployable candidates, researched:

1. **Magenta Onsets & Frames (recommended next jump).** Google's piano-specific
   transcription model, **already ported to TF.js** and shippable in-browser via
   `@magenta/music` — same runtime family we already load. ~94.8 % onset-F1 on
   MAESTRO vs. Basic Pitch's generic detector. API is a drop-in for our path:
   ```js
   import { OnsetsAndFrames } from '@magenta/music';
   const oaf = new OnsetsAndFrames(CHECKPOINT_URL);  // onsets_frames_uni_q2 (quantized, smaller)
   await oaf.initialize();
   const ns = await oaf.transcribeFromAudioBuffer(audioBuffer); // -> NoteSequence
   ```
   Feed it the **HPSS-separated** buffer we already compute, map its NoteSequence
   into our `{pitchMidi,start,end,amplitude}` shape, and the entire
   `mergeVizNotes → extendDurations → notesToMidiBase64` tail still applies.
   **Risks to validate before shipping** (can't be tested in this sandbox — no
   browser/GPU/real audio): (a) TF.js version sharing with the vendored
   `tf.min.js` Basic Pitch uses — two TF.js globals can clash, may need to load
   one and reuse it; (b) checkpoint download size/latency on mobile; (c) it
   assumes *solo piano* — HPSS first, and keep Basic Pitch as the fallback engine
   for non-piano clips. This is the single biggest accuracy lever left and the
   closest thing to Klangio's per-instrument approach we can run client-side.
2. **ByteDance high-resolution (96.7 % F1, SOTA) — server-side only.** Regresses
   exact onset/offset times; best-in-class on fast notes *and* pedal. But it's
   PyTorch, no browser port, and the analytic post-processing is heavy — it would
   mean an inference endpoint (breaks the "audio never leaves the device" promise
   and our visualizer-only scope). Park unless we decide a server path is OK.
3. **Light rhythm grid.** Estimate tempo from the inter-onset histogram and snap
   with low strength — only once it can be trusted (a wrong grid is worse than
   none). Addresses "kebingungan tempo" but secondary to the engine.

Sources: [Onsets & Frames in the browser](https://magenta.withgoogle.com/oaf-js) ·
[magenta-js OnsetsAndFrames API](https://magenta.github.io/magenta-js/music/classes/_transcription_model_.onsetsandframes.html) ·
[ByteDance high-res transcription (arXiv 2010.01815)](https://arxiv.org/pdf/2010.01815).

## Already shipped from this list
- ~~Dual-pass recall recovery~~ — done (`mergeRecall`): the free second
  lenient pass now recovers fast/quiet arpeggio & glissando notes the strict
  pass dropped, gated so it can't re-admit ghosts ("banyak nada hilang").
- ~~Run/glissando vs. chord disambiguation~~ — done: fast monotonic sweeps keep
  their distinct onsets instead of being collapsed into a block chord.
- ~~Source separation (HPSS) before transcription~~ — done, strips drums/noise.
- ~~Conservative overtone rejection~~ — done, now in two passes (chord +
  temporal/sustain).
- ~~Note-length refinement~~ — done (`extendDurations`, frame-energy follow).
- ~~Humanised chord voicing~~ — done (gentle mean-pull + melody lift).
- ~~Onset-strength velocity~~ — superseded by percentile-normalized,
  chord-blended velocity; revisit if real-clip listening still shows attack
  energy tracking better than frame amplitude.

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
