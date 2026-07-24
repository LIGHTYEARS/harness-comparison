# codex vs grok-build 对比报告（维度 1-4）

> 由 workflow `compare-dimensions-1-4` 生成：4 个分析 agent 并行探索 + 1 个汇总 agent 合成。

## 顶部摘要

| # | 跨维度结论 | 影响维度 |
|---|-----------|---------|
| 1 | **架构哲学分野**：codex 细粒度拆分（~90 crate）+ 单一范式 + 极简实现；grok-build 核心集中（~60 crate 但逻辑在单一大 crate）+ 多范式并存 + 功能完备 | 架构、工具、编辑 |
| 2 | **共享状态模型根本不同**：grok-build 有显式 single-leader-per-machine，leader 持有共享 agent 状态；codex 每连接独立 session，不跨客户端共享 | 架构 |
| 3 | **Prompt 安全/灵活性取向相反**：codex 全明文 + 仅变量替换；grok-build XOR 混淆 + Zeroize + MiniJinja 完整语法 + 动态工具注入 | Prompt |
| 4 | **编辑范式差异显著**：codex 单一 freeform apply_patch（流式 + shell 拦截）；grok-build 四套编辑工具 + LSP 反馈闭环（无流式、无拦截） | 编辑 |
| 5 | **工具注册与并发模型不同**：codex 按轮动态计划 + per-tool 并行标志；grok-build 静态集中注册 + tool pack + FuturesUnordered 全并发 | 工具 |

---

## 1. 架构与组织

### 设计要点对比

| 维度 | codex | grok-build |
|------|-------|-----------|
| crate 划分 | ~90 个细粒度 crate，边界清晰，核心在 codex-core | ~60 个 crate，核心逻辑集中在 xai-grok-shell 单一大 crate（src/session 下 90+ 文件） |
| 主循环 | `submission_loop` 单通道顺序 dispatch Op（UserInput/Interrupt/ExecApproval） | `run_session` actor loop，`select!` 跨 cmd_rx/chat_state_event_rx/event_rx 多 channel 并发驱动 |
| 语言 | Rust 为主（~2741 .rs）+ TypeScript（645 .ts）+ Python（136 .py） | 纯 Rust（~2359 .rs），无 TS/Python 业务代码 |
| 运行时入口 | 分散在 cli/tui/app-server/mcp-server/exec 多 crate | 集中在 xai-grok-pager-bin 单 binary（run_stdio_agent/run_headless/run_leader） |
| 多客户端架构 | 无 leader/worker 分层，app-server 每连接建独立 session | 显式 single-leader-per-machine，leader 持有共享 MvpAgent，多客户端经 ~/.grok/leader.sock 以 ACP 接入 |
| stdio 语义 | app-server 的一种传输（single_client_mode，断开即退出） | run_stdio_agent 独立入口，可经 leader 与其他客户端共享同一 agent |

### 核心差异

- **模块化粒度**：codex 拆分细、边界清；grok-build 核心高度集中于单 crate。
- **并发模型**：codex 单通道顺序 dispatch；grok-build 多 channel select! 并发。
- **多语言**：codex Rust+TS+Python；grok-build 纯 Rust。
- **入口分散度**：codex 多 crate 分散；grok-build 单 binary 集中。
- **共享状态**：grok-build 有 leader 共享 agent 状态；codex 完全隔离。

### 关键文件路径

**codex**
- `codex-rs/core/src/session/handlers.rs`
- `codex-rs/core/src/session/mod.rs`
- `codex-rs/core/src/session/session.rs`
- `codex-rs/cli/src/main.rs`
- `codex-rs/tui/src/lib.rs`
- `codex-rs/app-server/src/lib.rs`
- `codex-rs/app-server-daemon/src/lib.rs`
- `codex-cli/bin/codex.js`
- `sdk/typescript`
- `sdk/python`

**grok-build**
- `crates/codegen/xai-grok-shell/src/session/acp_session_impl/run_loop.rs`
- `crates/codegen/xai-grok-shell/src/session/mod.rs`
- `crates/codegen/xai-grok-shell/src/leader/mod.rs`
- `crates/codegen/xai-grok-shell/src/leader/server.rs`
- `crates/codegen/xai-grok-shell/src/agent/app.rs`
- `crates/codegen/xai-grok-pager-bin/src/main.rs`
- `crates/codegen/xai-grok-shell/Cargo.toml`

