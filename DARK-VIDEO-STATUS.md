# DARK VIDEO — implementation status

Updated: 2026-11-28
Branch: feature/dark-video-first-film-mvp
Pull request: https://github.com/Kriso2112/dark-editor/pull/12 (draft, targets work/dark-editor-1.0-stabilization).

## Implemented in this branch

- Mobile-first black-and-gold PWA with topic, category, duration, format and tone controls.
- Local storyboard and narration-outline templates, scene editing and browser project persistence.
- Project JSON, script TXT and storyboard CSV exports.
- PWA manifest, offline app shell and install prompt where supported.
- Existing DARK AI Worker foundation with mock mode and paid-provider safeguards.
- Separate Docker render service; it is deliberately not hosted inside Cloudflare Workers.
- FFmpeg H.264/AAC MP4 renderer for 16:9, 9:16 and 1:1.
- Local Polish synthetic speech through eSpeak NG.
- Original generated scene-card graphics with the scene title and narration text burned into the video.
- PWA MP4 export button that sends the edited scene manifest to the configured render service and downloads the returned MP4.
- Render-service CORS allowlist, JSON size/scene validation and temporary file cleanup.
- Node tests for render service and Playwright test for the MP4 download flow.
- GitHub Actions workflow extended to run browser, Worker and renderer tests and build the renderer Docker image.

## Important limitations

- The current video visuals are designed scene cards, not AI-generated images or video clips.
- The current Polish narrator is synthetic eSpeak NG, not a natural neural voice.
- A proper music bed and a separate timed SRT/VTT subtitle track are not implemented yet.
- Script generation is still template/demo based unless the separately configured paid AI provider is enabled through a future cost-consent interface.
- Rendering is currently a synchronous HTTP request; there is no durable job queue, progress, retry/cancel, user authentication or storage retention system.
- The renderer has not been deployed; the user must not enter a public endpoint until deployment and HTTPS/authentication/CORS setup are reviewed.
- No paid AI service, API key or secret was configured.
- The renderer's automated end-to-end MP4 test is being expanded to inspect video, audio and subtitle streams; its final CI result is not yet confirmed.
- The output has not yet been verified on a physical Android device.
- No merge to main or production deployment has been performed.

## Remaining work before first-film release

1. Improve script generation with factual source checking and a visible cost/consent gate.
2. Add scene image/video assets with licence/source tracking.
3. Add natural Polish TTS options and synchronized subtitle generation.
4. Add licensed/original music and volume ducking under narration.
5. Add asynchronous render jobs, progress, retries, cancellation and safe storage.
6. Add authentication, rate limiting, quotas and cleanup policies before public hosting.
7. Test a complete 60–90 second film on a real Android phone, then longer 5–10 minute videos.
8. Verify audio/video quality, aspect ratios, subtitle legibility, file size and recovery after refresh.

## Completion rule

Do not report a percentage for the whole product based only on code additions. Do not call the first release complete until a user can enter a topic, obtain a complete film without timeline editing, download the MP4 and play it on Android.
