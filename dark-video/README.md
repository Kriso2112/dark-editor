# DARK VIDEO — demo 0.3 + DARK AI API foundation

Mobile-first static PWA prototype for the DARK VIDEO workflow. This is a separate app surface and does not alter the existing DARK EDITOR.

## Run locally
Open index.html in a modern browser for the editor/demo features. Service-worker offline support and install prompts require HTTPS or localhost. GitHub Pages provides HTTPS when configured for the folder/repository.

## Included
- Responsive black-and-gold interface for Android and desktop.
- Brief form: topic, content type, duration, aspect ratio, tone, automatic/manual mode.
- Local storyboard and narration-outline templates (deterministic demo logic, not an AI model).
- Scene editing, approval toggles, reordering, deletion, and adding scenes.
- Local browser save/restore using localStorage.
- Project JSON import/export, narration TXT export, and storyboard CSV export.
- PWA manifest, SVG app icon, service worker, and offline shell caching on HTTPS/localhost.
- Optional DARK AI API URL in the app, health check, and mock-only server generation. The app deliberately refuses to call a configured paid provider until a dedicated cost-consent screen exists.
- Install prompt button where the browser supports the install prompt event.

## Not included yet
- DARK AI Worker API scaffold exists in `dark-ai-worker/`; mock API mode and a consent-gated OpenAI adapter are implemented but not deployed or connected to this PWA.
- No image/video generation, TTS, music generation, or MP4 rendering.
- No server database, accounts, or cloud sync.
- No integration with DARK EDITOR timeline yet.

## Safety and cost
The demo does not call external AI services and cannot incur provider charges. Future paid providers must be server-side, with a visible estimate and explicit approval before a job starts. Never put API keys in this folder or browser code.

## Offline and project storage
The service worker caches the app shell after the first successful online visit over HTTPS/localhost. Browser project storage is device- and browser-specific. Export JSON backups regularly; imported projects do not include media files because this version creates only a plan.

## DARK AI backend foundation\nSee `../dark-ai-worker/README.md` for Worker routes, local setup, secret handling, and explicit cost-consent gates. The provider route remains disabled by default; no API key or paid service has been configured.\n\n## Next milestones
1. Add and verify a server-side DARK AI API and a replaceable text-provider adapter.
2. Generate structured Polish scripts and scene plans with validation and explicit cost approval.
3. Add approved asset generation and Polish voice as optional, cost-gated steps.
4. Integrate approved scenes into DARK EDITOR and test export on real Android hardware.
