# 阶段性结论

## 结论 -5：三方工程哲学根本分野（来自 codex/grok-build/opencode 三方对比）

| | Codex | Grok-build | Opencode |
|---|---|---|---|
| **定位** | OpenAI 官方 Rust，「单一工具做精」 | XAI 内部，「移植拼装 + 加密闭源」 | 社区开源 TS，「多 provider + 声明式 UI」 |
| **编辑哲学** | 极简：唯一 apply_patch，freeform 非 JSON，流式 | 折中：三套并存（移植 codex + 移植 opencode + 自研），JSON | 迭代：V1 完整 → V2 精简，JSON |
| **可见性** | 明文 prompt + 明文规则 | 加密 prompt + 无规则 | 明文 prompt + 详尽规则 |
| **重试/容错** | 可配置，平衡 | 最激进（15 次 + doom-loop） | 几乎不重试（默认 0） |
| **TUI** | 自研 flex + fork ratatui | 上游 ratatui 原生 | 自研 @opentui（SolidJS） |
| **AI 协作** | 命令式硬约束（行数/token 限制） | 无规则层 | 术语表 + 架构不变量 |

**关键发现**：grok-build 是 codex 与 opencode 的「功能移植中转站」——同时移植 codex 的 apply_patch（保留解析+4 级模糊匹配，剥离 I/O/沙箱/流式）与 opencode 的 edit/write（仅保留精确替换骨架，删除 BOM/格式化/LSP/模糊匹配）。grok-build 的 apply_patch_template 也直接复用 codex 模板。

---

## 结论 -4：AI 友好性——codex 有详尽 AGENTS.md，grok-build 把规则做进产品但没给自己写（来自 AI 友好性对比）

| 维度 | codex | grok-build |
|---|---|---|
| AI 规则文件 | ✅ 22KB AGENTS.md（编码规范/测试/架构边界/上下文注入硬规则/变更规模限制） | ❌ 无任何 AI 规则文件 |
| 规则可执行性 | 带 `just` 命令、行数限制（<500 LoC）、token 限制（<10K），AI 可验证合规 | 靠 README 表 + clippy.toml 注释间接引导，无显式规则 |
| 配置 schema | 5732 行 JSON Schema（自动生成） | 主配置无 schema |
| 测试指引 | AGENTS.md 明确"改 tui 跑 tui、改 core 跑全量" | 无"改 X 必跑 Y"映射 |
| 产品端规则支持 | 读取项目 AGENTS.md | 内建扫描多 vendor 目录（.grok/.claude/.cursor/rules） |

**启示**：codex 是"AI 友好性"的标杆——一份详尽、可执行、带工程化约束的 AGENTS.md 让 AI 几乎能"无师自通"。grok-build 产品端对用户项目的 AI 规则支持更好，但自身仓库缺乏自描述（可能是从内部 monorepo 同步，内部有未公开的规则体系）。

---

## 结论 -3：能力边界与工程化是维度 9-10 最大的差异点（来自维度 9-10 对比）

| 维度 | codex | grok-build |
|---|---|---|
| **能力架构** | 模型原生能力 + ext/ 扩展混合 | 显式工具集全注册 |
| **能力宽度** | 无 workflow/scheduler/浏览器工具 | 有 workflow/scheduler/BrowserUse/记忆检索工具 |
| **多模态** | 无视频 | 有 video_gen，产物落盘 |
| **构建系统** | Bazel + Cargo 双轨 | 纯 Cargo workspace |
| **配置校验** | 5732 行 JSON Schema | 无 schema，多层 TOML + 签名策略 |
| **可观测** | OTel 一体化 + 本地 rollout-trace（不上传） | Mixpanel + Sentry + OTel/fastrace 三栈分立 |
| **崩溃恢复** | 无信号级 crash handler | 专用 xai-crash-handler（SIGSEGV 捕获 + 报告归档） |
| **CI** | 20+ GitHub Actions | 此快照无 .github/ |

