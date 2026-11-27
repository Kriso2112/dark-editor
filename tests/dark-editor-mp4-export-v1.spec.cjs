const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=",
  "base64"
);

test("shows a clear message when MP4 export is requested without media", async ({ page }) => {
  await page.goto("/");
  await page.locator("#exportMp4").click();
  await expect(page.locator("#exportStatus")).toContainText("Najpierw dodaj materiały");
});

test("renders and downloads an MP4 from a one-second image project", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/");
  await page.locator("#mediaInput").setInputFiles({
    name: "test-export.png",
    mimeType: "image/png",
    buffer: tinyPng
  });
  await expect(page.locator("#videoTrack .clip")).toHaveCount(1);
  await page.locator("#durationInput").fill("1");
  await page.locator("#applyDuration").click();

  const downloadPromise = page.waitForEvent("download", { timeout: 210000 });
  await page.locator("#exportMp4").click();
  await expect.poll(async () => page.locator("#exportStatus").textContent(), {
    timeout: 210000,
    message: "Eksport powinien zakończyć się sukcesem albo pokazać konkretny błąd."
  }).toMatch(/Gotowe|Eksport nie powiódł się/);

  const exportStatus = await page.locator("#exportStatus").textContent();
  expect(exportStatus, "Szczegóły błędu eksportu: " + exportStatus).toContain("Gotowe");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/i);
  const outputPath = await download.path();
  expect(fs.statSync(outputPath).size).toBeGreaterThan(1024);

  const header = Buffer.alloc(12);
  const fd = fs.openSync(outputPath, "r");
  try {
    fs.readSync(fd, header, 0, header.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  expect(header.toString("ascii", 4, 8)).toBe("ftyp");
});
