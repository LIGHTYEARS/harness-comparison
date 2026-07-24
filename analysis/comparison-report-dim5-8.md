# codex vs grok-build 对比报告（维度 5-8）

> 维度 5、6 由 Explore agent 调查；维度 7、8 由 workflow `compare-dimensions-5-8` 的分析 agent 产出（已缓存）。

## 顶部摘要

| # | 跨维度结论 | 涉及维度 |
|---|---|---|
| 1 | **沙箱粒度根本不同**：codex 每条命令起独立 bwrap 命名空间（粒度=单命令）；grok-build 用 nono 在进程级一次性装 Landlock/Seatbelt（粒度=整个 agent 进程） | 沙箱 |
| 2 | **网络控制策略不同**：codex `--unshare-net` 断网 + network-proxy MITM 做域名级 Allow/Deny/Ask；grok-build 用 seccomp 在子进程 pre_exec 一刀切断网 | 沙箱 |
| 3 | **长期记忆技术栈差异巨大**：codex 是文件记忆（state DB + git + 频次排序，无向量）；grok-build 是向量+FTS 混合检索（SQLite-vec + BM25 + 时间衰减 + MMR）+ dream 离线整理 | 记忆 |
| 4 | **压缩阈值与策略不同**：codex 90% 阈值 + tail-keep（保留最近用户消息+summary）；grok-build 85% 阈值 + full-replace（全量重建历史，9 段结构化 prompt） | 记忆 |
| 5 | **流式传输架构差异最大**：codex 同时支持 SSE 与 Responses-over-WebSocket（连接可跨 turn 复用）；grok-build 仅用 SSE | 模型交互 |
| 6 | **后端适配范围**：codex 以 OpenAI Responses API 为主 + Bedrock 专属 provider；grok-build 同时支持 Chat Completions / Responses / Anthropic Messages 三种协议 | 模型交互、可扩展性 |
| 7 | **可扩展性重心不同**：grok-build 在插件安装管线、完整 marketplace、ACP 编辑器协议上更完整；codex 在 skills 元数据系统与 5732 行集中 JSON Schema 强校验上更成熟 | 可扩展性 |

---

## 维度 5：命令执行与沙箱

### 设计要点对比

| 维度 | codex | grok-build |
|---|---|---|
| shell 工具 | `shell.rs` → `ShellRuntime`，非交互执行 | `bash/mod.rs`（5000+ 行 BashTool），PTY + alacritty_terminal 无头仿真 |
| 隔离技术 | **bubblewrap**：每条命令起独立 user/pid/net 命名空间 + bind/ro-bind/tmpfs 路径策略 | **nono**：进程启动时一次性装 Landlock（Linux）/Seatbelt（macOS），子进程继承 |
| 沙箱粒度 | **单命令**（每次 spawn bwrap） | **整个 agent 进程**（启动时应用，命令执行只额外加 seccomp 网络过滤） |
| 网络控制 | `--unshare-net` 完全断网 + `network-proxy` MITM 做域名级 Allow/Deny/Ask | seccomp 在 `pre_exec` 拦截 connect 等 syscall 全断网；`WebsitePolicy` 做 origin 级策略描述 |
| 网络模式 | FullAccess / Isolated / ProxyOnly 三档 | 全断 + 策略描述（实际放行需走代理/上层） |
| 交互命令 | ❌ 无 PTY，不支持 vim/top | ✅ PTY + 终端仿真，支持前台/后台/流式输出/kill |
| 审批流程 | 规则引擎：execpolicy 决策 Allow/Prompt/Forbidden + turn 级 sticky 权限 | LLM 分类器 + 启发式白名单 + 多模式（AlwaysApprove/Auto/Prompt） |
| FS 隔离 | 按 PermissionProfile 动态生成 bwrap 挂载（ro-bind/tmpfs 遮罩），可做"受限只读" | profile 固定（Workspace/Devbox/Strict/Custom/Off），Landlock 能力集授予 |
| macOS | Seatbelt（.sbpl 策略） | Seatbelt（nono） |

### 核心差异

