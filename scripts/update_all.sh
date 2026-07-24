#!/usr/bin/env bash
# 批量更新所有 agent submodule 到各自远端的最新提交
# 注意：更新后请在 docs/comparison-matrix.md 中记录新的 commit
set -e
cd "$(dirname "$0")/.."
git submodule update --remote --recursive
echo "✅ 所有 agent 已更新到最新。请检查 git diff 并提交。"
