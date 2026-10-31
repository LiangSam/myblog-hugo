#!/bin/zsh
# Blog Images：上传 Markdown 里的本地图片，替换成图床链接。
# 直接运行：处理 CotEditor 最前面的文档（先保存）；也可以把 .md 文件拖给它。

PICUP="/Users/bob/Developer/projects/blog/scripts/picup.py"

notify() { osascript -e "display notification \"$2\" with title \"Blog Images\" subtitle \"$1\""; }

files=("$@")
if (( ${#files} == 0 )); then
  doc=$(osascript <<'AS' 2>/dev/null
tell application "System Events" to set isOpen to (exists process "CotEditor")
if not isOpen then return ""
tell application "CotEditor"
  if (count documents) is 0 then return ""
  set d to front document
  set f to file of d
  if f is missing value then return ""
  save d
  return POSIX path of f
end tell
AS
)
  [[ -n $doc ]] && files=("$doc")
fi
if (( ${#files} == 0 )); then
  notify "没找到文章" "CotEditor 里没有已保存的 .md，或者把文件拖给我"
  exit 1
fi

out=$(/usr/bin/python3 "$PICUP" "${files[@]}" 2>&1)
code=$?
last=$(print -r -- "$out" | grep -v '^原文备份' | tail -n 1)
if (( code == 0 )); then
  notify "${files[1]:t}" "$last"
else
  notify "出错了" "$last"
fi
