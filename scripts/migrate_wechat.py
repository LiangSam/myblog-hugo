#!/usr/bin/env python3
"""
把公众号推文大文件拆分成 Hugo 的独立 md 文件
- 已存在的文章跳过（按标题模糊匹配）
- 自动生成 front matter（title, date, slug）
"""

import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path

SOURCE_FILE = "/Users/bob/Library/CloudStorage/OneDrive-Personal/myObsidian/04 Project/梁某银公众号推文.md"
BLOG_DIR = "/Users/bob/HUGO/content/blog"

def normalize(s):
    """标准化标题用于比较，去掉标点和空格"""
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'[\s\W]', '', s)
    return s.lower()

def title_to_slug(title):
    """把中文标题转成简单 slug（保留英文数字，其余用拼音首字母占位用 hash）"""
    # 保留英文、数字、连字符
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[\s_]+', '-', slug).strip('-')
    if not slug:
        # 纯中文标题，用标题 hash 生成短码
        slug = format(abs(hash(title)) % 0xFFFFFF, 'x')
    return slug

def get_existing_titles():
    """获取已有文章的标准化标题集合"""
    existing = {}
    for f in Path(BLOG_DIR).glob("*.md"):
        if f.name == "_index.md":
            continue
        # 尝试从文件名提取标题
        name = f.stem
        existing[normalize(name)] = f.name
        # 也尝试读 front matter 里的 title
        try:
            content = f.read_text(encoding='utf-8')
            m = re.search(r'^title\s*=\s*["\'](.+?)["\']', content, re.MULTILINE)
            if not m:
                m = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)
            if m:
                existing[normalize(m.group(1))] = f.name
        except:
            pass
    return existing

def parse_articles(filepath):
    """解析大文件，返回文章列表 [{title, date, content}]"""
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # 按 ## 标题分割
    parts = re.split(r'\n(?=## )', text)
    articles = []

    for part in parts:
        part = part.strip()
        if not part.startswith('## '):
            continue

        lines = part.split('\n')
        title = lines[0][3:].strip()  # 去掉 ## 前缀

        # 提取日期：支持多种格式
        date_str = None
        content_start = 1
        for i, line in enumerate(lines[1:5], 1):
            # 格式1：_2021-04-06 17:30_
            m = re.search(r'_(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}_', line)
            if m:
                date_str = m.group(1)
                content_start = i + 1
                break
            # 格式2：原创 xxx 2024-01-28 18:00 广东
            m = re.search(r'原创.+?(\d{4}-\d{2}-\d{2})', line)
            if m:
                date_str = m.group(1)
                content_start = i + 1
                break
            # 格式3：单独一行 2024-02-20 或 2024-05-06 周一
            m = re.match(r'^(\d{4}-\d{2}-\d{2})(\s|$)', line.strip())
            if m:
                date_str = m.group(1)
                content_start = i + 1
                break

        if not date_str:
            date_str = None  # 无日期，跳过

        # 正文（去掉标题行和日期行）
        body = '\n'.join(lines[content_start:]).strip()

        articles.append({
            'title': title,
            'date': date_str,
            'body': body,
        })

    return articles

def main():
    existing = get_existing_titles()
    articles = parse_articles(SOURCE_FILE)

    print(f"共解析 {len(articles)} 篇文章")
    print(f"已有 {len(existing)} 篇（含文件名匹配）\n")

    skipped = []
    to_create = []

    for art in articles:
        # 跳过无日期或 2024 年之前的文章
        if not art['date'] or art['date'] < '2024-01-01':
            continue
        key = normalize(art['title'])
        if key in existing:
            skipped.append(art['title'])
        else:
            to_create.append(art)

    print(f"✅ 已存在，跳过：{len(skipped)} 篇")
    print(f"🆕 待新建：{len(to_create)} 篇\n")

    if not to_create:
        print("没有需要新建的文章。")
        return

    print("待新建文章列表：")
    for i, art in enumerate(to_create, 1):
        print(f"  {i:3}. [{art['date']}] {art['title']}")

    print("\n是否继续创建这些文件？(y/n) ", end='')
    answer = input().strip().lower()
    if answer != 'y':
        print("已取消。")
        return

    created = 0
    for art in to_create:
        slug = title_to_slug(art['title'])
        filename = f"{art['date']}-{slug}.md"
        # 防止文件名过长
        if len(filename) > 100:
            filename = f"{art['date']}-{format(abs(hash(art['title'])) % 0xFFFFFF, 'x')}.md"

        filepath = os.path.join(BLOG_DIR, filename)

        # 如果文件名已存在，加后缀
        counter = 1
        while os.path.exists(filepath):
            filename = f"{art['date']}-{slug}-{counter}.md"
            filepath = os.path.join(BLOG_DIR, filename)
            counter += 1

        safe_title = art['title'].replace('"', '\\"')
        front_matter = f"""---
title: "{safe_title}"
date: {art['date']}
draft: true
---

"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(front_matter + art['body'])

        print(f"  ✓ {filename}")
        created += 1

    print(f"\n完成，共创建 {created} 篇文章。")

if __name__ == '__main__':
    main()
