import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, mkdir, readdir, rename } from "node:fs/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { open, unlink, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function positiveIntegerEnv(name, fallback, minimum = 1) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(name + " musi być bezpieczną liczbą całkowitą nie mniejszą niż " + minimum + ".");
  return value;
}
const PORT = positiveIntegerEnv("PORT", 8080);
const MAX_BODY = 2 * 1024 * 1024;
const MAX_SCENES = 120;
const MAX_FILM_SECONDS = 10 * 60;
const MAX_TOTAL_NARRATION_CHARS = 120000;
const FORMATS = { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [900, 900] };
const JOBS_DIR = process.env.DARK_VIDEO_JOBS_DIR || path.join(process.cwd(), "data", "render-jobs");
const MAX_QUEUED_JOBS = 25;
const MAX_STORED_JOBS = 100;
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_STORAGE_BYTES = positiveIntegerEnv("DARK_VIDEO_MAX_STORAGE_BYTES", 1024 * 1024 * 1024, 1024 * 1024);
const MAX_OUTPUT_BYTES = positiveIntegerEnv("DARK_VIDEO_MAX_OUTPUT_BYTES", 512 * 1024 * 1024, 1024 * 1024);
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = positiveIntegerEnv("DARK_VIDEO_RATE_LIMIT", 30);
const CREATE_RATE_LIMIT = positiveIntegerEnv("DARK_VIDEO_CREATE_RATE_LIMIT", 5);
const ENABLE_SYNC_RENDER = process.env.ENABLE_SYNC_RENDER === "true";
const rateBuckets = new Map();
const renderToken = process.env.RENDER_API_TOKEN || "";
let instanceLockPath = "";
const jobs = new Map();
const jobQueue = [];
let queueWorkerRunning = false;

