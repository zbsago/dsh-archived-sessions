// dsh-archived-sessions — host side.
//
// Exposes the archived-session API to the browser over the same browser-trust
// fence as the /api RPC bridge:
//
//   GET  /api/archived-sessions                         -> { sessions: [...] }
//   POST /api/archived-sessions/<sessionId>/unarchive    -> { ok, archivedSessionIds }
//   GET  /api/archived-sessions/<sessionId>/messages     -> read-only transcript
//
// The transcript endpoint is strictly read-only: it projects the session's
// durable log into display blocks and NEVER writes — `archivedSessionIds` is
// untouched, so viewing an archived session leaves it archived.
//
// Listing reads the workspace registry's archive set plus session persistence
// metadata. Unarchiving writes the registry state through its own operation
// queue, so the change is durable AND the storage domain emits
// `domain/changed` — which the shipped api-proxy already forwards to every
// browser as `host/archived-sessions-changed`, refreshing the sidebar client
// with no extra code here.

export const name = "dsh-archived-sessions";

export const inject = ["webServer", "workspaceRegistry", "sessionPersistence", "webRuntime"];

// --- browser-trust fence (mirror of the /api bridge) ------------------------

function header(headers, name) {
  const value = headers[name];
  return typeof value === "string" ? value : undefined;
}

function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return undefined;
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return (
    parts.length === 4 &&
    parts[0] === "127" &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
  return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}

function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry);
    if (entryUrl === undefined) return false;
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host;
  });
}

