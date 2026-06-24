# `/bin` — vendored binaries

- **`yt-dlp`** — official standalone Linux build from
  [yt-dlp/yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux),
  version `2026.06.09`, sha256
  `bf8aac79b72287a6d2043074415132558b43743a8f9461a22b0141e90f16ce66`.
  Used by `api/extract-audio.js` (via `child_process.execFile`) to pull the
  audio track out of TikTok/Instagram links for the "import from video"
  visualizer feature. Self-contained (bundles its own Python interpreter),
  no system Python/Deno required.

  To update: download the new `yt-dlp_linux` asset from the latest release,
  verify its sha256 against the `SHA2-256SUMS` file in the same release, then
  replace this file and update the version/hash above.
