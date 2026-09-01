// dsh-archived-sessions — client side.
//
// Two UI surfaces, both additive and non-destructive:
//   1. `sidebar.footer.action` — an "归档会话 / Archived" button beside Settings.
//   2. `shell.overlay`        — a frame-wide floating panel listing every
//      archived session.
//
// The harness runtime does not allow an archived session to become the current
// session (WorkspaceRuntime.project() clears it), so there is no way to open
// an archived session in the main view without unarchiving it. The plugin
// therefore offers:
//   - row click / 查看 (View): an IN-PANEL read-only transcript. It reads the
//     durable log through the host `/messages` endpoint and never writes —
//     `archivedSessionIds` is untouched, the session stays archived and stays
//     out of the sidebar.
//   - 恢复 (Restore): unarchive only — the session reappears in the sidebar.
//   - 恢复并继续 (Restore & Continue, inside the preview): unarchive AND open
//     in the main view, for when you actually want to keep talking.
//
// All session metadata (title, cwd, updatedAt) and the archive set already live
// in the browser (session.list includes archived sessions; the workspace list
// carries archivedSessionIds), so the client needs no host listing RPC.

import * as React from "react";

export const inject = ["slots", "sessions", "workspaces", "locale"];

const NS = "archived-sessions";

// --- shared open state: footer button -> overlay panel -----------------------

function createPanelStore() {
  let open = false;
  const listeners = new Set();
  const notify = () => {
    for (const fn of [...listeners]) fn();
  };
  return {
    isOpen: () => open,
    set(value) {
      if (open === value) return;
      open = value;
      notify();
    },
    toggle() {
      open = !open;
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const panelStore = createPanelStore();

function usePanelOpen() {
  return React.useSyncExternalStore(panelStore.subscribe, panelStore.isOpen);
}

// --- helpers -----------------------------------------------------------------

function formatTime(ms) {
  if (!ms || typeof ms !== "number") return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function displayTitle(session, fallback) {
  if (session == null) return fallback;
  if (typeof session.displayTitle === "string" && session.displayTitle.length > 0) return session.displayTitle;
  if (typeof session.title === "string" && session.title.length > 0) return session.title;
  return fallback;
}

// --- footer button -----------------------------------------------------------

function ArchivedButton(props) {
  const { wide = true, t } = props;
  const open = usePanelOpen();
  const style = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    minWidth: 0,
    padding: "6px 8px",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    borderRadius: "6px",
    fontSize: "13px",
    whiteSpace: "nowrap",
    overflow: "hidden",
  };
  return (
    <button
      type="button"
      onClick={() => panelStore.toggle()}
      aria-pressed={open}
      title={t ? t("button") : "归档会话"}
      style={style}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 14, lineHeight: 1 }}>
        🗄️
      </span>
      {wide ? (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto" }}>
          {t ? t("button") : "归档会话"}
        </span>
      ) : null}
    </button>
  );
}

// --- read-only transcript rendering ------------------------------------------

function BlockView({ block, t }) {
  switch (block.type) {
    case "text":
      return (
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{block.text}</div>
      );
    case "reasoning":
      return (
        <details style={{ opacity: 0.8, marginTop: 4 }}>
          <summary style={{ cursor: "pointer", fontSize: 12 }}>{t.thinking}</summary>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 4, fontSize: 12 }}>
            {block.text}
          </div>
        </details>
      );
    case "tool-call":
      return (
        <div
          style={{
            opacity: 0.78,
            fontSize: 12,
            fontFamily: "var(--dsw-font-markdown-code, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            marginTop: 4,
          }}
        >
          ⚙ {t.toolCall}: {block.name}({block.args})
        </div>
      );
    case "tool-result":
      return (
        <div
          style={{
            opacity: 0.7,
            fontSize: 12,
            fontFamily: "var(--dsw-font-markdown-code, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent)",
            borderRadius: 6,
            padding: "4px 8px",
            marginTop: 4,
          }}
        >
          ↩ {t.toolResult}: {block.text}
        </div>
      );
    case "image":
      return <div style={{ opacity: 0.7, marginTop: 4 }}>🖼 {t.image}</div>;
    default:
      return <div style={{ opacity: 0.6, marginTop: 4 }}>{block.text ?? block.type}</div>;
  }
}

