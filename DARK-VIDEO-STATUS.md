# DARK VIDEO — implementation status

Updated: 2026-11-28
Branch: feature/dark-video-multipart-render-clean (based on feature/dark-video-first-film-mvp)
Pull request: https://github.com/Kriso2112/dark-editor/pull/14 (draft, targets feature/dark-video-first-film-mvp).

## Implemented in this branch

- Mobile-first black-and-gold PWA with topic, category, duration, format and tone controls.
- Local storyboard and narration-outline templates, scene editing and browser project persistence.
- Project JSON, script TXT and storyboard CSV exports.
- PWA manifest, offline app shell and install prompt where supported.
- Existing DARK AI Worker foundation with mock mode and paid-provider safeguards.
- Separate Docker render service; it is deliberately not hosted inside Cloudflare Workers.
- FFmpeg H.264/AAC MP4 renderer for 16:9, 9:16 and 1:1.
- Multi-part rendering: each scene is rendered as a normalized MP4 segment, all segments are concatenated into one final file, and a single global audio mix plus continuous Polish subtitle timeline is applied after joining.
- Local Polish synthetic speech through eSpeak NG.
- Original generated scene-card graphics with the scene title and narration text burned into the video.
- PWA MP4 export button that sends the edited scene manifest to the configured render service and downloads the returned MP4.
- Render-service CORS allowlist, JSON size/scene validation and temporary file cleanup.
- Multi-part limits: 120 scenes, 120,000 total narration characters, 10,000 characters per scene and 10 minutes measured from generated speech.
- Node tests for render service and Playwright test for the MP4 download flow.
- GitHub Actions workflow extended to run browser, Worker and renderer tests and build the renderer Docker image.

## Important limitations

- The current video visuals are designed scene cards, not AI-generated images or video clips.
- The current Polish narrator is synthetic eSpeak NG, not a natural neural voice.
- The current audio bed is a generated ambient tone, not a finished licensed music score. Subtitles are currently generated from the Polish narration and embedded as a single MP4 subtitle track; standalone SRT/VTT export and fine-grained word-level timing are not implemented.
- Script generation is still template/demo based unless the separately configured paid AI provider is enabled through a future cost-consent interface.
- Rendering supports an asynchronous filesystem-backed queue with progress, retry from the beginning and MP4 download; the synchronous endpoint remains for compatibility. There is no cancellation, multi-instance locking, authentication, rate limiting, quota or retention cleanup. Long renders still need persistent mounted storage.
- The renderer has not been deployed; the user must not enter a public endpoint until deployment and HTTPS/authentication/CORS setup are reviewed.
- No paid AI service, API key or secret was configured.
- Automated tests now cover a two-part MP4 render and verify video, audio and subtitle streams, plus the 120-scene limit. The final CI result for this new branch is not yet confirmed.
- The output has not yet been verified on a physical Android device.
- No merge to main or production deployment has been performed.

## Remaining work before first-film release

1. Improve script generation with factual source checking and a visible cost/consent gate.
2. Add scene image/video assets with licence/source tracking.
3. Add natural Polish TTS options and synchronized subtitle generation.
4. Add licensed/original music and volume ducking under narration.
5. Harden the asynchronous render queue with cancellation, multi-instance locking, retention cleanup, authentication, rate limits and resumable segment checkpoints.
6. Add authentication, rate limiting, quotas and cleanup policies before public hosting.
7. Deploy only after security and storage controls are reviewed; then test a complete 60–90 second film on a real Android phone and validate longer renders.
8. Verify audio/video quality, aspect ratios, subtitle legibility, file size and recovery after refresh.

## Completion rule

Do not report a percentage for the whole product based only on code additions. Do not call the first release complete until a user can enter a topic, obtain a complete film without timeline editing, download the MP4 and play it on Android.


## Kolejka renderowania — etap przygotowany do testów

- PWA dodaje render do kolejki przez `POST /api/render/jobs`, odczytuje status i procent postępu oraz udostępnia pobranie MP4.
- Zadania i gotowe pliki są zapisywane w katalogu danych renderera; po restarcie zadania przerwane wracają do kolejki.
- Nieudane zadanie można ponowić. Ponowienie oraz odzyskanie po restarcie zaczyna render od początku, a nie od ostatniej klatki.
- Istniejący synchroniczny endpoint `POST /api/render` pozostaje dla zgodności.
- Kolejka obsługuje jedną instancję renderera i do 25 oczekujących zadań. Nie ma jeszcze anulowania, automatycznego czyszczenia danych ani obsługi wieloinstancyjnej.
- Zmiany są w draft PR #14. CI dla najnowszego commita jest w toku; nie uznajemy funkcji za zweryfikowaną, dopóki wszystkie testy i build nie przejdą.
- Nie wykonano deployu ani testu na fizycznym Androidzie.
