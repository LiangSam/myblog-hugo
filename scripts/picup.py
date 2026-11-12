#!/usr/bin/env python3
"""picup：把 Markdown 里的本地图片经 PicList 上传到图床，并替换成图床链接。

识别两种写法：
  1. 标准图片  ![说明](路径)   —— 绝对路径、~、相对路径（相对 md 所在目录）、file://、%20 都行
  2. 单独一行的图片路径         —— 把图片直接拖进编辑器时常见的样子

上传全部成功才改写文件；改写前先备份原 md。成功后把原图收进
~/Pictures/博客配图/YYYY-MM/ 归档：一篇文章有两张及以上的图，
再按文章文件名建一层子文件夹（--keep 不动，--trash 扔进废纸篓）。

用法：
  picup.py 文章.md [更多.md ...] [--dry-run] [--keep | --trash]
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys
import urllib.parse
import urllib.request

PICLIST = os.environ.get("PICLIST_URL", "http://127.0.0.1:36677")
ARCHIVE = os.path.expanduser("~/Pictures/博客配图")
BACKUPS = os.path.join(ARCHIVE, ".md-backups")
EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"}

IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)\n]+)\)")
FENCE_RE = re.compile(r"^\s*(```|~~~)")


def resolve(raw, base):
    """把 Markdown 里写的路径解析成本地图片的绝对路径；不是本地图片就返回 None。"""
    s = raw.strip()
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1].strip()
    elif re.search(r'\s+"[^"]*"$', s):  # 去掉 ![](path "title") 里的 title
        s = re.sub(r'\s+"[^"]*"$', "", s)
    s = s.strip().strip("'\"")
    if re.match(r"^(https?:|data:|//)", s, re.I):
        return None
    if s.lower().startswith("file://"):
        s = s[7:]
    s = urllib.parse.unquote(s).replace("\\ ", " ")
    s = os.path.expanduser(s)
    if not os.path.isabs(s):
        s = os.path.join(base, s)
    s = os.path.realpath(s)
    if os.path.splitext(s)[1].lower() in EXTS and os.path.isfile(s):
        return s
    return None


def scan(text, base):
    """逐行找出本地图片，返回 [(行号, 类型, 匹配信息, 绝对路径)]。代码块里的不算。"""
    hits, fenced = [], False
    for i, line in enumerate(text.split("\n")):
        if FENCE_RE.match(line):
            fenced = not fenced
            continue
        if fenced:
            continue
        found = False
        for m in IMG_RE.finditer(line):
            p = resolve(m.group(2), base)
            if p:
                hits.append((i, "md", m, p))
                found = True
        if not found and line.strip() and "](" not in line:
            p = resolve(line, base)
            if p:
                hits.append((i, "bare", None, p))
    return hits


def post(path, payload=None, timeout=120):
    data = json.dumps(payload or {}).encode()
    req = urllib.request.Request(PICLIST + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def upload(path):
    res = post("/upload", {"list": [path]})
    urls = res.get("result") or []
    if not res.get("success") or not urls:
        raise RuntimeError(res.get("message") or "PicList 没有返回链接")
    return urls[0]


def unique_dest(folder, name):
    stem, ext = os.path.splitext(name)
    dest, n = os.path.join(folder, name), 1
    while os.path.exists(dest):
        dest = os.path.join(folder, "%s-%d%s" % (stem, n, ext))
        n += 1
    return dest


def main():
    ap = argparse.ArgumentParser(description="上传 Markdown 里的本地图片并替换为图床链接")
    ap.add_argument("files", nargs="+", help="Markdown 文件")
    ap.add_argument("--dry-run", action="store_true", help="只列出会处理的图片，不上传、不改文件")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--keep", action="store_true", help="上传后原图留在原处")
    g.add_argument("--trash", action="store_true", help="上传后原图扔进废纸篓")
    args = ap.parse_args()

    jobs = []
    for f in args.files:
        f = os.path.abspath(os.path.expanduser(f))
        if not os.path.isfile(f):
            print("找不到文件：%s" % f)
            return 1
        with open(f, encoding="utf-8") as fh:
            text = fh.read()
        hits = scan(text, os.path.dirname(f))
        jobs.append((f, text, hits))

    images = []
    for _, _, hits in jobs:
        for h in hits:
            if h[3] not in images:
                images.append(h[3])

    for f, _, hits in jobs:
        print("%s：%d 处本地图片" % (os.path.basename(f), len(hits)))
        for i, kind, _, p in hits:
            print("  第 %d 行%s  %s" % (i + 1, "（单独路径）" if kind == "bare" else "", p))
    if not images:
        print("没有需要上传的本地图片。")
        return 0
    if args.dry_run:
        print("预览模式：共 %d 张图会上传，未做任何改动。" % len(images))
        return 0

    try:
        post("/heartbeat", timeout=5)
    except Exception:
        print("连不上 PicList（%s），请先打开 PicList 并启用 Server。" % PICLIST)
        return 1

    urls = {}
    for p in images:
        try:
            urls[p] = upload(p)
            print("  ↑ %s → %s" % (os.path.basename(p), urls[p]))
        except Exception as e:
            print("上传失败：%s（%s）。文件都没改。" % (p, e))
            return 1

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    os.makedirs(BACKUPS, exist_ok=True)
    for f, text, hits in jobs:
        if not hits:
            continue
        shutil.copy2(f, os.path.join(BACKUPS, "%s.%s.md" % (os.path.splitext(os.path.basename(f))[0], stamp)))
        lines = text.split("\n")
        for i, kind, m, p in sorted(hits, key=lambda h: (h[0], -(h[2].start() if h[2] else 0))):
            if kind == "bare":
                indent = re.match(r"\s*", lines[i]).group(0)
                lines[i] = "%s![](%s)" % (indent, urls[p])
            else:
                line = lines[i]
                # 保留 ![](path "title") 里的 title，它会渲染成图注
                title = re.search(r'\s+"[^"]*"\s*$', m.group(2))
                lines[i] = line[:m.start()] + "![%s](%s%s)" % (m.group(1), urls[p], title.group(0).rstrip() if title else "") + line[m.end():]
        with open(f, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))

    moved = 0
    if not args.keep:
        month = os.path.join(ARCHIVE, dt.date.today().strftime("%Y-%m"))
        where = set()
        for f, _, hits in jobs:
            mine = []
            for h in hits:
                if h[3] not in mine and os.path.isfile(h[3]):
                    mine.append(h[3])
            if not mine:
                continue
            if args.trash:
                target = os.path.expanduser("~/.Trash")
            elif len(mine) >= 2:  # 两张及以上：按文章建子文件夹
                target = os.path.join(month, os.path.splitext(os.path.basename(f))[0])
            else:
                target = month
            os.makedirs(target, exist_ok=True)
            for p in mine:
                shutil.move(p, unique_dest(target, os.path.basename(p)))
                moved += 1
            where.add("废纸篓" if args.trash else target)
        print("完成：上传 %d 张，原图 %d 张已移到 %s。" % (len(images), moved, "、".join(sorted(where))))
    else:
        print("完成：上传 %d 张，原图未动。" % len(images))
    print("原文备份在 %s" % BACKUPS)
    return 0


if __name__ == "__main__":
    sys.exit(main())
