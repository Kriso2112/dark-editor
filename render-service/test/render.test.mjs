import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

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
  assert.equal(response.status,200); assert.equal(body.ok,true); assert.equal(body.tts,"espeak-ng Polish voice");
});
test("rejects incomplete film manifests", async () => {
  await waitReady();
  const response=await fetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Test",format:"16:9",scenes:[]})});
  assert.equal(response.status,400);
});
test("renders a playable MP4 with Polish narration and scene captions", async () => {
  await waitReady();
  const response=await fetch(base+"/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic:"Test DARK VIDEO",format:"16:9",scenes:[{title:"Pierwsza scena",narration:"To jest test polskiego lektora w pierwszym filmie DARK VIDEO.",seconds:5}]})});
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type"),/video\/mp4/);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length>10000);
  assert.equal(bytes.subarray(4,8).toString(),"ftyp");
});
after(()=>server.kill("SIGTERM"));
