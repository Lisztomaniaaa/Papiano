# `/js/vendor` — vendored third-party browser bundles

- **`tf.min.js`** — `@tensorflow/tfjs` v4.22.0, official minified UMD browser
  build (`dist/tf.min.js` from the npm package). Defines the global `tf`.
- **`basic-pitch.bundle.js`** — `@spotify/basic-pitch` v1.0.1, bundled from
  its ESM source with esbuild (`--bundle --format=iife --minify`), with
  `@tensorflow/tfjs` aliased to the global `tf` from `tf.min.js` (so it is
  not duplicated in this bundle). Defines `window.BasicPitchLib` with
  `{ BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime }`.

  Used by `js/visualizer/piano.js` for the "import from TikTok/Instagram
  video" feature: transcribes extracted audio to note events entirely
  client-side (WebGL via TensorFlow.js), so no audio or MIDI ever leaves
  the browser after the initial `/api/extract-audio` fetch.

  To rebuild `basic-pitch.bundle.js` after a version bump: install
  `@spotify/basic-pitch` + `esbuild`, generate a `tfjs-shim.js` that
  re-exports every key of `@tensorflow/tfjs` from `window.tf`, then run
  `esbuild shim-entry.js --bundle --format=iife --alias:@tensorflow/tfjs=./tfjs-shim.js --minify --outfile=basic-pitch.bundle.js`
  where `shim-entry.js` imports from `@spotify/basic-pitch` and assigns to
  `window.BasicPitchLib`.
