# dsh-archived-sessions

DeepSeek Harness 插件：查看并恢复归档会话（archived sessions）。

## 功能

- 侧栏底部（Settings 旁）新增 **归档会话** 按钮。
- 点击弹出浮动面板，列出所有已归档会话（标题 / 工作区 / 更新时间）。
- **查看 / 点行**：在面板内打开**只读转录预览**（消息 / 思考 / 工具调用 / 工具结果）。
  全程不写存储 —— `archivedSessionIds` 不动，会话保持归档、不出现在左侧栏。
  这是 harness 限制下的"打开即读"：运行时不允许归档会话成为当前会话
  （`WorkspaceRuntime.project()` 会强制 `sessions.clear()`），所以真正"打开到
  主视图"必然伴随取消归档；插件用面板内只读预览来满足"只看不恢复"。
- **恢复**：仅从归档集合移除（不打开），会话重新出现在左侧栏原工作区位置。
- 预览内 **恢复并继续**：取消归档 + 在主视图中打开（可继续对话）。
- 列表顶部 **搜索框**：即时过滤标题 / 路径 / 工作区；对会话内容做全文本搜索
  （防抖 400ms，`GET .../search`），内容命中的行带 snippet 与「内容匹配」标记。
- 数据即开即用：`session.list` 本就包含归档会话，归档集合 `archivedSessionIds`
  也已推送到浏览器；恢复后 host 通过 `domain/changed` 自动广播
  `host/archived-sessions-changed`，浏览器侧栏即时刷新。
- 数据即开即用：`session.list` 本就包含归档会话，归档集合 `archivedSessionIds`
  也已推送到浏览器；恢复后 host 通过 `domain/changed` 自动广播
  `host/archived-sessions-changed`，浏览器侧栏即时刷新。

## 安装

```bash
dsh plugin --profile web add /home/xxk/ov-dsh-plugin/dsh-archived-sessions
sudo systemctl restart dsh-web
```

该命令把本地目录链接进 web profile 的 `node_modules`，追加到
`dsh.profile.bundles`，并在启动时合并本包的 `cordis.patch.yml`。

## 结构

| 文件 | 说明 |
| --- | --- |
| `index.mjs` | host 插件：`/api/archived-sessions` 路由（GET 列表 / POST unarchive），带浏览器信任 fence |
| `src/client/index.jsx` | client 源码（React） |
| `lib/client.js` | 构建产物（`window.__ModuleLoader__.load` 格式），`./client` 导出 |
| `build.mjs` | esbuild 构建脚本（`npm i --no-save esbuild && node build.mjs`） |
| `cordis.patch.yml` | profile patch：挂载 host 插件 |

## API

- `GET /api/archived-sessions` → `{ ok, sessions: [{ id, cwd, createdAt }] }`
- `GET /api/archived-sessions/search?q=<query>` → 全文本搜索所有归档会话内容：
  `{ ok, query, results: [{ id, cwd, createdAt, title, matchCount, matches: [{ seq, role, kind, snippet }] }] }`
  - 扫描归档集（通常很小）的持久化日志，大小写不敏感；每会话最多 3 条命中、
    最多 20 个结果，snippet 取命中处上下文。只读，不改 `archivedSessionIds`。
- `GET /api/archived-sessions/<id>/messages` → 只读转录：
  `{ ok, session: { id, cwd, createdAt, title }, messages: [{ id, seq, role, kind, blocks }], truncated }`
  - 通过 `sessionPersistence.inspect` 读取持久化日志，投影 append-origin
    surface 事件（等价 `deriveEventMessage`），只保留 `user` / `model` / `tool`
    三类消息，剔除注入上下文（agent-instructions / plugin / skill-catalog 等）。
  - 只读：不写入、不改 `archivedSessionIds`；非归档会话返回 404。
- `POST /api/archived-sessions/<id>/unarchive` → `{ ok, archivedSessionIds }`

## 查看 vs 恢复 vs 恢复并继续

| 操作 | 取消归档 | 主视图打开 | 面板 | 写入? |
| --- | --- | --- | --- | --- |
| 点行 / 查看 | ❌ | ❌（面板内只读预览） | 切换为预览 | 否 |
| 恢复 | ✅ | ❌ | 保持列表 | 是 |
| 恢复并继续（预览内） | ✅ | ✅ | 关闭 | 是 |

- 「查看」走 `GET .../messages`，纯读，会话保持归档。
- 「恢复并继续」= unarchive + `ctx.sessions.open(id)`；由于 host 侧 unarchive 经
  `enqueueOperation` 异步写入 storage，客户端在打开前先订阅
  `ctx.workspaces.list`，等 `archivedSessionIds` 不再包含该 id（最多约 5s）
  再调 `open`，避免竞态被 `WorkspaceRuntime.project()` 的归档守卫拦下。

## 备注

host 侧依赖 `ctx.workspaceRegistry` 的 `enqueueOperation` / `requireState` /
`setState` 完成恢复写入（该版本 registry 没有公开的 `unarchiveSession`），
写入经由 storage domain，故 `domain/changed` 正常触发、客户端自动同步。
升级 harness 若新增官方 unarchive API，可平滑替换。

## 测试

```bash
npm i --no-save esbuild   # 仅构建 client bundle 需要
node build.mjs            # 重新构建 lib/client.js
node --test test/host.test.mjs test/client.test.mjs   # 19 个单测（host 14 + client 5）
```
