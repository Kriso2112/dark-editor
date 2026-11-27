# DARK AI Worker — backend foundation

A Cloudflare Worker API scaffold for DARK VIDEO. It is intentionally **not deployed** and does not contain credentials.

## Endpoints

- `GET /api/health` — service status and whether a provider is configured.
- `POST /api/generate` — validates a DARK VIDEO brief and returns a structured project.

With no provider secrets configured, the endpoint returns a clearly labelled deterministic mock project. This is useful for testing the client/server contract without charges.

## Optional OpenAI-compatible provider

The adapter is present but locked behind all of these conditions:
1. Set an OpenAI API key as a Cloudflare Worker secret named `OPENAI_API_KEY`.
2. Set `OPENAI_MODEL` as a Worker variable to a model available to that API account.
3. Set `ENABLE_PAID_AI=true`.
4. Set `DARK_AI_ACCESS_TOKEN` as a second Worker secret.
5. Set `ALLOWED_ORIGIN` to the exact HTTPS origin of the deployed app.
6. Each generation request must include the access token and both `confirmPaid: true` and `costAcknowledged: true`.

The app UI is not yet connected to this paid route. Do not enable it until an authenticated UI can show the provider/model and a cost warning before each job. The endpoint does not calculate an exact price; the caller must review the provider's current pricing. The default configuration keeps paid generation disabled.

## Local development

Install Wrangler in this folder (or use `npx wrangler`), then run:

```sh
npx wrangler dev
```

For local secrets, create `.dev.vars` in this folder (never commit it). Example:

```ini
OPENAI_API_KEY="your-key"
DARK_AI_ACCESS_TOKEN="a-long-random-token"
```

Set `OPENAI_MODEL`, `ENABLE_PAID_AI`, and `ALLOWED_ORIGIN` in a local Wrangler vars override when testing. The production config leaves paid AI disabled.

## Security notes

- No secret values belong in Git, browser JavaScript, or the PWA.
- Paid mode requires server-side API key, exact allowed origin, bearer access token, and per-request cost acknowledgment.
- The API currently has no user accounts, persistent database, billing ledger, or rate-limiting binding. Keep paid mode disabled until those protections and an authenticated UI are implemented.
- Generated factual content must be reviewed and fact-checked before publication.

## Test

From the repository root run `npm run test:dark-ai`.