---

## 2. Prompt 工程

### 设计要点对比

| 维度 | codex | grok-build |
|------|-------|-----------|
| 存储形式 | 全明文 markdown/txt/xml，编译期 `include_str!` 内嵌 | 核心 prompt 经 XOR（seed=[0x5A,0x7B,0x3D]）混淆为字节数组，运行期 `decrypt()` 解密，`Zeroizing<String>` 持有，drop 时清零 |
| 模板引擎 | 自研 `codex_utils_template::Template`，仅 `{{ var }}` 简单替换，无条件/循环 | MiniJinja，支持 `{{ var }}`、`{% if %}`、`{%- endif -%}` 等完整语法 |
| 动态注入 | 仅注入少量标量（personality、token 预算、network_access） | PromptContext + TemplateRenderer + ToolBridge 动态注入工具名映射（tools.by_kind.read 等）、模式标志（is_non_interactive）、身份标签（system_prompt_label），可按工具存在条件渲染段落 |
| AGENTS.md | 从 project root 向 cwd 逐级收集 AGENTS.md/AGENTS.override.md 并拼接 | 扫描 ~/.grok/rules、repo root、cwd 及 .claude/.cursor/.grok/rules 下 *.md，兼容多厂商规则目录 |
| compaction prompt | 仅一个 compact/prompt.md + summary_prefix.md | 多套独立模板：history（developer/user 双 prompt 强制一致）、intra_compaction、code_compaction |
| subagent prompt | 无独立 subagent prompt，复用主 prompt + multi_agent_mode_instructions 注入委派文本 | 专用加密 subagent_prompt.md 模板，从 xai_tool_types 引入 EXPLORE/PLAN/GENERAL_PURPOSE 三类子代理 prompt |
| COMPACT prompt | 明文模板文件 | template.rs 中明文常量 COMPACT_SYSTEM_PROMPT |

### 核心差异

- **存储安全**：codex 全明文；grok-build 混淆 + 内存清零（仅防 strings 可见，非安全边界）。
- **模板能力**：codex 极简变量替换；grok-build 完整模板语法 + 条件渲染。
- **动态注入深度**：codex 少量标量；grok-build 整套工具名 + 模式 + 身份标签。
- **规则目录兼容**：codex 仅 AGENTS.md；grok-build 兼容多厂商规则目录。
- **compaction/subagent**：grok-build 远更细分、有专用模板；codex 复用主 prompt。

### 关键文件路径

**codex**
- `codex-rs/prompts/src/lib.rs`
- `codex-rs/prompts/src/compact.rs`
- `codex-rs/prompts/src/goals.rs`
- `codex-rs/prompts/templates/compact/prompt.md`
- `codex-rs/prompts/templates/goals/continuation.md`
- `codex-rs/core/gpt-5.2-codex_prompt.md`
- `codex-rs/models-manager/prompt.md`
- `codex-rs/core/templates/model_instructions/gpt-5.2-codex_instructions_template.md`
- `codex-rs/core/src/agents_md.rs`
- `codex-rs/core/src/context/multi_agent_mode_instructions.rs`

**grok-build**
- `crates/codegen/xai-grok-agent/src/prompt/template.rs`
- `crates/codegen/xai-grok-agent/src/prompt/prompt_encrypted.rs`
- `crates/codegen/xai-grok-agent/src/prompt/context.rs`
- `crates/codegen/xai-grok-agent/src/prompt/agents_md.rs`
- `crates/codegen/xai-grok-agent/src/prompt/subagent_prompts.rs`
- `crates/codegen/xai-grok-agent/templates/prompt.md`
- `crates/codegen/xai-grok-agent/templates/subagent_prompt.md`
- `crates/codegen/xai-grok-agent/templates/apply_patch_prompt.md`
- `crates/codegen/xai-grok-agent/scripts/encrypt_templates.py`
- `crates/common/xai-grok-compaction/src/history/prompt.rs`
- `crates/common/xai-grok-compaction/src/templates/compaction_developer_prompt.txt`

---

## 3. 工具系统 (Tool System)

### 设计要点对比

