import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.PORT || 8080);
const MAX_BODY = 2 * 1024 * 1024;
const FORMATS = { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [900, 900] };

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}
function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}
function wrap(text, max = 34, lines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean), out = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) { out.push(line); line = word; }
    else line = (line + " " + word).trim();
    if (out.length === lines) break;
  }
  if (line && out.length < lines) out.push(line);
  return out;
}
function svgForScene(scene, index, total, width, height, topic) {
  const title = wrap(scene.title || "Scena " + (index + 1), 28, 2);
  const caption = wrap(scene.narration || scene.visual || topic, width > height ? 48 : 25, width > height ? 3 : 5);
  const titleY = Math.round(height * 0.39), captionY = Math.round(height * 0.58);
  const titleSize = Math.round(Math.min(width, height) * 0.055), bodySize = Math.round(Math.min(width, height) * 0.027);
  const titleText = title.map((line, i) => '<text x="8%" y="' + (titleY + i * titleSize * 1.25) + '" font-size="' + titleSize + '" font-weight="700" fill="#f3d58c">' + escapeXml(line) + '</text>').join("");
  const bodyText = caption.map((line, i) => '<text x="8%" y="' + (captionY + i * bodySize * 1.55) + '" font-size="' + bodySize + '" fill="#f5f0e5">' + escapeXml(line) + '</text>').join("");
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#292116"/><stop offset="1" stop-color="#08090c"/></linearGradient><radialGradient id="glow"><stop stop-color="#96713b" stop-opacity=".5"/><stop offset="1" stop-color="#08090c" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><circle cx="' + Math.round(width*.78) + '" cy="' + Math.round(height*.24) + '" r="' + Math.round(Math.min(width,height)*.5) + '" fill="url(#glow)"/><path d="M0 ' + Math.round(height*.84) + ' Q' + Math.round(width*.5) + ' ' + Math.round(height*.68) + ' ' + width + ' ' + Math.round(height*.84) + ' L' + width + ' ' + height + ' L0 ' + height + 'Z" fill="#000" opacity=".35"/><text x="8%" y="12%" font-size="' + Math.round(Math.min(width,height)*.025) + '" letter-spacing="5" fill="#b99b63">DARK VIDEO · ' + String(index+1).padStart(2,"0") + ' / ' + total + '</text>' + titleText + bodyText + '<text x="8%" y="93%" font-size="' + Math.round(Math.min(width,height)*.02) + '" fill="#b99b63">' + escapeXml(topic).slice(0,100) + '</text></svg>';
}
function run(command, args, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); if (stderr.length > 12000) stderr = stderr.slice(-12000); });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(command + " zakończył się kodem " + code + ": " + stderr.slice(-2500))); });
  });
}
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error("Żądanie przekracza 2 MB."), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("Nieprawidłowy JSON."), { status: 400 }); }
}
async function render(input) {
  if (!input || typeof input.topic !== "string" || input.topic.trim().length < 3 || input.topic.length > 240) throw Object.assign(new Error("Temat musi mieć od 3 do 240 znaków."), { status: 400 });
  if (!Array.isArray(input.scenes) || input.scenes.length < 1 || input.scenes.length > 12) throw Object.assign(new Error("Film musi zawierać od 1 do 12 scen."), { status: 400 });
  const dimensions = FORMATS[input.format || "16:9"];
  if (!dimensions) throw Object.assign(new Error("Nieobsługiwany format obrazu."), { status: 400 });
  const [width, height] = dimensions;
  const scenes = input.scenes.map(s => ({ title: String(s.title || "").slice(0,160), narration: String(s.narration || "").slice(0,5000), visual: String(s.visual || "").slice(0,500), seconds: Math.max(1, Math.min(120, Number(s.seconds) || 5)) }));
  if (scenes.some(s => !s.narration.trim())) throw Object.assign(new Error("Każda scena musi mieć tekst narracji."), { status: 400 });
  const dir = await mkdtemp(path.join(os.tmpdir(), "dark-video-"));
  try {
    const segments = [];
    for (let i=0; i<scenes.length; i++) {
      const scene = scenes[i], svg = path.join(dir, "scene-" + i + ".svg"), wav = path.join(dir, "voice-" + i + ".wav"), mp4 = path.join(dir, "part-" + i + ".mp4");
      await writeFile(svg, svgForScene(scene, i, scenes.length, width, height, input.topic), "utf8");
      await run("espeak-ng", ["-v", "pl", "-s", "148", "-w", wav, scene.narration], 30000);
      await run("ffmpeg", ["-y", "-loop", "1", "-framerate", "25", "-i", svg, "-i", wav, "-vf", "scale=" + width + ":" + height + ",format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", mp4], 90000);
      segments.push(mp4);
    }
    const list = path.join(dir, "concat.txt");
    await writeFile(list, segments.map(file => "file '" + file.replace(/'/g, "'\\''") + "'").join("\n"));
    const output = path.join(dir, "dark-video.mp4");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", output], 90000);
    const bytes = await readFile(output);
    if (bytes.length < 2048 || bytes.subarray(4,8).toString() !== "ftyp") throw new Error("Weryfikacja pliku MP4 nie powiodła się.");
    return bytes;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "DARK VIDEO Render Engine", ffmpeg: "required", tts: "espeak-ng Polish voice", formats: Object.keys(FORMATS), maxScenes: 12 });
  if (req.method === "POST" && url.pathname === "/api/render") {
    try {
      const input = await readJson(req), bytes = await render(input);
      return send(res, 200, bytes, "video/mp4");
    } catch (error) { return send(res, error.status || 500, { error: error.message || "Renderowanie nie powiodło się." }); }
  }
  return send(res, 404, { error: "Nie znaleziono endpointu." });
});
server.listen(PORT, "0.0.0.0", () => process.stdout.write("DARK VIDEO render engine listening on " + PORT + "\n"));