- **隔离技术栈**：codex 每条命令用 bwrap 起独立命名空间；grok-build 用 nono 在进程级一次性装 Landlock/Seatbelt。
- **网络控制**：codex 默认断网 + MITM 代理做域名级策略（可审计、可放行）；grok-build 用 seccomp 一刀切断网。
- **交互命令**：grok-build 用 PTY 原生支持 vim/top/后台任务；codex 无 PTY，长进程靠 session ID 轮询。
- **审批流程**：codex 是规则引擎；grok-build 是 LLM 分类器 + 启发式白名单，更依赖模型判断。
- **FS 隔离粒度**：codex 逐路径挂载更灵活；grok-build profile 固定。

### 关键文件

**codex**：`codex-rs/core/src/tools/handlers/shell.rs`、`codex-rs/linux-sandbox/src/bwrap.rs`、`codex-rs/linux-sandbox/src/landlock.rs`、`codex-rs/execpolicy/src/decision.rs`、`codex-rs/network-proxy/src/network_policy.rs`

**grok-build**：`crates/codegen/xai-grok-tools/src/implementations/grok_build/bash/mod.rs`、`crates/codegen/xai-grok-tools/src/computer/local/terminal.rs`、`crates/codegen/ptyctl/src/term.rs`、`crates/codegen/xai-grok-sandbox/src/lib.rs`、`crates/codegen/xai-grok-sandbox/src/child_net.rs`、`crates/codegen/xai-grok-workspace/src/permission/manager.rs`

---

## 维度 6：上下文与记忆

### 设计要点对比

| 维度 | codex | grok-build |
|---|---|---|
| 历史管理 | `ContextManager`（`Arc<Vec<ResponseItem>>`）内存维护，state_db/rollout 持久化，支持 fork/rollback | 会话日志写入 `~/.grok/memory/{workspace_hash}/` |
| token 估算 | `approx_token_count`（bytes/4 启发式） | `xai-token-estimation` 独立 crate：`BYTES_PER_TOKEN=4`、`IMAGE_TOKEN_ESTIMATE=765` |
| 压缩阈值 | **90%**（`auto_compact_token_limit = context_window * 9/10`，硬编码） | **85%**（`DEFAULT_AUTO_COMPACT_THRESHOLD_PERCENT=85`，可配） |
| 压缩策略 | **tail-keep**：保留最近用户消息（≤20000 tokens）+ summary；压缩失败时从头部逐条删保 prefix cache | **full-replace**：全量重建历史 `[SP, UP', AGENTS.md?, UQ_last, recent…, summary, reminder?]`；9 段结构化 prompt |
| 压缩 prompt | `SUMMARIZATION_PROMPT`（CONTEXT CHECKPOINT COMPACTION） | `full_replace_summary_prompt.txt`（9 段：Primary Request/Files/Errors/All User Messages 等）或短 `SELF_SUMMARIZATION_PROMPT` |
| 压缩退化处理 | 压缩后仍超窗 → 从头部 `remove_first_item` | summary 低于 `MIN_SUMMARY_SEED_CHARS=500` 视为退化重试，`max_attempts=3`、`sampling_timeout=120s`、`wall_clock_budget=300s` |
| 长期记忆 | **文件记忆**：Phase1 从 rollout 抽取 raw_memory/rollout_summary 写入 state DB，Phase2 合并到 `~/.codex/memories/`（MEMORY.md、rollout_summaries/），git diff 驱动 consolidation sub-agent；按 usage_count 与 last_usage 排序，受 `max_unused_days` 过滤 | **向量+FTS 混合检索**：SQLite + FTS5(BM25) + sqlite-vec(KNN)，分数归一化后叠加时间衰减（session 源指数衰减，`half_life_days=7`）、源权重、访问频次 boost，再经 **MMR 重排**（λ=0.7，默认关），`max_results=6` |
| 离线整理 | 启动时异步 Phase1/Phase2 consolidation | **dream 机制**：`min_hours=4`、`min_sessions=3` 双门控触发，用 `DREAM_SYSTEM_PROMPT` 合并近期 session log 到 MEMORY.md |
| 记忆与压缩耦合 | 记忆流水线独立于压缩生命周期 | 可选 `memory_flush_enabled` 在压缩前先做记忆抽取 turn |

