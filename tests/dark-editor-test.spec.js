const { test, expect } = require("@playwright/test");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=",
  "base64"
);

test("replaces a selected timeline file without adding another scene and restores it", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/dark-editor-test/");

  await page.locator("#mediaInput").setInputFiles({
    name: "pierwszy.png", mimeType: "image/png", buffer: tinyPng
  });
  await expect(page.locator("#videoTrack")).toContainText("pierwszy.png");
  await expect(page.locator("#videoTrack .clip")).toHaveCount(1);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "ZAMIEŃ PLIK" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "drugi.png", mimeType: "image/png", buffer: tinyPng
  });

  await expect(page.locator("#videoTrack")).toContainText("drugi.png");
  await expect(page.locator("#videoTrack")).not.toContainText("pierwszy.png");
  await expect(page.locator("#videoTrack .clip")).toHaveCount(1);

  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator("#videoTrack")).toContainText("drugi.png");
  await expect(page.locator("#videoTrack")).not.toContainText("BRAK PLIKU");
});
