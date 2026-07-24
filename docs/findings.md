# 阶段性结论

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
