# DARK WORK API deployment bootstrap

This directory contains the source and Wrangler configuration for the existing
Cloudflare Worker `dark-work-api`.

## What this does

- Provides a read-only `GET /` and `GET /health` health check.
- Allows GitHub Actions to deploy this Worker after changes are merged to
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

- `CLOUDFLARE_API_TOKEN`: a newly created Cloudflare token scoped to edit the
  existing `dark-work-api` Worker only, where supported.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

Never put either value in source files, commits, chat messages, or workflow logs.

The deploy workflow runs only when files in this directory or its workflow
change on `main`, or when manually started from the Actions tab.
