# DARK VIDEO — private staging and Android test runbook

This is a preparation guide only. It does not deploy anything, create a hosting account, publish the renderer or expose a public endpoint.

## 1. Host prerequisites

Use a private Linux host or VM with Docker Engine and the Docker Compose plugin. Start with at least 4 GB RAM and enough disk for the persistent volume plus temporary render files. Keep the host private; do not expose port 8080 to the internet.

The renderer is intentionally single-instance. Do not run multiple replicas or share its data volume with another renderer.

## 2. Configure secrets

On the staging host:

1. Copy `.env.staging.example` to `.env.staging`.
2. Generate a unique secret with `openssl rand -hex 32`.
3. Put the generated value in `RENDER_API_TOKEN`.
4. Set `ALLOWED_ORIGIN` to the exact HTTPS origin serving the PWA (scheme + hostname only, no path and no trailing slash).
5. Keep `.env.staging` private; never commit it, paste the token into chat, or put it in a URL.

Production startup rejects a missing or shorter-than-32-byte token. The production synchronous `POST /api/render` endpoint is disabled; use the bounded asynchronous queue.

## 3. Build and start privately

From the repository root on the staging host:

```sh
docker compose -f render-service/compose.staging.yml up -d --build
```

The published port is bound to `127.0.0.1:8080`, not to a public interface. The compose profile applies a read-only container filesystem, drops Linux capabilities, disables privilege escalation, limits PIDs/CPU/memory and mounts persistent job data at `/data`.

For browser testing, place a TLS reverse proxy in front of this loopback-only service. Keep the upstream private, enforce HTTPS, and do not add a broad wildcard CORS rule. Set `ALLOWED_ORIGIN` to the PWA's exact HTTPS origin. Do not expose port 8080 directly.

## 4. Verify the service from the host

Health is intentionally public:

```sh
curl -i http://127.0.0.1:8080/health
```

An unauthenticated API request must return HTTP 401:

```sh
curl -i http://127.0.0.1:8080/api/render/jobs/00000000-0000-4000-8000-000000000000
```

After loading the secret into a protected shell environment, the same request with a valid token should return HTTP 404 (the random job does not exist), not 401. Never print the token into shared logs or screenshots.

Check container status and logs locally:

```sh
docker compose -f render-service/compose.staging.yml ps
docker compose -f render-service/compose.staging.yml logs --tail=100 dark-video-render
```

## 5. Android end-to-end checklist

Only after a private HTTPS reverse proxy is configured:

1. Open the staging PWA on Android.
2. Open **EKSPORT MP4 · SERWER RENDERUJĄCY**.
3. Enter the HTTPS renderer URL and the staging token.
4. Generate a short project (about 30–60 seconds) and start **EKSPORT MP4**.
5. Confirm progress changes from queued to running to completed.
6. Download the MP4 and play it in the Android gallery/player.
7. Refresh the PWA, re-enter the token, and confirm the last job status is restored.
8. Test a failed job/retry only in staging, then confirm the queue and downloaded file remain available after a controlled container restart.

The token is held in page memory only. After reload or closing the tab, the user must enter it again before the app polls the saved job. Do not save the token in browser storage.

## 6. Stop and clean up

Stop the service without deleting its persistent volume:

```sh
docker compose -f render-service/compose.staging.yml down
```

Deleting the named volume permanently removes staged jobs and rendered videos:

```sh
docker volume rm dark-video-staging-data
```

Run the destructive volume command only when you intentionally want to erase staging data.

## Security boundary and remaining work

This staging setup is single-user/single-token, single-process and single-host. Rate limiting is process-local. There is no account-level authorization, distributed locking, cancellation, resumable segment checkpointing, WAF configuration or load/stress-test result. The filesystem lock is not a distributed lock. A reverse proxy must provide TLS and private access controls; CORS is not authentication.

Do not use this setup as a public production service. Public release still requires a separate security review, monitoring/alerting, backup/retention policy, verified host disk quotas and load testing.
