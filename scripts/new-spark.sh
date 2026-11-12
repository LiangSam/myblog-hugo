#!/bin/zsh

# 新建一条 Sparks：LaunchBar 的 Sparks 动作调用。
# 带文字：直接写成一条 Sparks，只提交这一个文件并推送上线。
# 不带文字：建好空文件用 CotEditor 打开，写完再用 Hugo Sync 发布。
set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

repo_dir="${BLOG_DIR:-/Users/bob/Developer/projects/blog}"
notes_dir="$repo_dir/content/notes"
log_file="${SPARK_LOG:-/tmp/new-spark.log}"

text="$(printf '%s' "${1:-}" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"

# 北京时间，和博客的时区一致
today="$(TZ=Asia/Shanghai date +%Y-%m-%d)"
stamp="$(TZ=Asia/Shanghai date +%Y-%m-%dT%H:%M:%S+08:00)"

# 同一天已经有了就往后编号：2026-11-12.md、2026-11-12-2.md……
note_path="$notes_dir/$today.md"
n=2
while [[ -e "$note_path" ]]; do
  note_path="$notes_dir/$today-$n.md"
  n=$((n + 1))
done

mkdir -p "$notes_dir"
printf '%s\n' '+++' "date = $stamp" '+++' '' > "$note_path"

if [[ -z "$text" ]]; then
  open -a CotEditor "$note_path"
  printf '%s\n' "$note_path"
  exit 0
fi

printf '%s\n' "$text" >> "$note_path"

publish() {
  cd "$repo_dir" || return 1
  if [[ "$(git branch --show-current)" != "main" ]]; then
    echo "当前分支不是 main"
    return 1
  fi
  rel="${note_path#$repo_dir/}"
  git add -- "$rel" || return 1
  # 只提交这一条，工作区里别的改动不跟着上线
  git commit -m "Spark $today" -- "$rel" || return 1
  git -c core.sshCommand="ssh -o ProxyCommand=none -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2" push origin main
}

if publish > "$log_file" 2>&1; then
  echo "Sparks 已发布 ✓"
else
  echo "已保存，但发布失败 ✗（见 $log_file）"
  exit 1
fi
