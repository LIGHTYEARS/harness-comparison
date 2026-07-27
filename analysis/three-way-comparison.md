# 三方对比报告：codex / grok-build / opencode

> 由 workflow `three-way-comparison` 生成：5 个分析 agent 并行（代码行动、模型交互、Prompt 工程、TUI、AI 友好性）+ 1 个汇总 agent。

## 顶部摘要：5 条最值得关注的跨维度结论

1. **grok-build 是 codex 与 opencode 的「功能移植中转站」**：同时移植 codex 的 `apply_patch`（保留解析与 4 级模糊匹配，剥离 I/O/沙箱/流式）与 opencode 的 `edit/write`（仅保留精确替换骨架，删除 BOM/格式化/LSP/模糊匹配），形成三套并存的编辑工具。
2. **编辑工具形态根本分野**：codex 用 freeform grammar 工具（lark 语法，非 JSON）+ 唯一 `apply_patch`；grok-build/opencode 全为 JSON schema 结构化工具；且**仅 codex 支持流式增量解析**（`StreamingPatchParser`）。
3. **Prompt 工程呈两极**：codex/opencode 明文 `.md`/`.txt` 可读，grok-build 用 XOR 加密字节数组（运行时 `Zeroizing` 清零防泄露）；grok-build 的 `apply_patch_template` 直接复用 codex 模板，是另一处明确移植证据。
4. **模型交互三者独立演化无移植**：codex/grok-build 全自研 Rust SDK，opencode 主路径绑定 Vercel AI SDK；grok-build 仅 XAI 单后端但重试策略最激进（15 次/30s 封顶/doom-loop），opencode 支持 13 个 provider 最广。
5. **AI 友好性分三档**：codex 单文件详尽命令式规则（322 行 `AGENTS.md` + 行数/token 硬限制），opencode 双层（`AGENTS.md` 规范 + `CONTEXT.md` 术语表），grok-build 完全缺失且明确拒绝外部 PR。

---

## 1. 代码行动 / 文件编辑

### 三方设计要点对比

| 维度 | Codex | Grok-build | Opencode |
|---|---|---|---|
| 编辑工具 | 唯一 `apply_patch`（freeform 多文件 diff） | 三套并存：`codex/apply_patch`（移植）、`grok_build/search_replace`（自研）、`opencode/edit`+`opencode/write`（移植） | V1：`edit`+`write`+`apply_patch`；V2（core）：精简版 |
| 工具形态 | grammar freeform（lark 语法，非 JSON） | 全部 JSON schema | 全部 JSON schema |
| 流式 | ✅ `StreamingPatchParser` 增量推送（500ms 节流） | ❌ 整段接收 | ❌ 整段接收 |
| 命令拦截 | `shell.rs` 拦截 argv 形式 `apply_patch` | ❌ | ❌ |
| I/O 抽象 | `ExecutorFileSystem`（本地/沙箱/远程） | `AsyncFileSystem` + `FileWritten` 通知 | `FSUtil` + `FileSystem`/`Watcher` 事件 |
| 权限/审批 | `FileSystemSandboxPolicy` + `ApplyPatchRuntime` | `Resources`/`Expr` 需求声明 | `ctx.ask({permission:'edit'})` 逐次询问 |
| 错误处理 | `FunctionCallError::RespondToModel`（分类） | 枚举输出（不抛错） | 抛 `Error`/`ToolFailure` |
| 模糊匹配 | `seek_sequence` 4 级回退 | 移植版保留同样 4 级 | V1 有 trim+similarity；V2 暂为精确（TODO） |

### 演化关系
grok-build 同时移植 codex 的 `apply_patch`（保留解析与 4 级模糊匹配，剥离 I/O/沙箱/流式）与 opencode 的 `edit/write`（仅保留精确替换骨架，删除 BOM/格式化/LSP/模糊匹配）。opencode 自身存在 V1（功能完整）与 V2（精简）两代。

---

## 2. 模型交互

### 三方设计要点对比

