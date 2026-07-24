# harness-comparison

对比分析主流开源 AI Coding Agent 的源码，聚焦架构、Prompt 工程、工具调用、上下文管理、评测等维度，沉淀可复用的设计模式与权衡取舍。

## 仓库结构

```
harness-comparison/
├── agents/          # 被分析的项目源码（git submodule）
├── analysis/        # 分析产物（按维度分目录）
│   ├── architecture/   # 架构图、模块划分
│   ├── prompt/         # system prompt 对比
│   ├── tool-use/       # 工具调用机制
│   ├── memory/         # 上下文 / 记忆策略
│   └── eval/           # 评测方法与结果
├── scripts/         # 自动化脚本（拉取、更新、抽取）
└── docs/            # 对比矩阵、阶段性结论
```

## 已纳入分析

| 项目 | 版本 / Commit | 主要语言 | 许可证 | 备注 |
|------|---------------|----------|--------|------|
| [codex](https://github.com/openai/codex) | `81da9deb06` | Rust / TypeScript | Apache-2.0 | OpenAI 官方 CLI Agent |
| [grok-build](https://github.com/xai-org/grok-build) | `69f0ba880a` | Rust | 专有（SpaceXAI） | xAI 官方 CLI Agent |

## 对比维度（10 个，详见 `docs/comparison-matrix.md`）

1. **架构与组织** — crate 划分、主循环、多入口
2. **Prompt 工程** — 存储形式、模板、动态注入、AGENTS.md
3. **工具系统** — 来源（自研/移植）、注册、协议层、动态搜索、并行
4. **代码行动** — 编辑范式（patch / search_replace / LSP）、流式
5. **命令执行与沙箱** — shell 工具、沙箱技术、网络策略、权限
6. **上下文与记忆** — 历史、compaction、长期记忆、dream
7. **模型交互** — 后端、streaming、切模型、重试
8. **可扩展性** — 插件、skills、MCP、hooks、配置、编辑器协议
9. **能力边界** — 多模态、计划模式、工作流、子代理、web 搜索
10. **工程化与可观测** — 构建、schema、benchmark、tracing、TUI

## 快速开始

```bash
# 克隆本仓库 + 所有 submodule
git clone --recursive <repo-url>

# 或克隆后拉取 submodule
git submodule update --init --recursive

# 批量更新所有 agent 到最新
./scripts/update_all.sh
```

## 如何新增一个分析对象

1. `cd agents && git submodule add <repo-url> <name>`
2. 在上方"已纳入分析"表格补一行，记录锁定的 commit
3. 按维度在 `analysis/` 下补充笔记
4. 有共性结论时更新 `docs/comparison-matrix.md`
