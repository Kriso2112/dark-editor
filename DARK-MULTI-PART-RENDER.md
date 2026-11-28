# DARK MULTI-PART RENDER

## Purpose

Render a longer film as a sequence of scene segments and deliver one final MP4. This is a rendering strategy inside DARK VIDEO, not a way to bypass a third-party AI provider's generation limits.

## Current implementation

1. The PWA sends one film manifest containing the topic, output format and ordered scenes.
2. The render service validates the manifest and caps it at 120 scenes, 120,000 total narration characters and 10 minutes of measured generated speech.
3. eSpeak NG creates a Polish narration WAV for each scene.
4. FFmpeg renders each scene as a temporary H.264/AAC MP4 segment using the same dimensions, frame rate and encoding settings.
5. FFmpeg concatenates the ordered segments into one intermediate MP4.
6. The renderer creates one continuous ambient bed and applies one global Polish subtitle timeline across the joined film.
7. The service returns a single MP4 download and removes its temporary files.

The renderer measures actual narration duration rather than trusting the requested scene seconds. A film exceeding ten minutes is rejected with HTTP 413.

## Current limits

| Limit | Value |
|---|---:|
| Scene/segment count | 120 |
| Measured total narration | 10 minutes |
| Narration per scene | 10,000 characters |
| Total narration text | 120,000 characters |
| JSON request body | 2 MB |
| Formats | 16:9, 9:16, 1:1 |

## Important distinction

The system does not generate ten separate AI videos. It renders scene-level media and assembles them locally with FFmpeg. If an external provider such as HeyGen is used to generate source clips, that provider's own plan limits, credits, duration caps and licensing still apply. Concatenation does not remove those restrictions.

## Known limitations

- The HTTP render request is synchronous. Long jobs may be interrupted by mobile browser, proxy or hosting timeouts.
- There is no durable job queue, progress polling, cancellation or retry/resume yet.
- Visuals are currently designed black-and-gold scene cards, not realistic AI footage.
- Polish speech is synthetic eSpeak NG.
- The ambient sound is a generated tone, not a finished soundtrack.
- Subtitle timing is aligned to each generated narration segment and embedded in the final MP4; word-level karaoke timing and separate SRT/VTT download are not yet provided.
- The renderer is not deployed. Do not expose it publicly before authentication, HTTPS, CORS allowlisting, rate limits, storage quotas and retention controls are in place.

## Next engineering milestone

Introduce durable asynchronous render jobs with an ID, queued/running/completed/failed states, progress, retry and cancellation. Store intermediate segments safely and resume from completed segments after a failure. The Android PWA should poll job status and download the final MP4 only after completion.
