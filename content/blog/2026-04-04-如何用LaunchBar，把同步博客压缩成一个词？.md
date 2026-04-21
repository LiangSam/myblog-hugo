---
title: 如何用LaunchBar，把同步博客压缩成一个词？
date: 2026-04-04
tags:
  - LaunchBar
slug: launchbar-hugo-sync
author:
  - 梁某银
draft: false
featured: false
description: 本文也仅作为一种自动化的示例，并不复杂，甚至我对 LaunchBar 的用法也很简陋。但这并不妨碍我用它来解决遇到的问题，只要有一个需求，询问 AI，反复调整，直到它跑起来，这就够了。
---
![](https://img.liangmouyin.com/2026/04/b4ff428ff0adbdc4b98da75b3df07f08.png)

众所周知，笔者的文章每日都会同步到博客，日复一日，工序繁琐。之前还有读者认为我是用什么工具把公众号的文章同步过去的，实则不然，全是手动。

好在我的博客是基于本地，因此写作时几乎不需要网络。过去我是在自己的笔记库写文章，写完后再复制粘贴到博客文件夹，但弊端是如果文字有改动，我需要同时在三个地方修改，活像一个老农，顾完一块田还要操心下一块。

后来我醒悟到，把文章放在笔记库毫无作用，于是以转移战场，只在博客文件夹下写作。写完后复制到公众号，等系统自动检查错别字，如果有，顺带改正，没有则发布文章。

但我的博客是通过 GitHub 同步的，所以每次都要手动同步：首先打开终端（Terminal），把目录切换到 博客文件夹（我的是 HUGO），然后逐次`git add .`，`git commit -m "update"`，`git push`。部分读者应该不懂是干嘛的，大意是存储更改、保存到历史记录、最后上传到远程仓库。

流程非常明确，但是时间长了就觉得很麻烦。后来用 MacBook 后，发现后面这三个代码可以同时输入，只要用两个 `&` 符号来衔接即可，如 `git add . && git commit -m "update" && git push`。这样将繁琐的输入流程，简化为粘贴一条代码。

可还是需要手动打开终端，我开始思考有没有更加简便的方法，然后我想到了 LaunchBar。

LaunchBar 是 macOS 上的「快捷启动器」，其使用逻辑是呼出、输入和执行，同类软件有 Alfred 和 Raycast。它能做什么呢？我举三个例子：

- 最简单的是呼出 LaunchBar 打开应用，比如输入 `ob` 是 Obsidian，`ter` 是 Terminal，`we` 是微信，`mu` 是 Apple Music，因为 LaunchBar 会学习你的缩写习惯；
- 按`⌘Command-\`呼出剪贴板，再通过方向键找到我需要的字条；
- 自定义搜索模板后，呼出面板，按 `ChatGPT`，空格，键入关键词或句子，回车，就能看到 ChatGPT 给出回答。

![](https://img.liangmouyin.com/2026/04/0d9306cf598c170baab53578651edd1f.gif)

而 LaunchBar 还能执行自定义脚本，想必几条命令不再话说。一通折腾后，我终于成功只需要输入`hugo`，就能直接同步博客，并为我反馈结果。

首先要呼出 LaunchBar，输入 Action Editor，新建一个行动，姑且命名为 `Hugo Sync`，到 Scripts 页面，点击 `JavaScript` 下来菜单，把类型改为 `Shell Script`，再点 `Edit` 打开脚本，粘贴下面的代码（注意第三条需要改为你自己的博客文件夹地址），保存。

```
#!/bin/bash
PATH=$PATH:/usr/local/bin/;
cd ~/HUGO 
{
  /opt/homebrew/bin/hugo
  git add .
  git commit -m "update $(date '+%Y-%m-%d %H:%M')"
  git push
} > /tmp/hugo-sync.log 2>&1
if [ $? -eq 0 ]; then
    echo "Hugo 同步成功 ✓"
else
    echo "同步失败 ✗ (请检查日志)"
fi
```

随后勾选 Returns result（返回结果），`Item` 的下拉菜单，选择 `String`，这样能够只返回一条消息。如此，将来写完文章后，只要呼出 LaunchBar，键入`hugo`，等待几秒，就能看到「Hugo 同步成功 ✓」的反馈。

![](https://img.liangmouyin.com/2026/04/2c8d4271e24ddb41d309c8009f1717bd.gif)

诚然，这篇文章对大部分人来说，其实都没有必要。因为没有那么多人写博客（况且也未必基于本地搭建），也没有那么多人用 macOS，更没有那么多人用 LaunchBar。导致这篇文章看起来就是纯技术分享且不知所云。

但这个思路应该是可以延伸到更多方面，譬如工作和生活中的大量重复性工作，也应该思考有没有更快捷的方法，把繁琐步骤压缩到极致。

本文也仅作为一种自动化的示例，并不复杂，甚至我对 LaunchBar 的用法也很简陋。但这并不妨碍我用它来解决遇到的问题，只要有一个需求，询问 AI，反复调整，直到它跑起来，这就够了。