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

## 对比维度

1. **架构模式** — 单 Agent / 多 Agent / 工作流编排
2. **Prompt 工程** — system prompt 结构、few-shot、动态注入
3. **工具系统** — 工具定义格式、调用方式、错误处理
4. **上下文管理** — token 预算、截断策略、长期记忆
5. **代码行动** — edit / apply patch、文件读写、命令执行
6. **评测** — benchmark、成功标准、可复现性
7. **可扩展性** — 插件机制、自定义模型 / 工具

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
