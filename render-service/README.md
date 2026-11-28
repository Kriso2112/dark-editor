# DARK VIDEO Render Engine (MVP)

A separate container service for real MP4 rendering. It is intentionally not deployed and is not run inside a Cloudflare Worker.

## What this first engine does

- Accepts a validated film manifest with 1–120 scenes/segments and up to 10 minutes of measured narration.
- Creates each scene as a separate render segment, then concatenates the segments into one MP4. Scene cards use the title and narration.
- Generates Polish narration locally with eSpeak NG (voice quality is synthetic and is a temporary MVP voice).
- Renders H.264/AAC MP4 in 16:9, 9:16 or 1:1.
- Adds a subtle slow zoom to scene cards, mixes a quiet original ambient tone under narration, and embeds a synchronized Polish subtitle track.
- Verifies the MP4 container signature before returning it.
- Keeps one global narration timeline, mixes one continuous ambient bed after concatenation, and writes one continuous Polish subtitle track. Uses temporary job folders and removes them after rendering.

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

The response body is one MP4 file containing all scene segments. Segments are normalized to the same resolution, frame rate and codecs before concatenation. The final render has one continuous audio mix and one global subtitle timeline. The client should use a blob URL to offer a download.

## Multi-part render behavior

The renderer creates a temporary MP4 for each scene, then joins those parts with FFmpeg's concat demuxer. This is not ten separate calls to a paid AI video provider. One request carries the whole film manifest; the renderer synthesizes narration for each scene, measures the actual speech duration, and rejects the project if the resulting film would exceed 10 minutes. Ambient audio and subtitles are added on the global timeline after joining. For reliable long-form production, a future release still needs a durable asynchronous job queue, progress reporting, retries and cancellation.

## Limits and safety

- 2 MB JSON body limit; up to 120 scenes/segments; up to 10,000 characters per scene and 120,000 total narration characters; hard cap of 10 minutes measured from generated speech.
- No arbitrary input file paths, shell commands, remote URLs, API keys or paid provider calls.
- Run behind HTTPS and an authenticated gateway before public deployment. Add job queue, rate limits, storage quotas and cancellation before production.
- No paid AI provider is configured. No service is deployed by this change.
