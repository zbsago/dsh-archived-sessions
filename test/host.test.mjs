// Standalone host-plugin logic tests: exercise index.mjs against a mock ctx
// (fence, GET listing, POST unarchive) without touching the live harness.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../index.mjs";

function makeRegistry(initialArchived) {
  let state = { archivedSessionIds: [...initialArchived] };
  const written = [];
  return {
    get archivedSessionIds() { return state.archivedSessionIds; },
    requireState() { return state; },
    async setState(next) { state = next; written.push(next); },
    async enqueueOperation(fn) { return fn(); },
    __state: () => state,
    __written: () => written,
  };
}

function makeCtx({ registry, metas, trustedHosts = ["10.1.124.77", "10.2.4.21"] } = {}) {
  let route = null;
  const ctx = {
    logger: { warn() {} },
    webRuntime: { trustedHosts },
    workspaceRegistry: registry,
    get(name) {
      if (name === "sessionPersistence") return { list: async () => metas };
      return undefined;
    },
    webServer: {
      register(r) { route = r; return () => {}; },
    },
    effect(fn) { const d = typeof fn === "function" ? fn() : fn; return () => { if (typeof d === "function") d(); }; },
  };
  return { ctx, route: () => route };
}

function req({ method = "GET", url = "/api/archived-sessions", host = "127.0.0.1:8081", origin = "http://127.0.0.1:8081", secFetchSite = "same-origin" } = {}) {
  return { method, url, headers: { host, origin, "sec-fetch-site": secFetchSite } };
}

function makeRes() {
  let status = 0, body = "";
  return {
    writeHead(s, h) { status = s; this.headers = h; },
    end(b) { body = b; },
    __status: () => status,
    __json: () => JSON.parse(body || "null"),
  };
}

test("GET /api/archived-sessions lists archived ids with persistence metadata", async () => {
  const registry = makeRegistry(["session-a", "session-b"]);
  const { ctx, route } = makeCtx({
    registry,
    metas: [
      { id: "session-a", cwd: "/home/xxk/test", createdAt: 1 },
      { id: "session-b", cwd: "/home/xxk/src", createdAt: 2 },
    ],
  });
  apply(ctx);
  const res = makeRes();
  await route().handler(req(), res);
  assert.equal(res.__status(), 200);
  assert.deepEqual(res.__json(), {
    ok: true,
    sessions: [
      { id: "session-a", cwd: "/home/xxk/test", createdAt: 1 },
      { id: "session-b", cwd: "/home/xxk/src", createdAt: 2 },
    ],
  });
});

test("POST .../unarchive removes the id durably via the registry write path", async () => {
  const registry = makeRegistry(["session-a", "session-b"]);
  const { ctx, route } = makeCtx({ registry, metas: [] });
  apply(ctx);
  const res = makeRes();
  await route().handler(req({ method: "POST", url: "/api/archived-sessions/session-a/unarchive" }), res);
  assert.equal(res.__status(), 200);
  const json = res.__json();
  assert.equal(json.ok, true);
  assert.deepEqual(json.archivedSessionIds, ["session-b"]);
  assert.deepEqual(registry.__state().archivedSessionIds, ["session-b"]);
  assert.equal(registry.__written().length, 1);
});

test("POST unarchive of an already-visible session is a no-op (no write)", async () => {
  const registry = makeRegistry(["session-a"]);
  const { ctx, route } = makeCtx({ registry, metas: [] });
  apply(ctx);
  const res = makeRes();
  await route().handler(req({ method: "POST", url: "/api/archived-sessions/ghost/unarchive" }), res);
  assert.equal(res.__status(), 200);
  assert.deepEqual(registry.__state().archivedSessionIds, ["session-a"]);
  assert.equal(registry.__written().length, 0);
});

test("fence rejects untrusted LAN origin (403)", async () => {
  const registry = makeRegistry(["session-a"]);
  const { ctx, route } = makeCtx({ registry, metas: [], trustedHosts: ["10.2.4.21"] });
  apply(ctx);
  const res = makeRes();
  // Host header is an untrusted host AND origin is cross-site
  await route().handler(req({ host: "10.9.9.9:8080", origin: "http://evil.example", secFetchSite: "cross-site" }), res);
  assert.equal(res.__status(), 403);
});