### 核心差异

- **压缩阈值**：codex 90%（硬编码），grok-build 85%（可配）。
- **压缩策略**：codex tail-keep（保留最近+summary）；grok-build full-replace（全量重建，prompt 更结构化）。
- **长期记忆**：codex 文件记忆（state DB + git + 频次排序，无向量）；grok-build 向量+FTS 混合检索（SQLite-vec + BM25 + 时间衰减 + MMR）。
- **离线整理**：codex 启动时异步 consolidation；grok-build 显式 dream（时间+会话数双门控）。
- **溢出兜底**：codex 压缩失败时从头部逐条删保 prefix cache；grok-build 未见等价头部丢弃逻辑。

### 关键文件

**codex**：`codex-rs/core/src/compact.rs`、`codex-rs/core/src/session/token_budget.rs`、`codex-rs/core/src/context_manager/history.rs`、`codex-rs/core/src/state/auto_compact_window.rs`、`codex-rs/memories/README.md`、`codex-rs/prompts/templates/compact/prompt.md`

**grok-build**：`crates/common/xai-grok-compaction/src/code_compaction/{config,prompt,assemble,compact}.rs`、`crates/codegen/xai-grok-agent/src/compaction.rs`、`crates/codegen/xai-token-estimation/src/lib.rs`、`crates/codegen/xai-grok-memory/src/{search,mmr,dream,index,embedding}.rs`

---

## 维度 7：模型交互

### 设计要点对比

| 维度 | codex | grok-build |
|---|---|---|
| 后端抽象 | `ModelProvider` trait；默认 OpenAI Responses API + Amazon Bedrock 专属 provider（含 AWS 签名）；本地/兼容后端通过 `create_oss_provider_with_base_url` 接入（Ollama、LMStudio） | `ApiBackend` 枚举：Chat Completions / Responses / Anthropic Messages 三种协议，按模型配置选择，`base_url/headers/query_params` 可配，后端无关 |
| 流式传输 | **双轨**：SSE（`eventsource_stream` 解析，`idle_timeout` 超时保护）+ Responses-over-WebSocket（`tungstenite`，60 分钟连接上限，可跨 turn 复用，失败 session 级回退 HTTP） | 统一 SSE（`eventsource_stream`，含 UTF-8 BOM 剥离、`[DONE]` 终止、防 h2 断流忙循环）；无 WebSocket LLM 流（WebSocket 仅用于 ACP relay/leader） |
| 模型目录与切换 | `models-manager` 从 `/models` 拉取（磁盘缓存/etag）或静态目录；turn 间可换模型；服务端可通过 `ResponseEvent::ServerModel` 在流中覆盖 | `ModelsManager` 持有 `current_model_id`，`set_current_model_id` 通过 `watch::channel` 通知 SessionActor；目录从 `/v1/models` 拉取并缓存；默认模型来自 `default_models.json`（CLI>ENV>config>remote>defaults 优先级） |
| 重试策略 | 分两档：`request_max_retries`（普通请求）与 `stream_max_retries`（SSE 流）；指数退避 + ±10% jitter；可重试 429/5xx/传输错误 | `classify_error` 决定 `RetryDecision`；默认 15 次（约 6 分钟预算）；指数退避（2/4/8…封顶 30s）±20% jitter；429 尊重 `Retry-After`；413/图像错误 strip 图像重试一次；传输错误首次重建 HTTP/1.1 客户端；`x-should-retry: false` 直接致命；另设 doom-loop 近立即重采样 |
| Token 统计 | 主要依赖 API 返回的 `TokenUsage`（input/output/cached/reasoning/total），用于 rollout budget、auto-compact、TUI 显示；本地仅用 `approx_bytes_for_tokens` 做截断估算 | `xai-token-estimation` 用 bytes/4 启发式（含图像 765 tok/张）；实际用量取自 API `response.usage`；`TurnUsageAccumulator` 跨多次模型调用累加；暴露 `x.ai/session/usage` 扩展（含 `cost_in_usd_ticks`） |
| 多轮工具循环 | `turn.rs` 的 loop 反复采样→执行工具→回填 `tool_result`，直到无工具调用或停止 | `turn.rs` 的 loop 反复 `process_conversation_turn_with_recovery`→执行工具→`stop_gate` 判定，含 doom-loop 检测与恢复 |

