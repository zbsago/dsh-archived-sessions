// Sandbox-load lib/client.js to confirm it registers under the harness
// client-module contract and that apply() wires both slot contributions
// without throwing (components are not rendered here).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

function loadBundle(stubRequire, fetchImpl) {
  let registration = null;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(reg) { registration = reg; },
      },
    },
    console,
    fetch: fetchImpl ?? (async () => ({ ok: true, json: async () => ({ ok: true }) })),
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  assert.ok(registration, "bundle must call window.__ModuleLoader__.load");
  assert.equal(registration.id, "dsh-archived-sessions");
  const exports = registration.factory(stubRequire);
  return exports;
}

const stubRequire = (spec) => {
  if (spec === "react") return {};
  if (spec === "react/jsx-runtime") return { jsx() {}, jsxs() {}, Fragment: "F" };
  throw new Error(`unexpected require: ${spec}`);
};

// A minimal store mirroring ctx.workspaces.list (snapshot + subscribe).
function makeListStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) { state = next; for (const fn of [...listeners]) fn(); },
  };
}

function makeCtx({ workspacesList, fetchImpl } = {}) {
  const registered = [];
  const ctx = {
    effect(fn) { const d = fn(); return () => { if (typeof d === "function") d(); }; },
    locale: { register() {} },
    sessions: { open() {} },
    workspaces: { list: workspacesList ?? makeListStore({ archivedSessionIds: [] }) },
    slots: {
      inject(key, cb) {
        registered.push({ key, cb });
        cb(); // slots already declared in the real app -> run immediately
        return () => {};
      },
      register(options, component) {
        registered.push({ register: { options, component } });
        return () => {};
      },
    },
    fetch: fetchImpl ?? (async () => ({ ok: true, json: async () => ({ ok: true }) })),
  };
  return { ctx, registered };
}

test("client bundle registers id + exports { apply, inject }", () => {
  const exports = loadBundle(stubRequire);
  assert.equal(typeof exports.apply, "function");
  assert.ok(Array.isArray(exports.inject));
  assert.ok(exports.inject.includes("slots"));
  assert.ok(exports.inject.includes("sessions"));
});

test("apply() registers footer action + overlay with inject faces", async () => {
  const exports = loadBundle(stubRequire);
  const { ctx, registered } = makeCtx();
  await exports.apply(ctx);
  const injectKeys = registered.filter((e) => e.key !== undefined).map((e) => e.key);
  assert.ok(injectKeys.includes("sidebar.footer.action"));
  assert.ok(injectKeys.includes("shell.overlay"));
  const overlay = registered.find((e) => e.register && e.register.options.name === "shell.overlay");
  assert.ok(overlay, "shell.overlay must be registered");
  const injected = overlay.register.options.inject();
  assert.equal(typeof injected.preview, "function");
  assert.equal(typeof injected.restoreAndOpen, "function");
  assert.equal(typeof injected.unarchive, "function");
});

test("only react and react/jsx-runtime are required externally", () => {
  const seen = new Set();
  loadBundle((spec) => {
    seen.add(spec);
    if (spec === "react") return {};
    if (spec === "react/jsx-runtime") return { jsx() {}, jsxs() {}, Fragment: "F" };
    throw new Error(`unexpected require: ${spec}`);
  });
  assert.deepEqual([...seen].sort(), ["react", "react/jsx-runtime"]);
});

test("restoreAndOpen unarchives first, waits for the mirror, then opens", async () => {
  const workspacesList = makeListStore({ archivedSessionIds: ["session-x"] });
  const opened = [];
  let fetchCalls = 0;
  const { ctx, registered } = makeCtx({ workspacesList });
  const fetchImpl = async () => { fetchCalls += 1; return { ok: true, json: async () => ({ ok: true }) }; };
  const exports2 = loadBundle(stubRequire, fetchImpl);
  ctx.sessions.open = (id) => opened.push(id);
  await exports2.apply(ctx);
  const overlay = registered.find((e) => e.register && e.register.options.name === "shell.overlay");
  const injected = overlay.register.options.inject();
  const openPromise = injected.restoreAndOpen("session-x");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(opened.length, 0, "must not open while still archived");
  workspacesList.set({ archivedSessionIds: [] });
  await openPromise;
  assert.equal(fetchCalls, 1);
  assert.deepEqual(opened, ["session-x"]);
});

test("preview fetches the transcript and never unarchives or opens", async () => {
  const workspacesList = makeListStore({ archivedSessionIds: ["session-x"] });
  const opened = [];
  const urls = [];
  const { ctx, registered } = makeCtx({ workspacesList });
  const fetchImpl = async (url) => {
    urls.push(url);
    return { ok: true, json: async () => ({ ok: true, messages: [{ id: "m1" }] }) };
  };
  const exports2 = loadBundle(stubRequire, fetchImpl);
  ctx.sessions.open = (id) => opened.push(id);
  await exports2.apply(ctx);
  const overlay = registered.find((e) => e.register && e.register.options.name === "shell.overlay");
  const injected = overlay.register.options.inject();
  const body = await injected.preview("session-x");
  assert.deepEqual(urls, ["/api/archived-sessions/session-x/messages"]);
  assert.deepEqual(body.messages, [{ id: "m1" }]);
  assert.deepEqual(opened, []);
  assert.deepEqual(workspacesList.getSnapshot().archivedSessionIds, ["session-x"], "preview must not unarchive");
});
