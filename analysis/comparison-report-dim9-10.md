# codex vs grok-build 对比报告（维度 9-10）

> 维度 9 由 workflow `compare-dimensions-9-10` 的分析 agent 产出；维度 10 由 Explore agent 调查（workflow 中该维度因服务端 500 错误失败）。

## 顶部摘要

| # | 跨维度结论 | 涉及维度 |
|---|---|---|
| 1 | **能力架构范式根本差异**：codex 走「模型原生能力 + `ext/` 扩展」混合路线；grok-build 走「显式工具集全注册」路线 | 能力边界 |
| 2 | **grok-build 能力边界更宽**：工作流编排、任务调度、浏览器/计算机使用、记忆检索四个维度，grok-build 具备 codex 完全缺失的工具化能力 | 能力边界 |
| 3 | **多模态与 web 抓取**：grok-build 更完整（含 `video_gen`、产物落盘、带 SSRF 防护的 `web_fetch`）；codex 依赖模型原生模态与扩展，视频与深度抓取缺位 | 能力边界 |
| 4 | **构建系统差异**：codex 是 Bazel（发布/e2e 真源）+ Cargo（本地）双轨；grok-build 是纯 Cargo workspace | 工程化 |
| 5 | **可观测与崩溃恢复**：grok-build 有 Mixpanel + Sentry + OTel/fastrace 三栈 + 专用 `xai-crash-handler`（SIGSEGV 捕获 + 报告归档）；codex 是 OTel 一体化 + 本地 rollout-trace 诊断，无信号级 crash handler | 工程化 |

---

## 维度 9：能力边界（超出纯代码编辑）

### 设计要点对比

| 能力域 | codex | grok-build |
|---|---|---|
| **多模态** | `view_image`（读图）+ `image_gen`/`image_edit`（扩展，生成/编辑图，**无视频**） | `image_gen` + `image_edit` + `video_gen`（image_to_video / reference_to_video），产物落盘供代码引用 |
| **计划模式** | 会话级 `ModeKind::Plan`（只读模式）+ `update_plan` 工具（TODO/清单，Plan 模式下禁用） | `enter_plan_mode` / `exit_plan_mode` 工具对（代理主动进入，需用户同意，种子 plan 文件） |
| **目标追踪** | `ext/goal`：`create_goal`/`get_goal`/`update_goal`（状态仅 complete/blocked，含 token 预算） | `update_goal`（含分类器裁决、`ClassifierNotAchieved`/`Stalled`/`CapReached`/`Blocked` 多分支与自动暂停） |
| **工作流** | **无** workflow 工具 | `workflow` 工具（Rhai 脚本编排子代理，`name`/`script`/`script_path` 三选一，`agent_budget` 上限 1024，可 pause/resume/stop） |
| **子代理** | `multi_agents` v1（spawn/wait/send_input/close）+ v2（spawn/wait/send_message/list/interrupt/followup_task）两套 | 单一 `task` 工具，内置 BrowserUse/Explore/Plan/GeneralPurpose/GrokBuildOrchestrator 角色，`MAX_SUBAGENT_DEPTH=1`，配 `task_output`/`kill_task` |
| **web 搜索/抓取** | 模型原生 `ToolSpec::WebSearch`（`ext/web-search` 落地，支持 Search/OpenPage/FindInPage） | `web_search`（Responses API）+ `web_fetch`（reqwest 抓取、htmd 转 Markdown、SSRF 防护、缓存） |
| **浏览器/计算机使用** | 仅 `config_requirements` 中权限位，**无对应工具** | `xai-computer-hub`（transport/registry/resolver）+ BrowserUse 内置子代理 |
| **任务调度** | **无** scheduler | `scheduler`（create/list/delete，interval 如 5m/2h/1d，支持 recurring、durable 跨会话、foreground、fire_immediately） |
| **记忆/回忆** | 后台流水线（`ext/memories`，Phase1 抽取+Phase2 固化，会话启动异步运行），**不向模型暴露检索工具** | `memory_search`/`memory_get` 工具（SQLite 向量索引+embedding+MMR，`~/.grok/memory/` 跨会话持久化，受 `--experimental-memory` 门控） |
| **工具发现** | `tool_search` 工具（BM25 检索可用工具） | 未见对等的 tool_search（工具集固定注册） |