### 核心差异

- **后端范围**：codex 以 OpenAI Responses API 为主 + Bedrock 专属 provider；grok-build 同时支持三种 wire API，可对接更多兼容提供商。
- **流式传输**：codex 同时支持 SSE 与 WebSocket（可复用连接）；grok-build 仅用 SSE。
- **重试策略**：grok-build 更激进（15 次、429 单独阈值、图像剥离重试、doom-loop）；codex 分 request/stream 两档，退避带抖动。
- **Token 统计**：codex 统计维度更细（cached/reasoning）；grok-build 额外跟踪 cost 并通过扩展暴露用量。
- **模型切换**：codex 靠 provider/catalog 刷新 + 服务端事件覆盖；grok-build 靠 ModelsManager + watch 通道显式通知。

### 关键文件

**codex**：`codex-rs/model-provider/src/provider.rs`、`codex-rs/codex-client/src/sse.rs`、`codex-rs/codex-client/src/retry.rs`、`codex-rs/codex-api/src/sse/responses.rs`、`codex-rs/codex-api/src/endpoint/responses_websocket.rs`、`codex-rs/core/src/session/turn.rs`

**grok-build**：`crates/codegen/xai-grok-sampler/src/client.rs`、`crates/codegen/xai-grok-sampler/src/retry.rs`、`crates/codegen/xai-grok-sampler/src/config.rs`、`crates/codegen/xai-grok-shell/src/agent/models.rs`、`crates/codegen/xai-grok-shell/src/session/acp_session_impl/turn.rs`

---

## 维度 8：可扩展性

### 设计要点对比

| 维度 | codex | grok-build |
|---|---|---|
| 插件清单 | `PluginManifest`（TOML/JSON），统一打包 skills、mcp_servers、apps、hooks 四类资源 | `plugin.json`（兼容 `.claude-plugin`），声明 skills/agents/hooks/mcp_servers/lsp_servers 五类资源，每类可用路径或 inline（JSON） |
| 安装/卸载 | 编辑 `config.toml` 的 `[plugins]` 表（`set_user_plugin_enabled`/`clear_user_plugin`）与 `[marketplaces]` 表（git 源），无独立安装器 | `xai-grok-plugin-marketplace` crate：官方源 `xai-org/plugin-marketplace` 自动注册，支持 local/git 源、`plugin-index.json` 目录扫描、`install_from_marketplace` 走 `InstallRegistry`+`git_install` 管道复制到 managed 存储并记录 provenance |
| Skills | 独立 `codex-skills` crate，`SKILL.md` 元数据含 dependencies/policy/interface，支持隐式调用与产品 gating，系统技能编译进二进制并按指纹缓存 | 扫描 `skills/` 下的 `SKILL.md`（含 frontmatter），跨 `.grok`/`.claude`/`.cursor` 多 vendor 目录发现并过滤 vendor 内置 skill，支持会话中动态发现 |
| MCP | `codex-mcp` 大 crate（~10k 行）：`McpRuntime`/`connection_manager` 管理 stdio 与远程传输、OAuth、tool catalog 缓存，插件可内嵌 mcp_servers | `xai-grok-mcp` crate：隔离 rmcp 2.1，提供 stdio/streamable-HTTP 传输、OAuth、凭证存储，并通过 `acp_transport` 把 MCP 桥接到 ACP 反向通道 |
| Hooks | 11 个事件（PreToolUse…Stop），支持 matcher 分组与 Prompt/Command/Agent 三种 handler，每事件生成 JSON schema | 14 个事件（含 StopFailure/Notification/PermissionDenied 等），反序列化兼容 PascalCase/snake_case/camelCase 及别名，每事件有 GateKind（Observe/Tool/Stop）与 MatcherPolicy |
| 配置 | TOML + **5732 行 `config.schema.json`**（schemars 生成，覆盖全部字段） | 多层 TOML（/etc/grok、$GROK_HOME、requirements.toml 签名层、macOS MDM），无集中 JSON Schema，校验靠 `validation.rs` |
| 编辑器集成 | ❌ 无 ACP/LSP | ✅ `xai-acp-lib` 提供完整 ACP 协议（channel/gateway/message），插件清单支持 `lsp_servers` |
| 自定义模型 | `ModelProvider` trait 可新增 provider；`model_providers` 配置项注册自定义 OpenAI 兼容 provider | `default_models.json` + CLI/ENV/config/remote 优先级链（无 provider trait）；`[model.<name>]` 与 `[model_providers.<id>]` 配置三种后端 |
| 自定义工具 | `ToolExecutor` trait、`DynamicToolFunctionSpec` 动态工具 | MCP 或 `register_tool_pack` 注册 ToolPack |

