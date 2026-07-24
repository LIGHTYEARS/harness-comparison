# 阶段性结论

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