### 核心差异

- **能力架构**：codex 「模型原生能力 + ext/ 扩展」混合；grok-build 「显式工具集全注册」。
- **能力宽度**：grok-build 在工作流、调度、浏览器/计算机、记忆检索四个维度有 codex 完全缺失的工具。
- **多模态**：grok-build 有 video_gen，产物落盘；codex 无视频。
- **web 抓取**：grok-build 的 web_fetch 带 SSRF 防护 + 缓存，能力更强。
- **子代理**：codex 有 v1/v2 两套接口更丰富；grok-build 单一 task + 内置角色 + 深度限制，更收敛可控。
- **记忆策略**：codex 后台隐式抽取不暴露检索；grok-build 显式暴露 memory_search/memory_get 工具。

### 关键文件

**codex**：`codex-rs/core/src/tools/handlers/view_image.rs`、`codex-rs/ext/image-generation/src/tool.rs`、`codex-rs/core/src/tools/handlers/plan.rs`、`codex-rs/ext/goal/src/tool.rs`、`codex-rs/core/src/tools/handlers/multi_agents.rs`、`codex-rs/core/src/tools/handlers/multi_agents_v2/`、`codex-rs/ext/web-search/src/tool.rs`、`codex-rs/memories/README.md`

**grok-build**：`crates/codegen/xai-grok-tools/src/implementations/grok_build/`（image_gen/video_gen/enter_plan_mode/update_goal/workflow/task/web_search/web_fetch/scheduler/）、`crates/codegen/xai-grok-tools/src/implementations/memory/`、`crates/codegen/xai-grok-agent/src/config.rs`

---

## 维度 10：工程化与可观测

### 设计要点对比

| 维度 | codex | grok-build |
|---|---|---|
| **构建系统** | **Bazel + Cargo 双轨**：Bazel（MODULE.bazel + hermetic LLVM toolchain + 远程/磁盘缓存）是发布与 e2e 基准的真源；Cargo + `justfile` 负责本地开发 | **纯 Cargo workspace**：根 `Cargo.toml` 自动生成（注释「Prefer editing per-crate Cargo.toml」）；`.cargo/config.toml` 做链接加固（RELRO/noexecstack）与 jemalloc 配置 |
| **配置 schema** | **5732 行 JSON Schema**（`schemars` 从 Rust 类型生成，`just write-config-schema`）+ `config.md` 文档 | 无 JSON Schema；6 层 TOML 深度合并（/etc/grok → GROK_HOME → requirements → macOS MDM）+ `signed_policy`（Ed25519 签名 requirements，fail-closed 启动） |
| **可观测** | `codex-otel`：OTLP logs/trace/metrics + SessionTelemetry 业务事件 + W3C tracecontext 传播；`rollout-trace`：opt-in 本地诊断 bundle（manifest/trace.jsonl/payloads），离线 reducer 生成语义图，明确「不是 telemetry，不上传」；`rollout` crate 管持久化/索引/压缩 | **三栈分立**：`xai-grok-telemetry` 同时接 Mixpanel（产品分析）、Sentry（panic/anyhow/backtrace，`install_panic_hook`）、OTel（OTLP logs/metrics）；`xai-tracing` 用 `fastrace` 做高性能分布式追踪，配 tonic/reqwest/tower 中间件 |
| **崩溃恢复** | 未见专用信号级 crash handler，主要靠 `anyhow` + 子命令 `panic!` 兜底 | **`xai-crash-handler`**：注册 sigaction，async-signal-safe 写 `last-crash.bin`（GCRX 格式）、恢复终端、下次启动 `check_previous_crash` 解析符号并归档最近 5 份报告；`xai-circuit-breaker` 提供熔断+重试 |
| **测试** | `nextest` + Bazel e2e macrobenchmarks（`//codex-rs:e2e-benchmarks`）；`cli/e2e_benches/` | `xai-grok-test-support` 集中基建（mock inference server、SSE 生成器、PTY harness、headless runner）；26 个 `tests/` + 6 个 `benches/` |
| **代码质量** | `clippy.toml` + `rustfmt.toml` + `deny.toml`（cargo-deny）+ 自定义 `argument-comment-lint` | `clippy.toml`（禁 canonicalize、large-error-threshold=256）+ `rustfmt.toml` |
| **CI/CD** | **20+ GitHub Actions**：`rust-ci.yml`、`rust-ci-full.yml`、`cargo-deny.yml`、`bazel.yml`、`codespell.yml` 等 | 此快照**无 `.github/`**（可能托管在内部平台） |
| **CLI** | clap derive，子命令丰富（exec/review/login/mcp/plugin/doctor/debug/trace-reduce/sandbox/cloud 等），有 TUI | clap，默认进 TUI（`xai-grok-pager`）；`agent` 子命令支持 stdio/headless/serve/leader 多模式；`update` 做自更新并通知 leader 重启 |
| **工具链** | `.bazelversion`（9.0.0）；rust-toolchain 未在根目录显式指定 | `rust-toolchain.toml`（1.92.0） |

