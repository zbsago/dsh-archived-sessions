window.__ModuleLoader__.load({
	id: "dsh-archived-sessions",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var React = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "sessions", "workspaces", "locale"];
var NS = "archived-sessions";
function createPanelStore() {
  let open = false;
  const listeners = /* @__PURE__ */ new Set();
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
    }
  };
}
var panelStore = createPanelStore();
function usePanelOpen() {
  return React.useSyncExternalStore(panelStore.subscribe, panelStore.isOpen);
}
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
    overflow: "hidden"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      onClick: () => panelStore.toggle(),
      "aria-pressed": open,
      title: t ? t("button") : "\u5F52\u6863\u4F1A\u8BDD",
      style,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", style: { flexShrink: 0, fontSize: 14, lineHeight: 1 }, children: "\u{1F5C4}\uFE0F" }),
        wide ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto" }, children: t ? t("button") : "\u5F52\u6863\u4F1A\u8BDD" }) : null
      ]
    }
  );
}
function BlockView({ block, t }) {
  switch (block.type) {
    case "text":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: block.text });
    case "reasoning":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { style: { opacity: 0.8, marginTop: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { style: { cursor: "pointer", fontSize: 12 }, children: t.thinking }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 4, fontSize: 12 }, children: block.text })
      ] });
    case "tool-call":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          style: {
            opacity: 0.78,
            fontSize: 12,
            fontFamily: "var(--dsh-mono, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            marginTop: 4
          },
          children: [
            "\u2699 ",
            t.toolCall,
            ": ",
            block.name,
            "(",
            block.args,
            ")"
          ]
        }
      );
    case "tool-result":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          style: {
            opacity: 0.7,
            fontSize: 12,
            fontFamily: "var(--dsh-mono, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "color-mix(in srgb, var(--dsh-text, #e6e6e6) 6%, transparent)",
            borderRadius: 6,
            padding: "4px 8px",
            marginTop: 4
          },
          children: [
            "\u21A9 ",
            t.toolResult,
            ": ",
            block.text
          ]
        }
      );
    case "image":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { opacity: 0.7, marginTop: 4 }, children: [
        "\u{1F5BC} ",
        t.image
      ] });
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0.6, marginTop: 4 }, children: block.text ?? block.type });
  }
}
function MessageRow({ message, t }) {
  const isAssistant = message.role === "assistant";
  const isTool = message.kind === "tool";
  const align = isAssistant ? "flex-start" : "flex-end";
  const bg = isAssistant ? "color-mix(in srgb, #4a76d8 18%, transparent)" : isTool ? "transparent" : "color-mix(in srgb, #3fa06a 16%, transparent)";
  const label = isAssistant ? t.assistant : isTool ? t.tool : t.user;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: align, margin: "10px 0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0.55, fontSize: 11, marginBottom: 3 }, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          background: bg,
          borderRadius: 8,
          padding: isTool ? 0 : "6px 10px",
          maxWidth: "100%",
          minWidth: 0
        },
        children: message.blocks.map((block, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlockView, { block, t }, i))
      }
    )
  ] });
}
function ArchivedPanel(props) {
  const {
    preview,
    restoreAndOpen,
    unarchive,
    closePanel,
    useSessions,
    useWorkspaces,
    t
  } = props;
  const open = usePanelOpen();
  const byId = useSessions((state) => state.byId);
  const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
  const workspaces = useWorkspaces((state) => state.items);
  const rows = React.useMemo(
    () => (archivedSessionIds || []).map((id) => byId[id]).filter((s) => s != null).map((s) => ({
      session: s,
      workspace: workspaces.find((w) => (w.sessionIds || []).includes(s.id))
    })),
    [archivedSessionIds, byId, workspaces]
  );
  const [busy, setBusy] = React.useState(null);
  const [viewId, setViewId] = React.useState(null);
  const [transcript, setTranscript] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [contentHits, setContentHits] = React.useState([]);
  const [contentSearching, setContentSearching] = React.useState(false);
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
  React.useEffect(() => {
    if (!open) return;
    const q2 = query.trim();
    if (q2.length === 0) {
      setContentHits([]);
      setContentSearching(false);
      return;
    }
    setContentSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/archived-sessions/search?q=${encodeURIComponent(q2)}`);
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
    return contentHits.filter((h) => !metaRows.some((r) => r.session.id === h.id)).map((h) => {
      const session = byId[h.id] || {
        id: h.id,
        cwd: h.cwd,
        updatedAt: h.createdAt,
        title: h.title
      };
      return {
        key: h.id,
        session,
        workspace: workspaces.find((w) => (w.sessionIds || []).includes(h.id)),
        snippet: h.matches && h.matches[0] ? h.matches[0].snippet : null,
        contentHit: true
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
          const body2 = await res.json();
          message = body2?.error?.message || message;
        } catch {
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
    title: t ? t("panelTitle") : "\u5F52\u6863\u4F1A\u8BDD",
    empty: t ? t("empty") : "\u6CA1\u6709\u5F52\u6863\u4F1A\u8BDD",
    workspace: t ? t("workspace") : "\u5DE5\u4F5C\u533A",
    view: t ? t("view") : "\u67E5\u770B",
    unarchive: t ? t("unarchive") : "\u6062\u590D",
    restoreAndOpen: t ? t("restoreAndOpen") : "\u6062\u590D\u5E76\u7EE7\u7EED",
    back: t ? t("back") : "\u8FD4\u56DE",
    close: t ? t("close") : "\u5173\u95ED",
    unnamed: t ? t("unnamed") : "\u672A\u547D\u540D\u4F1A\u8BDD",
    updatedAt: t ? t("updatedAt") : "\u66F4\u65B0\u65F6\u95F4",
    loading: t ? t("loading") : "\u8BFB\u53D6\u4E2D\u2026",
    loadError: t ? t("loadError") : "\u65E0\u6CD5\u8BFB\u53D6\u4F1A\u8BDD",
    noMessages: t ? t("noMessages") : "\u8BE5\u4F1A\u8BDD\u6682\u65E0\u6D88\u606F",
    truncated: t ? t("truncated") : "\u4EC5\u663E\u793A\u524D {n} \u6761\u6D88\u606F",
    thinking: t ? t("thinking") : "\u601D\u8003",
    toolCall: t ? t("toolCall") : "\u5DE5\u5177\u8C03\u7528",
    toolResult: t ? t("toolResult") : "\u5DE5\u5177\u7ED3\u679C",
    image: t ? t("image") : "\u56FE\u7247",
    assistant: t ? t("assistant") : "\u52A9\u624B",
    user: t ? t("user") : "\u7528\u6237",
    tool: t ? t("tool") : "\u5DE5\u5177",
    searchPlaceholder: t ? t("searchPlaceholder") : "\u641C\u7D22\u6807\u9898 / \u8DEF\u5F84 / \u5185\u5BB9\u2026",
    contentMatch: t ? t("contentMatch") : "\u5185\u5BB9\u5339\u914D",
    searching: t ? t("searching") : "\u641C\u7D22\u4E2D\u2026",
    noMatch: t ? t("noMatch") : "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD"
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
    boxSizing: "border-box"
  };
  const cardStyle = {
    pointerEvents: "auto",
    width: "min(520px, 92vw)",
    maxHeight: "min(78vh, 640px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    background: "var(--dsh-panel-bg, #1f1f23)",
    color: "var(--dsh-text, #e6e6e6)",
    border: "1px solid var(--dsh-border, #3a3a40)",
    borderRadius: "10px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    fontFamily: "var(--dsh-font, inherit)",
    fontSize: "13px",
    lineHeight: 1.5
  };
  const headerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    borderBottom: "1px solid var(--dsh-border, #3a3a40)",
    fontWeight: 600,
    flexShrink: 0
  };
  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid color-mix(in srgb, var(--dsh-border, #3a3a40) 50%, transparent)"
  };
  const btnBase = {
    border: "1px solid var(--dsh-border, #4a4a52)",
    background: "transparent",
    color: "inherit",
    borderRadius: "6px",
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "12px",
    flexShrink: 0
  };
  const viewing = viewId != null ? byId[viewId] : void 0;
  const previewTitle = transcript?.session?.title || displayTitle(viewing, tText.unnamed);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: overlayStyle, onClick: () => closePanel(), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      role: "dialog",
      "aria-label": tText.title,
      onClick: (event) => event.stopPropagation(),
      style: cardStyle,
      children: viewId == null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(React.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: headerStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
            "\u{1F5C4}\uFE0F ",
            tText.title
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              onClick: () => closePanel(),
              "aria-label": tText.close,
              style: { ...btnBase, border: "none", padding: "2px 6px", marginLeft: "auto" },
              children: "\u2715"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "search",
            value: query,
            onChange: (event) => setQuery(event.target.value),
            placeholder: tText.searchPlaceholder,
            "aria-label": tText.searchPlaceholder,
            style: {
              margin: "8px 12px",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid var(--dsh-border, #4a4a52)",
              background: "color-mix(in srgb, var(--dsh-panel-bg, #1f1f23) 70%, transparent)",
              color: "inherit",
              fontSize: "13px",
              outline: "none",
              flexShrink: 0
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { overflowY: "auto", flex: "1 1 auto", minHeight: 0 }, children: visibleRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "24px 12px", textAlign: "center", opacity: 0.6 }, children: q.length > 0 ? contentSearching ? tText.searching : tText.noMatch : tText.empty }) : visibleRows.map((row) => {
          const { session, workspace } = row;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: rowStyle, onClick: () => handlePreview(session.id), children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 auto", minWidth: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  style: {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 500
                  },
                  children: displayTitle(session, tText.unnamed)
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { opacity: 0.65, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                workspace ? `${tText.workspace}: ${workspace.title || workspace.path || ""}` : session.cwd || "",
                session.updatedAt ? ` \xB7 ${tText.updatedAt}: ${formatTime(session.updatedAt)}` : ""
              ] }),
              row.snippet ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    opacity: 0.78,
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  },
                  children: [
                    "\u{1F50D} ",
                    tText.contentMatch,
                    ": ",
                    row.snippet
                  ]
                }
              ) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                disabled: busy !== null,
                onClick: (event) => {
                  event.stopPropagation();
                  handlePreview(session.id);
                },
                title: t ? t("viewHint") : "\u5728\u9762\u677F\u5185\u53EA\u8BFB\u67E5\u770B\uFF0C\u4FDD\u6301\u5F52\u6863\u72B6\u6001",
                style: { ...btnBase },
                children: busy === session.id ? "\u2026" : tText.view
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                disabled: busy !== null,
                onClick: (event) => {
                  event.stopPropagation();
                  handleUnarchive(session.id);
                },
                title: t ? t("restoreHint") : "\u4EC5\u6062\u590D\u5230\u5DE6\u4FA7\u680F\uFF0C\u4E0D\u6253\u5F00",
                style: { ...btnBase },
                children: busy === session.id ? "\u2026" : tText.unarchive
              }
            )
          ] }, session.id);
        }) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(React.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: headerStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              onClick: () => {
                setViewId(null);
                setError(null);
              },
              title: tText.back,
              style: { ...btnBase, border: "none", padding: "2px 6px" },
              children: [
                "\u2190 ",
                tText.back
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 auto" }, children: previewTitle }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              onClick: () => closePanel(),
              "aria-label": tText.close,
              style: { ...btnBase, border: "none", padding: "2px 6px" },
              children: "\u2715"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              opacity: 0.65,
              fontSize: 12,
              borderBottom: "1px solid color-mix(in srgb, var(--dsh-border, #3a3a40) 50%, transparent)",
              flexShrink: 0
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                transcript?.session?.cwd || viewing?.cwd || "",
                transcript?.session?.createdAt ? ` \xB7 ${tText.updatedAt}: ${formatTime(transcript.session.createdAt)}` : ""
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { marginLeft: "auto", flexShrink: 0 }, "aria-hidden": "true", children: [
                "\u{1F5C4}\uFE0F ",
                tText.title
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { overflowY: "auto", flex: "1 1 auto", minHeight: 0, padding: "4px 14px 12px" }, children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "24px 12px", textAlign: "center", opacity: 0.6 }, children: tText.loading }) : error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "24px 12px", textAlign: "center", opacity: 0.7, color: "#e06666" }, children: [
          tText.loadError,
          ": ",
          error
        ] }) : transcript == null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "24px 12px", textAlign: "center", opacity: 0.6 }, children: tText.loading }) : (transcript.messages || []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "24px 12px", textAlign: "center", opacity: 0.6 }, children: tText.noMessages }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(React.Fragment, { children: [
          transcript.truncated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0.6, fontSize: 12, textAlign: "center", padding: "8px 0 0" }, children: tText.truncated.replace("{n}", String((transcript.messages || []).length)) }) : null,
          transcript.messages.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageRow, { message, t: tText }, `${message.seq}-${message.id}`))
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "10px 12px", borderTop: "1px solid var(--dsh-border, #3a3a40)", flexShrink: 0, display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            disabled: busy !== null,
            onClick: () => handleRestoreAndOpen(viewId),
            title: t ? t("restoreAndOpenHint") : "\u53D6\u6D88\u5F52\u6863\u5E76\u5728\u4E3B\u89C6\u56FE\u4E2D\u6253\u5F00\uFF08\u53EF\u7EE7\u7EED\u5BF9\u8BDD\uFF09",
            style: { ...btnBase, fontWeight: 600 },
            children: busy === viewId ? "\u2026" : tText.restoreAndOpen
          }
        ) })
      ] })
    }
  ) });
}
function apply(ctx) {
  ctx.effect(
    () => ctx.locale.register(NS, {
      zh: {
        button: "\u5F52\u6863\u4F1A\u8BDD",
        panelTitle: "\u5F52\u6863\u4F1A\u8BDD",
        empty: "\u6CA1\u6709\u5F52\u6863\u4F1A\u8BDD",
        workspace: "\u5DE5\u4F5C\u533A",
        view: "\u67E5\u770B",
        viewHint: "\u5728\u9762\u677F\u5185\u53EA\u8BFB\u67E5\u770B\uFF0C\u4FDD\u6301\u5F52\u6863\u72B6\u6001",
        unarchive: "\u6062\u590D",
        restoreHint: "\u4EC5\u6062\u590D\u5230\u5DE6\u4FA7\u680F\uFF0C\u4E0D\u6253\u5F00",
        restoreAndOpen: "\u6062\u590D\u5E76\u7EE7\u7EED",
        restoreAndOpenHint: "\u53D6\u6D88\u5F52\u6863\u5E76\u5728\u4E3B\u89C6\u56FE\u4E2D\u6253\u5F00\uFF08\u53EF\u7EE7\u7EED\u5BF9\u8BDD\uFF09",
        back: "\u8FD4\u56DE",
        close: "\u5173\u95ED",
        unnamed: "\u672A\u547D\u540D\u4F1A\u8BDD",
        updatedAt: "\u66F4\u65B0\u65F6\u95F4",
        loading: "\u8BFB\u53D6\u4E2D\u2026",
        loadError: "\u65E0\u6CD5\u8BFB\u53D6\u4F1A\u8BDD",
        noMessages: "\u8BE5\u4F1A\u8BDD\u6682\u65E0\u6D88\u606F",
        truncated: "\u4EC5\u663E\u793A\u524D {n} \u6761\u6D88\u606F",
        thinking: "\u601D\u8003",
        toolCall: "\u5DE5\u5177\u8C03\u7528",
        toolResult: "\u5DE5\u5177\u7ED3\u679C",
        image: "\u56FE\u7247",
        assistant: "\u52A9\u624B",
        user: "\u7528\u6237",
        tool: "\u5DE5\u5177",
        searchPlaceholder: "\u641C\u7D22\u6807\u9898 / \u8DEF\u5F84 / \u5185\u5BB9\u2026",
        contentMatch: "\u5185\u5BB9\u5339\u914D",
        searching: "\u641C\u7D22\u4E2D\u2026",
        noMatch: "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD"
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
        loading: "Loading\u2026",
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
        searchPlaceholder: "Search title / path / content\u2026",
        contentMatch: "Content match",
        searching: "Searching\u2026",
        noMatch: "No matching sessions"
      }
    }),
    "archived-sessions: dictionaries"
  );
  const unarchive = async (sessionId) => {
    const res = await fetch(
      `/api/archived-sessions/${encodeURIComponent(sessionId)}/unarchive`,
      { method: "POST" }
    );
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body?.error?.message || message;
      } catch {
      }
      throw new Error(`unarchive failed: ${message}`);
    }
    return res.json();
  };
  const preview = async (sessionId) => {
    const res = await fetch(
      `/api/archived-sessions/${encodeURIComponent(sessionId)}/messages`
    );
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body?.error?.message || message;
      } catch {
      }
      throw new Error(`preview failed: ${message}`);
    }
    return res.json();
  };
  const waitArchivedUpdated = (sessionId, timeoutMs = 5e3) => new Promise((resolve) => {
    const list = ctx.workspaces?.list;
    const isArchived = () => {
      try {
        return list.getSnapshot().archivedSessionIds.includes(sessionId);
      } catch {
        return false;
      }
    };
    if (list === void 0 || !isArchived()) return resolve();
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
    () => ctx.slots.register(
      {
        name: "sidebar.footer.action",
        id: "archived-sessions",
        order: 50,
        label: () => "\u5F52\u6863\u4F1A\u8BDD"
      },
      ArchivedButton
    ),
    "archived-sessions: footer action"
  );
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      {
        name: "shell.overlay",
        id: "archived-sessions-panel",
        order: 100,
        label: () => "\u5F52\u6863\u4F1A\u8BDD",
        inject: () => ({
          preview,
          restoreAndOpen,
          unarchive,
          closePanel: () => panelStore.set(false)
        })
      },
      ArchivedPanel
    ),
    "archived-sessions: overlay panel"
  );
}

		return module.exports;
	}
});
