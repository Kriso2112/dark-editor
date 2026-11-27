# DARK WORK BRIDGE deployment bootstrap

This directory contains the source and Wrangler configuration for a **new**
Cloudflare Worker named `dark-work-bridge`. It is deliberately separate from
the existing `dark-work-api` Worker, which this deployment must not modify.

## What this does

- Provides a read-only `GET /` and `GET /health` health check.
- Allows GitHub Actions to deploy this new Worker after changes are merged to
  `main`.
- Keeps Cloudflare credentials in GitHub Actions repository secrets.

## What this does not do

- It does not provide ChatGPT with a direct connection to arbitrary Cloudflare
  APIs.
- It does not expose remote shell access or arbitrary code execution.
- It does not accept deployment or account-management commands over HTTP.

A direct ChatGPT-to-Worker management integration requires a supported custom
connector/MCP endpoint to be configured separately. Do not add a broad,
unauthenticated command endpoint.

## Required GitHub repository secrets

In GitHub, open **Settings → Secrets and variables → Actions → New repository
secret** and add:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with the Workers Scripts
  write permission for the account containing this new Worker.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

Never put either value in source files, commits, chat messages, or workflow logs.
The token is an account-level permission and may be able to modify other Workers
in that account; keep it private and revoke it if exposed.

The deploy workflow runs only when files in this directory or its workflow
change on `main`, or when manually started from the Actions tab.
