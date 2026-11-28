# DARK VIDEO — implementation status

Updated: 2026-11-28
Branch: feature/dark-video-secure-staging-hardening (based on feature/dark-video-multipart-render-clean)
Pull request: https://github.com/Kriso2112/dark-editor/pull/15 (draft); underlying multi-part renderer remains in draft PR #14.

## Implemented in this branch

- Mobile-first black-and-gold PWA with topic, category, duration, format and tone controls.
- Local storyboard and narration-outline templates, scene editing and automatic browser project persistence.
- Project JSON, script TXT and storyboard CSV exports.
- PWA manifest, offline app shell and install prompt where supported.
- Existing DARK AI Worker foundation with mock mode and paid-provider safeguards.
- Separate Docker render service; it is deliberately not hosted inside Cloudflare Workers.
- FFmpeg H.264/AAC MP4 renderer for 16:9, 9:16 and 1:1.
- Multi-part rendering: each scene is rendered as a normalized MP4 segment, all segments are concatenated into one final file, and a single global audio mix plus continuous Polish subtitle timeline is applied after joining.
- Local Polish synthetic speech through eSpeak NG.
- Original generated scene-card graphics with the scene title and narration text burned into the video.
- PWA MP4 export flow that queues the edited scene manifest, displays progress, restores job status after reload and downloads the completed MP4.
- Render-service bearer-token authentication for every API endpoint, constant-time token comparison, exact-origin CORS allowlist and Authorization preflight support.
- Per-IP request/job rate limits, strict positive-integer configuration validation, output-size and total-storage ceilings, a single-process filesystem lock and a production requirement for a 32-byte minimum token.
- Production disables the legacy synchronous render endpoint; expensive renders must use the bounded asynchronous queue. The synchronous route remains available only when explicitly enabled outside production.
- Session-only PWA token handling; after reload, the user re-enters the token before the app polls the restored job.
- Private staging Compose profile with loopback-only port binding, read-only container filesystem, dropped capabilities, no-new-privileges, PID/CPU/memory limits and persistent job volume.
- Private staging and Android test runbook plus a safe environment-variable template.
- Multi-part limits: 120 scenes, 120,000 total narration characters, 10,000 characters per scene and 10 minutes measured from generated speech.
- Node tests for render service and Playwright test for the MP4 download flow.
- GitHub Actions workflow extended to run browser, Worker and renderer tests and build the renderer Docker image.

## Important limitations

- The current video visuals are designed scene cards, not AI-generated images or video clips.
- The current Polish narrator is synthetic eSpeak NG, not a natural neural voice.
- The current audio bed is a generated ambient tone, not a finished licensed music score. Subtitles are currently generated from the Polish narration and embedded as a single MP4 subtitle track; standalone SRT/VTT export and fine-grained word-level timing are not implemented.
- Script generation is still template/demo based unless the separately configured paid AI provider is enabled through a future cost-consent interface.
- Rendering supports an asynchronous filesystem-backed queue with progress, retry from the beginning and MP4 download. It is single-instance/single-host; the filesystem lock is not distributed coordination. There is no cancellation, account-based authorization, distributed locking, resumable segment checkpointing or load/stress-test result. Completed/failed jobs are pruned after 7 days, with a 100-job cap. Long renders require persistent mounted storage.
- The renderer has not been deployed. The new Compose profile and runbook prepare a private staging host; they do not deploy it or make the service publicly accessible.
- No paid AI service, API key or secret was configured.
- Automated tests now cover a two-part MP4 render and verify video, audio and subtitle streams, plus the 120-scene limit. The final CI result for this new branch is not yet confirmed.
- The output has not yet been verified on a physical Android device.
- No merge to main, staging deployment or production deployment has been performed.

## Remaining work before first-film release

1. Improve script generation with factual source checking and a visible cost/consent gate.
2. Add scene image/video assets with licence/source tracking.
3. Add natural Polish TTS options and synchronized subtitle generation.
4. Add licensed/original music and volume ducking under narration.
5. Add cancellation and resumable segment checkpoints; consider distributed coordination only if multi-host operation becomes necessary.
6. Add account-based authorization, host-level quotas, monitoring, backup/retention policy and a reverse-proxy/WAF review before any public hosting.
7. Run the new CI suite, then deploy only to private staging after a host and TLS reverse proxy are configured.
8. Test a complete 60–90 second film on a real Android phone; verify video/audio/subtitle playback, aspect ratios, download, reload recovery and controlled restart recovery.

## Completion rule

Do not report a percentage for the whole product based only on code additions. Do not call the first release complete until a user can enter a topic, obtain a complete film without timeline editing, download the MP4 and play it on Android.


## Kolejka renderowania — etap przygotowany do testów

- PWA dodaje render do kolejki przez `POST /api/render/jobs`, odczytuje status i procent postępu oraz udostępnia pobranie MP4.
- Zadania i gotowe pliki są zapisywane w katalogu danych renderera; po restarcie zadania przerwane wracają do kolejki.
- Nieudane zadanie można ponowić. Ponowienie oraz odzyskanie po restarcie zaczyna render od początku, a nie od ostatniej klatki.
- Istniejący synchroniczny endpoint `POST /api/render` pozostaje dla zgodności.
- Kolejka obsługuje jedną instancję renderera i do 25 oczekujących zadań. Przechowuje do 100 zadań, a ukończone/nieudane starsze niż 7 dni usuwa przy starcie usługi lub przyjmowaniu kolejnego zadania. Nie ma jeszcze anulowania ani obsługi wieloinstancyjnej.
- Poprawki bezpieczeństwa i przygotowanie prywatnego stagingu są na osobnej gałęzi; PR zostanie otwarty jako draft do gałęzi `feature/dark-video-first-film-mvp`. CI musi przejść przed uznaniem ich za zweryfikowane.
- W Dockerze dane kolejki są zapisywane pod `/data/render-jobs`; wymagany jest trwały wolumen `/data`. Nie wykonano deployu ani testu na fizycznym Androidzie.