| 维度 | Codex | Grok-build | Opencode |
|---|---|---|---|
| SDK | 自研 Rust SDK | 自研 Rust SDK（`xai-grok-sampler`） | 主路径 Vercel AI SDK + 自研 `@opencode-ai/llm` |
| Provider 广度 | 4 类（openai/bedrock/ollama/lmstudio） | 仅 XAI 单后端 | 13 个（anthropic/openai/google/azure/bedrock/xai/openrouter/copilot 等） |
| Streaming | `eventsource_stream` + `idle_timeout` | `reqwest bytes_stream` + 自管 SSE | 委托 AI SDK `streamText` |
| 重试 | 可配置 `RetryOn`（指数退避+jitter） | 最复杂：15 次、2s→30s 封顶、doom-loop、client rebuild | 透传 `maxRetries`（默认 0） |
| Token 统计 | `TokenUsage` 含 cached/reasoning 细分 | 从最终 chunk 提取 | AI SDK 的 inputTokens/outputTokens |

### 核心差异
- **SDK 路线**：codex/grok-build 全自研 Rust；opencode 绑定 Vercel AI SDK 生态。
- **Provider 策略**：opencode 最广（13），codex 居中（4），grok-build 最窄（XAI 单后端）。
- **重试哲学**：grok-build 最激进（15 次 + doom-loop），codex 可配置，opencode 几乎不重试。

---

## 3. Prompt 工程

### 三方设计要点对比

| 维度 | Codex | Grok-build | Opencode |
|---|---|---|---|
| 存储形式 | 明文 `.md` + `include_str!` | XOR 加密字节数组（`Zeroizing` 清零） | 明文 `.txt` |
| 模板组织 | 单一 base + 功能子目录 | 三模板（base/apply-patch/subagent）+ 硬编码常量 | 14 个 provider/model 模板 + 4 个 subagent 模板 |
| 按 provider/model 分模板 | 仅少数模型覆写 | ❌ 单一 base | ✅ 按 model.api.id 匹配（anthropic/gpt/gemini/codex 等） |
| 动态注入 | 简单 `.replace()` 占位符 | MiniJinja 模板引擎（`${{ }}`） | 运行时拼接 env/instructions/mcp/skills |
| Compaction prompt | 独立 `.md` 模板 | 硬编码 `COMPACT_SYSTEM_PROMPT` | `compaction.txt` + 动态拼 previous-summary |

### 演化关系
grok-build 移植自 codex（`apply_patch_template` 解密 `CODEX_PROMPT_ENC`，`TemplateOverride::Codex` 直接复用 codex 模板）；opencode 独立演化，按 provider/model 分模板。

---

## 4. TUI 渲染框架

### 三方设计要点对比

| 维度 | Codex | Grok-build | Opencode |
|---|---|---|---|
| 框架 | ratatui 0.29（nornagon fork）+ crossterm（双 fork） | 上游 ratatui 0.29 + crossterm | 自研 `@opentui`（SolidJS 响应式） |
| 布局 | 自研 `FlexRenderable`（Flutter 风格 flex） | ratatui 原生 `Layout` + `Constraint` | opentui 的 box/flex 模型（类 CSS） |
| 状态管理 | 集中式 `App` 结构体 | `AppView` + reducer（dispatch Action→Effect） | SolidJS 信号（细粒度响应式） |
| 流式渲染 | `StreamState` 行队列 + 节拍出队 | scrollback entry 增量更新 | 响应式 message 数组变更触发重渲染 |
| 视口模型 | `custom_terminal` 自管光标/OSC8 | scrollback pane 按 block 虚拟化 | `ScrollBoxRenderable` 可视区定位 |

### 核心差异
- **技术栈**：codex/grok-build 同代 ratatui 0.29（codex 走 fork）；opencode 完全另起炉灶用 TS/SolidJS。
- **布局哲学**：codex 自研 Flutter 风格 flex；grok-build 用 ratatui 原生 Constraint；opencode 类 CSS box/flex。
- **状态模型**：codex/grok-build 集中式结构体（命令式），opencode 细粒度响应式（声明式）。

---

## 5. AI 友好性

### 三方设计要点对比