test("fence accepts a trusted LAN host with same-origin marker", async () => {
  const registry = makeRegistry(["session-a"]);
  const { ctx, route } = makeCtx({ registry, metas: [], trustedHosts: ["10.2.4.21"] });
  apply(ctx);
  const res = makeRes();
  await route().handler(req({ host: "10.2.4.21:8080", origin: "https://10.2.4.21:8080", secFetchSite: "same-origin" }), res);
  assert.equal(res.__status(), 200);
});

test("unknown archived-sessions method returns 404", async () => {
  const registry = makeRegistry([]);
  const { ctx, route } = makeCtx({ registry, metas: [] });
  apply(ctx);
  const res = makeRes();
  await route().handler(req({ method: "POST", url: "/api/archived-sessions/session-a/delete" }), res);
  assert.equal(res.__status(), 404);
});

test("method not allowed for PUT", async () => {
  const registry = makeRegistry([]);
  const { ctx, route } = makeCtx({ registry, metas: [] });
  apply(ctx);
  const res = makeRes();
  await route().handler(req({ method: "PUT", url: "/api/archived-sessions" }), res);
  assert.equal(res.__status(), 405);
});

// --- read-only transcript endpoint ------------------------------------------

function makePersistence(metas, inspections) {
  const byId = new Map((metas ?? []).map((m) => [m.id, m]));
  return {
    async list() { return [...byId.values()]; },
    async inspect(id) {
      const meta = byId.get(id) ?? { id, cwd: "/home/xxk", createdAt: 1 };
      const events = inspections?.[id] ?? [];
      return { meta, events };
    },
  };
}

function makeCtxFull({ registry, metas, inspections, trustedHosts = ["10.1.124.77", "10.2.4.21"] } = {}) {
  const { ctx, route } = makeCtx({ registry, metas: [], trustedHosts });
  ctx.get = (name) => (name === "sessionPersistence" ? makePersistence(metas, inspections) : undefined);
  apply(ctx);
  return { ctx, route };
}

