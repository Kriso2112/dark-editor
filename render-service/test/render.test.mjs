import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const port = 8097;
const jobsDir = await mkdtemp(path.join(os.tmpdir(),"dark-video-test-jobs-"));
const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port), DARK_VIDEO_JOBS_DIR: jobsDir, RENDER_API_TOKEN: "test-render-token", ENABLE_SYNC_RENDER: "true", DARK_VIDEO_RATE_LIMIT: "100", DARK_VIDEO_CREATE_RATE_LIMIT: "100", ALLOWED_ORIGIN: "https://dark-video.example.test" }, stdio: "ignore" });
const authHeaders = { Authorization: "Bearer test-render-token" };
async function apiFetch(url, options = {}) { return fetch(url, { ...options, headers: { ...authHeaders, ...(options.headers || {}) } }); }
const base = "http://127.0.0.1:" + port;
async function waitReady() {
  for (let i=0;i<60;i++) {
    try { const r=await fetch(base+"/health"); if(r.ok)return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error("Render service did not start");
}
test("render service exposes health and media capabilities", async () => {
  await waitReady();
  const response=await fetch(base+"/health"), body=await response.json();
  assert.equal(response.status,200); assert.equal(body.ok,true); assert.equal(body.authenticationRequired,true); assert.deepEqual(body.formats,["16:9","9:16","1:1"]);
});

test("protects render API with bearer authentication", async () => {
  await waitReady();
  const denied = await fetch(base + "/api/render/jobs/" + "00000000-0000-4000-8000-000000000000");
  assert.equal(denied.status,401);
  const wrong = await fetch(base + "/api/render/jobs/" + "00000000-0000-4000-8000-000000000000",{headers:{Authorization:"Bearer wrong-token"}});
  assert.equal(wrong.status,401);
  const allowed = await fetch(base + "/api/render/jobs/" + "00000000-0000-4000-8000-000000000000",{headers:authHeaders});
  assert.equal(allowed.status,404);
});
test("rejects an untrusted browser origin", async () => {
  await waitReady();
  const response = await fetch(base + "/api/render/jobs", { method:"OPTIONS", headers:{ Origin:"https://attacker.example", "Access-Control-Request-Method":"POST", "Access-Control-Request-Headers":"authorization" } });
  assert.equal(response.status,403);
});
test("production refuses a short renderer secret", async () => {
  const result = spawnSync(process.execPath, ["server.mjs"], { env:{ ...process.env, NODE_ENV:"production", PORT:"8098", DARK_VIDEO_JOBS_DIR:path.join(jobsDir,"weak-secret"), RENDER_API_TOKEN:"too-short", ALLOWED_ORIGIN:"https://dark-video.example.test" }, encoding:"utf8", timeout:5000 });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/co najmniej 32 bajty/);
});
test("prevents a second renderer from opening the same jobs directory", async () => {
  const result = spawnSync(process.execPath, ["server.mjs"], { env:{ ...process.env, NODE_ENV:"test", PORT:"8100", DARK_VIDEO_JOBS_DIR:jobsDir, RENDER_API_TOKEN:"test-render-token" }, encoding:"utf8", timeout:5000 });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Inny renderer już korzysta/);
});
test("production disables the legacy synchronous render endpoint", async () => {
  const productionPort = 8101;
  const productionDir = path.join(jobsDir,"production-sync");
  const secret = "a".repeat(64);
  const child = spawn(process.execPath, ["server.mjs"], { env:{ ...process.env, NODE_ENV:"production", PORT:String(productionPort), DARK_VIDEO_JOBS_DIR:productionDir, RENDER_API_TOKEN:secret, ALLOWED_ORIGIN:"https://dark-video.example.test" }, stdio:"ignore" });
  const productionBase = "http://127.0.0.1:" + productionPort;
  try {
    let ready = false;
    for (let i=0;i<60;i++) {
      try { if ((await fetch(productionBase+"/health")).ok) { ready=true; break; } } catch {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(ready,true,"production renderer should start with a strong token");
    const response = await fetch(productionBase+"/api/render",{method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json"},body:"{}"});
    assert.equal(response.status,410);
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve=>child.once("exit",resolve));
    await rm(productionDir,{recursive:true,force:true});
  }
});
test("production requires an exact HTTPS origin", async () => {
  const result = spawnSync(process.execPath, ["server.mjs"], { env:{ ...process.env, NODE_ENV:"production", PORT:"8102", DARK_VIDEO_JOBS_DIR:path.join(jobsDir,"missing-origin"), RENDER_API_TOKEN:"b".repeat(64), ALLOWED_ORIGIN:"http://insecure.example" }, encoding:"utf8", timeout:5000 });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/dokładny origin HTTPS/);
});
test("rejects invalid resource-limit configuration", async () => {
  const result = spawnSync(process.execPath, ["server.mjs"], { env:{ ...process.env, NODE_ENV:"test", PORT:"8099", DARK_VIDEO_JOBS_DIR:path.join(jobsDir,"bad-limit"), RENDER_API_TOKEN:"test-token", DARK_VIDEO_MAX_STORAGE_BYTES:"NaN" }, encoding:"utf8", timeout:5000 });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/DARK_VIDEO_MAX_STORAGE_BYTES/);
});
test("allows Authorization in the CORS preflight", async () => {
  await waitReady();
  const response = await fetch(base + "/api/render/jobs",{method:"OPTIONS",headers:{Origin:"https://dark-video.example.test","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization,content-type"}});
  assert.equal(response.status,204);
  assert.match(response.headers.get("access-control-allow-headers"),/Authorization/i);
});
test("rejects incomplete film manifests", async () => {
  await waitReady();
  const response=await apiFetch(base+"/api/render",{method:"POST",headers:{...authHeaders,"Content-Type":"application/json"},body:JSON.stringify({topic:"Test",format:"16:9",scenes:[]})});
  assert.equal(response.status,400);
});
test("rejects oversized narration in an individual segment", async () => {
  await waitReady();
  const response=await apiFetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Limit tekstu",format:"16:9",scenes:[{title:"Za długa scena",narration:"x".repeat(10001)}]})});
  assert.equal(response.status,413);
});
test("rejects manifests beyond the multi-part scene limit", async () => {
  await waitReady();
  const scenes=Array.from({length:121},(_,i)=>({title:"Scena "+i,narration:"Tekst testowy."}));
  const response=await apiFetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Limit segmentów",format:"16:9",scenes})});
  assert.equal(response.status,400);
});
test("validates queued manifests, renders a job, and serves its MP4", async () => {
  await waitReady();
  const invalid = await apiFetch(base + "/api/render/jobs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ topic:"Nieprawidłowe zadanie", format:"16:9", scenes:[] }) });
  assert.equal(invalid.status,400);
  const created = await apiFetch(base + "/api/render/jobs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ topic:"Test kolejki DARK VIDEO", format:"16:9", scenes:[{title:"Scena testowa",narration:"To jest krótki test kolejki renderowania.",seconds:2}] }) });
  assert.equal(created.status,202);
  const job = await created.json();
  assert.match(job.id,/^[0-9a-f-]{36}$/);
  assert.ok(["queued","running","completed"].includes(job.status));
  let current = job;
  for (let i=0;i<180 && current.status!=="completed" && current.status!=="failed";i++) {
    await new Promise(resolve=>setTimeout(resolve,500));
    const status = await apiFetch(base + "/api/render/jobs/" + job.id,{headers:authHeaders});
    current = await status.json();
  }
  assert.equal(current.status,"completed",current.error||"Render job did not complete");
  assert.equal(current.progress,100);
  const download = await apiFetch(base + "/api/render/jobs/" + job.id + "/download",{headers:authHeaders});
  assert.equal(download.status,200);
  assert.match(download.headers.get("content-type"),/video\/mp4/);
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.ok(bytes.length>10000);
  assert.equal(bytes.subarray(4,8).toString(),"ftyp");
  const retry = await apiFetch(base + "/api/render/jobs/" + job.id + "/retry",{method:"POST",headers:authHeaders});
  assert.equal(retry.status,409);
});
test("renders a playable multi-part MP4 with continuous narration and subtitle track", async () => {
  await waitReady();
  const response=await apiFetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Test DARK VIDEO",format:"16:9",scenes:[{title:"Pierwsza scena",narration:"To jest pierwsza część testu polskiego lektora.",seconds:5},{title:"Druga scena",narration:"A tutaj zaczyna się druga część, połączona w jeden film.",seconds:5}]})});
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type"),/video\/mp4/);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length>10000);
  assert.equal(bytes.subarray(4,8).toString(),"ftyp");
  const dir=await mkdtemp(path.join(os.tmpdir(),"dark-video-test-"));
  try {
    const file=path.join(dir,"output.mp4"); await writeFile(file,bytes);
    const probe=spawnSync("ffprobe",["-v","error","-show_entries","stream=codec_type:stream_tags=language","-of","json",file],{encoding:"utf8"});
    assert.equal(probe.status,0,probe.stderr);
    const types=JSON.parse(probe.stdout).streams.map(stream=>stream.codec_type);
    assert.ok(types.includes("video"),"MP4 must contain video");
    assert.ok(types.includes("audio"),"MP4 must contain Polish narration audio");
    assert.ok(types.includes("subtitle"),"MP4 must contain a timed subtitle track");
  } finally { await rm(dir,{recursive:true,force:true}); }
});
after(async()=>{server.kill("SIGTERM");await new Promise(resolve=>server.once("exit",resolve));await rm(jobsDir,{recursive:true,force:true});});