**启示**：grok-build 能力边界更宽（工作流/调度/浏览器/记忆检索）、工程化更偏产品化（Mixpanel/Sentry/crash-handler）；codex 更偏基础设施（Bazel/JSON Schema/OTel），能力扩展依赖模型原生能力 + ext/ 插件。

---

## 结论 -2：沙箱粒度与记忆技术栈是维度 5-8 最大的差异点（来自维度 5-8 对比）

| 维度 | codex | grok-build |
|---|---|---|
| **沙箱粒度** | 每条命令起独立 bwrap 命名空间（粒度=单命令） | nono 在进程级一次性装 Landlock/Seatbelt（粒度=整个 agent 进程） |
| **网络控制** | `--unshare-net` 断网 + MITM 代理做域名级 Allow/Deny/Ask | seccomp 在子进程 pre_exec 一刀切断网 |
| **交互命令** | ❌ 无 PTY | ✅ PTY + alacritty_terminal 仿真，支持 vim/top |
| **长期记忆** | 文件记忆（state DB + git + 频次排序，无向量） | 向量+FTS 混合检索（SQLite-vec + BM25 + 时间衰减 + MMR）+ dream |
| **压缩阈值** | 90%（硬编码） | 85%（可配） |
| **压缩策略** | tail-keep（保留最近+summary） | full-replace（全量重建，9 段结构化 prompt） |
| **流式传输** | SSE + WebSocket 双轨 | 仅 SSE |
| **后端协议** | Responses API 为主 + Bedrock | Chat/Responses/Messages 三种 |
| **配置校验** | 5732 行 JSON Schema 强校验 | 无集中 schema，靠 validation.rs |
| **编辑器集成** | ❌ 无 | ✅ 完整 ACP 协议 + LSP |

**启示**：codex 的沙箱更细粒度（单命令隔离）、网络控制更灵活（域名级放行）；grok-build 的记忆系统更先进（向量检索 + dream）、可扩展性更完整（marketplace + ACP）。两者在"安全隔离"与"智能记忆/生态"上各有侧重。

---

## 结论 -1：TUI 框架同源但工程哲学分野（来自 TUI 对比）

两者都用 **ratatui 0.29 + crossterm**，渲染策略也一致（立即模式 + 双 buffer diff + SynchronizedUpdate），但工程路线完全不同：

| 维度 | codex | grok-build |
|---|---|---|
| 框架 | 维护 **两个 git fork**（nornagon/ratatui + nornagon/crossterm） | 用上游版本，定制逻辑抽到独立 crate |
| 布局 | 自研 **Flutter 式 flexbox**（FlexRenderable） | ratatui 原生 Layout/Constraint |
| 状态 | `App` struct **直接 mutate** | **Elm 式纯函数 reducer**（Action→dispatch→Effect） |
| 视口 | 内联视口 + 终端原生 scrollback | 虚拟视口 + sticky header + Fullscreen/Minimal 双模式 |
| 输入 | `select!` 内直接消费 EventStream | **独立线程读输入** + 防流式饿死输入 |

**启示**：codex 走"深度 fork + 自研"路线，grok-build 走"上游 + 分层 crate"路线。后者的 `xai-ratatui-inline`、`xai-grok-pager-render` 等自研 crate 有通用复用价值；前者的 fork 维护成本与漂移风险值得关注。

---

## 结论 0：架构哲学分野贯穿各维度（来自维度 1-4 对比）

- **codex**：细粒度拆分（~90 crate）+ 单一范式 + 极简实现。单 apply_patch、自研轻量模板（仅 `{{ var }}`）、按轮动态工具计划、per-tool 并行标志。
- **grok-build**：核心集中（~60 crate 但逻辑在单一大 crate）+ 多范式并存 + 功能完备。多套编辑工具、MiniJinja 完整模板语法、静态注册 + tool pack、FuturesUnordered 全并发。

**依据**：维度 1（架构）、维度 3（工具）、维度 4（编辑）的设计要点对比表。

---

## 结论 0.1：多客户端共享状态是最根本的架构差异

