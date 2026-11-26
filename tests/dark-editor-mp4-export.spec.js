const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=",
  "base64"
);

test("blocks MP4 export when no media has been added", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/dark-editor-test/");
  await page.locator("#exportMp4").click();
  await expect(page.locator("#exportStatus")).toContainText("Najpierw dodaj materiały");
});

test("exports a real MP4 file from a one-second still-image project", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("http://127.0.0.1:4173/dark-editor-test/");
  await page.locator("#mediaInput").setInputFiles({
    name: "test-export.png", mimeType: "image/png", buffer: tinyPng
  });
  await expect(page.locator("#videoTrack .clip")).toHaveCount(1);
  await page.locator("#durationInput").fill("1");
  await page.locator("#applyDuration").click();

  const downloadPromise = page.waitForEvent("download", { timeout: 210000 });
  await page.locator("#exportMp4").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/i);
  const path = await download.path();
  expect(fs.statSync(path).size).toBeGreaterThan(1024);
  await expect(page.locator("#exportStatus")).toContainText("Gotowe", { timeout: 5000 });
});
