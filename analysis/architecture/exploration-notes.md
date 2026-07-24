# 初步结构探索笔记

> 由 Explore agent 并行扫描 codex 与 grok-build 后汇总。目的是定位关键文件，为后续逐维度深入分析做准备。

## codex 关键文件速查

| 关注点 | 路径 |
|---|---|
| 二进制入口 | `codex-rs/cli/src/main.rs` |
| 主循环 | `codex-rs/core/src/session/mod.rs`（`submission_loop`）、`turn.rs` |
| Prompt 模板 | `codex-rs/prompts/templates/`（goals / compact / permissions / apply_patch_tool_instructions.md） |
| Prompt 拼装 | `codex-rs/core/src/context/*.rs` |
| 工具实现 | `codex-rs/core/src/tools/handlers/`（apply_patch / shell / plan / multi_agents / mcp ...） |
| 工具框架 | `codex-rs/tools/` |
| 文件编辑 | `codex-rs/apply-patch/`（独立 crate，含 streaming_parser） |
| 沙箱 | `codex-rs/linux-sandbox/`（bwrap + landlock） |
| Compaction | `codex-rs/core/src/compact.rs` |
| 记忆 | `codex-rs/memories/` |
| 模型调用 | `codex-rs/codex-client/src/sse.rs` |
| 插件 | `codex-rs/plugin/` |
| 配置 | `codex-rs/config/`、`codex-rs/core/config.schema.json` |

## grok-build 关键文件速查

| 关注点 | 路径 |
|---|---|
| 二进制入口 | `crates/codegen/xai-grok-pager-bin/src/main.rs` |
| 运行时入口 | `crates/codegen/xai-grok-shell/src/agent/app.rs`（leader/stdio/headless） |
| 主循环 | `crates/codegen/xai-grok-shell/src/session/acp_session_impl/run_loop.rs` |
| Prompt（加密） | `crates/codegen/xai-grok-agent/src/prompt/prompt_encrypted.rs` |
| Prompt（模板/常量） | `crates/codegen/xai-grok-agent/src/prompt/template.rs` |
| Prompt 拼装 | `crates/codegen/xai-grok-shell/src/session/acp_session_impl/prompt_build.rs` |
| 工具实现 | `crates/codegen/xai-grok-tools/src/implementations/{codex,opencode,grok_build}/` |
| 工具注册 | `crates/codegen/xai-grok-tools/src/registry/` |
| 工具分发 | `crates/codegen/xai-grok-shell/src/session/acp_session_impl/tool_dispatch.rs` |
| 沙箱 | `crates/codegen/xai-grok-sandbox/src/` |
| Compaction | `crates/common/xai-grok-compaction/`、`xai-grok-agent/src/compaction.rs` |
| 记忆（向量） | `crates/codegen/xai-grok-memory/src/`（embedding/index/mmr/dream） |
| 模型调用 | `crates/codegen/xai-grok-sampler/src/client.rs` |
| 配置 | `crates/codegen/xai-grok-config/src/` |
| 插件市场 | `crates/codegen/xai-grok-plugin-marketplace/` |
| ACP 协议 | `crates/codegen/xai-acp-lib/` |

## 待确认项（探索阶段未完全搞清）

- grok-build 工具是否支持并行调用
- grok-build apply_patch 是否支持流式解析
- codex 的重试/容错机制
- grok-build 配置是否有公开 schema
- 两边 subagent 委派协议的具体差异
