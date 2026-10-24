# Changelog

本文件记录 Skill Forge 的版本变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-10-24

### 新增

- **对话按工作区分组**：锻造页的会话下拉用 `optgroup` 按 `cwd` 分组，未归属工作区的会话单独成组。
- **子代理对话可视化**：用会话头部的 `origin: 'subagent'` / `parentSession` 标记子代理会话，
  选项以 `↳` 缩进并标注「子代理对话」；父会话标注「含 N 个子代理对话」。
- **锻造模型可选**：新增 `GET /api/dsh-skill-forge/models`，枚举 `llm.listProviders()` 与
  `llm.listModels(provider)`；面板新增「锻造模型」下拉，默认「跟随默认模型」，可按 provider 分组选具体模型。
  `distill` 接受 `provider` / `model` 覆盖。无法枚举模型的 provider 仍会被列出但标记为空列表，
  不会让整个目录失败。
- 「最近会话」改称「对话」，「最近轮数」改称「读取轮数」。

### 变更

- **轮次默认读取全部**：`skill_forge_context` 与 `distill` 的 `lastTurns` 省略或传 `0` 表示读取全部轮次；
  上下文仍由 `maxChars` 约束，因此不会无限膨胀。`lastTurns` 上限从 50 放宽到 500。
- 会话列表默认窗口从 20 提高到 300（分组需要完整语料）。

### 修复

- `normalizeInt(null)` 因 `Number(null) === 0` 会把缺省查询参数钳到最小值，
  导致不带 `?limit=` 的会话列表只返回 1 条。

## [1.0.1] - 2026-10-24

### 修复

- 把 `@deepseek-ai/dsh` 和 `react` 标记为**可选** peer 依赖（`peerDependenciesMeta`）。
  之前 `npm install dsh-skill-forge` 会自动拉取整个 DSH 运行时：实测 179 个包 / 79 MB。
  插件在宿主内运行时由 DSH 提供这两个依赖，无需用户安装。

## [1.0.0] - 2026-10-23

首个公开版本。

### 新增

- **4 个模型工具**
  - `skill_forge_context`：从当前或指定会话取有界摘要（默认 10 轮 / 16000 字符，超长保留最新尾部），可选带上工具结果。
  - `skill_forge_save`：写 `~/.dsh/skills/<name>/SKILL.md`，含 `metadata.forge` 所有权标记；同名默认拒绝，覆盖保留 `.bak`。
  - `skill_forge_list`：列出本插件写出的技能。
  - `skill_forge_delete`：移入 `.trash` 可恢复，且只允许删本插件写的技能。
- **Web GUI 面板**（侧边栏 order 26）
  - 「技能库」：搜索、点行预览、删除；预览支持轻量 Markdown 渲染与「原文」切换。
  - 「锻造」：对话/粘贴文本两种来源，「AI 提炼」产出草稿，人工确认后保存；覆盖前二次确认。
- **7 条 HTTP 路由** `/api/dsh-skill-forge/{health,list,read,save,delete,sessions,distill}`，仅 loopback + same-origin。
- **一次调用模型提炼**：走 `prepareCall` 绑定适配器注册，避免第三方插件替换 `llm.stream` 导致失败；45 秒超时；失败降级为 503/504/502 并给出可读原因。

### 安全

- 技能名强制 kebab-case，拒绝路径逃逸。
- 请求体上限 1 MiB；跨站与非回环请求 403。
- 不向 session log 追加事件，不修改 DSH 安装目录与 profile 清单。

### 视觉

- 修正纵向 flex 容器内控件被误撑高的问题（控件改为 `width:100%;flex:none`，仅工具栏搜索框放开 flex）。
- 修正深色主题主按钮文字对比度（2.59:1 → 6.92:1，改用 `--dsw-alias-bg-base` 作前景，不引入新色值）。
- 补上技能行的键盘焦点环（原先继承 UA 近黑 outline，暗色下 1.06:1 不可见）。
- 草稿保存按钮改为粘性底栏，长正文下依然可见。
- 用面板内确认条替代 `window.confirm()`。
- 工具栏由两行收回单行；描述字段改为两行文本域，不再截断。
- 摘要来源由原始枚举 `text` 改为本地化文案「粘贴文本」。

### 验证

- 结构一致性检查 61 项、功能行为检查 73 项，全部通过（使用临时 `DSH_HOME`，不触碰真实技能）。
