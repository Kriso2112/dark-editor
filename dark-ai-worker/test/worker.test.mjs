import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = {};
const brief = { topic: "Tajemnice piramid", category: "wiedza", duration: 60, format: "16:9", tone: "mroczny", mode: "auto" };

test("health endpoint reports safe mock mode by default", async () => {
  const response = await worker.fetch(new Request("https://worker.test/api/health"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, "mock");
  assert.equal(body.paidProviderEnabled, false);
});

test("generate endpoint returns a structured mock project", async () => {
  const response = await worker.fetch(new Request("https://worker.test/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief) }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, "mock");
  assert.equal(body.project.title, brief.topic);
  assert.ok(body.project.scenes.length > 0);
  assert.match(body.project.script, /pytani/i);
});

test("rejects malformed or unsupported briefs", async () => {
  const response = await worker.fetch(new Request("https://worker.test/api/generate", { method: "POST", body: JSON.stringify({ ...brief, duration: 999 }) }), env);
  assert.equal(response.status, 400);
});

test("paid mode requires an authenticated, explicit per-job cost confirmation", async () => {
  const paidEnv = { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model", ENABLE_PAID_AI: "true", DARK_AI_ACCESS_TOKEN: "test-token", ALLOWED_ORIGIN: "https://example.test" };
  const noAuth = await worker.fetch(new Request("https://worker.test/api/generate", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.test" }, body: JSON.stringify(brief) }), paidEnv);
  assert.equal(noAuth.status, 401);
  const noConsent = await worker.fetch(new Request("https://worker.test/api/generate", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.test", Authorization: "Bearer test-token" }, body: JSON.stringify(brief) }), paidEnv);
  assert.equal(noConsent.status, 402);
});

test("rejects unapproved browser origins when paid credentials are configured", async () => {
  const paidEnv = { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model", ENABLE_PAID_AI: "true", DARK_AI_ACCESS_TOKEN: "test-token", ALLOWED_ORIGIN: "https://example.test" };
  const response = await worker.fetch(new Request("https://worker.test/api/health", { headers: { Origin: "https://attacker.test" } }), paidEnv);
  assert.equal(response.status, 403);
});