| 维度 | codex | grok-build |
|------|-------|-----------|
| 工具来源 | 几乎全自研（仅 MCP/插件为外部） | 自研（grok_build）+ 移植 codex（apply_patch/list_dir/grep_files/read_file）+ 移植 opencode（bash/read/edit/write/grep/glob/todowrite/skill） |
| 注册机制 | 按轮动态计划：spec_plan.rs 的 add_tool_sources() 每轮根据 feature flag/环境/模型能力/MCP 把 handler 加入 PlannedTools，再经 router 分发 | 启动时静态集中注册（ToolRegistryBuilder，registry/types.rs L666-756）+ `register_tool_pack()` 全局扩展点 + 运行时 MCP 动态注册 |
| 协议层 | 自家 codex_protocol（ToolInvocation/ToolName/ToolPayload） | xai_tool_protocol（ToolId/ToolCallContext/ToolOutput）+ xai_tool_runtime::Tool trait（name/description/execute） |
| 动态工具搜索 | tool_search handler（内置搜索引擎索引 deferred 工具，模型按 query 检索） | search_tool（BM25 关键词搜索 MCP 工具）+ use_tool（按 id 调用搜到的工具） |
| 并行调用 | 每工具带 `supports_parallel_tool_calls()` 标志，parallel.rs 用 RwLock「并行执行门」串行化非并行工具 | execute_tool_calls 中用 FuturesUnordered 把所有 approved 调用并发执行，仅靠文件锁避免同文件写冲突 |
| 工具规模 | ~25 个模型可见工具（含多 agent 协作族） | 40+ 工具，分 grok_build/codex/opencode/memory/search 五组 |

### 核心差异

- **来源构成**：codex 纯自研；grok-build 自研 + 显式移植 codex/opencode 两套并存。
- **注册时机**：codex 按轮动态装配；grok-build 启动静态注册 + 扩展点 + 运行时 MCP。
- **协议层**：各自独立协议 crate。
- **并行控制**：codex per-tool 标志 + RwLock 门；grok-build 全并发 + 文件锁。
- **规模**：grok-build 工具数约为 codex 的 1.6 倍，分组更细。

### 关键文件路径

**codex**
- `codex-rs/core/src/tools/handlers/mod.rs`
- `codex-rs/core/src/tools/spec_plan.rs`
- `codex-rs/core/src/tools/registry.rs`
- `codex-rs/core/src/tools/router.rs`
- `codex-rs/core/src/tools/parallel.rs`
- `codex-rs/core/src/tools/handlers/tool_search.rs`
- `codex-rs/tools/src/tool_executor.rs`

**grok-build**
- `crates/codegen/xai-grok-tools/src/registry/types.rs`
- `crates/codegen/xai-grok-tools/src/implementations/mod.rs`
- `crates/common/xai-tool-runtime/src/tool.rs`
- `crates/codegen/xai-grok-tools/src/implementations/search_tool/mod.rs`
- `crates/codegen/xai-grok-shell/src/session/acp_session_impl/tool_calls.rs`
- `crates/codegen/xai-grok-tools/src/implementations/grok_build/bash/mod.rs`

---

## 4. 代码行动 / 文件编辑

### 设计要点对比

| 维度 | codex | grok-build |
|------|-------|-----------|
| 编辑范式 | 单一：apply_patch（freeform，lark 语法，模型输出 `*** Begin Patch...*** End Patch` 文本，不包 JSON） | 多套并存：codex::apply_patch（结构化 JSON {patch}）+ grok_build::search_replace（精确字符串替换，replace_all/unicode 回退）+ opencode::edit + opencode::write |
| 工具形态 | freeform 工具，仅在 model_info.apply_patch_tool_type 存在时注册 | 所有编辑工具同时注册，按 ToolKind（Edit/Write）区分 |
| 实现位置 | 独立 apply-patch crate（含可执行 apply_patch 二进制，可被 shell/exec 拦截调用） | 补丁引擎移植为纯库（无 I/O），I/O 留在 tool 层，无独立二进制 |
| 流式解析 | StreamingPatchParser 增量解析模型流出补丁，每 500ms 发 PatchApplyUpdated 进度事件（受 ApplyPatchStreamingEvents feature 控制） | 一次性 parse_patch 完整字符串，无流式补丁解析 |
| 错误处理 | 区分 ParseError/ComputeReplacements/IoError，返回 FunctionCallError 给模型，跟踪 AppliedPatchDelta（部分应用时 delta.exact=false） | 用输出变体（ParseError/ApplicationError/EmptyPatch）返回而非抛错，先在内存算完所有变更再写入，部分失败不落盘 |
| 与命令执行关系 | shell.rs/exec_command.rs 用 intercept_apply_patch 拦截命令行里的 apply_patch 调用，路由到补丁 runtime（不真正执行 shell），有 legacy 警告 | 编辑工具与 bash 完全独立，bash 不拦截任何编辑调用 |
| LSP 角色 | 无 LSP 编辑通路 | LSP 工具只读，但编辑工具写文件后通过 FileWritten 通知触发 LSP did_change 刷新诊断，形成编辑-反馈闭环 |

