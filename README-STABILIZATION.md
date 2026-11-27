# DARK EDITOR 1.0 stabilization

This branch is an isolated stabilization line based on `develop/dark-editor-1.0`.
It does not change `main`.

## Changes in this branch

- Preserve the selected timeline scene in project data and restore it after reload.
- Save the selected scene whenever the user changes selection.
- Update media records in IndexedDB without clearing all stored media first.
- Prune only obsolete records belonging to this project, preserving blobs for scenes that are temporarily unavailable.
- Integrate the experimental browser MP4 export into the 1.0 page using MediaRecorder and FFmpeg WebAssembly.
- Add Playwright browser regression tests and GitHub Actions workflows.

## Local verification

```bash
npm install
npx playwright install chromium
npm test
```

The automated tests cover project restoration, the missing-media retention regression, the empty-export state, and a one-second image-to-MP4 export.

## Important limits

- Automated tests run in desktop Chromium. They do not replace testing on a real Android device.
- MP4 export has been verified only with a short one-second test clip in CI. A 10-minute export has not yet been verified on Android and may require substantial device memory and processing time.
- The FFmpeg engine is downloaded from a CDN on first export, so the first export requires an internet connection.
- Keep this branch separate from `main` until real-device tests cover gallery import, reload/restore, audio/video clips and longer exports.
