import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const port = 8097;
const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
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
  assert.equal(response.status,200); assert.equal(body.ok,true); assert.equal(body.tts,"espeak-ng Polish voice"); assert.equal(body.maxScenes,120); assert.equal(body.maxFilmSeconds,600); assert.equal(body.renderMode,"multi-part-concat");
});
test("rejects incomplete film manifests", async () => {
  await waitReady();
  const response=await fetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Test",format:"16:9",scenes:[]})});
  assert.equal(response.status,400);
});
test("rejects oversized narration in an individual segment", async () => {
  await waitReady();
  const response=await fetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Limit tekstu",format:"16:9",scenes:[{title:"Za długa scena",narration:"x".repeat(10001)}]})});
  assert.equal(response.status,413);
});
test("rejects manifests beyond the multi-part scene limit", async () => {
  await waitReady();
  const scenes=Array.from({length:121},(_,i)=>({title:"Scena "+i,narration:"Tekst testowy."}));
  const response=await fetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Limit segmentów",format:"16:9",scenes})});
  assert.equal(response.status,400);
});
test("creates a persistent render job and allows retry after a failed attempt", async () => {
  await waitReady();
  const created = await fetch(base + "/api/render/jobs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ topic:"Nieprawidłowe zadanie", format:"16:9", scenes:[] }) });
  assert.equal(created.status,202);
  const job = await created.json();
  assert.match(job.id,/^[0-9a-f-]{36}$/);
  assert.equal(job.status,"queued");
  let current = job;
  for (let i=0;i<40 && current.status!=="failed";i++) {
    await new Promise(resolve=>setTimeout(resolve,100));
    const status = await fetch(base + "/api/render/jobs/" + job.id);
    current = await status.json();
  }
  assert.equal(current.status,"failed");
  assert.match(current.error,/scen/);
  const retry = await fetch(base + "/api/render/jobs/" + job.id + "/retry",{method:"POST"});
  assert.equal(retry.status,202);
  const retried = await retry.json();
  assert.equal(retried.status,"queued");
  assert.equal(retried.attempts,1);
});
test("renders a playable multi-part MP4 with continuous narration and subtitle track", async () => {
  await waitReady();
  const response=await fetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Test DARK VIDEO",format:"16:9",scenes:[{title:"Pierwsza scena",narration:"To jest pierwsza część testu polskiego lektora.",seconds:5},{title:"Druga scena",narration:"A tutaj zaczyna się druga część, połączona w jeden film.",seconds:5}]})});
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
after(()=>server.kill("SIGTERM"));
