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
    if (errors.length) throw new Error("Browser JavaScript errors: " + errors.join(" | "));
    console.log("PASS: renderer script loads; empty projects are rejected; export approval gate responds safely. Chromium MP4 support: " + loaded.mp4);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exit(1); });
