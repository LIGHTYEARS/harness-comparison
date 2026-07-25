# 维度 11：AI 友好性 — 项目如何管理上下文让 AI 规范工作

> 由两个 Explore agent 并行调查 codex 与 grok-build 的 AI 上下文管理机制后合成。

## 顶部摘要

| # | 核心发现 |
|---|---|
| 1 | **codex 有一份 22KB 的详尽 AGENTS.md 作为"AI 宪法"**，覆盖编码规范、测试规则、架构边界、上下文注入硬规则、PR 规模限制；grok-build **自身仓库没有任何 AI 规则文件**（AGENTS.md/CLAUDE.md 等全无） |
| 2 | **grok-build 把 AI 规则机制做进了产品**（内建扫描 AGENTS.md/CLAUDE.md/.grok/rules/ 等），但**没给自己的仓库写规则**；codex 给自己写了详尽规则，但产品端对 AGENTS.md 的支持相对简单 |
| 3 | **codex 的规则具体可执行**（带 `just` 命令、文件路径、行数限制）；grok-build 靠 README 的 crate 职责表 + clippy.toml/.cargo/config.toml 的详尽注释间接引导 |
| 4 | **codex 有 5732 行自动生成的 config.schema.json** 帮 AI 理解配置；grok-build 主配置无 JSON schema |
| 5 | **两者都不接受外部 PR**，但 codex 的贡献指南仍给出了完整的受邀 PR 流程；grok-build 的 CONTRIBUTING.md 仅 20 行 |

---

## 设计要点对比

| 维度 | codex | grok-build |
|---|---|---|
| **AI 规则文件** | ✅ `AGENTS.md`（22KB，详尽）：Rust 编码规范、测试规则、模块大小约束（<500 LoC）、上下文注入硬规则（<10K tokens）、变更规模限制（≤800 行）、禁止事项、TUI 样式约定、app-server API 规范 | ❌ 无 AGENTS.md/CLAUDE.md/.cursorrules/.github/copilot-instructions.md |
| **贡献指南** | `docs/contributing.md`：外部贡献仅受邀，但给出完整流程（建分支、加测试、原子提交、跑 `just fmt`/`just fix`/测试、PR 模板） | `CONTRIBUTING.md`（20 行）：明确不接受外部 PR/补丁，仅源码透明 + 本地构建 |
| **命令入口** | `justfile`（`just help` 列出所有 recipe：fmt/fix/test/clippy/bench/write-config-schema/argument-comment-lint 等） | README 的 Development 小节：`cargo check -p <crate>`、`cargo test -p <crate>`、`cargo clippy -p <crate>`、`cargo fmt --all` |
| **架构文档** | 无统一 ARCHITECTURE.md；分散在 `codex-rs/docs/protocol_v1.md`（核心术语）、各 crate README | 无 ARCHITECTURE.md；README 的 Repository layout 表列 crate 职责；`xai-grok-pager/README.md` 有 Architecture 小节（目录树 + Elm 风格 Action/Effect 概念） |
| **代码组织** | ~100 crate，`codex-` 前缀，按职责拆分；AGENTS.md 明确"resist adding code to codex-core" | ~65 crate，`xai-grok-*` 前缀，按 `codegen/common/build/prod` 分层；根 Cargo.toml 自动生成（只读警告） |
| **测试结构** | 单元测试用 `*_tests.rs` 兄弟文件；集成测试在 `core/tests/suite/`；UI 用 insta snapshot；AGENTS.md 给分层指引（改 tui 跑 tui、改 core 跑全量） | 按 crate 组织，`xai-grok-shell/tests/`（30+ 集成）、场景测试用 YAML；运行指引仅一句 `cargo test -p <crate>`，无"改 X 必跑 Y"映射 |
| **代码规范** | `clippy.toml`（禁特定 Color/Stylize 方法）、`rustfmt.toml`（2024 edition）、`deny.toml`（许可证白名单、禁 async-trait）、**自定义 `argument-comment-lint`**（Dylint，要求位置参数写注释） | `clippy.toml`（注释极详尽，解释为什么禁 canonicalize 等）、`rustfmt.toml`（仅一行）、`.cargo/config.toml`（每段注释说明 rustflags 用途含安全加固） |
| **配置 schema** | ✅ `config.schema.json`（5732 行，schemars 自动生成，带 description） | ⚠️ 仅 `tool_meta.schema.json`（工具元数据契约）；**主 config.toml 无 JSON schema** |
| **内联文档** | 关键模块有 `//!` doc comment；几乎每个 crate 有 README 说明职责 | 关键 crate 有 `//!` doc comment；`clippy.toml`/`.cargo/config.toml` 注释质量高（"配置即文档"） |
| **示例与模板** | `core/templates/`（模型指令/agent 编排模板）、`thread-manager-sample/`（嵌入示例）、`.codex/skills/`（活样板） | `xai-grok-hooks/examples/`（hook 示例+安装说明）、`xai-grok-agent/templates/`（prompt 模板）、各 crate examples/ |
| **产品端 AI 规则支持** | 读取项目 AGENTS.md（`core/src/agents_md.rs`，从 project root 向 cwd 逐级收集） | **内建扫描**：`Agents.md`/`Claude.md`/`CLAUDE.md`/`AGENTS.md` + `.grok/rules/`/`.claude/rules/`/`.cursor/rules/`（`12-project-rules.md` 详细说明） |

