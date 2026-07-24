# agents/

被分析的 AI Coding Agent 源码放在这里，每个项目一个子目录，使用 git submodule 引入。

## 添加新项目

```bash
cd agents
git submodule add <repo-url> <name>
# 例如：
# git submodule add https://github.com/All-Hands-AI/OpenHands.git open-hands
```

添加后：
1. 回到仓库根目录 `cd ..`
2. 在 `README.md` 的"已纳入分析"表格补一行，记录锁定的 commit
3. 在 `docs/comparison-matrix.md` 中开始填充该项目的各维度信息
