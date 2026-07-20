#!/usr/bin/env bash

set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

REPO_DIR="${BLOG_DIR:-$HOME/HUGO}"
LOG_FILE="${HUGO_SYNC_LOG:-/tmp/hugo-sync.log}"

git_push() {
  git -c core.sshCommand="ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2" push origin main
}

run_sync() {
  echo "== Hugo sync started at $(date '+%Y-%m-%d %H:%M:%S') =="

  cd "$REPO_DIR" || {
    echo "找不到文件夹：$REPO_DIR"
    return 1
  }

  current_branch="$(git branch --show-current)"
  if [ "$current_branch" != "main" ]; then
    echo "当前分支是 $current_branch，请先切换到 main"
    return 1
  fi

  if ! command -v hugo >/dev/null 2>&1; then
    echo "找不到 hugo 命令"
    return 1
  fi

  echo "正在构建 Hugo..."
  hugo || return 1

  echo "正在检查变更..."
  git add .

  if git diff --cached --quiet; then
    echo "没有需要提交的变更"
    echo "正在确认远端同步状态..."
    git_push || return 1
    return 0
  fi

  commit_message="update $(date '+%Y-%m-%d %H:%M')"
  echo "正在提交：$commit_message"
  git commit -m "$commit_message" || return 1

  echo "正在推送到远端..."
  git_push || return 1
}

run_sync > "$LOG_FILE" 2>&1
status=$?
echo "== Hugo sync finished at $(date '+%Y-%m-%d %H:%M:%S') with status $status ==" >> "$LOG_FILE"

if [ "$status" -eq 0 ]; then
  echo "Hugo 同步成功 ✓"
else
  echo "同步失败 ✗ (请检查 $LOG_FILE)"
fi

exit "$status"
