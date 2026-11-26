const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

(async () => {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404).end("Not found"); return; }
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      res.end(body);
    });
  });
  await new Promise(resolve => server.listen(4174, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
    const loaded = await page.evaluate(() => ({
      renderer: !!window.DarkLocalRenderer,
      recorder: !!window.MediaRecorder,
      mp4: !!window.MediaRecorder && typeof MediaRecorder.isTypeSupported === "function" &&
        ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"].some(t => MediaRecorder.isTypeSupported(t)),
      renderButtonDisabled: document.querySelector("#renderExport").disabled
    }));
    if (!loaded.renderer) throw new Error("local-renderer.js did not load.");
    if (!loaded.recorder) throw new Error("MediaRecorder is missing in Chromium.");
    if (!loaded.renderButtonDisabled) throw new Error("Render button must be disabled before project approval.");

    let emptyRejected = false;
    try { await page.evaluate(() => window.DarkLocalRenderer.render({ clips: [] })); }
    catch (e) { emptyRejected = String(e.message).includes("Dodaj przynajmniej jedną scenę"); }
    if (!emptyRejected) throw new Error("Renderer did not reject an empty project.");

    await page.locator("#approveExport").click();
    const status = await page.locator("#exportStatus").textContent();
    if (!status || !/(MP4|scen do zatwierdzenia)/i.test(status)) {
      throw new Error("Unexpected approval-gate result: " + status);
    }
    if (!loaded.mp4) throw new Error("CI Chromium does not support MP4; actual renderer test cannot run.");

    const rendered = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 96; canvas.height = 54;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#d6ad55"; ctx.fillRect(0, 0, 96, 54);
      ctx.fillStyle = "#090909"; ctx.font = "bold 14px Arial";
      ctx.fillText("DARK QA", 8, 30);
      const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const imageUrl = URL.createObjectURL(imageBlob);
      try {
        const result = await window.DarkLocalRenderer.render({
          clips: [{ name: "qa-still.png", type: "image", url: imageUrl, duration: 1 }],
          subtitles: [{ text: "QA SUBTITLE", start: 0.2, end: 0.8, position: "bottom" }],
          width: 320, height: 180, fps: 10, maxDurationSec: 5
        });
        return { size: result.blob.size, type: result.blob.type, filename: result.filename, duration: result.duration };
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    });
    if (!rendered.size || !String(rendered.type).toLowerCase().startsWith("video/mp4") ||
        rendered.filename !== "dark-editor-export.mp4" || rendered.duration !== 1) {
      throw new Error("Actual MP4 render returned an invalid result: " + JSON.stringify(rendered));
    }
    if (errors.length) throw new Error("Browser JavaScript errors: " + errors.join(" | "));
    console.log("PASS: renderer loads; empty projects are rejected; approval gate works; one still image with subtitle renders to a non-empty MP4. Output: " + JSON.stringify(rendered));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exit(1); });