function send(res, status, data, type = "application/json; charset=utf-8", extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders });
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
function capture(command, args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => stdout += chunk.toString());
    child.stderr.on("data", chunk => stderr += chunk.toString());
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve(stdout.trim()) : reject(new Error(command + " zakończył się kodem " + code + ": " + stderr.slice(-1200))); });
  });
}
function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000), milli = ms % 1000;
  return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0") + "," + String(milli).padStart(3,"0");
}
function subtitleLines(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > 42 && line) { lines.push(line); line = word; }
    else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  const chunks = [];
  for (let i=0;i<lines.length;i+=2) chunks.push(lines.slice(i,i+2).join("\n"));
  return chunks.join("\n");
}
async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error("Żądanie przekracza 2 MB."), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("Nieprawidłowy JSON."), { status: 400 }); }
}
function normalizeInput(input) {
  if (!input || typeof input.topic !== "string" || input.topic.trim().length < 3 || input.topic.length > 240) throw Object.assign(new Error("Temat musi mieć od 3 do 240 znaków."), { status: 400 });
  if (!Array.isArray(input.scenes) || input.scenes.length < 1 || input.scenes.length > MAX_SCENES) throw Object.assign(new Error("Film musi zawierać od 1 do " + MAX_SCENES + " scen/segmentów."), { status: 400 });
  if (input.scenes.some(scene => !scene || typeof scene !== "object" || Array.isArray(scene))) throw Object.assign(new Error("Każdy segment musi być prawidłowym obiektem sceny."), { status: 400 });
  if (input.scenes.some(scene => String(scene.narration || "").length > 10000)) throw Object.assign(new Error("Tekst pojedynczej sceny przekracza limit 10 000 znaków."), { status: 413 });
  const totalNarrationChars = input.scenes.reduce((sum, scene) => sum + String(scene.narration || "").length, 0);
  if (totalNarrationChars > MAX_TOTAL_NARRATION_CHARS) throw Object.assign(new Error("Łączny tekst lektora przekracza limit 120 000 znaków."), { status: 413 });
  const format = input.format || "16:9";
  if (!FORMATS[format]) throw Object.assign(new Error("Nieobsługiwany format obrazu."), { status: 400 });
  const scenes = input.scenes.map(s => ({ title: String(s.title || "").slice(0,160), narration: String(s.narration || "").slice(0,10000), visual: String(s.visual || "").slice(0,500), seconds: Math.max(1, Math.min(600, Number(s.seconds) || 5)) }));
  if (scenes.some(s => !s.narration.trim())) throw Object.assign(new Error("Każda scena musi mieć tekst narracji."), { status: 400 });
  return { topic: input.topic.trim(), format, scenes };
}
async function render(input, onProgress = async () => {}) {
  input = normalizeInput(input);
  const dimensions = FORMATS[input.format];
  const [width, height] = dimensions;
  const scenes = input.scenes;
  const dir = await mkdtemp(path.join(os.tmpdir(), "dark-video-"));
  try {
    const segments = [], subtitleEntries = [];
    let timeline = 0;
    for (let i=0; i<scenes.length; i++) {
      await onProgress({ progress: Math.round((i / scenes.length) * 85), stage: "Przygotowywanie sceny " + (i + 1) + " z " + scenes.length });
      const scene = scenes[i], svg = path.join(dir, "scene-" + i + ".svg"), wav = path.join(dir, "voice-" + i + ".wav"), mp4 = path.join(dir, "part-" + i + ".mp4");
      await writeFile(svg, svgForScene(scene, i, scenes.length, width, height, input.topic), "utf8");
      await run("espeak-ng", ["-v", "pl", "-s", "148", "-w", wav, scene.narration], 30000);
      const duration = Number(await capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wav]));
      if (!Number.isFinite(duration) || duration <= 0) throw new Error("Nie udało się odczytać długości narracji segmentu " + (i+1) + ".");
      if (timeline + duration > MAX_FILM_SECONDS) throw Object.assign(new Error("Film przekracza limit 10 minut. Podziel go na krótszy projekt."), { status: 413 });
      subtitleEntries.push(String(i+1) + "\n" + srtTime(timeline) + " --> " + srtTime(timeline + duration) + "\n" + subtitleLines(scene.narration) + "\n");
      timeline += duration;
      await run("ffmpeg", ["-y", "-loop", "1", "-framerate", "25", "-i", svg, "-i", wav, "-vf", "zoompan=z=min(zoom+0.0005\\,1.08):d=1:s=" + width + "x" + height + ":fps=25,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", mp4], 90000);
      segments.push(mp4);
      await onProgress({ progress: Math.round(((i + 1) / scenes.length) * 85), stage: "Gotowa scena " + (i + 1) + " z " + scenes.length });
    }
    await onProgress({ progress: 92, stage: "Łączenie filmu i ścieżek audio" });
    const list = path.join(dir, "concat.txt");
    await writeFile(list, segments.map(file => "file '" + file.replace(/'/g, "'\\''") + "'").join("\n"));
    const joined = path.join(dir, "joined.mp4"), subtitles = path.join(dir, "captions.srt"), output = path.join(dir, "dark-video.mp4");
    await writeFile(subtitles, "\uFEFF" + subtitleEntries.join("\n"), "utf8");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined], 90000);
    const ambience = "aevalsrc=0.025*sin(2*PI*55*t)+0.012*sin(2*PI*82.41*t)+0.008*sin(2*PI*110*t):s=44100:d=" + timeline;
    const fadeOut = Math.max(0, timeline - 2);
    await run("ffmpeg", ["-y", "-i", joined, "-i", subtitles, "-f", "lavfi", "-i", ambience, "-filter_complex", "[0:a]volume=1.0[voice];[2:a]volume=0.6,afade=t=in:st=0:d=1,afade=t=out:st=" + fadeOut + ":d=2[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=2[mix]", "-map", "0:v:0", "-map", "[mix]", "-map", "1:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-c:s", "mov_text", "-metadata:s:s:0", "language=pol", "-movflags", "+faststart", output], 120000);
    const bytes = await readFile(output);
    if (bytes.length < 2048 || bytes.subarray(4,8).toString() !== "ftyp") throw new Error("Weryfikacja pliku MP4 nie powiodła się.");
    await onProgress({ progress: 98, stage: "Weryfikacja pliku MP4" });
    return bytes;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
async function saveJob(job) {
  job.updatedAt = new Date().toISOString();
  await mkdir(path.join(JOBS_DIR, job.id), { recursive: true });
  const temp = path.join(JOBS_DIR, job.id, "job.json.tmp");
  await writeFile(temp, JSON.stringify(job), "utf8");
  await rename(temp, path.join(JOBS_DIR, job.id, "job.json"));
}
function isAuthorized(req) {
  if (!renderToken) return process.env.NODE_ENV !== "production" && process.env.ALLOW_INSECURE_LOCAL_RENDER === "true";
  const supplied = String(req.headers.authorization || "");
  const expected = "Bearer " + renderToken;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function allowRate(req, res, cors, create = false) {
  const now = Date.now(), key = String(req.socket.remoteAddress || "unknown");
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) bucket = { start: now, count: 0, creates: 0 };
  bucket.count += 1;
  if (create) bucket.creates += 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 10000) for (const [k, v] of rateBuckets) if (now - v.start >= RATE_WINDOW_MS) rateBuckets.delete(k);
  if (bucket.count > RATE_LIMIT || (create && bucket.creates > CREATE_RATE_LIMIT)) {
    send(res, 429, { error: "Za dużo żądań. Odczekaj chwilę i spróbuj ponownie." }, "application/json; charset=utf-8", { ...cors, "Retry-After": "60" });
    return false;
  }
  return true;
}
async function acquireInstanceLock() {
  await mkdir(JOBS_DIR, { recursive: true });
  instanceLockPath = path.join(JOBS_DIR, ".renderer.lock");
  try {
    const handle = await open(instanceLockPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, hostname: os.hostname(), startedAt: new Date().toISOString() }));
    await handle.close();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let stale = false;
    try {
      const lock = JSON.parse(await readFile(instanceLockPath, "utf8"));
      if (lock.hostname === os.hostname()) {
        try { process.kill(Number(lock.pid), 0); } catch (probe) { if (probe.code === "ESRCH") stale = true; }
      }
    } catch { stale = true; }
    if (!stale) throw new Error("Inny renderer już korzysta z tego katalogu danych. Uruchom tylko jedną instancję.");
    await unlink(instanceLockPath).catch(() => {});
    const handle = await open(instanceLockPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, hostname: os.hostname(), startedAt: new Date().toISOString() }));
    await handle.close();
  }
}
async function releaseInstanceLock() {
  if (!instanceLockPath) return;
  try { const lock = JSON.parse(await readFile(instanceLockPath, "utf8")); if (Number(lock.pid) === process.pid) await unlink(instanceLockPath); } catch {}
}
async function directoryBytes() {
  let total = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === ".renderer.lock") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full); else total += (await stat(full)).size;
    }
  }
  await walk(JOBS_DIR);
  return total;
}
function publicJob(job) {
  return { id: job.id, status: job.status, progress: job.progress, stage: job.stage, error: job.error || null, attempts: job.attempts, createdAt: job.createdAt, updatedAt: job.updatedAt, completedAt: job.completedAt || null };
}
async function pruneJobs() {
  const terminal = [...jobs.values()]
    .filter(job => job.status === "completed" || job.status === "failed")
    .sort((a,b) => Date.parse(a.updatedAt || a.createdAt) - Date.parse(b.updatedAt || b.createdAt));
  const now = Date.now();
  for (const job of terminal) {
    const age = now - Date.parse(job.updatedAt || job.createdAt);
    if (age > JOB_RETENTION_MS || jobs.size > MAX_STORED_JOBS) {
      jobs.delete(job.id);
      await rm(path.join(JOBS_DIR, job.id), { recursive:true, force:true });
    }
  }
}
async function processQueue() {
  if (queueWorkerRunning) return;
  queueWorkerRunning = true;
  try {
    while (jobQueue.length) {
      const id = jobQueue.shift(), job = jobs.get(id);
      if (!job || job.status !== "queued") continue;
      job.status = "running"; job.progress = 1; job.stage = "Uruchamianie renderera"; job.error = null; job.attempts += 1;
      await saveJob(job);
      try {
        const bytes = await render(job.input, async update => {
          job.progress = update.progress; job.stage = update.stage; await saveJob(job);
        });
        if (bytes.length > MAX_OUTPUT_BYTES) throw new Error("Wygenerowany film przekracza limit rozmiaru pliku.");
        if (await directoryBytes() + bytes.length > MAX_STORAGE_BYTES) throw new Error("Render przekroczył dostępny limit magazynu.");
        await writeFile(path.join(JOBS_DIR, id, "output.mp4"), bytes, { flag: "wx" });
        job.status = "completed"; job.progress = 100; job.stage = "Film gotowy"; job.completedAt = new Date().toISOString();
      } catch (error) {
        job.status = "failed"; job.stage = "Renderowanie nie powiodło się"; job.error = "Render nie powiódł się. Spróbuj ponownie; szczegóły techniczne są dostępne wyłącznie w logach administratora.";
      }
      await saveJob(job);
    }
  } finally { queueWorkerRunning = false; if (jobQueue.length) void processQueue(); }
}
async function initializeJobs() {
  await mkdir(JOBS_DIR, { recursive: true });
  for (const id of await readdir(JOBS_DIR)) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    try {
      const job = JSON.parse(await readFile(path.join(JOBS_DIR, id, "job.json"), "utf8"));
      if (!job || job.id !== id || !job.input) continue;
      if (job.status === "running" || job.status === "queued") {
        job.status = "queued"; job.progress = 0; job.stage = "Wznowiono kolejkę po restarcie — render zacznie się od początku"; job.error = null;
        jobs.set(id, job); jobQueue.push(id); await saveJob(job);
      } else jobs.set(id, job);
    } catch {}
  }
  await pruneJobs();
  void processQueue();
}
async function createJob(input) {
  input = normalizeInput(input);
  await pruneJobs();
  const waiting = jobQueue.length + [...jobs.values()].filter(job => job.status === "running").length;
  if (waiting >= MAX_QUEUED_JOBS) throw Object.assign(new Error("Kolejka jest pełna. Spróbuj ponownie za chwilę."), { status: 429 });
  if (jobs.size >= MAX_STORED_JOBS) throw Object.assign(new Error("Limit przechowywanych zadań został osiągnięty. Spróbuj później."), { status: 429 });
  if (await directoryBytes() >= MAX_STORAGE_BYTES) throw Object.assign(new Error("Brak dostępnego miejsca w magazynie renderera."), { status: 507 });
  const id = randomUUID(), now = new Date().toISOString();
  const job = { id, input, status: "queued", progress: 0, stage: "Oczekiwanie w kolejce", error: null, attempts: 0, createdAt: now, updatedAt: now };
  jobs.set(id, job); await saveJob(job); jobQueue.push(id); void processQueue(); return job;
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const origin = req.headers.origin, allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (origin && (!allowedOrigin || origin !== allowedOrigin)) return send(res, 403, { error: "Origin nie jest dozwolony. Ustaw ALLOWED_ORIGIN dla adresu aplikacji." });
  const cors = origin ? { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Vary": "Origin" } : {};
  if (req.method === "OPTIONS") { res.writeHead(204, { ...cors, "Access-Control-Max-Age": "86400" }); return res.end(); }
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "DARK VIDEO Render Engine", authenticationRequired: Boolean(renderToken), formats: Object.keys(FORMATS), renderQueue: true }, "application/json; charset=utf-8", cors);
  if (url.pathname.startsWith("/api/")) {
    if (!isAuthorized(req)) return send(res, 401, { error: "Brak autoryzacji. Podaj prawidłowy token renderera." }, "application/json; charset=utf-8", { ...cors, "WWW-Authenticate": "Bearer" });
    if (!allowRate(req, res, cors, req.method === "POST" && (url.pathname === "/api/render" || url.pathname === "/api/render/jobs"))) return;
  }
  if (req.method === "POST" && url.pathname === "/api/render/jobs") {
    try { const job = await createJob(await readJson(req)); return send(res, 202, publicJob(job), "application/json; charset=utf-8", cors); }
    catch (error) { return send(res, error.status || 500, { error: error.message || "Nie udało się dodać renderu do kolejki." }, "application/json; charset=utf-8", cors); }
  }
  const jobRoute = url.pathname.match(/^\/api\/render\/jobs\/([0-9a-f-]{36})(?:\/(retry|download))?$/i);
  if (jobRoute) {
    const [, id, action] = jobRoute, job = jobs.get(id);
    if (!job) return send(res, 404, { error: "Nie znaleziono zadania renderowania." }, "application/json; charset=utf-8", cors);
    if (req.method === "GET" && !action) return send(res, 200, publicJob(job), "application/json; charset=utf-8", cors);
    if (req.method === "POST" && action === "retry") {
      if (job.status !== "failed") return send(res, 409, { error: "Można ponowić tylko nieudane zadanie." }, "application/json; charset=utf-8", cors);
      const waiting = jobQueue.length + [...jobs.values()].filter(item => item.status === "running").length;
      if (waiting >= MAX_QUEUED_JOBS) return send(res, 429, { error: "Kolejka jest pełna. Spróbuj ponownie za chwilę." }, "application/json; charset=utf-8", { ...cors, "Retry-After": "60" });
      job.status = "queued"; job.progress = 0; job.stage = "Ponowne renderowanie od początku"; job.error = null; job.completedAt = null;
      await saveJob(job); jobQueue.push(id); void processQueue(); return send(res, 202, publicJob(job), "application/json; charset=utf-8", cors);
    }
    if (req.method === "GET" && action === "download") {
      if (job.status !== "completed") return send(res, 409, { error: "Film nie jest jeszcze gotowy." }, "application/json; charset=utf-8", cors);
      try { const bytes = await readFile(path.join(JOBS_DIR, id, "output.mp4")); return send(res, 200, bytes, "video/mp4", { ...cors, "Content-Length": String(bytes.length), "Content-Disposition": 'attachment; filename="dark-video-' + id + '.mp4"' }); }
      catch { return send(res, 404, { error: "Plik MP4 nie jest już dostępny." }, "application/json; charset=utf-8", cors); }
    }
  }
  if (req.method === "POST" && url.pathname === "/api/render") {
    if (process.env.NODE_ENV === "production" || !ENABLE_SYNC_RENDER) return send(res, 410, { error: "Synchroniczny endpoint renderowania jest wyłączony. Użyj kolejki /api/render/jobs." }, "application/json; charset=utf-8", cors);
    try {
      const input = await readJson(req), bytes = await render(input);
      return send(res, 200, bytes, "video/mp4", cors);
    } catch (error) { return send(res, error.status || 500, { error: error.message || "Renderowanie nie powiodło się." }, "application/json; charset=utf-8", cors); }
  }
  return send(res, 404, { error: "Nie znaleziono endpointu." });
});
(async () => {
  if (process.env.NODE_ENV === "production" && Buffer.byteLength(renderToken, "utf8") < 32) throw new Error("W trybie production RENDER_API_TOKEN musi zawierać co najmniej 32 bajty losowego sekretu.");
  if (!renderToken && process.env.NODE_ENV !== "production" && process.env.ALLOW_INSECURE_LOCAL_RENDER !== "true") throw new Error("Ustaw RENDER_API_TOKEN albo jawnie ALLOW_INSECURE_LOCAL_RENDER=true dla lokalnych testów.");
  await acquireInstanceLock();
  await initializeJobs();
  server.listen(PORT, renderToken ? (process.env.HOST || "0.0.0.0") : "127.0.0.1", () => process.stdout.write("DARK VIDEO render engine listening on " + PORT + "\n"));
})().catch(error => { process.stderr.write("Render queue initialization failed: " + error.message + "\n"); process.exitCode = 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  server.close(async () => { await releaseInstanceLock(); process.exit(0); });
});
