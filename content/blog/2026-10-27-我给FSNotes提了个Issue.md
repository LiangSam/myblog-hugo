---
title: 困扰一年的 FSNotes 蓝色链接，两天就修好了
date: 2026-10-27
tags:
  - 工具
  - 笔记
slug: fsnotes-cjk-link-issue
author:
  - 梁某银
draft: false
featured: false
description: 似乎是从拥有 MacBook 以来，我的笔记软件就从 Obsidian 迁移到 FSNotes。具体时间我忘了，但理由清清楚楚，因为后者只有 macOS 和 iOS 才能使用，我此前并不具备条件。
---

![](https://img.liangmouyin.com/2026/10/a465efbb6554673d383da2cd0af6d7f0.png)

似乎是从拥有 MacBook 以来，我的笔记软件就从 Obsidian 迁移到 FSNotes。具体时间我忘了，但理由清清楚楚，因为后者只有 macOS 和 iOS 才能使用，我此前并不具备条件。

FSNotes 胜在轻盈迅捷、功能简单（甚至没有插件）、界面清爽，而且更接近[卡片笔记编辑器](https://utgd.net/article/20138/)的概念，加上开发者更新勤快，这一年就迭代不少版本。

不过这一年，有个问题让我颇为困扰。在编辑器内，如果我插入一个 Markdown 链接（例如`[标题](example.com)`，编辑模式时能看到网址，预览模式则会隐藏，并将文字渲染成蓝色高亮可点击的链接），但之后的文字也都变成蓝色高亮，看起来就像可以点击一样。

![](https://img.liangmouyin.com/2026/10/f214ccb00f74b1ffee13d996b21a3816.png "FSNotes 7.3.6 版本")

我知道这是一个 BUG，但我又不是开发者，对此无能为力。我的对策是习惯它，或者在后面加一个空格后，那串蓝色便戛然而止。

最近我和 Claude Code 聊到[笔记系统是否需要一次破产](https://liangmouyin.com/blog/archive-notes-instead-of-deleting/)，突然我把这个困扰我一年之久的问题抛给它，好奇这是不是字体的原因。Opus 5.5 摆出 Thinking 的架势，一两分钟后，告诉我说查过源码，问题在于开发者只针对 ASCII 字符做停止（如果换成英文输入法的标点符号，就不会出现这样的情况），但是 CJK 中日韩标点符号并没有被排除，因此连带后面的文字也被视为链接的一部分。

于是，Claude Code 问我如何处理，继续习惯，或者干脆到 GitHub 提交 Issue 反馈。尽管我有些胆怯，Claude Code 那条回复下面就是一个按钮，意思是点击后直接帮我写草稿，我点击，Claude Code 唰唰给我写好英文草稿，顺便贴上 GitHub 链接，进去后就能新建 Issue，粘贴提交，一气呵成。

不过我并不报太大期望，可能要十天半个月才能看到结果。谁知道不到两天，我就看到 RSS 订阅显示 FSNotes 更新到 7.4.0，更新内容里有一条「Fixes autolink highlighting extending past CJK punctuation after a Markdown link」，修复了 Markdown 链接后自动链接高亮延伸到 CJK 标点之后的问题。

这正是我反馈的问题。我琢磨一阵后，把 FSNotes 更新到最新版，再打开那条笔记时，终于不再是一片蓝海，链接矜持有度，没有无限延展，阅读体验大大增强。

![](https://img.liangmouyin.com/2026/10/e828338297975bdbf2c090253f4be3bd.png "FSNotes 7.4.0 版本")

这件事让我意识到，开源软件的优势不仅仅在于免费，还提供一个开放的姿态迎接使用者的反馈，最后让软件不断完善。再加上 Claude Code 写的 Issue 清晰明确，还指出具体代码的问题，对于开发者来说降低了修改成本，自然更容易采纳。

这下我又可以更愉快地编辑器插入链接了，记住，快捷键是`⌘Command-⌥Option-I`。