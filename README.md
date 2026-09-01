# dsh-archived-sessions

Browse, preview and restore archived sessions in the DeepSeek Harness web UI.
DeepSeek Harness 插件：查看并恢复归档会话（archived sessions）。

## Features / 功能

- Adds an **Archived Sessions** button at the bottom of the sidebar (next to Settings).
  侧栏底部（Settings 旁）新增 **归档会话** 按钮。
- Click to open a floating panel listing all archived sessions (title / workspace / updated time).
  点击弹出浮动面板，列出所有已归档会话（标题 / 工作区 / 更新时间）。
- **View / click a row**: opens a **read-only transcript preview** inside the panel (messages / thoughts / tool calls / tool results). No storage is written — `archivedSessionIds` stays untouched, the session stays archived and out of the sidebar.
  **查看 / 点行**：在面板内打开**只读转录预览**（消息 / 思考 / 工具调用 / 工具结果）。全程不写存储 —— `archivedSessionIds` 不动，会话保持归档、不出现在左侧栏。
- **Restore**: removes from the archived set only (does not open); the session reappears in the sidebar at its original workspace position.
  **恢复**：仅从归档集合移除（不打开），会话重新出现在左侧栏原工作区位置。
- **Restore & Continue** (inside the preview): unarchive + open in the main view (can continue the conversation).
  预览内 **恢复并继续**：取消归档 + 在主视图中打开（可继续对话）。
- **Search box** at the top of the list: instant filter on title / path / workspace; full-text search over session content (debounced 400ms, `GET .../search`), with snippets and a "content match" marker on matching rows.
  列表顶部 **搜索框**：即时过滤标题 / 路径 / 工作区；对会话内容做全文本搜索（防抖 400ms，`GET .../search`），内容命中的行带 snippet 与「内容匹配」标记。

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

## Structure / 结构

| File / 文件 | Description / 说明 |
| --- | --- |
| `index.mjs` | host plugin: `/api/archived-sessions` routes (GET list / POST unarchive), with a browser-trust fence / host 插件：`/api/archived-sessions` 路由（GET 列表 / POST unarchive），带浏览器信任 fence |
| `src/client/index.jsx` | client source (React) / client 源码（React） |
| `lib/client.js` | build output (`window.__ModuleLoader__.load` format), exported as `./client` / 构建产物（`window.__ModuleLoader__.load` 格式），`./client` 导出 |
| `build.mjs` | esbuild build script (`npm i --no-save esbuild && node build.mjs`) / esbuild 构建脚本（`npm i --no-save esbuild && node build.mjs`） |
| `cordis.patch.yml` | profile patch that mounts the host plugin / profile patch：挂载 host 插件 |
