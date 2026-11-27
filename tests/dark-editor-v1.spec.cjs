const { test, expect } = require("@playwright/test");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=",
  "base64"
);
const tinyWav = Buffer.from(
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
  "base64"
);

test("restores selected scene, settings, captions, storyboard and media after reload", async ({ page }) => {
  await page.goto("/");
  await page.locator("#mediaInput").setInputFiles([
    { name: "scena-a.png", mimeType: "image/png", buffer: tinyPng },
    { name: "scena-b.png", mimeType: "image/png", buffer: tinyPng }
  ]);
  await expect(page.locator("#videoTrack .clip")).toHaveCount(2);

  await page.locator("#videoTrack .clip").nth(1)
    .getByRole("button", { name: "EDYTUJ SCENĘ" }).click();
  await page.locator("#projectName").fill("Test trwałego projektu");
  await page.locator("#manualMode").click();

  await page.locator("#subtitleText").fill("Ważny napis testowy");
  await page.locator("#subtitleStart").fill("1");
  await page.locator("#subtitleEnd").fill("4");
  await page.locator("#addSubtitle").click();

  await page.locator("#scriptInput").fill("Pierwsza scena.\n\nDruga scena.");
  await page.locator("#generateStoryboard").click();
  await page.locator("#audioInput").setInputFiles({
    name: "podklad.wav", mimeType: "audio/wav", buffer: tinyWav
  });

  await page.locator("#saveProject").click();
  await expect(page.locator("#saveStatus")).toContainText("zapisane", { timeout: 10000 });
  await page.reload();

  await expect(page.locator("#projectName")).toHaveValue("Test trwałego projektu");
  await expect(page.locator("#modeInfo")).toContainText("Tryb ręczny");
  await expect(page.locator("#videoTrack .clip")).toHaveCount(2);
  await expect(page.locator("#videoTrack .clip").nth(1)).toHaveClass(/selected/);
  await expect(page.locator("#subtitleList")).toContainText("Ważny napis testowy");
  await expect(page.locator("#scriptInput")).toHaveValue("Pierwsza scena.\n\nDruga scena.");
  await expect(page.locator("#storyboardList")).not.toBeEmpty();
  await expect(page.locator("#audioStatus")).toContainText("Muzyka przywrócona");
  await expect(page.locator("#audioTrack")).toContainText("podklad.wav");
});

test("does not erase other saved media when one scene's blob is missing", async ({ page }) => {
  await page.goto("/");
  await page.locator("#mediaInput").setInputFiles([
    { name: "zachowany-a.png", mimeType: "image/png", buffer: tinyPng },
    { name: "zachowany-b.png", mimeType: "image/png", buffer: tinyPng }
  ]);
  await page.locator("#saveProject").click();
  await expect(page.locator("#saveStatus")).toContainText("zapisane", { timeout: 10000 });

  await page.evaluate(async () => {
    const data = JSON.parse(localStorage.getItem("darkEditor100"));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("darkEditorMediaDB", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("media", "readwrite");
      tx.objectStore("media").delete(data.clips[0].id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.reload();
  await expect(page.locator("#videoTrack .clip")).toHaveCount(2);
  await expect(page.locator("#videoTrack .clip").nth(0)).toContainText("BRAK PLIKU");
  await expect(page.locator("#videoTrack .clip").nth(1)).not.toContainText("BRAK PLIKU");

  await page.locator("#projectName").fill("Zapis po braku jednego pliku");
  await page.locator("#saveProject").click();
  await expect(page.locator("#saveStatus")).toContainText("zapisane", { timeout: 10000 });
  await page.reload();

  await expect(page.locator("#videoTrack .clip").nth(0)).toContainText("BRAK PLIKU");
  await expect(page.locator("#videoTrack .clip").nth(1)).not.toContainText("BRAK PLIKU");
});