| 维度 | Codex | Grok-build | Opencode |
|---|---|---|---|
| 规则文件 | 单文件 `AGENTS.md`（322 行/22KB，命令式硬约束） | ❌ 无任何 AI 规则文件 | 双层：`AGENTS.md`（161 行）+ `CONTEXT.md`（225 行/32KB 术语表） |
| 贡献政策 | 邀请制 + 详细工作流 | 不接受外部 PR（20 行） | 开放接受 + 设计评审门槛 |
| 架构文档 | 分散在 `docs/` + `AGENTS.md` | 仅 README 仓库布局表 | 集中在 `specs/v2/*.md` + `CONTEXT.md` |
| 配置 schema | 5732 行 `config.schema.json` | 未见根级 schema | `.opencode/opencode.jsonc` + `specs/v2/config.md` |
| 测试指引 | 强制 `just test`、insta 快照、集成测试优先 | 仅 `cargo test -p <crate>` | 从 package 目录跑 `bun typecheck` |
| 代码规范 | Rust clippy + 行数/token 硬限制（模块<500 LoC，变更<800 行） | 仅 rustfmt/clippy | TS/Effect 风格（禁 star import、早返回、const 优先） |

### 核心差异
- **AI 规则投入**：codex/opencode 显式为 AI 协作设计规则文件；grok-build 作为内部 monorepo 同步树，未对外暴露 AI 规则层。
- **规范粒度**：codex 最严（行数/token 硬限制 + 强制 just 工作流），opencode 重术语与架构一致性，grok-build 仅靠工具链配置隐式约束。

---

## 综合洞察：三方工程哲学根本分野

| 哲学维度 | Codex | Grok-build | Opencode |
|---|---|---|---|
| **定位** | OpenAI 官方 Rust agent，「单一工具做精」 | XAI 内部 sampler，「移植拼装 + 加密闭源」 | 社区开源 TS agent，「多 provider 适配 + 声明式 UI」 |
| **编辑哲学** | 极简：唯一 apply_patch，freeform 非 JSON，支持流式 | 折中：三套并存（移植 codex + 移植 opencode + 自研），全部 JSON | 迭代：V1 功能完整 → V2 精简，全部 JSON |
| **可见性** | 明文 prompt + 明文规则，开源友好 | 加密 prompt + 无规则，闭源倾向 | 明文 prompt + 详尽规则，开源友好 |
| **重试/容错** | 可配置，平衡 | 最激进（15 次 + doom-loop），追求可用性 | 几乎不重试（默认 0），依赖 SDK |
| **TUI** | 自研 flex + fork ratatui，深度定制 | 上游 ratatui 原生，务实 | 完全另起炉灶（SolidJS），生态独立 |
| **AI 协作** | 命令式硬约束（行数/token 限制） | 无规则层 | 术语表 + 架构不变量，软约束 |

**根本分野总结**：
- **Codex** = 「极简 + 深度定制 + 开源友好」
- **Grok-build** = 「移植拼装 + 闭源 + 激进容错」
- **Opencode** = 「生态适配 + 声明式 + 社区驱动」

---

## 后续建议

1. **关注 grok-build 的移植完整性**：其 `apply_patch` 剥离了流式/沙箱/审批，`edit/write` 剥离了 BOM/格式化/LSP/模糊匹配——若需恢复这些能力，需明确是回引原版还是自行补全。
2. **opencode V2 的 TODO 收敛**：V2 core `edit` 的模糊匹配、格式化、LSP 均标注 TODO，需跟踪是否回移 V1 能力。
3. **codex 的 freeform 工具范式评估**：在全行业 JSON schema 化趋势下，codex 坚持 lark grammar freeform + 流式增量解析是差异化优势还是维护负担。
4. **grok-build 的 AI 规则层补全**：参考 codex（命令式硬约束）或 opencode（术语表 + 不变量）补全规则层是明确缺口。
5. **跨方 Prompt 复用机制**：grok-build 已通过 `TemplateOverride::Codex` 复用 codex apply-patch 模板，这种「模板级移植」是否会扩展到 base/subagent 模板，是观察三方关系演化的关键信号。