### 核心差异

- **范式数量**：codex 单一 apply_patch；grok-build 四套编辑工具 + LSP。
- **工具形态**：codex freeform 文本；grok-build 结构化 JSON。
- **实现形态**：codex 独立 crate + 二进制；grok-build 纯库无二进制。
- **流式**：codex 有流式解析 + 进度事件；grok-build 无。
- **错误语义**：codex 抛错给模型 + 部分应用 delta；grok-build 变体返回 + 全内存计算后原子写入。
- **shell 拦截**：codex 拦截 shell 中 apply_patch；grok-build 不拦截。
- **LSP 闭环**：grok-build 有编辑-诊断反馈；codex 无。

### 关键文件路径

**codex**
- `codex-rs/apply-patch/src/lib.rs`（apply_patch/apply_hunks 入口）
- `codex-rs/apply-patch/src/streaming_parser.rs`（StreamingPatchParser）
- `codex-rs/apply-patch/src/standalone_executable.rs`（apply_patch 二进制）
- `codex-rs/core/src/tools/handlers/apply_patch.rs`（ApplyPatchHandler + intercept_apply_patch）
- `codex-rs/core/src/tools/handlers/apply_patch_spec.rs`（create_apply_patch_freeform_tool + lark）
- `codex-rs/core/src/tools/runtimes/apply_patch.rs`（ApplyPatchRuntime）
- `codex-rs/core/src/apply_patch.rs`（安全评估 + 路由到 runtime）

**grok-build**
- `xai-grok-tools/src/implementations/codex/apply_patch/tool.rs`（ApplyPatchTool::run）
- `xai-grok-tools/src/implementations/codex/apply_patch/apply.rs`（derive_new_contents 纯函数）
- `xai-grok-tools/src/implementations/codex/apply_patch/parser.rs`（parse_patch）
- `xai-grok-tools/src/implementations/grok_build/search_replace/mod.rs`（run_search_replace）
- `xai-grok-tools/src/implementations/opencode/edit/mod.rs`（EditTool）
- `xai-grok-tools/src/implementations/opencode/write/mod.rs`（WriteTool）
- `xai-grok-tools/src/implementations/grok_build/lsp/mod.rs`（LspTool，只读）
- `xai-grok-tools/src/implementations/lsp/manager.rs`（notify_file_changed）

---

## 待深入确认项

### 架构与组织
1. codex app-server 的 daemon 模式是否在多连接间共享任何状态（如 thread-store），还是完全每连接隔离？
2. grok-build 的 run_headless 与 run_leader 的关系：headless 是直连 agent 还是也走 leader IPC？
3. codex 的 codex-cli（JS 包装器）与 Rust cli 的职责划分。
4. grok-build session actor 与 leader server 的进程边界。

### Prompt 工程
1. codex 是否存在未发现的 subagent 专用 prompt？
2. grok-build 的 XOR 种子硬编码，是否有生产环境下的额外加密/签名机制？
3. grok-build PromptContext 中注入变量的完整来源与作用域。

### 工具系统
1. codex 的 tool_search 与 grok-build 的 search_tool 在「deferred 工具暴露」策略上是否等价？
2. grok-build 对并行调用是否有「非并行工具」白名单/黑名单？
3. grok-build 的 use_tool 与 codex 的 MCP 动态工具调用路径是否共享同一调度器？

### 代码行动 / 文件编辑
1. grok-build 的 apply_patch 与 search_replace/edit 在实际 prompt/模型选择中如何取舍？
2. codex 的 apply_patch_tool_type 具体有哪些取值？
3. grok-build 是否计划为 apply_patch 增加流式解析？
4. codex 拦截 shell 中 apply_patch 的行为在新版是否仍保留？