const transcriptEvents = (id) => [
  { type: "session", seq: undefined, id },
  { type: "session/title", seq: 3, data: { title: "标题一" } },
  { type: "user/message", seq: 4, surfaceOp: "append", data: { id: "u1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "你好" }] } },
  // injected context is user-role producer content and must be dropped
  { type: "user/message", seq: 4, surfaceOp: "append", data: { id: "ctx1", role: "user", source: { kind: "agent-instructions" }, content: [{ type: "text", text: "<system-reminder>..." }] } },
  { type: "assistant/message", seq: 5, surfaceOp: "append", data: { message: { id: "a1", role: "assistant", source: { kind: "model" }, content: [{ type: "text", text: "世界" }] } } },
  { type: "assistant/message", seq: 6, surfaceOp: "append", data: { message: { id: "a2", role: "assistant", source: { kind: "model" }, content: [] } } },
  { type: "assistant/message", seq: 7, surfaceOp: "append", data: { message: { id: "a3", role: "assistant", source: { kind: "model" }, content: [{ type: "reasoning", text: "想想看" }, { type: "tool-call", name: "bash", arguments: "{}" }, { type: "tool-result", content: [{ type: "text", text: "result-text" }] }, { type: "text", text: "最终答案" }] } } },
  { type: "tool/result", seq: 8, surfaceOp: "append", data: { message: { id: "t1", role: "user", source: { kind: "tool", callId: "c1" }, content: [{ type: "tool-result", content: [{ type: "text", text: "x".repeat(2000) }] }] } } },
  // replacement copies are model-visible only -> excluded from the transcript
  { type: "assistant/message", seq: 9, surfaceOp: { op: "replace", start: 5, end: 5 }, data: { message: { id: "a9", role: "assistant", source: { kind: "model" }, content: [{ type: "text", text: "替换版" }] } } },
];

test("GET .../messages returns a read-only transcript of the archived session", async () => {
  const registry = makeRegistry(["session-a"]);
  const { route } = makeCtxFull({ registry, metas: [{ id: "session-a", cwd: "/home/xxk/test", createdAt: 42 }], inspections: { "session-a": transcriptEvents("session-a") } });
  const res = makeRes();
  await route().handler(req({ url: "/api/archived-sessions/session-a/messages" }), res);
  assert.equal(res.__status(), 200);
  const json = res.__json();
  assert.equal(json.ok, true);
  assert.deepEqual(json.session, { id: "session-a", cwd: "/home/xxk/test", createdAt: 42, title: "标题一" });
  const msgs = json.messages;
  // user -> message; assistant -> message; empty assistant skipped; replacement copy excluded; tool/result included
  assert.deepEqual(msgs.map((m) => m.id), ["u1", "a1", "a3", "t1"]);
  const a3 = msgs[2];
  assert.equal(a3.role, "assistant");
  assert.deepEqual(
    a3.blocks.map((b) => b.type),
    ["reasoning", "tool-call", "tool-result", "text"],
  );
  assert.equal(a3.blocks[0].text, "想想看");
  assert.equal(a3.blocks[1].name, "bash");
  assert.equal(a3.blocks[2].text, "result-text");
  assert.equal(a3.blocks[3].text, "最终答案");
  // tool-result content clipped
  const t1 = msgs[3];
  assert.equal(t1.kind, "tool");
  assert.ok(t1.blocks[0].text.endsWith("…(已截断)"));
  // read-only: archive set untouched
  assert.deepEqual(registry.__state().archivedSessionIds, ["session-a"]);
  assert.equal(registry.__written().length, 0);
});

test("GET .../messages of a non-archived session returns 404", async () => {
  const registry = makeRegistry(["session-a"]);
  const { route } = makeCtxFull({ registry, inspections: {} });
  const res = makeRes();
  await route().handler(req({ url: "/api/archived-sessions/session-z/messages" }), res);
  assert.equal(res.__status(), 404);
});

test("GET .../messages applies the browser-trust fence", async () => {
  const registry = makeRegistry(["session-a"]);
  const { route } = makeCtxFull({ registry, inspections: {} });
  const res = makeRes();
  await route().handler(req({ host: "10.9.9.9:8080", origin: "http://evil.example", secFetchSite: "cross-site", url: "/api/archived-sessions/session-a/messages" }), res);
  assert.equal(res.__status(), 403);
});

test("GET .../messages with unknown suffix returns 404", async () => {
  const registry = makeRegistry(["session-a"]);
  const { route } = makeCtxFull({ registry, inspections: {} });
  const res = makeRes();
  await route().handler(req({ url: "/api/archived-sessions/session-a/export" }), res);
  assert.equal(res.__status(), 404);
});

// --- content search endpoint -------------------------------------------------

test("GET .../search returns content matches with snippets (read-only)", async () => {
  const registry = makeRegistry(["session-a", "session-b"]);
  const inspections = {
    "session-a": transcriptEvents("session-a"),
    "session-b": [
      { type: "session", seq: undefined, id: "session-b" },
      { type: "session/title", seq: 1, data: { title: "另一个标题" } },
      { type: "user/message", seq: 2, surfaceOp: "append", data: { id: "u9", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "这里没有匹配词" }] } },
    ],
  };
  const { route } = makeCtxFull({ registry, metas: [{ id: "session-a", cwd: "/home/xxk/test", createdAt: 42 }], inspections });
  const res = makeRes();
  await route().handler(req({ url: "/api/archived-sessions/search?q=%E6%9C%80%E7%BB%88" }), res);
  assert.equal(res.__status(), 200);
  const json = res.__json();
  assert.equal(json.ok, true);
  assert.equal(json.query, "最终");
  assert.equal(json.results.length, 1);
  const r = json.results[0];
  assert.equal(r.id, "session-a");
  assert.equal(r.title, "标题一");
  assert.equal(r.cwd, "/home/xxk/test");
  assert.equal(r.createdAt, 42);
  assert.ok(r.matchCount >= 1);
  assert.ok(r.matches[0].snippet.includes("最终答案"));
  assert.equal(r.matches[0].kind, "model");
  // read-only: archive set untouched
  assert.deepEqual(registry.__state().archivedSessionIds, ["session-a", "session-b"]);
  assert.equal(registry.__written().length, 0);
});

test("GET .../search with an empty query returns no results", async () => {
  const registry = makeRegistry(["session-a"]);
  const { route } = makeCtxFull({ registry, inspections: { "session-a": transcriptEvents("session-a") } });
  const res = makeRes();
  await route().handler(req({ url: "/api/archived-sessions/search?q=" }), res);
  assert.equal(res.__status(), 200);
  assert.deepEqual(res.__json(), { ok: true, query: "", results: [] });
});

test("GET .../search applies the browser-trust fence", async () => {
  const registry = makeRegistry(["session-a"]);
  const { route } = makeCtxFull({ registry, inspections: {} });
  const res = makeRes();
  await route().handler(req({ host: "10.9.9.9:8080", origin: "http://evil.example", secFetchSite: "cross-site", url: "/api/archived-sessions/search?q=x" }), res);
  assert.equal(res.__status(), 403);
});