### 核心差异

- **构建系统**：codex Bazel + Cargo 双轨，工程化更重、可复现性更强；grok-build 纯 Cargo，更轻、上手更快。
- **配置校验**：codex 有 5732 行 JSON Schema 可校验/IDE 提示；grok-build 无 schema，靠多层 TOML 合并 + 签名策略，偏运行时治理。
- **可观测**：codex OTel 一体化 + 本地 rollout-trace 诊断（不上传）；grok-build Mixpanel + Sentry + OTel/fastrace 三栈分立，产品分析与错误上报更显式。
- **崩溃恢复**：grok-build 有专用 `xai-crash-handler`（SIGSEGV 捕获 + 终端恢复 + 报告归档）和 `xai-circuit-breaker`；codex 未见对等的信号级 crash handler。
- **CI**：codex 有 20+ GitHub Actions；grok-build 此快照无 `.github/`。
- **CLI**：codex 子命令更多更碎；grok-build 以 TUI 为默认、`agent` 子命令承载多运行模式。

### 关键文件

**codex**：`MODULE.bazel`、`.bazelrc`、`justfile`、`codex-rs/core/config.schema.json`、`codex-rs/config.md`、`codex-rs/otel/`、`codex-rs/rollout-trace/README.md`、`codex-rs/clippy.toml`、`codex-rs/deny.toml`、`.github/workflows/`

**grok-build**：`Cargo.toml`、`.cargo/config.toml`、`rust-toolchain.toml`、`crates/codegen/xai-grok-config/src/lib.rs`、`crates/codegen/xai-grok-telemetry/`、`crates/common/xai-tracing/`、`crates/codegen/xai-crash-handler/`、`crates/codegen/xai-grok-test-support/`、`clippy.toml`

---

## 待深入确认项

### 能力边界
1. codex 的 computer_use/browser_use 仅在 config_requirements 出现为权限位，是否有未被覆盖的实际工具实现（如通过 MCP 或动态工具注入）？
2. grok-build 的 computer-hub 与 BrowserUse 子代理之间的具体调用链未完全确认。
3. codex ext/goal 的 create_goal/get_goal/update_goal 是否默认对所有会话启用，还是受 feature flag 门控？
4. grok-build 的 workflow（Rhai）与 task（子代理）在编排能力上的边界。

### 工程化
1. grok-build 是否在仓库外使用 Bazel（clippy.toml、test-utils 多处提到 Bazel，但快照内无 BUILD.bazel）——历史残留还是外部构建？
2. grok-build 的 CI/CD 托管在何处（此快照无 `.github/workflows`）？
3. grok-build 是否有配置 schema 生成流程（仅发现 tool_meta.schema.json，非主配置）？
4. codex 的 rollout-trace 与 otel 的边界——生产环境是否同时启用及数据流向？
5. codex 是否有信号级 crash handler？
6. grok-build `fastrace` 与 `xai-grok-telemetry` 中 OTel 的关系——互补还是二选一？
