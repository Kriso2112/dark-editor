const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function wavBuffer(seconds = 1, sampleRate = 8000) {
  const samples = Math.floor(seconds * sampleRate);
  const dataSize = samples * 2;
  const b = Buffer.alloc(44 + dataSize);
  b.write("RIFF", 0); b.writeUInt32LE(36 + dataSize, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i++) b.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/sampleRate)*5000), 44+i*2);
  return b;
}

(async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=", "base64");
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404).end("Not found"); return; }
      res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
      res.end(body);
    });
  });
  await new Promise(resolve => server.listen(4173, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
    await page.locator("#mediaInput").setInputFiles({ name: "qa-image.png", mimeType: "image/png", buffer: png });
    await page.locator("#audioInput").setInputFiles({ name: "qa-audio.wav", mimeType: "audio/wav", buffer: wavBuffer() });
    await page.locator("#projectName").fill("QA persistence project");
    await page.locator("#scriptInput").fill("Pierwsza scena testowa.\n\nDruga scena testowa.");
    await page.locator("#generateStoryboard").click();
    await page.locator("#subtitleText").fill("QA NAPIS");
    await page.locator("#subtitleStart").fill("0");
    await page.locator("#subtitleEnd").fill("4");
    await page.locator("#addSubtitle").click();
    await page.locator("#durationInput").fill("9");
    await page.locator("#applyDuration").click();
    await page.locator("#saveProject").click();
    await page.waitForFunction(() => document.querySelector("#saveStatus").textContent.includes("zapisane"));
    const before = await page.evaluate(() => ({
      clipCount: document.querySelectorAll("#videoTrack .clip").length,
      imageLoaded: document.querySelector("#photo").complete && document.querySelector("#photo").naturalWidth > 0,
      audioName: document.querySelector("#audioTrack").textContent
    }));
    if (before.clipCount !== 1 || !before.imageLoaded || !before.audioName.includes("qa-audio.wav")) {
      throw new Error("Initial media setup failed: " + JSON.stringify(before));
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#saveStatus").textContent.includes("Wczytano"));
    const after = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("darkEditorDatabase", 1);
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      const record = await new Promise((resolve, reject) => {
        const r = db.transaction("projects", "readonly").objectStore("projects").get("current");
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      db.close();
      return {
        name: document.querySelector("#projectName").value,
        duration: document.querySelector("#videoTrack").textContent,
        subtitle: document.querySelector("#subtitleList").textContent,
        audioStatus: document.querySelector("#audioStatus").textContent,
        photoSrc: document.querySelector("#photo").getAttribute("src"),
        recordHasImageBlob: record?.clips?.[0]?.blob instanceof Blob,
        recordHasAudioBlob: record?.audioBlob instanceof Blob,
        recordName: record?.data?.name
      };
    });
    if (after.name !== "QA persistence project" || !after.duration.includes("9 s") ||
        !after.subtitle.includes("QA NAPIS") || !after.audioStatus.includes("przywrócone") ||
        !after.photoSrc || !after.recordHasImageBlob || !after.recordHasAudioBlob ||
        after.recordName !== "QA persistence project") {
      throw new Error("Persistence restore failed: " + JSON.stringify(after));
    }
    if (errors.length) throw new Error("Browser JavaScript errors: " + errors.join(" | "));
    console.log("PASS: media Blob, audio Blob, project name, scene duration, subtitles and script/storyboard survive reload.");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exit(1); });
