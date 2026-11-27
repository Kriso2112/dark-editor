const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const appUrl = pathToFileURL(path.resolve(__dirname, "../dark-video/index.html")).href;

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl);
});

test("shows the DARK VIDEO brief form and validates an empty topic", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Opowiedz nam o filmie" })).toBeVisible();
  await page.getByRole("button", { name: /STWÓRZ PLAN FILMU/ }).click();
  await expect(page.locator("#notice")).toContainText("Wpisz temat");
  await expect(page.locator("#workspace")).toBeHidden();
});

test("creates a storyboard and allows scene editing", async ({ page }) => {
  await page.locator("#topic").fill("Tajemnice piramid");
  await page.getByRole("button", { name: /STWÓRZ PLAN FILMU/ }).click();
  await expect(page.locator("#workspace")).toBeVisible();
  await expect(page.locator("#scenes .scene-card")).toHaveCount(4);
  await page.locator("#scenes .scene-card").first().locator('[data-field="narration"]').fill("Mój poprawiony tekst sceny.");
  await expect(page.locator("#scenes .scene-card").first().locator("textarea")).toHaveValue("Mój poprawiony tekst sceny.");
});

test("saves and restores the current project in browser storage", async ({ page }) => {
  await page.locator("#topic").fill("Historia zaginionego miasta");
  await page.getByRole("button", { name: /STWÓRZ PLAN FILMU/ }).click();
  await page.locator("#script").fill("Scenariusz testowy do zapisania.");
  await page.getByRole("button", { name: "ZAPISZ PROJEKT" }).click();
  await page.reload();
  await expect(page.locator("#workspace")).toBeVisible();
  await expect(page.locator("#topic")).toHaveValue("Historia zaginionego miasta");
  await expect(page.locator("#script")).toHaveValue("Scenariusz testowy do zapisania.");
});

test("supports a narrow mobile viewport without hiding the main action", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole("button", { name: /STWÓRZ PLAN FILMU/ })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test("exports a readable script file", async ({ page }) => {
  await page.locator("#topic").fill("Tajemnice piramid");
  await page.getByRole("button", { name: /STWÓRZ PLAN FILMU/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SCENARIUSZ TXT ↓" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("dark-video-scenariusz.txt");
});

test("exports a storyboard CSV file", async ({ page }) => {
  await page.locator("#topic").fill("Historia starożytnego miasta");
  await page.getByRole("button", { name: /STWÓRZ PLAN FILMU/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "STORYBOARD CSV ↓" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("dark-video-storyboard.csv");
});

test("updates the word count correctly for ordinary text", async ({ page }) => {
  await page.locator("#topic").fill("Tajemnice piramid");
  await page.getByRole("button", { name: /STWÓRZ PLAN FILMU/ }).click();
  await page.locator("#script").fill("jeden dwa trzy");
  await expect(page.locator("#wordCount")).toHaveText("3 słów");
});
