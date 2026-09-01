# dsh-archived-sessions

Browse, preview and restore archived sessions in the DeepSeek Harness web UI.
DeepSeek Harness 插件：查看并恢复归档会话（archived sessions）。

## Features / 功能

- Adds an **Archived Sessions** button at the bottom of the sidebar (next to Settings).
  侧栏底部（Settings 旁）新增 **归档会话** 按钮。
- Click to open a floating panel listing all archived sessions (title / workspace / updated time).
  点击弹出浮动面板，列出所有已归档会话（标题 / 工作区 / 更新时间）。
- **View / click a row**: opens a **read-only transcript preview** inside the panel (messages / thoughts / tool calls / tool results). No storage is written — `archivedSessionIds` stays untouched, the session stays archived and out of the sidebar. This is the harness limit for "open-to-read": the runtime doesn't allow an archived session to become the current session (`WorkspaceRuntime.project()` forces `sessions.clear()`), so opening to the main view necessarily unarchives; the plugin uses an in-panel read-only preview to satisfy "view without restoring".
  **查看 / 点行**：在面板内打开**只读转录预览**（消息 / 思考 / 工具调用 / 工具结果）。全程不写存储 —— `archivedSessionIds` 不动，会话保持归档、不出现在左侧栏。这是 harness 限制下的"打开即读"：运行时不允许归档会话成为当前会话（`WorkspaceRuntime.project()` 会强制 `sessions.clear()`），所以真正"打开到主视图"必然伴随取消归档；插件用面板内只读预览来满足"只看不恢复"。
- **Restore**: removes from the archived set only (does not open); the session reappears in the sidebar at its original workspace position.
  **恢复**：仅从归档集合移除（不打开），会话重新出现在左侧栏原工作区位置。
- **Restore & Continue** (inside the preview): unarchive + open in the main view (can continue the conversation).
  预览内 **恢复并继续**：取消归档 + 在主视图中打开（可继续对话）。
- **Search box** at the top of the list: instant filter on title / path / workspace; full-text search over session content (debounced 400ms, `GET .../search`), with snippets and a "content match" marker on matching rows.
  列表顶部 **搜索框**：即时过滤标题 / 路径 / 工作区；对会话内容做全文本搜索（防抖 400ms，`GET .../search`），内容命中的行带 snippet 与「内容匹配」标记。
- Data is ready to use: `session.list` already includes archived sessions and the archived set `archivedSessionIds` is already pushed to the browser; after a restore the host broadcasts `host/archived-sessions-changed` via `domain/changed`, and the browser sidebar refreshes instantly.
  数据即开即用：`session.list` 本就包含归档会话，归档集合 `archivedSessionIds` 也已推送到浏览器；恢复后 host 通过 `domain/changed` 自动广播 `host/archived-sessions-changed`，浏览器侧栏即时刷新。

## Install / 安装

### Users (from GitHub) / 普通用户（从 GitHub 安装）

```bash
dsh plugin --profile web add github:zbsago/dsh-archived-sessions
sudo systemctl restart dsh-web
```

- The command above installs the latest version of the `main` branch. To pin to a release, use the tag suffix:
  上面命令安装仓库 `main` 分支最新版。想固定到发布版本，加 tag 后缀：

  ```bash
  dsh plugin --profile web add github:zbsago/dsh-archived-sessions#semver:v0.1.0
  sudo systemctl restart dsh-web
  ```

- Update to the latest from GitHub:
  从 GitHub 升级到最新版：

  ```bash
  dsh plugin --profile web update dsh-archived-sessions
  sudo systemctl restart dsh-web
  ```

> **Note**: build scripts of git-hosted packages are blocked by default. If pnpm reports `Ignored build scripts` / asks for `allowBuilds`, put the exact key pnpm printed into `allowBuilds` in `~/.dsh/profiles/web/pnpm-workspace.yaml` (e.g. `dsh-archived-sessions: true`) and re-run the install. This package ships its build output (`lib/client.js`), so this step is normally not needed.
> **注**：git 来源的包默认不运行构建脚本。若 pnpm 安装时报 `Ignored build scripts` / 提示需要 `allowBuilds`，把报错里打印的确切 key 填进 `~/.dsh/profiles/web/pnpm-workspace.yaml` 的 `allowBuilds`（如 `dsh-archived-sessions: true`），再重跑安装命令。本包已提交构建产物（`lib/client.js`），正常情况无需这一步。

### Local development (for hacking on the code) / 本地开发（改代码调试用）

```bash
dsh plugin --profile web add /home/xxk/ov-dsh-plugin/dsh-archived-sessions
sudo systemctl restart dsh-web
```

This links the local directory into the web profile's `node_modules`, appends it to `dsh.profile.bundles`, and merges this package's `cordis.patch.yml` at startup. This local path only works on this machine — other users cannot install it.
该命令把本地目录以 link 方式链接进 web profile 的 `node_modules`，追加到 `dsh.profile.bundles`，并在启动时合并本包的 `cordis.patch.yml`。仅本机路径有效，不能给其他用户安装使用。

## Structure / 结构