function isTrustedApiRequest(request, trustedHosts) {
  const host = header(request.headers, "host");
  if (host === undefined) return false;
  const hostUrl = parseAuthority(host);
  if (hostUrl === undefined) return false;
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
  if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
  const origin = header(request.headers, "origin");
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function writeJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

// --- unarchive --------------------------------------------------------------
//
// The registry has `archiveSession()` but no `unarchiveSession()`. We reuse the
// registry's own durable write path (`enqueueOperation` serializes against
// other registry mutations and runs pending recovery; `setState` persists via
// the storage domain, which is what fires `domain/changed`).
async function unarchiveSession(registry, sessionId) {
  await registry.enqueueOperation(async () => {
    const state = registry.requireState();
    if (!state.archivedSessionIds.includes(sessionId)) return;
    await registry.setState({
      ...state,
      archivedSessionIds: state.archivedSessionIds.filter((id) => id !== sessionId),
    });
  });
}

// --- read-only transcript projection ------------------------------------------
//
// The harness runtime forbids an archived session from being the current
// session (WorkspaceRuntime.project() clears it), so "open an archived
// session" cannot happen in the main view without unarchiving. Instead the
// plugin offers an in-panel read-only transcript: we read the durable log
// (sessionPersistence.inspect) and project the append-origin surface events
// into display blocks. Nothing here writes to storage.

const SURFACE_EVENT_TYPES = new Set(["user/message", "assistant/message", "tool/result"]);

/** Message kinds that belong in a human-facing transcript. Injected context
* (agent-instructions, plugin runtime snapshots, skill catalogs, recall, ...)
* is user-role producer content that would drown the actual conversation, so it
* is dropped from the preview. */
const TRANSCRIPT_KINDS = new Set(["user", "model", "tool"]);

/** Append-origin surface events are the durable human transcript material
* (model-visible replacement copies shadow what the user already saw, so they
* are excluded here). */
function isAppendSurfaceEvent(event) {
  return SURFACE_EVENT_TYPES.has(event.type) && event.surfaceOp === "append";
}

/** Mirror of @deepseek-ai/dsh-session/surface `deriveEventMessage`: projects a
* surface event into its immutable Message, or null when it produces none. */
function deriveEventMessage(event) {
  switch (event.type) {
    case "user/message":
      return event.data; // the event's data IS the message
    case "assistant/message": {
      const message = event.data?.message;
      if (message == null || message.content?.length === 0) return null;
      return message;
    }
    case "tool/result":
      return event.data?.message ?? null;
    default:
      return null;
  }
}

const MAX_TEXT_CHARS = 4000;
const MAX_REASONING_CHARS = 1200;
const MAX_TOOL_RESULT_CHARS = 800;
const MAX_TOOL_ARGS_CHARS = 500;
const MAX_MESSAGES = 500;

function clip(text, max) {
  const value = String(text ?? "");
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(已截断)`;
}

function renderTextBlocks(blocks) {
  return (blocks ?? [])
    .map((block) => (block?.type === "text" ? String(block.text ?? "") : ""))
    .join("\n")
    .trim();
}

/** Normalize one LLM content block into a render-safe display block. */
function normalizeBlock(block) {
  switch (block?.type) {
    case "text":
      return { type: "text", text: clip(block.text, MAX_TEXT_CHARS) };
    case "reasoning":
      return { type: "reasoning", text: clip(block.text, MAX_REASONING_CHARS) };
    case "tool-call": {
      let args = "";
      try {
        args = JSON.stringify(JSON.parse(block.arguments ?? "{}"));
      } catch {
        args = String(block.arguments ?? "");
      }
      return { type: "tool-call", name: String(block.name ?? ""), args: clip(args, MAX_TOOL_ARGS_CHARS) };
    }
    case "tool-result":
      return { type: "tool-result", text: clip(renderTextBlocks(block.content), MAX_TOOL_RESULT_CHARS) };
    case "image":
      return { type: "image" };
    default:
      return { type: "other", text: `[${String(block?.type ?? "unknown")}]` };
  }
}

function toTranscriptMessage(message, seq) {
  return {
    id: message.id,
    seq,
    role: message.role ?? "user",
    kind: message.source?.kind ?? "other",
    blocks: (message.content ?? []).map(normalizeBlock),
  };
}

/** Latest durable title (session/title event) if any. */
function latestTitle(events) {
  let title = null;
  for (const event of events) {
    if (event.type === "session/title" && event.data?.title) title = String(event.data.title);
  }
  return title;
}

/** Join a message's display blocks into one case-preserving searchable string. */
function blocksToSearchText(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "text":
        case "reasoning":
          return block.text;
        case "tool-result":
          return block.text;
        case "tool-call":
          return `${block.name} ${block.args}`;
        default:
          return "";
      }
    })
    .join("\n")
    .trim();
}

/** Project one archived session's durable log into transcript messages.
* `searchText` rides along for the /search endpoint and is dropped by the
* /messages endpoint. Never writes. */
async function loadProjection(ctx, sessionId) {
  const persistence = ctx.get("sessionPersistence");
  if (persistence == null || typeof persistence.inspect !== "function") {
    throw new Error("sessionPersistence is unavailable");
  }
  const inspection = await persistence.inspect(sessionId);
  const events = inspection.events;
  const meta = inspection.meta;
  const messages = [];
  let truncated = false;
  for (const event of events) {
    if (messages.length >= MAX_MESSAGES) {
      truncated = true;
      break;
    }
    if (!isAppendSurfaceEvent(event)) continue;
    const message = deriveEventMessage(event);
    if (message == null) continue;
    if (!TRANSCRIPT_KINDS.has(message.source?.kind)) continue;
    const blocks = (message.content ?? []).map(normalizeBlock);
    messages.push({
      id: message.id,
      seq: event.seq,
      role: message.role ?? "user",
      kind: message.source?.kind ?? "other",
      blocks,
      searchText: blocksToSearchText(blocks),
    });
  }
  return { meta, title: latestTitle(events), messages, truncated };
}

/** Read-only transcript of an archived session. */
async function readTranscript(ctx, sessionId) {
  const { meta, title, messages, truncated } = await loadProjection(ctx, sessionId);
  return {
    ok: true,
    session: {
      id: meta.id ?? sessionId,
      cwd: meta.cwd ?? null,
      createdAt: meta.createdAt ?? null,
      title,
    },
    messages: messages.map(({ searchText, ...rest }) => rest),
    truncated,
  };
}

const SNIPPET_RADIUS = 70;
const MAX_MATCHES_PER_SESSION = 3;
const MAX_SEARCH_RESULTS = 20;

/** A short context window around the first case-insensitive hit. */
function snippetAround(text, needleLower) {
  const lower = String(text ?? "").toLowerCase();
  const idx = lower.indexOf(needleLower);
  if (idx < 0) return null;
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + needleLower.length + SNIPPET_RADIUS);
  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

/** Full-text search over every archived session's projected transcript.
* Scans the archived set (usually small) and caps work per session. Read-only. */
async function searchArchived(ctx, query, metasById) {
  const q = String(query ?? "").trim();
  if (q === "") return { ok: true, query: q, results: [] };
  const needle = q.toLowerCase();
  const results = [];
  for (const id of ctx.workspaceRegistry.archivedSessionIds) {
    let projection;
    try {
      projection = await loadProjection(ctx, id);
    } catch (error) {
      ctx.logger.warn(`archived-sessions: search inspect ${id} failed: ${String(error)}`);
      continue;
    }
    const matches = [];
    for (const message of projection.messages) {
      if (matches.length >= MAX_MATCHES_PER_SESSION) break;
      if (!message.searchText.toLowerCase().includes(needle)) continue;
      const snippet = snippetAround(message.searchText, needle);
      if (snippet == null) continue;
      matches.push({ seq: message.seq, role: message.role, kind: message.kind, snippet });
    }
    if (matches.length === 0) continue;
    const meta = metasById.get(id);
    results.push({
      id,
      cwd: meta?.cwd ?? projection.meta?.cwd ?? null,
      createdAt: meta?.createdAt ?? projection.meta?.createdAt ?? null,
      title: projection.title,
      matchCount: matches.length,
      matches,
    });
    if (results.length >= MAX_SEARCH_RESULTS) break;
  }
  return { ok: true, query: q, results };
}

export function apply(ctx) {
  const trustedHosts = ctx.webRuntime?.trustedHosts ?? [];
  const fence = (request) => isTrustedApiRequest(request, trustedHosts);

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: "/api/archived-sessions",
        handler: async (req, res) => {
          if (!fence(req)) {
            writeJson(res, 403, { ok: false, error: { code: "forbidden", message: "forbidden" } });
            return;
          }
          const url = new URL(req.url ?? "/", "http://dsh.internal");
          const pathname = url.pathname;
          const prefix = "/api/archived-sessions";

          if (req.method === "GET") {
            const rest = pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length + 1) : "";
            if (rest === "search") {
              const q = url.searchParams.get("q") ?? "";
              let metasById = new Map();
              const persistence = ctx.get("sessionPersistence");
              if (persistence !== undefined && typeof persistence.list === "function") {
                try {
                  for (const meta of await persistence.list()) metasById.set(meta.id, meta);
                } catch (error) {
                  ctx.logger.warn(`archived-sessions: search persistence list failed: ${String(error)}`);
                }
              }
              try {
                writeJson(res, 200, await searchArchived(ctx, q, metasById));
              } catch (error) {
                ctx.logger.warn(`archived-sessions: search failed: ${String(error)}`);
                writeJson(res, 500, { ok: false, error: { code: "internal", message: String(error) } });
              }
              return;
            }
            if (rest.endsWith("/messages")) {
              const sessionId = rest.slice(0, -"/messages".length);
              if (sessionId.length === 0 || sessionId.includes("/")) {
                writeJson(res, 404, { ok: false, error: { code: "not-found", message: "unknown session" } });
                return;
              }
              if (!ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)) {
                writeJson(res, 404, { ok: false, error: { code: "not-found", message: "session is not archived" } });
                return;
              }
              try {
                writeJson(res, 200, await readTranscript(ctx, sessionId));
              } catch (error) {
                ctx.logger.warn(`archived-sessions: read transcript ${sessionId} failed: ${String(error)}`);
                writeJson(res, 500, { ok: false, error: { code: "internal", message: String(error) } });
              }
              return;
            }
            if (pathname === prefix) {
            const registry = ctx.workspaceRegistry;
            const archived = registry.archivedSessionIds;
            let byId = new Map();
            const persistence = ctx.get("sessionPersistence");
            if (persistence !== undefined) {
              try {
                const metas = await persistence.list();
                for (const meta of metas) byId.set(meta.id, meta);
              } catch (error) {
                ctx.logger.warn(`archived-sessions: persistence list failed: ${String(error)}`);
              }
            }
            const sessions = archived.map((id) => {
              const meta = byId.get(id);
              return {
                id,
                cwd: meta?.cwd ?? null,
                createdAt: meta?.createdAt ?? null,
              };
            });
            writeJson(res, 200, { ok: true, sessions });
            return;
            }
            writeJson(res, 404, { ok: false, error: { code: "not-found", message: "unknown archived-sessions method" } });
            return;
          }

          if (req.method === "POST") {
            const rest = pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length + 1) : "";
            if (!rest.endsWith("/unarchive")) {
              writeJson(res, 404, { ok: false, error: { code: "not-found", message: "unknown archived-sessions method" } });
              return;
            }
            const sessionId = rest.slice(0, -"/unarchive".length);
            if (sessionId.length === 0 || sessionId.includes("/")) {
              writeJson(res, 404, { ok: false, error: { code: "not-found", message: "unknown session" } });
              return;
            }
            try {
              await unarchiveSession(ctx.workspaceRegistry, sessionId);
              writeJson(res, 200, {
                ok: true,
                archivedSessionIds: [...ctx.workspaceRegistry.archivedSessionIds],
              });
            } catch (error) {
              ctx.logger.warn(`archived-sessions: unarchive ${sessionId} failed: ${String(error)}`);
              writeJson(res, 500, { ok: false, error: { code: "internal", message: String(error) } });
            }
            return;
          }

          writeJson(res, 405, { ok: false, error: { code: "method-error", message: "method not allowed" } });
        },
      }),
    "dsh-archived-sessions: /api/archived-sessions routes",
  );
}
