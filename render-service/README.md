# DARK VIDEO Render Engine (MVP)

A separate container service for real MP4 rendering. It is intentionally not deployed and is not run inside a Cloudflare Worker.

## What this first engine does

- Accepts a validated film manifest with 1–120 scenes/segments and up to 10 minutes of measured narration.
- Creates each scene as a separate render segment, then concatenates the segments into one MP4. Scene cards use the title and narration.
- Generates Polish narration locally with eSpeak NG (voice quality is synthetic and is a temporary MVP voice).
- Renders H.264/AAC MP4 in 16:9, 9:16 or 1:1.
- Adds a subtle slow zoom to scene cards, mixes a quiet original ambient tone under narration, and embeds a synchronized Polish subtitle track.
- Verifies the MP4 container signature before returning it.
- Keeps one global narration timeline, mixes one continuous ambient bed after concatenation, and writes one continuous Polish subtitle track. Temporary scene-render files are removed after rendering; queued job metadata and completed MP4 files are retained in the configured data directory.

This is a genuine rendering proof, not yet the final visual production pipeline: scene cards are not AI-generated footage, the voice is a local synthetic voice, and a dedicated music/subtitle-timing pipeline is still outstanding.

## Run with Docker

    docker build -t dark-video-render ./render-service
    docker run --rm -p 8080:8080 -e ALLOWED_ORIGIN=https://your-pwa.example.com -e RENDER_API_TOKEN -v dark-video-data:/data dark-video-render

Health: GET /health

Render: POST /api/render with JSON:

    {
      "topic": "Tajemnice piramid",
      "format": "16:9",
      "scenes": [
        {
          "title": "Kamienne giganty",
          "narration": "Na pustynnym płaskowyżu wznoszą się budowle, które od tysiącleci przyciągają uwagę świata.",
          "visual": "Szeroki plan piramid o świcie",
          "seconds": 8
        }
      ]
    }

The response body is one MP4 file containing all scene segments. Segments are normalized to the same resolution, frame rate and codecs before concatenation. The final render has one continuous audio mix and one global subtitle timeline. The client should use a blob URL to offer a download.

## Multi-part render behavior

The renderer creates a temporary MP4 for each scene, then joins those parts with FFmpeg's concat demuxer. This is not ten separate calls to a paid AI video provider. One request carries the whole film manifest; the renderer synthesizes narration for each scene, measures the actual speech duration, and rejects the project if the resulting film would exceed 10 minutes. Ambient audio and subtitles are added on the global timeline after joining. Long-form rendering uses the filesystem-backed asynchronous queue below. Cancellation and resumable segment checkpoints are not implemented.

## Limits and safety

- 2 MB JSON body limit; up to 120 scenes/segments; up to 10,000 characters per scene and 120,000 total narration characters; hard cap of 10 minutes measured from generated speech.
- No arbitrary input file paths, shell commands, remote URLs, API keys or paid provider calls.
- Every `/api/*` endpoint requires `Authorization: Bearer <RENDER_API_TOKEN>`. The token is compared in constant time and must be supplied through the process environment/secret manager; never put it in a URL, source file, image, or repository.
- `/health` is intentionally public and returns only minimal service status. CORS allows only the exact `ALLOWED_ORIGIN`; CORS is not authentication.
- In-memory rate limits default to 30 API requests/minute and 5 new render jobs/minute per client IP. Configure with `DARK_VIDEO_RATE_LIMIT` and `DARK_VIDEO_CREATE_RATE_LIMIT`.
- Storage defaults: 1 GiB total job directory (`DARK_VIDEO_MAX_STORAGE_BYTES`) and 512 MiB per final MP4 (`DARK_VIDEO_MAX_OUTPUT_BYTES`). Limits are checked before accepting jobs and before saving completed output.
- A filesystem lock prevents two local renderer processes from sharing one jobs directory. Run exactly one container/replica with this volume; the lock is not a distributed multi-host coordination system.
- Docker runs as the unprivileged `node` user and uses the persistent `/data` volume. Keep the volume private and back it with a disk quota at the hosting layer as an additional safeguard.
- Use HTTPS, a strong random token (at least 32 random bytes; production startup rejects shorter secrets), private network access where possible, and host-level CPU/memory/disk limits. Do not expose the renderer publicly until the hosting configuration and Android browser flow have been tested.
- No paid AI provider is configured. No service is deployed by this change.


## Kolejka renderowania (wersja eksperymentalna)

