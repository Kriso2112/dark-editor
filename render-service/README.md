# DARK VIDEO Render Engine (MVP)

A separate container service for real MP4 rendering. It is intentionally not deployed and is not run inside a Cloudflare Worker.

## What this first engine does

- Accepts a validated film manifest with 1–12 scenes.
- Creates original black-and-gold scene cards from the scene title and narration.
- Generates Polish narration locally with eSpeak NG (voice quality is synthetic and is a temporary MVP voice).
- Renders H.264/AAC MP4 in 16:9, 9:16 or 1:1.
- Burns scene text into the picture and verifies the MP4 container signature before returning it.
- Uses temporary job folders and removes them after rendering.

This is a genuine rendering proof, not yet the final visual production pipeline: scene cards are not AI-generated footage, the voice is a local synthetic voice, and a dedicated music/subtitle-timing pipeline is still outstanding.

## Run with Docker

    docker build -t dark-video-render ./render-service
    docker run --rm -p 8080:8080 dark-video-render

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

The response body is an MP4 file. The client should use a blob URL to offer a download.

## Limits and safety

- 2 MB JSON body limit; 12 scenes; each narration is limited to 5,000 characters.
- No arbitrary input file paths, shell commands, remote URLs, API keys or paid provider calls.
- Run behind HTTPS and an authenticated gateway before public deployment. Add job queue, rate limits, storage quotas and cancellation before production.
- No paid AI provider is configured. No service is deployed by this change.