function MessageRow({ message, t }) {
  const isAssistant = message.role === "assistant";
  const isTool = message.kind === "tool";
  const align = isAssistant ? "flex-start" : "flex-end";
  const bg = isTool ? "transparent" : "var(--dsw-specific-bubble)";
  const label = isAssistant ? t.assistant : isTool ? t.tool : t.user;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, margin: "10px 0" }}>
      <div style={{ opacity: 0.55, fontSize: 11, marginBottom: 3 }}>{label}</div>
      <div
        style={{
          background: bg,
          borderRadius: 8,
          padding: isTool ? 0 : "6px 10px",
          maxWidth: "100%",
          minWidth: 0,
        }}
      >
        {message.blocks.map((block, i) => (
          <BlockView key={i} block={block} t={t} />
        ))}
      </div>
    </div>
  );
}

// --- overlay panel -----------------------------------------------------------

function ArchivedPanel(props) {
  const {
    preview,
    restoreAndOpen,
    unarchive,
    closePanel,
    useSessions,
    useWorkspaces,
    t,
  } = props;
  const open = usePanelOpen();
  const byId = useSessions((state) => state.byId);
  const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
  const workspaces = useWorkspaces((state) => state.items);

  const rows = React.useMemo(
    () =>
      (archivedSessionIds || [])
        .map((id) => byId[id])
        .filter((s) => s != null)
        .map((s) => ({
          session: s,
          workspace: workspaces.find((w) => (w.sessionIds || []).includes(s.id)),
        })),
    [archivedSessionIds, byId, workspaces],
  );

  const [busy, setBusy] = React.useState(null);
  const [viewId, setViewId] = React.useState(null);
  const [transcript, setTranscript] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [contentHits, setContentHits] = React.useState([]);
  const [contentSearching, setContentSearching] = React.useState(false);
  const [hoverId, setHoverId] = React.useState(null);

  // Reset to the list every time the panel opens.
  React.useEffect(() => {
    if (open) {
      setViewId(null);
      setTranscript(null);
      setError(null);
      setLoading(false);
      setQuery("");
      setContentHits([]);
      setContentSearching(false);
    }
  }, [open]);

  // Debounced full-text search over the archived sessions' content. Metadata
  // (title / cwd / workspace) filtering is instant on the client; content hits
  // arrive from the host and are merged in below.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length === 0) {
      setContentHits([]);
      setContentSearching(false);
      return;
    }
    setContentSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/archived-sessions/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (body && body.ok) setContentHits(body.results || []);
      } catch (e) {
        console.error("[dsh-archived-sessions] search failed:", e);
      } finally {
        setContentSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, open]);

  const q = query.trim().toLowerCase();
  const metaRows = React.useMemo(() => {
    if (q.length === 0) return rows;
    return rows.filter((r) => {
      const title = displayTitle(r.session, "");
      const cwd = r.session?.cwd || "";
      const ws = r.workspace ? r.workspace.title || r.workspace.path || "" : "";
      return [title, cwd, ws].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, q]);

  const contentRows = React.useMemo(() => {
    if (q.length === 0) return [];
    return contentHits
      .filter((h) => !metaRows.some((r) => r.session.id === h.id))
      .map((h) => {
        const session =
          byId[h.id] || {
            id: h.id,
            cwd: h.cwd,
            updatedAt: h.createdAt,
            title: h.title,
          };
        return {
          key: h.id,
          session,
          workspace: workspaces.find((w) => (w.sessionIds || []).includes(h.id)),
          snippet: h.matches && h.matches[0] ? h.matches[0].snippet : null,
          contentHit: true,
        };
      });
  }, [contentHits, metaRows, byId, workspaces, q]);

  const visibleRows = q.length > 0 ? [...metaRows, ...contentRows] : rows;

  const handleUnarchive = async (sessionId) => {
    if (busy !== null) return;
    setBusy(sessionId);
    try {
      await unarchive(sessionId);
      setViewId(null);
    } catch (e) {
      console.error("[dsh-archived-sessions] unarchive failed:", e);
      setError(String(e && e.message ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async (sessionId) => {
    setViewId(sessionId);
    setLoading(true);
    setError(null);
    setTranscript(null);
    try {
      const res = await fetch(`/api/archived-sessions/${encodeURIComponent(sessionId)}/messages`);
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          message = body?.error?.message || message;
        } catch {
          /* keep HTTP message */
        }
        throw new Error(message);
      }
      const body = await res.json();
      if (!body.ok) throw new Error(body?.error?.message || "preview failed");
      setTranscript(body);
    } catch (e) {
      console.error("[dsh-archived-sessions] preview failed:", e);
      setError(String(e && e.message ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreAndOpen = async (sessionId) => {
    if (busy !== null) return;
    setBusy(sessionId);
    try {
      await restoreAndOpen(sessionId);
      closePanel();
    } catch (e) {
      console.error("[dsh-archived-sessions] restore+open failed:", e);
      setError(String(e && e.message ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const tText = {
    title: t ? t("panelTitle") : "归档会话",
    empty: t ? t("empty") : "没有归档会话",
    workspace: t ? t("workspace") : "工作区",
    view: t ? t("view") : "查看",
    unarchive: t ? t("unarchive") : "恢复",
    restoreAndOpen: t ? t("restoreAndOpen") : "恢复并继续",
    back: t ? t("back") : "返回",
    close: t ? t("close") : "关闭",
    unnamed: t ? t("unnamed") : "未命名会话",
    updatedAt: t ? t("updatedAt") : "更新时间",
    loading: t ? t("loading") : "读取中…",
    loadError: t ? t("loadError") : "无法读取会话",
    noMessages: t ? t("noMessages") : "该会话暂无消息",
    truncated: t ? t("truncated") : "仅显示前 {n} 条消息",
    thinking: t ? t("thinking") : "思考",
    toolCall: t ? t("toolCall") : "工具调用",
    toolResult: t ? t("toolResult") : "工具结果",
    image: t ? t("image") : "图片",
    assistant: t ? t("assistant") : "助手",
    user: t ? t("user") : "用户",
    tool: t ? t("tool") : "工具",
    searchPlaceholder: t ? t("searchPlaceholder") : "搜索标题 / 路径 / 内容…",
    contentMatch: t ? t("contentMatch") : "内容匹配",
    searching: t ? t("searching") : "搜索中…",
    noMatch: t ? t("noMatch") : "没有匹配的会话",
  };

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 1200,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: "12px 12px 12px 320px",
    pointerEvents: "none",
    boxSizing: "border-box",
  };
  const cardStyle = {
    pointerEvents: "auto",
    width: "min(520px, 92vw)",
    maxHeight: "min(78vh, 640px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    background: "var(--dsw-alias-bg-overlay)",
    color: "var(--dsw-alias-label-primary)",
    border: "1px solid var(--dsw-alias-border-l2)",
    borderRadius: "10px",
    boxShadow: "var(--dsw-shadow-lv3, 0 12px 40px rgba(0,0,0,0.45))",
    fontFamily: "var(--dsw-font-family, inherit)",
    fontSize: "13px",
    lineHeight: 1.5,
  };
  const headerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    borderBottom: "1px solid var(--dsw-alias-border-l1)",
    fontWeight: 600,
    flexShrink: 0,
  };
  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid var(--dsw-alias-border-l1)",
  };
  const btnBase = {
    border: "1px solid var(--dsw-alias-border-l2)",
    background: "transparent",
    color: "inherit",
    borderRadius: "6px",
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "12px",
    flexShrink: 0,
  };

  const viewing = viewId != null ? byId[viewId] : undefined;
  const previewTitle =
    transcript?.session?.title ||
    displayTitle(viewing, tText.unnamed);

  return (
    <div style={overlayStyle} onClick={() => closePanel()}>
      <div
        role="dialog"
        aria-label={tText.title}
        onClick={(event) => event.stopPropagation()}
        style={cardStyle}
      >
        {viewId == null ? (
          <React.Fragment>
            <div style={headerStyle}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                🗄️ {tText.title}
              </span>
              <button
                type="button"
                onClick={() => closePanel()}
                aria-label={tText.close}
                style={{ ...btnBase, border: "none", padding: "2px 6px", marginLeft: "auto" }}
              >
                ✕
              </button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tText.searchPlaceholder}
              aria-label={tText.searchPlaceholder}
              style={{
                margin: "8px 12px",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid var(--dsw-alias-border-l2)",
                background: "var(--dsw-alias-bg-layer-2)",
                color: "inherit",
                fontSize: "13px",
                outline: "none",
                flexShrink: 0,
              }}
            />
            <div style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
              {visibleRows.length === 0 ? (
                <div style={{ padding: "24px 12px", textAlign: "center", opacity: 0.6 }}>
                  {q.length > 0 ? (contentSearching ? tText.searching : tText.noMatch) : tText.empty}
                </div>
              ) : (
                visibleRows.map((row) => {
                  const { session, workspace } = row;
                  return (
                    <div
                      key={session.id}
                      style={{ ...rowStyle, background: hoverId === session.id ? "var(--dsw-alias-interactive-bg-hover)" : undefined }}
                      onMouseEnter={() => setHoverId(session.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => handlePreview(session.id)}
                    >
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                          }}
                        >
                          {displayTitle(session, tText.unnamed)}
                        </div>
                        <div style={{ opacity: 0.65, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {workspace ? `${tText.workspace}: ${workspace.title || workspace.path || ""}` : session.cwd || ""}
                          {session.updatedAt ? ` · ${tText.updatedAt}: ${formatTime(session.updatedAt)}` : ""}
                        </div>
                        {row.snippet ? (
                          <div
                            style={{
                              opacity: 0.78,
                              fontSize: 12,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🔍 {tText.contentMatch}: {row.snippet}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePreview(session.id);
                        }}
                        title={t ? t("viewHint") : "在面板内只读查看，保持归档状态"}
                        style={{ ...btnBase }}
                      >
                        {busy === session.id ? "…" : tText.view}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleUnarchive(session.id);
                        }}
                        title={t ? t("restoreHint") : "仅恢复到左侧栏，不打开"}
                        style={{ ...btnBase }}
                      >
                        {busy === session.id ? "…" : tText.unarchive}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div style={headerStyle}>
              <button
                type="button"
                onClick={() => {
                  setViewId(null);
                  setError(null);
                }}
                title={tText.back}
                style={{ ...btnBase, border: "none", padding: "2px 6px" }}
              >
                ← {tText.back}
              </button>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 auto" }}>
                {previewTitle}
              </span>
              <button
                type="button"
                onClick={() => closePanel()}
                aria-label={tText.close}
                style={{ ...btnBase, border: "none", padding: "2px 6px" }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                opacity: 0.65,
                fontSize: 12,
                borderBottom: "1px solid var(--dsw-alias-border-l1)",
                flexShrink: 0,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {transcript?.session?.cwd || viewing?.cwd || ""}
                {transcript?.session?.createdAt ? ` · ${tText.updatedAt}: ${formatTime(transcript.session.createdAt)}` : ""}
              </span>
              <span style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true">🗄️ {tText.title}</span>
            </div>
            <div style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0, padding: "4px 14px 12px" }}>
              {loading ? (
                <div style={{ padding: "24px 12px", textAlign: "center", opacity: 0.6 }}>{tText.loading}</div>
              ) : error ? (
                <div style={{ padding: "24px 12px", textAlign: "center", opacity: 0.7, color: "var(--dsw-alias-state-error-primary)" }}>
                  {tText.loadError}: {error}
                </div>
              ) : transcript == null ? (
                <div style={{ padding: "24px 12px", textAlign: "center", opacity: 0.6 }}>{tText.loading}</div>
              ) : (transcript.messages || []).length === 0 ? (
                <div style={{ padding: "24px 12px", textAlign: "center", opacity: 0.6 }}>{tText.noMessages}</div>
              ) : (
                <React.Fragment>
                  {transcript.truncated ? (
                    <div style={{ opacity: 0.6, fontSize: 12, textAlign: "center", padding: "8px 0 0" }}>
                      {tText.truncated.replace("{n}", String((transcript.messages || []).length))}
                    </div>
                  ) : null}
                  {transcript.messages.map((message) => (
                    <MessageRow key={`${message.seq}-${message.id}`} message={message} t={tText} />
                  ))}
                </React.Fragment>
              )}
            </div>
            <div style={{ padding: "10px 12px", borderTop: "1px solid var(--dsw-alias-border-l1)", flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => handleRestoreAndOpen(viewId)}
                title={t ? t("restoreAndOpenHint") : "取消归档并在主视图中打开（可继续对话）"}
                style={{ ...btnBase, fontWeight: 600 }}
              >
                {busy === viewId ? "…" : tText.restoreAndOpen}
              </button>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

// --- plugin apply ------------------------------------------------------------

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.locale.register(NS, {
        zh: {
          button: "归档会话",
          panelTitle: "归档会话",
          empty: "没有归档会话",
          workspace: "工作区",
          view: "查看",
          viewHint: "在面板内只读查看，保持归档状态",
          unarchive: "恢复",
          restoreHint: "仅恢复到左侧栏，不打开",
          restoreAndOpen: "恢复并继续",
          restoreAndOpenHint: "取消归档并在主视图中打开（可继续对话）",
          back: "返回",
          close: "关闭",
          unnamed: "未命名会话",
          updatedAt: "更新时间",
          loading: "读取中…",
          loadError: "无法读取会话",
          noMessages: "该会话暂无消息",
          truncated: "仅显示前 {n} 条消息",
          thinking: "思考",
          toolCall: "工具调用",
          toolResult: "工具结果",
          image: "图片",
          assistant: "助手",
          user: "用户",
          tool: "工具",
          searchPlaceholder: "搜索标题 / 路径 / 内容…",
          contentMatch: "内容匹配",
          searching: "搜索中…",
          noMatch: "没有匹配的会话",
        },
        en: {
          button: "Archived",
          panelTitle: "Archived Sessions",
          empty: "No archived sessions",
          workspace: "Workspace",
          view: "View",
          viewHint: "Read-only preview in the panel; stays archived",
          unarchive: "Restore",
          restoreHint: "Restore to the sidebar without opening",
          restoreAndOpen: "Restore & Open",
          restoreAndOpenHint: "Unarchive and open in the main view (keep talking)",
          back: "Back",
          close: "Close",
          unnamed: "Untitled session",
          updatedAt: "Updated",
          loading: "Loading…",
          loadError: "Unable to read session",
          noMessages: "This session has no messages",
          truncated: "Showing the first {n} messages only",
          thinking: "Thinking",
          toolCall: "Tool call",
          toolResult: "Tool result",
          image: "Image",
          assistant: "Assistant",
          user: "User",
          tool: "Tool",
          searchPlaceholder: "Search title / path / content…",
          contentMatch: "Content match",
          searching: "Searching…",
          noMatch: "No matching sessions",
        },
      }),
    "archived-sessions: dictionaries",
  );

  const unarchive = async (sessionId) => {
    const res = await fetch(
      `/api/archived-sessions/${encodeURIComponent(sessionId)}/unarchive`,
      { method: "POST" },
    );
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body?.error?.message || message;
      } catch {
        /* keep HTTP message */
      }
      throw new Error(`unarchive failed: ${message}`);
    }
    return res.json();
  };

  const preview = async (sessionId) => {
    const res = await fetch(
      `/api/archived-sessions/${encodeURIComponent(sessionId)}/messages`,
    );
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body?.error?.message || message;
      } catch {
        /* keep HTTP message */
      }
      throw new Error(`preview failed: ${message}`);
    }
    return res.json();
  };

  // The harness clears any archived session from the active view (see
  // WorkspaceRuntime.project()), so "restore and open" must first restore it
  // to the archive set, wait for the browser mirror to catch up, then select
  // it. Plain "view" never touches the archive set.
  const waitArchivedUpdated = (sessionId, timeoutMs = 5000) =>
    new Promise((resolve) => {
      const list = ctx.workspaces?.list;
      const isArchived = () => {
        try {
          return list.getSnapshot().archivedSessionIds.includes(sessionId);
        } catch {
          return false;
        }
      };
      if (list === undefined || !isArchived()) return resolve();
      const timer = setTimeout(() => {
        unsub();
        resolve();
      }, timeoutMs);
      const unsub = list.subscribe(() => {
        if (!isArchived()) {
          clearTimeout(timer);
          unsub();
          resolve();
        }
      });
    });

  const restoreAndOpen = async (sessionId) => {
    await unarchive(sessionId);
    await waitArchivedUpdated(sessionId);
    ctx.sessions.open(sessionId);
  };

  ctx.slots.inject(
    "sidebar.footer.action",
    () =>
      ctx.slots.register(
        {
          name: "sidebar.footer.action",
          id: "archived-sessions",
          order: 50,
          label: () => "归档会话",
        },
        ArchivedButton,
      ),
    "archived-sessions: footer action",
  );

  ctx.slots.inject(
    "shell.overlay",
    () =>
      ctx.slots.register(
        {
          name: "shell.overlay",
          id: "archived-sessions-panel",
          order: 100,
          label: () => "归档会话",
          inject: () => ({
            preview,
            restoreAndOpen,
            unarchive,
            closePanel: () => panelStore.set(false),
          }),
        },
        ArchivedPanel,
      ),
    "archived-sessions: overlay panel",
  );
}
