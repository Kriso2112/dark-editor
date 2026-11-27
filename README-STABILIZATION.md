# DARK EDITOR 1.0 stabilization

This branch is an isolated stabilization line based on `develop/dark-editor-1.0`.
It does not change `main`.

## Changes in this branch

- Preserve the selected timeline scene in the project data and restore it after reload.
- Save the selected scene whenever the user changes selection.
- Update media records in IndexedDB without clearing all stored media first.
- Prune only obsolete records belonging to this project, preserving blobs for scenes that are temporarily unavailable.
- Add Playwright browser regression tests and a GitHub Actions workflow.

## Local verification

```bash
npm install
npx playwright install chromium
npm test
```

The automated tests cover project restoration and the regression where one missing media blob must not erase the other saved media.

## Important limits

- These browser tests do not replace testing on a real Android device.
- The current 1.0 editor is a browser-based timeline/project editor. MP4 rendering/export is not yet integrated into this 1.0 root page.
- Keep this branch separate from `main` until automated tests pass and Android media import, persistence and export are verified.
