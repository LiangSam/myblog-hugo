#!/bin/zsh

# 新建博客文章：Blog Draft / Blog Post 两个 LaunchBar 动作共用。
# NEW_BLOG_DIR 指定存放文件夹，NEW_BLOG_DRAFT=true 时写成草稿。
set -eu

blog_dir="${NEW_BLOG_DIR:-/Users/bob/Developer/projects/blog/content/blog}"
today="$(date +%Y-%m-%d)"
draft="${NEW_BLOG_DRAFT:-false}"
requested_title="${1:-}"
post_title="$(printf '%s' "$requested_title" | tr '\r\n' '  ' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/[[:space:]]+/ /g')"
filename_title="$(printf '%s' "$post_title" | sed -E 's#[/:]#-#g')"

if [[ -n "$filename_title" ]]; then
  post_path="${blog_dir}/${today}-${filename_title}.md"
  yaml_title="$(printf '%s' "$post_title" | sed "s/'/''/g")"
  title_line="title: '${yaml_title}'"
else
  post_path="${blog_dir}/${today}.md"
  title_line='title: '
fi

mkdir -p "$blog_dir"

if [[ ! -e "$post_path" ]]; then
  printf '%s\n' \
    '---' \
    "$title_line" \
    "date: ${today}" \
    'tags:' \
    '  - ' \
    'slug: ' \
    'author:' \
    '  - 梁某银' \
    "draft: ${draft}" \
    'featured: false' \
    'description: ' \
    '---' \
    '' > "$post_path"
fi

if [[ "${NEW_BLOG_SKIP_OPEN:-0}" != "1" ]]; then
  open -a CotEditor "$post_path"
fi

printf '%s\n' "$post_path"
