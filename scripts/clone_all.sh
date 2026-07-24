#!/usr/bin/env bash
# 拉取所有 agent submodule（首次克隆后执行）
set -e
cd "$(dirname "$0")/.."
git submodule update --init --recursive
echo "✅ 所有 agent 源码已拉取到 agents/"
