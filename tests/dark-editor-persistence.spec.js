const { test, expect } = require("@playwright/test");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=",
  "base64"
);
const tinyWav = Buffer.from(
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
  "base64"
);

test("restores project settings, subtitles, storyboard, clips and audio after reload", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/dark-editor-test/");

  await page.locator("#mediaInput").setInputFiles([
    { name: "scena-a.png", mimeType: "image/png", buffer: tinyPng },
    { name: "scena-b.png", mimeType: "image/png", buffer: tinyPng }
  ]);
  await expect(page.locator("#videoTrack .clip")).toHaveCount(2);
  await page.locator("#videoTrack .clip").nth(1).getByRole("button", { name: "EDYTUJ SCENĘ" }).click();
  await expect(page.locator("#videoTrack .clip.selected")).toHaveCount(1);

  await page.locator("#projectName").fill("Test trwałego projektu");
  await page.locator("#manualMode").click();

  await page.locator("#subtitleText").fill("Ważny napis testowy");
  await page.locator("#subtitleStart").fill("1");
  await page.locator("#subtitleEnd").fill("4");
  await page.locator("#addSubtitle").click();
  await expect(page.locator("#subtitleList")).toContainText("Ważny napis testowy");

  await page.locator("#scriptInput").fill("Pierwsza scena. Druga scena. Trzecia scena.");
  await page.locator("#generateStoryboard").click();
  await expect(page.locator("#storyboardList")).not.toBeEmpty();

  await page.locator("#audioInput").setInputFiles({
    name: "podklad.wav", mimeType: "audio/wav", buffer: tinyWav
  });

  await page.waitForTimeout(1200);
  await page.reload();

  await expect(page.locator("#projectName")).toHaveValue("Test trwałego projektu");
  await expect(page.locator("#modeInfo")).toContainText("Tryb ręczny");
  await expect(page.locator("#videoTrack .clip")).toHaveCount(2);
  await expect(page.locator("#videoTrack .clip.selected")).toHaveCount(1);
  await expect(page.locator("#videoTrack .clip").nth(1)).toHaveClass(/selected/);
  await expect(page.locator("#subtitleList")).toContainText("Ważny napis testowy");
  await expect(page.locator("#scriptInput")).toHaveValue("Pierwsza scena. Druga scena. Trzecia scena.");
  await expect(page.locator("#storyboardList")).not.toBeEmpty();
  await expect(page.locator("#audioStatus")).toContainText("Muzyka przywrócona");
  await expect(page.locator("#audioTrack")).toContainText("podklad.wav");
});
