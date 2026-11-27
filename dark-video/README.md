# DARK VIDEO — demo 0.1

Mobile-first static prototype for the DARK VIDEO workflow. This is a separate app surface and does not alter the existing DARK EDITOR.

## Run locally
Open index.html in a modern browser, or serve this folder from any static HTTPS host. No build step, npm package, API key, or paid provider is required.

## Included
- Responsive black-and-gold interface for Android and desktop.
- Brief form: topic, content type, duration, aspect ratio, tone, automatic/manual mode.
- Local storyboard and narration-outline templates (deterministic demo logic, not an AI model).
- Scene editing, approval toggles, reordering, deletion, and adding scenes.
- Local browser save/restore using localStorage.
- Project JSON import/export for backup and transfer.

## Not included yet
- No real LLM/DARK AI connection.
- No image/video generation, TTS, music generation, or MP4 rendering.
- No server database, accounts, cloud sync, or provider billing.
- No integration with DARK EDITOR timeline yet.

## Safety and cost
The demo does not call external AI services and cannot incur provider charges. Future paid providers must be server-side, with a visible estimate and explicit approval before a job starts. Never put API keys in this folder or browser code.

## Next milestones
1. Add automated browser checks for form validation, project creation, editing, and JSON round-trip.
2. Add a server-side DARK AI API and a replaceable text-provider adapter.
3. Add approved asset generation and Polish voice as optional, cost-gated steps.
4. Integrate approved scenes into DARK EDITOR and test export on real Android hardware.

Browser storage is device- and browser-specific. Export JSON backups regularly; imported projects do not include media files because this version creates only a plan.
