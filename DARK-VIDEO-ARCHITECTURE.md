# DARK VIDEO — architecture and build plan

## Product goal
DARK VIDEO extends DARK EDITOR into one mobile-first production studio. DARK AI coordinates the workflow; the editor remains the place for preview, manual corrections, timeline editing, and MP4 export.

## Device target
Primary client: Android Chrome / installable PWA. Initial target device: Xiaomi Redmi Note 14 Pro+ 5G (12 GB RAM). The phone handles the interface, media selection, preview, project editing, and carefully tested exports. Heavy AI generation runs through remote providers.

## Architecture
1. **DARK VIDEO PWA (client)**
   - project dashboard and prompt form
   - script and storyboard review
   - scene list with per-scene regenerate/approve controls
   - media library and handoff to DARK EDITOR timeline
   - visible generation progress, usage estimate, and cancellation
2. **DARK AI orchestrator (server-side)**
   - turns a brief into a structured Polish script and scene plan
   - validates output and stores project state
   - calls provider adapters for image/video generation and speech
   - retries safely, tracks job status, and enforces user-approved budgets
   - keeps provider credentials on the server; never put API keys in browser code or Git
3. **Provider adapters**
   - text/script provider
   - image generation provider
   - optional video generation provider
   - Polish text-to-speech provider
   - music from licensed/royalty-free sources or a separately approved generation provider
   - providers are replaceable; no single paid service is mandatory for editing
4. **DARK EDITOR**
   - receives approved generated assets and scene metadata
   - user can edit ordering, duration, captions, voice/music and transitions
   - existing MP4 export remains experimental until tested on the actual Android device

## Cost and consent rules
- Default workflow should offer a low-cost mode: script + storyboard + still images / existing user media.
- Video generation and paid speech are optional steps, never silently triggered.
- Before a paid job, show provider, estimated units/cost where available, and ask for confirmation.
- Store usage per project; support a hard user-set spending limit.
- Never claim generation is free when a provider charges.
- Keep provider API keys server-side; do not commit secrets.

## Delivery milestones
### M0 — protect and verify
- Keep the existing DARK EDITOR stabilization branch isolated from main.
- Continue Android checks for gallery import, project restoration, audio/video playback, and export.
### M1 — DARK VIDEO foundation
- Build a separate mobile-first screen and project data model.
- Add a local-only demo flow for prompt → sample script → storyboard, clearly marked as demo (not real AI).
- Do not require provider credentials for the editor or demo.
### M2 — DARK AI text orchestration
- Add a small server API and one text-provider adapter.
- Generate Polish scripts and structured scene plans; save/reopen projects.
### M3 — assets and voice
- Add image generation first, then optional video generation and Polish TTS through replaceable adapters.
- Include cost estimates and explicit approval before paid generation.
### M4 — editor integration
- Transfer approved scenes, voice, captions, and music into DARK EDITOR.
- Test short exports on Android before increasing duration/resolution.
### M5 — release hardening
- Verify privacy, storage limits, provider failures, cancellation, budgets, and Android performance.
- Do not merge to main until real-device checks pass.

## Important boundaries
- DARK AI is an orchestrator and workflow layer, not a claim that we own or train a foundation video model.
- Free/open-source editing does not make third-party AI inference free.
- Do not add a paid provider or create paid jobs without explicit user approval.
- Do not merge or deploy this branch automatically.