---

## 核心差异

1. **规则哲学**：codex 是"我给自己写了详尽规则，AI 照着做就行"；grok-build 是"我做了规则引擎让用户给项目写规则，但我自己的仓库没写"。
2. **规则可执行性**：codex 的 AGENTS.md 带具体命令（`just test -p codex-tui`）、行数限制（<500 LoC）、token 限制（<10K），AI 可直接验证合规；grok-build 无显式规则，AI 需从 clippy.toml 注释、README 表中自行推断。
3. **上下文注入约束**：codex 把"如何规范地往 LLM 上下文里塞东西"写成硬规则（有界、<10K tokens、>1K 需 P0 review、必须实现 `ContextualUserFragment`）——这本身就是 AI 上下文管理的最佳实践示范；grok-build 无此类约束文档。
4. **配置可理解性**：codex 有 5732 行 JSON Schema，AI 可直接读它理解 config.toml；grok-build 主配置无 schema，AI 需读 Rust 类型或用户文档。
5. **测试指引**：codex AGENTS.md 明确"改 tui 跑 tui 测试、改 core/common/protocol 跑全量"；grok-build 无此映射，AI 改完代码不知道该跑哪些测试。
6. **架构可发现性**：codex 架构分散在多 crate README，需自行拼接；grok-build README 的 crate 职责表 + pager README 的架构小节更集中。
7. **产品端**：grok-build 的 AI 规则扫描机制（多 vendor 目录兼容）比 codex 更完善，是其产品优势。

---

## 关键文件

**codex**：`AGENTS.md`、`docs/contributing.md`、`justfile`、`codex-rs/core/config.schema.json`、`codex-rs/clippy.toml`、`codex-rs/deny.toml`、`tools/argument-comment-lint/`、`codex-rs/core/src/agents_md.rs`

**grok-build**：`README.md`（Repository layout + Development）、`CONTRIBUTING.md`、`crates/codegen/xai-grok-pager/README.md`（Architecture）、`clippy.toml`、`.cargo/config.toml`、`crates/codegen/xai-grok-pager/docs/user-guide/12-project-rules.md`、`crates/codegen/xai-grok-tools/schema/tool_meta.schema.json`

---

## 启示

- **codex 是"AI 友好性"的标杆**：一份详尽、可执行、带工程化约束的 AGENTS.md + 自动生成的 schema + 自定义 lint，让 AI 几乎能"无师自通"地规范贡献。
- **grok-build 的"AI 友好性"分裂**：产品端对用户项目的 AI 规则支持极好（内建多 vendor 扫描），但自身仓库缺乏自描述——这可能是因为它从内部 monorepo 同步（`SOURCE_REV` 记录 commit SHA），内部有另一套 AI 规则体系未公开。
- **给 AI 编码项目的建议**：如果想让 AI 在你的仓库里规范工作，codex 的 AGENTS.md 结构值得借鉴——具体可执行的规则 > 泛泛的"请写好代码"。

---

## 待深入确认项

1. grok-build 内部 monorepo 是否有未公开的 AGENTS.md/AI 规则（此快照是从内部同步的）？
2. codex 的 `argument-comment-lint` 在 CI 中是 warn 还是 deny？实际执行力度如何？
3. grok-build 的 `tool_meta.schema.json` 是否覆盖了所有工具，还是仅部分？
4. codex AGENTS.md 中的"模型可见上下文"硬规则（<10K tokens、>1K 需 P0 review）实际执行力度——是 CI 校验还是人工 review？
5. 两者对"AI 改了代码后如何验证"的指引差距，是否影响实际 AI 贡献质量？
