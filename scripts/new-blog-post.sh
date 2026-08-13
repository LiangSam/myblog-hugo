#!/bin/zsh

set -eu

blog_dir="${NEW_BLOG_DIR:-/Users/bob/HUGO/content/blog}"
today="$(date +%Y-%m-%d)"
requested_title="${1:-}"
filename_title="$(printf '%s' "$requested_title" | tr '\r\n' '  ' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s#[/:]#-#g; s/[[:space:]]+/ /g')"

if [[ -n "$filename_title" ]]; then
  post_path="${blog_dir}/${today}-${filename_title}.md"
else
  post_path="${blog_dir}/${today}.md"
fi

mkdir -p "$blog_dir"

if [[ ! -e "$post_path" ]]; then
  printf '%s\n' \
    '---' \
    'title: ' \
    "date: ${today}" \
    'tags:' \
    '  - ' \
    'slug: ' \
    'author:' \
    '  - 梁某银' \
    'draft: false' \
    'featured: false' \
    'description: ' \
    '---' \
    '' > "$post_path"
fi

if [[ "${NEW_BLOG_SKIP_OPEN:-0}" != "1" ]]; then
  open -a CotEditor "$post_path"
fi

printf '%s\n' "$post_path"
