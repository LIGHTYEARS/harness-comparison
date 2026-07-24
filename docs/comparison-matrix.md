# 对比矩阵

基于对 codex 与 grok-build 的初步结构探索，确定以下 10 个对比维度。每个维度下先给"对比要点"，再给横向对比表。

> 项目根目录速查：
> - codex：`agents/codex/codex-rs/`
> - grok-build：`agents/grok-build/crates/codegen/`

---

## 1. 架构与组织

**对比要点**：crate 划分、模块边界、是否多语言、主循环位置、是否区分 leader/worker。

| 项目 | 语言 | 模块组织 | 主循环位置 | 备注 |
|------|------|----------|------------|------|
| codex | Rust + TS | 100+ crate，`core/` 为核心 | `core/src/session/{mod,turn}.rs` | TS CLI 是薄包装 |
| grok-build | Rust | 70+ crate，`xai-grok-shell` 为运行时 | `xai-grok-shell/src/session/acp_session_impl/run_loop.rs` | 有 leader/stdio/headless 多入口 |

---

## 2. Prompt 工程

**对比要点**：prompt 存储形式（明文/加密/代码内嵌）、模板组织、动态注入、AGENTS.md 支持、compaction prompt。

| 项目 | 存储形式 | 模板位置 | 动态注入 | AGENTS.md | 备注 |
|------|----------|----------|----------|-----------|------|
| codex | 明文 markdown | `prompts/templates/` | `core/src/context/*.rs` | ✅ `agents_md.rs` | 易读、可审计 |
| grok-build | **XOR 加密** + 明文常量 | `xai-grok-agent/src/prompt/{prompt_encrypted,template}.rs` | `prompt/context.rs` 等 | ✅ `prompt/agents_md.rs` | 核心 prompt 不可直接读 |

---

## 3. 工具系统

**对比要点**：工具来源（自研/移植）、注册机制、工具协议层、是否支持动态工具搜索、并行调用。

| 项目 | 工具来源 | 注册/分发 | 协议层 | 动态搜索 | 并行 |
|------|----------|-----------|--------|----------|------|
| codex | 自研 | `core/src/tools/{registry,router,orchestrator}.rs` | `tools/` crate | ✅ `tool_search` | ✅ `parallel.rs` |
| grok-build | **移植 codex + opencode + 自研** | `xai-grok-tools/src/registry/` + `tool_dispatch.rs` | `common/xai-tool-protocol/` | ✅ `search_tool/` | 待确认 |

---

## 4. 代码行动（文件编辑）

**对比要点**：编辑范式（patch / search_replace / 直接写 / LSP）、实现位置、是否支持流式 patch。

| 项目 | 编辑范式 | 实现位置 | 流式 | 备注 |
|------|----------|----------|------|------|
| codex | apply_patch（单一） | `core/src/tools/handlers/apply_patch.rs` + `apply-patch/` crate | ✅ `streaming_parser.rs` | 独立 patch 解析 crate |
| grok-build | apply_patch + search_replace + edit + write + **LSP** | `xai-grok-tools/src/implementations/{codex,grok_build,opencode}/` | 待确认 | 多范式并存 |

---

## 5. 命令执行与沙箱

**对比要点**：shell 工具实现、沙箱技术（命名空间/landlock/Seatbelt）、网络策略、权限审批。

| 项目 | 命令工具 | 沙箱技术 | 网络策略 | 权限审批 |
|------|----------|----------|----------|----------|
| codex | `shell` / `unified_exec` | `linux-sandbox/`（bwrap+landlock）/ Windows / macOS Seatbelt | `network-proxy/` | `tools/approvals.rs` |
| grok-build | `bash`（两套实现） | `xai-grok-sandbox/`（网络/路径策略） | `sandbox/src/network_policy.rs` | `xai-grok-workspace/src/permission/` |

---

## 6. 上下文与记忆

**对比要点**：历史管理、token 预算、auto-compaction 策略、长期记忆形式（无/向量/文件）、是否有"dream/离线整理"。

| 项目 | 历史管理 | Compaction | 长期记忆 | Dream/离线 |
|------|----------|------------|----------|------------|
| codex | `context_manager/` + `message-history/` | `compact.rs`（单策略） | `memories/` crate（轻量） | ❌ |
| grok-build | `session/prompt_history.rs` | `xai-grok-compaction/`（code/history/inter/intra 多策略） | `xai-grok-memory/`（**向量 + MMR**） | ✅ `dream.rs` |

---

## 7. 模型交互

**对比要点**：支持的后端/提供商、streaming 实现、是否可切模型、重试/容错。

| 项目 | 后端 | Streaming | 切模型 | 重试 |
|------|------|-----------|--------|------|
| codex | 多后端（Bedrock/Ollama/LMStudio/ChatGPT） | `codex-client/src/sse.rs` | ✅ 动态 catalog | 待确认 |
| grok-build | xAI Grok API（为主） | `xai-grok-sampler/src/client.rs`（SSE） | ✅ `ModelsManager` | ✅ `retry.rs` + `doom_loop.rs` |

---

## 8. 可扩展性

**对比要点**：插件机制、skills、MCP、hooks、配置格式、是否有插件市场、编辑器集成协议。

| 项目 | 插件 | Skills | MCP | Hooks | 配置 | 编辑器协议 | 插件市场 |
|------|------|--------|-----|-------|------|------------|----------|
| codex | ✅ `plugin/` | ✅ `skills/` | ✅ `codex-mcp/` | ✅ `hooks/` | TOML（schema 生成） | ❌ | ❌ |
| grok-build | ✅ | ✅ | ✅ `xai-grok-mcp/` | ✅ `xai-grok-hooks/` | TOML（多层级） | ✅ **ACP** | ✅ `plugin-marketplace/` |

---

## 9. 能力边界（超出纯编码）

**对比要点**：是否支持多模态（图/视频生成）、计划模式、工作流、子代理、web 搜索。

| 项目 | 多模态 | 计划模式 | 工作流 | 子代理 | Web 搜索 |
|------|--------|----------|--------|--------|----------|
| codex | ❌（仅 view_image） | ❌ | ❌ | ✅ `multi_agents` | ❌ |
| grok-build | ✅ image_gen / video_gen | ✅ enter/exit_plan_mode | ✅ workflow | ✅ `subagent/` | ✅ web_search / web_fetch |

---

## 10. 工程化与可观测

**对比要点**：构建系统、配置 schema、测试/benchmark、tracing/rollout、CLI 体验（TUI）。

| 项目 | 构建 | 配置 Schema | Benchmark | Tracing | TUI |
|------|------|-------------|-----------|---------|-----|
| codex | Bazel + Cargo | ✅ `config.schema.json` | ❌（仅 e2e_benches） | ✅ `otel/` + `rollout/` | ✅ `tui/` |
| grok-build | Cargo（根 Cargo.toml 自动生成） | 待确认 | ❌（仅单元/集成） | ✅ tracing | ✅ `xai-grok-pager/` |

---

## 待深入确认项（探索阶段标记为"待确认"的点）

- grok-build 工具是否支持并行调用
- grok-build apply_patch 是否支持流式解析
- codex 的重试/容错机制具体实现
- grok-build 配置是否有公开 schema
- 两边 subagent / multi_agent 的委派协议差异
