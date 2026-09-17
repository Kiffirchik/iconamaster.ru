# Local workshop videos

The four owner-supplied films are hosted under `/assets/videos/` on MTW and listed in `public/content/videos.json`. Existing YouTube/Vimeo entries remain supported.

- The initial page mounts only poster buttons; MP4 elements and sources appear only after a visitor clicks.
- Native controls, inline mobile playback and the original display aspect ratio are preserved.
- MP4s are H.264/AAC lossless stream copies with faststart metadata. Do not upscale, crop, redraw or overwrite source footage.
- JPEG posters are real frames with the source rotation applied. No generated imagery.
- `reports/video-import.json` records source names, SHA-256, display rotation, poster timestamps and deployed file hashes.

## Reimport on Windows

Node/npm are the normal project prerequisites. Reimport additionally requires FFmpeg and FFprobe on PATH; site builds and playback do not.

Run `node scripts/import-local-videos.mjs "<folder containing the original MP4 files>"`. The source filenames, titles and poster timestamps are in `scripts/data/local-videos.json`. Outputs go to this repository, not a machine-specific path.

Review the derived files and manifest, then run `npm run verify`. Keep MP4s and posters in Git with the content definitions (each current MP4 is below 45 MB).

## Publication

Commit and push verified source before publishing. For the September 17 release, `package-videos-20260917.mjs` prepares a narrow overlay from a fresh live HTML snapshot, and `deploy-videos-20260917.sh` checks old/new hashes, preserves all other JSON and admin files, archives the old site and performs a guarded directory swap.

After publication verify HTTP 206 byte-range responses, `video/mp4`, no media sources before click, playback/seek and mobile layout. Hosting bandwidth charges/traffic limits are tariff-specific; the Unix quota check alone does not establish billing policy.