| File / 文件 | Description / 说明 |
| --- | --- |
| `index.mjs` | host plugin: `/api/archived-sessions` routes (GET list / POST unarchive), with a browser-trust fence / host 插件：`/api/archived-sessions` 路由（GET 列表 / POST unarchive），带浏览器信任 fence |
| `src/client/index.jsx` | client source (React) / client 源码（React） |
| `lib/client.js` | build output (`window.__ModuleLoader__.load` format), exported as `./client` / 构建产物（`window.__ModuleLoader__.load` 格式），`./client` 导出 |
| `build.mjs` | esbuild build script (`npm i --no-save esbuild && node build.mjs`) / esbuild 构建脚本（`npm i --no-save esbuild && node build.mjs`） |
| `cordis.patch.yml` | profile patch that mounts the host plugin / profile patch：挂载 host 插件 |

## API

- `GET /api/archived-sessions` → `{ ok, sessions: [{ id, cwd, createdAt }] }`
- `GET /api/archived-sessions/search?q=<query>` → full-text search across all archived session content / 全文本搜索所有归档会话内容：
  `{ ok, query, results: [{ id, cwd, createdAt, title, matchCount, matches: [{ seq, role, kind, snippet }] }] }`
  - Scans the persisted logs of the archived set (usually small), case-insensitive; up to 3 matches per session, up to 20 results, snippets from the matching context. Read-only, does not change `archivedSessionIds`.
    扫描归档集（通常很小）的持久化日志，大小写不敏感；每会话最多 3 条命中、最多 20 个结果，snippet 取命中处上下文。只读，不改 `archivedSessionIds`。
- `GET /api/archived-sessions/<id>/messages` → read-only transcript / 只读转录：
  `{ ok, session: { id, cwd, createdAt, title }, messages: [{ id, seq, role, kind, blocks }], truncated }`
  - Reads persisted logs via `sessionPersistence.inspect`, projects append-origin surface events (equivalent to `deriveEventMessage`), keeps only `user` / `model` / `tool` messages and drops injected context (agent-instructions / plugin / skill-catalog etc.).
    通过 `sessionPersistence.inspect` 读取持久化日志，投影 append-origin surface 事件（等价 `deriveEventMessage`），只保留 `user` / `model` / `tool` 三类消息，剔除注入上下文（agent-instructions / plugin / skill-catalog 等）。
  - Read-only: no writes, does not change `archivedSessionIds`; non-archived sessions return 404.
    只读：不写入、不改 `archivedSessionIds`；非归档会话返回 404。
- `POST /api/archived-sessions/<id>/unarchive` → `{ ok, archivedSessionIds }`

## View vs Restore vs Restore & Continue / 查看 vs 恢复 vs 恢复并继续

| Action / 操作 | Unarchive / 取消归档 | Open in main view / 主视图打开 | Panel / 面板 | Writes? / 写入? |
| --- | --- | --- | --- | --- |
| Click row / View / 点行 / 查看 | ❌ | ❌ (in-panel read-only preview / 面板内只读预览) | switches to preview / 切换为预览 | No / 否 |
| Restore / 恢复 | ✅ | ❌ | stays list / 保持列表 | Yes / 是 |
| Restore & Continue / 恢复并继续（预览内） | ✅ | ✅ | closes / 关闭 | Yes / 是 |

- "View" uses `GET .../messages`, read-only; the session stays archived.
  「查看」走 `GET .../messages`，纯读，会话保持归档。
- "Restore & Continue" = unarchive + `ctx.sessions.open(id)`; because host-side unarchive writes storage asynchronously via `enqueueOperation`, the client first subscribes to `ctx.workspaces.list`, waits until `archivedSessionIds` no longer contains the id (up to ~5s), then calls `open` — avoiding the race where `WorkspaceRuntime.project()`'s archive guard blocks it.
  「恢复并继续」= unarchive + `ctx.sessions.open(id)`；由于 host 侧 unarchive 经 `enqueueOperation` 异步写入 storage，客户端在打开前先订阅 `ctx.workspaces.list`，等 `archivedSessionIds` 不再包含该 id（最多约 5s）再调 `open`，避免竞态被 `WorkspaceRuntime.project()` 的归档守卫拦下。

## Notes / 备注

The host side relies on `ctx.workspaceRegistry`'s `enqueueOperation` / `requireState` / `setState` to perform the restore write (this registry version has no public `unarchiveSession`); writes go through the storage domain, so `domain/changed` fires and the client syncs automatically. If a harness upgrade adds an official unarchive API, it can be swapped in cleanly.
host 侧依赖 `ctx.workspaceRegistry` 的 `enqueueOperation` / `requireState` / `setState` 完成恢复写入（该版本 registry 没有公开的 `unarchiveSession`），写入经由 storage domain，故 `domain/changed` 正常触发、客户端自动同步。升级 harness 若新增官方 unarchive API，可平滑替换。

## Testing / 测试

```bash
npm i --no-save esbuild   # only needed to build the client bundle / 仅构建 client bundle 需要
node build.mjs            # rebuild lib/client.js / 重新构建 lib/client.js
node --test test/host.test.mjs test/client.test.mjs   # 19 unit tests (host 14 + client 5) / 19 个单测（host 14 + client 5）
```
