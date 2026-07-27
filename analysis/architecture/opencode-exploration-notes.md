# opencode 初步结构探索

> 由 Explore agent 扫描后汇总。opencode 是 TypeScript 项目（~2520 个 .ts 文件），bun 包管理，MIT 许可证。grok-build 移植了它的部分工具实现。

## 关键速查

| 关注点 | 路径 |
|---|---|
| CLI 入口 | `packages/opencode/src/index.ts`（yargs）、`packages/cli/src/index.ts`（新版 effect CLI） |
| 主循环 | `packages/core/src/session/runner/index.ts`（`SessionRunner.run`）+ `packages/opencode/src/session/processor.ts`（tool call 处理、continue/stop/compact，含 `DOOM_LOOP_THRESHOLD`） |
| System prompt | `packages/opencode/src/session/prompt/`（按 provider/model 分模板：anthropic.txt / gpt.txt / gemini.txt / codex.txt / plan.txt 等） |
| Prompt 组装 | `packages/opencode/src/session/system.ts`（选模板 + 注入 environment/skills/mcp）、`packages/opencode/src/session/prompt.ts`（1631 行，拼装消息序列） |
| 工具实现 | `packages/opencode/src/tool/`（edit / apply_patch / write / shell / read / glob / grep / task / webfetch / websearch / todo / skill / lsp / plan） |
| 工具（core，grok-build 移植来源） | `packages/core/src/tool/`（bash.ts / edit.ts / write.ts / glob.ts / grep.ts / read.ts / todowrite.ts / skill.ts / webfetch.ts / apply-patch.ts） |
| 工具注册 | `packages/opencode/src/tool/registry.ts`（合并 builtin + plugin 自定义，按 agent/permission 过滤） |
| 对话历史 | `packages/opencode/src/session/message-v2.ts`、`core/src/session/history.ts`、`core/src/session/store.ts`（sqlite 持久化，drizzle schema） |
| Token 预算 | `packages/opencode/src/session/overflow.ts`（`usable()` / `isOverflow()`） |
| Compaction | `packages/opencode/src/session/compaction.ts`（`PRUNE_MINIMUM=20000` / `PRUNE_PROTECT=40000`） |
| 模型交互 | Vercel **AI SDK**（`ai` 包，`streamText`/`streamObject`）；多 provider 在 `packages/llm/src/providers/`（anthropic/openai/google/azure/bedrock/openrouter/xai 等） |
| TUI | `@opentui/core` + `@opentui/solid`（**自研**，基于 SolidJS，非 Ink/blessed）；入口 `packages/tui/src/index.tsx` |
| MCP | `packages/opencode/src/mcp/index.ts`（`@modelcontextprotocol/sdk`，stdio/SSE/StreamableHTTP） |
| 插件 | `packages/plugin/src/`（Hooks 接口：auth/provider/catalog/agent/aisdk）；`opencode/src/plugin/loader.ts` 加载 |
| 配置 | `.opencode/` 目录，JSONC 格式（`jsonc-parser`） |
| AI 规则文件 | 根 `AGENTS.md`（贡献指南）、`packages/opencode/AGENTS.md`（数据库/模块规范）、`packages/llm/AGENTS.md` + `DESIGN.md`、根 `CONTEXT.md`（87KB，Session Runtime 术语表） |

## 与 codex/grok-build 的关键差异（初步）

| 维度 | codex | grok-build | opencode |
|---|---|---|---|
| **语言** | Rust | Rust | **TypeScript** |
| **包管理** | Cargo + Bazel | Cargo | **bun**（monorepo，~20 packages） |
| **TUI 框架** | ratatui（fork） | ratatui（上游） | **@opentui（自研，SolidJS）** |
| **模型 SDK** | 自研（codex-client） | 自研（xai-grok-sampler） | **Vercel AI SDK** |
| **Prompt 模板** | 明文 markdown（codex）/ 加密（grok-build） | 按 provider/model 分 **.txt 模板**（anthropic/gpt/gemini/codex/plan 等） |
| **编辑工具** | apply_patch（单一） | apply_patch + search_replace + edit + write | **edit + apply_patch + write**（三套） |
| **命令执行** | shell（无 PTY） | bash（PTY） | **shell（PTY，cwd 跟踪、输出截断）** |
| **多 provider** | Responses API + Bedrock | Chat/Responses/Messages 三种 | **10+ provider**（anthropic/openai/google/azure/bedrock/openrouter/xai/copilot 等） |
| **AI 规则文件** | 1 份详尽 AGENTS.md | 无 | **多层 AGENTS.md + 87KB CONTEXT.md 术语表** |

## 观察

1. **opencode 是 grok-build 工具的"上游"**：`packages/core/src/tool/` 下的 bash/edit/write/grep/glob/todowrite/skill/apply-patch/webfetch 就是 grok-build 移植的来源。这意味着对比"工具实现"时，opencode 是原始版本，grok-build 是移植版本——可以做有趣的"移植变异"分析。

2. **语言栈完全不同**：codex/grok-build 是 Rust，opencode 是 TypeScript。这会影响很多维度的对比（构建系统、TUI 框架、错误处理、并发模型等），但也让"语言对 agent 设计的影响"成为一个新的分析角度。

3. **Prompt 策略独特**：opencode 按 provider/model 分不同 system prompt 模板（anthropic.txt / gpt.txt / gemini.txt / codex.txt / plan.txt 等），而 codex/grok-build 基本是单一模板。这是一个值得对比的设计选择。

4. **TUI 自研**：opencode 用自研的 @opentui（基于 SolidJS），而 codex/grok-build 都用 ratatui。TUI 框架对比会很有意思。

5. **CONTEXT.md 是亮点**：87KB 的 Session Runtime 术语表，定义了 System Context、Session History、Context Epoch、Provider Turn、Session Drain 等核心概念——这在"AI 友好性"维度上是独特的资产。

## 如何纳入现有对比框架

现有 10+ 维度的对比框架可以直接复用，但需要注意：

- **维度 1（架构）**：opencode 是 TS monorepo，crate 对比要换成 package 对比
- **维度 7（模型交互）**：opencode 用 Vercel AI SDK，多 provider 支持最广，对比会很有看点
- **维度 4（代码行动）**：opencode 同时有 edit/apply_patch/write，且 grok-build 移植了它的 edit/write——可以做"原版 vs 移植版"对比
- **维度 10（工程化）**：TS 的构建/测试/lint 与 Rust 完全不同，对比维度需要调整
- **AI 友好性**：opencode 的多层 AGENTS.md + CONTEXT.md 值得与 codex 的单 AGENTS.md 对比

## 下一步建议

可以选一个维度先做三方对比（codex vs grok-build vs opencode），推荐：
- **维度 4（代码行动）**：因为 grok-build 移植了 opencode 的工具，三方对比能揭示"工具设计的演化路径"
- **维度 7（模型交互）**：opencode 用 AI SDK + 10+ provider，与另外两个自研 SDK 的对比很有价值
- **AI 友好性**：opencode 的 CONTEXT.md 是独特资产，三方对比能总结"AI 规则文件的最佳实践"
