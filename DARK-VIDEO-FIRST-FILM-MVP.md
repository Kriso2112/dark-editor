# DARK VIDEO — first complete film MVP

## Product goal

The first usable release must take one brief and produce one playable, downloadable MP4 containing:
- a complete Polish script,
- scene-by-scene visuals,
- Polish narration,
- background music,
- readable subtitles,
- a finished 16:9 video file.

The first acceptance target is a 60–90 second 720p film. A longer 5–10 minute export is a later performance milestone, not part of the first acceptance test.

## End-to-end workflow

1. **Brief** — topic, style, duration, aspect ratio and language.
2. **Script** — generate a structured Polish script and scene list; validate duration, factual claims and scene timing.
3. **Assets** — attach a generated image/clip or a user-approved/licensed stock asset to every scene. Track each asset's source and usage rights.
4. **Narration** — generate Polish speech and retain the audio file plus timing metadata.
5. **Music and captions** — select licensed/cleared music, create timed subtitles from the final narration.
6. **Render** — assemble scene visuals, motion, transitions, voice, music and captions into MP4.
7. **Quality gate** — verify file existence, codec, duration, dimensions, audio stream and subtitle readability before enabling download.

## Architecture decisions

- Keep the existing PWA as the Android-friendly control panel.
- Keep the Cloudflare Worker as a lightweight API/orchestration layer; it must not attempt to run FFmpeg or long-running media rendering inside a Worker request.
- Put media rendering in a separate container service with FFmpeg. It should accept a validated render manifest, process an asynchronous job, expose progress/status, and return a downloadable MP4.
- Store temporary source media and final renders in object storage with expiry and size limits. Do not store API credentials in the browser or Git.
- Define replaceable adapters for script generation, image/video assets, Polish TTS and music. The local/mock adapters must be safe and must clearly label demo output.
- Paid providers stay disabled until the UI can show provider, model, estimated cost/range, usage limits and explicit per-job consent.

## First implementation milestones

### M0 — Stable baseline
- Fix JavaScript parse/runtime errors.
- Make the browser tests pass.
- Keep the existing project save/restore behavior intact.

### M1 — Render engine proof
- Add a containerized FFmpeg render service.
- Create a deterministic test manifest using only bundled/generated test media and an original test tone.
- Produce a short 16:9 MP4 with image motion, narration track placeholder, captions and music track placeholder.
- Verify output with ffprobe and automated tests.

### M2 — Real content pipeline
- Add the script provider adapter and structured-output validation.
- Add an asset adapter with source/licence metadata.
- Add Polish TTS and music adapters behind cost/rights gates.
- Generate subtitles from final speech timing.

### M3 — One-click production
- Connect the PWA to asynchronous render jobs.
- Show progress, failures, retry/cancel and output preview/download.
- Persist project and render status safely.

### M4 — Android acceptance
- Run the full flow on a real Android phone.
- Confirm background/foreground behavior, uploads, downloads, storage limits and recovery after refresh.
- Test 60–90 seconds first, then 5 minutes, then 10 minutes.

## Acceptance criteria

The MVP is not complete until a new user can enter a topic and, without manually editing a timeline, obtain an MP4 that:
- plays on Android and desktop,
- has the selected aspect ratio and expected duration,
- contains a full Polish narration track,
- shows synchronized Polish subtitles,
- contains a visual for every scene,
- has audible but non-dominating background music,
- has no missing-media gaps or clipped audio,
- passes automated media inspection and a real-device playback check.

## Explicit non-goals for the first release

- A full multi-track manual editor replacement.
- Unlimited video length or 4K rendering.
- Multiple AI providers at launch.
- Automatic YouTube upload.
- Paid AI generation without an explicit cost screen and per-job approval.

## Current baseline note

The existing DARK VIDEO prototype currently creates a local/demo storyboard and exports project/script/storyboard files. It does not yet generate media, narration, music or MP4. The Worker source is not deployed. The first MVP must add those missing production stages rather than describing the current storyboard prototype as a video generator.
