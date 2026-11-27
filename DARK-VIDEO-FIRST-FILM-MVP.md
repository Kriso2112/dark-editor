# DARK VIDEO — first complete film MVP

## Product goal

The first usable release must take one brief and produce one playable, downloadable MP4 containing a complete Polish script, scene-by-scene visuals, Polish narration, music, readable subtitles and a finished video file.

## Architecture

- The PWA is the Android-friendly control panel.
- The Cloudflare Worker remains a lightweight API/orchestration layer; it must not run FFmpeg or long media jobs.
- A separate container service runs FFmpeg and local Polish TTS.
- Future image/video, voice and music providers are replaceable adapters. Paid providers require visible provider/model/cost and explicit per-job approval.

## Implemented in this branch

- Existing PWA storyboard and project workflow.
- New isolated Docker render service (render-service/) with health endpoint and MP4 endpoint.
- FFmpeg H.264/AAC rendering in 16:9, 9:16 and 1:1.
- Local Polish synthetic narration using eSpeak NG.
- Original black-and-gold scene-card visuals with burned-in text.
- Temporary job directories with automatic cleanup and request/scene limits.
- Render-service tests for health, validation and real MP4 output.

## Still required before the first release

- Connect the PWA to the render endpoint and provide a download/progress/error UI.
- Replace scene-card visuals with licensed/generated images or clips and track provenance.
- Add a proper music bed and timed subtitle file (SRT/VTT), synchronized against the final narration.
- Improve voice quality and add voice selection.
- Add asynchronous job queue, cancellation, progress, authentication, rate limiting, storage quotas and retention policy.
- Add a factual script-generation provider with source review and a per-job cost estimate/consent screen.
- Run all CI tests and validate output playback on a real Android phone.
- Do not deploy or merge without explicit user approval.

## Acceptance gate

Do not call the first film release complete until a user can enter a topic, create a complete film without timeline editing, download the MP4, and play it on Android. A scene-card test render is a render-engine milestone, not the finished product.