### 核心差异

- **插件安装**：grok-build 有完整 marketplace crate + InstallRegistry + git 安装管道；codex 靠编辑 config.toml，无独立安装器。
- **Skills 系统**：codex 有独立 crate + policy/interface 元数据 + 产品 gating，更成熟；grok-build 是轻量扫描 + 多 vendor 兼容。
- **MCP**：codex 的 codex-mcp 更大更全（~10k 行）；grok-build 用 rmcp 2.1 并桥接 ACP。
- **配置校验**：codex 有 5732 行 JSON Schema 强校验；grok-build 无集中 schema，靠 validation.rs。
- **编辑器集成**：grok-build 有完整 ACP 协议 + LSP 支持；codex 无。

### 关键文件

**codex**：`codex-rs/plugin/src/manifest.rs`、`codex-rs/plugin/src/load_outcome.rs`、`codex-rs/config/src/plugin_edit.rs`、`codex-rs/config/src/skills_config.rs`、`codex-rs/codex-mcp/src/lib.rs`、`codex-rs/hooks/src/lib.rs`、`codex-rs/core/config.schema.json`、`codex-rs/model-provider/src/provider.rs`

**grok-build**：`crates/codegen/xai-grok-plugin-marketplace/src/lib.rs`、`crates/codegen/xai-grok-plugin-marketplace/src/installer.rs`、`crates/codegen/xai-grok-agent/src/plugins/manifest.rs`、`crates/codegen/xai-grok-tools/src/implementations/skills/discovery.rs`、`crates/codegen/xai-grok-mcp/src/lib.rs`、`crates/codegen/xai-grok-hooks/src/lib.rs`、`crates/codegen/xai-acp-lib/src/lib.rs`

---

## 待深入确认项

### 沙箱
1. codex `network-proxy` 的 ProxyOnly 模式如何把流量桥回代理，以及域名策略与 bwrap `--unshare-net` 的配合细节。
2. grok-build `WebsitePolicy`（origin 级 allow/deny）是否真正在子进程层生效——seccomp 是全断网，未见按域名放行的实现路径。
3. codex 是否存在 PTY/终端仿真路径使某些场景支持交互命令。
4. grok-build Devbox profile 的 `/data` 写保护依赖 bwrap re-exec，与 nono Landlock 的叠加关系。

### 记忆
1. codex `TokenBudgetConfig` 的 `reminder_threshold_tokens`/`auto_compact_fallback_prompt` 默认是否在生产配置中开启。
2. grok-build `memory_flush_enabled` 的实际触发实现（agent crate 仅定义字段）。
3. grok-build 上下文窗口硬溢出（压缩后仍超限）的兜底丢弃策略。
4. codex 记忆是否完全无向量检索（仅文件+频次排序）。

### 模型交互
1. codex 的 `request_max_retries` / `stream_max_retries` 默认值是多少？
2. grok-build 是否计划支持 WebSocket 传输？
3. codex 的 Bedrock provider 是否也走 SSE，还是有专属流式解析路径？
4. 两者多轮工具循环的终止条件（最大轮数/doom-loop 检测）具体阈值差异。

### 可扩展性
1. codex 的 marketplace 概念（`marketplace_edit.rs`）是否有实际的远程市场，还是仅本地 git 源？
2. grok-build 的 ACP 协议是否对外开放供第三方编辑器集成，还是仅内部使用？
3. 两者 hooks 系统的实际执行性能与可靠性对比。