DARK VIDEO udostępnia teraz asynchroniczne zadania:
- `POST /api/render/jobs` — dodaje zadanie i zwraca `jobId` oraz status HTTP 202.
- `GET /api/render/jobs/:id` — zwraca status, etap, procent postępu i liczbę prób.
- `POST /api/render/jobs/:id/retry` — ponawia nieudane zadanie od początku.
- `GET /api/render/jobs/:id/download` — pobiera MP4 po zakończeniu.
- Dotychczasowy synchroniczny `POST /api/render` pozostaje dla zgodności.

Metadane zadań, wejściowy manifest i gotowe MP4 są przechowywane na dysku w katalogu `DARK_VIDEO_JOBS_DIR` (domyślnie `render-service/data/render-jobs`). Przy restarcie serwera zadania przerwane w statusie queued/running wracają do kolejki i renderują się od początku. To nie jest kontynuacja od ostatniej klatki ani od ostatniego segmentu. Jedna instancja renderera przetwarza zadania kolejno, a limit oczekujących zadań wynosi 25.

Interfejs PWA zapamiętuje identyfikator zadania, odświeża status i pokazuje postęp. Po ponownym otwarciu strony próbuje odtworzyć status ostatniego zadania. Nieudane zadanie można ponowić, a gotowy film pobrać. Brak jeszcze anulowania zadania, wieloinstancyjnej blokady kolejki, automatycznego czyszczenia starych plików i testów obciążeniowych. Katalog danych musi być trwałym wolumenem na hostingu; efemeryczny filesystem hostingu nie gwarantuje zachowania zadań po wymianie instancji.


## Asynchronous render queue

The PWA uses the queue API for long renders:
- `POST /api/render/jobs` — validates the manifest before accepting it and returns HTTP 202 with a job ID.
- `GET /api/render/jobs/:id` — returns status, stage, percentage and attempt count.
- `POST /api/render/jobs/:id/retry` — retries a failed job from the beginning.
- `GET /api/render/jobs/:id/download` — downloads the completed MP4.
- The original synchronous `POST /api/render` endpoint remains available for compatibility.

The queue stores job metadata and final MP4 files in `DARK_VIDEO_JOBS_DIR`. The Docker image defaults this to `/data/render-jobs`; mount a persistent volume at `/data` as shown above. If the container is recreated without the volume, saved jobs and films will be lost. Interrupted queued/running jobs are re-queued after restart and rendered again from the beginning; completed scene segments are not resumed.

Replace the example ALLOWED_ORIGIN value with the exact HTTPS origin serving the PWA. CORS is not authentication: the current queue is single-process/single-instance, permits up to 25 waiting jobs and retains at most 100 stored jobs; completed/failed jobs older than 7 days are pruned. It does not yet include cancellation, distributed multi-host coordination, account-based quotas or resumable segment checkpoints. Do not expose it publicly until those controls are implemented and reviewed.


## Secure test setup

Set a strong random secret outside the repository before starting the container. For example, generate one with a password manager or a cryptographically secure secret generator, then export it as `RENDER_API_TOKEN` in the deployment environment. Do not reuse the example test token.

Required production environment:
- `NODE_ENV=production` (set in the Docker image)
- `RENDER_API_TOKEN` (required; startup fails if absent)
- `ALLOWED_ORIGIN` (exact HTTPS origin of the PWA, without a path)
- Persistent volume mounted at `/data`

Optional resource controls:
- `DARK_VIDEO_MAX_STORAGE_BYTES` (default 1073741824)
- `DARK_VIDEO_MAX_OUTPUT_BYTES` (default 536870912)
- `DARK_VIDEO_RATE_LIMIT` (default 30 per minute)
- `DARK_VIDEO_CREATE_RATE_LIMIT` (default 5 new jobs per minute)

The PWA asks for the bearer token in the MP4 settings. It is held only in the current page's memory, not localStorage; the user must enter it again after closing/reloading the tab. All status, retry and download calls also send the token. Use HTTPS for every non-local connection.

The health endpoint is public; all API endpoints require the bearer token. Production disables the legacy synchronous `/api/render` endpoint (HTTP 410) so expensive renders must use the bounded queue. It remains available only when `ENABLE_SYNC_RENDER=true` outside production for local compatibility tests. Rate limiting is process-local and intended as a first safety layer, not a substitute for a reverse proxy/WAF or account-based quotas. The filesystem lock supports one renderer process on one shared local filesystem only. Do not scale this service to multiple hosts/replicas. The legacy synchronous render endpoint is disabled in production and must not be enabled there.

No staging or production service is deployed by this repository change. First run the automated CI tests, then deploy only to a private staging environment with a persistent volume, strong secret, TLS and strict origin allowlist. Perform the Android end-to-end check before considering any public release.