- grok-build 有显式 **single-leader-per-machine**，leader 持有共享 MvpAgent，多客户端经 `~/.grok/leader.sock` 以 ACP 接入。
- codex app-server 为每连接建独立 session，不跨客户端共享 agent 状态。

**启示**：这决定了两者的使用场景——grok-build 适合"IDE + CLI + headless 共享同一 agent 上下文"，codex 适合"每个连接独立"。

---

## 结论 0.2：Prompt 在「安全/混淆」与「灵活性」上取向相反

- codex：全明文 + 仅变量替换（易审计、难动态）。
- grok-build：XOR 混淆 + Zeroize 清零 + MiniJinja 完整语法 + 动态工具名注入（难审计、易动态）。

**启示**：grok-build 的 XOR 种子硬编码在仓库内，混淆强度有限，仅防 `strings` 可见，非安全边界。

---

## 结论 0.3：编辑工具的"暴露/形态/兼容"三维度哲学分歧（来自维度 4 深入）

| 维度 | codex | grok-build |
|---|---|---|
| **工具暴露** | 按模型能力 (`apply_patch_tool_type`) 每 turn 条件注册 | 按 agent profile 会话级锁定唯一编辑工具（ToolKind 去重） |
| **工具形态** | `ToolSpec::Freeform` + lark 语法文本补丁（非 JSON） | 标准 JSON schema 工具（apply_patch/search_replace/edit/write） |
| **兼容性** | shell 中 `intercept_apply_patch` 静默拦截，无 flag 无 deprecation | 无兼容层，调错就报错 |
| **Edit/Write** | 单一 apply_patch，靠 patch 格式区分局部/整文件 | 显式 `ToolKind::Edit` vs `ToolKind::Write` 分离 |
| **引导方式** | runtime 工程（拦截 + ImplicitInvocation 错误纠正） | prompt 工程（模板硬编码工具名 + 动态解析） |

**启示**：codex 把"补丁语法"塞进工具定义本身，靠 runtime 兜底；grok-build 把"编辑语义"塞进 JSON 参数，靠 prompt 引导。两种范式的实际工程代价（模型输出格式错误率）值得实测对比。

---

## 结论 1：两个项目的工程哲学截然不同

- **codex**：自研为主、单一范式（apply_patch）、多后端中立、prompt 明文可读。设计取向是"可审计、可移植、聚焦编码"。
- **grok-build**：博采众长（移植 codex + opencode 工具）、多编辑范式并存、绑定 xAI 生态、prompt 加密、能力外溢到多模态/计划/工作流。设计取向是"功能全、体验优先、深度整合"。

**依据**：工具来源（`codex` 全自研 vs `grok-build` implementations/{codex,opencode,grok_build}）、prompt 存储（明文 md vs XOR 加密）、能力边界（纯编码 vs 多模态+计划模式）。

---

## 结论 2：Prompt 透明度是一个被低估的设计维度

- codex 的 system prompt 全部以 markdown 明文存于 `codex-rs/prompts/templates/`，可直接 diff、审计、fork 修改。
- grok-build 的核心 system prompt 用 XOR 加密存于 `prompt_encrypted.rs`，运行时解密，外部无法直接阅读或修改。

**启示**：后续对比时，"prompt 是否可审计/可定制"应作为独立维度，而非只看 prompt 内容本身。

---

## 结论 3：记忆系统的复杂度差异巨大

- codex：`memories/` crate，机制相对轻量。
- grok-build：`xai-grok-memory/` 完整向量检索栈（embedding / index / MMR / query_expansion / dream 离线整理）。

**启示**：对比"上下文与记忆"维度时，不能只问"有没有长期记忆"，要问"记忆的检索/排序/更新策略是什么"。

---

## 结论 4：两边都没有自带 agent benchmark

- codex 仅有 `cli/e2e_benches/codex_help.rs`（CLI 帮助基准）和 rollout trace。
- grok-build 仅有各 crate 的 `tests/` 和 `benches/`（性能基准）。

**启示**：能力对比需依赖外部 benchmark（如 SWE-bench）或自行设计评测，不能直接复用项目自带脚本。
