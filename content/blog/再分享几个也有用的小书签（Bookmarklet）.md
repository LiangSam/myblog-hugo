---
title: 再分享几个也许有用的小书签（Bookmarklet）
date: 2025-06-22
categories:
  - 方法论
tags:
  - 方法论
  - 低技术
slug: 
draft: false
description: 能帮得上忙的小书签，当然如韩信点兵，多多益善。
---
![image.png](https://img.liangmouyin.com/2025/07/20b10e9b8dea3d417c5ef1dc127658c4.png)

> 能帮得上忙的小书签，当然如韩信点兵，多多益善。

昨天的文章[我的打印终极方法论](https://mp.weixin.qq.com/s/7zqhldAirvLqeaAYTSBHjA)受到不少欢迎，这让我意识到，很多人都没用过小书签，也不知道它能发挥这么大的作用。

因此，秉承帮人帮到底的念头，我继续为大家分享更多的小书签。

其实小书签已经有人专门做过分享，功能丰富，类型齐全，如生成网页二维码、编辑网页、解除网页限制、阅读护眼模式、网页下雪特效，等等。依然无需安装插件、脚本，即点即用。

这是由[奔跑的奶酪汇总整理的 Bookmarklet 小书签](https://www.runningcheese.com/RunningCheese_Bookmarklets.html)，打开网站后，把想要的小书签，直接拖到书签栏就能使用，一点也不拖泥带水。

本着不再重复造轮子的理念，我在下面分享几个也许能优化打印的小书签。

**1、一键移除所有悬浮元素。**

```
javascript:(function() { document.querySelectorAll('*').forEach(el => { const style = window.getComputedStyle(el); if (style.position === 'fixed' || style.position === 'sticky') { el.style.setProperty('position', 'static', 'important'); } }); })();
```

功能：点击后，会自动将所有悬浮、吸顶元素移除，避免让打印时遮挡正文内容，或者在每一页重复出现。

**2、显示所有链接的URL地址。**

```
javascript:(function() { document.querySelectorAll('a').forEach(link => { const href = link.getAttribute('href'); if (href && (href.startsWith('http') || href.startsWith('/')) && !link.querySelector('span.appended-url')) { const urlNode = document.createElement('span'); urlNode.className = 'appended-url'; urlNode.style.color = '#555'; urlNode.style.fontSize = '0.9em'; urlNode.style.marginLeft = '4px'; urlNode.style.fontFamily = 'monospace'; urlNode.textContent = `(${href})`; link.after(urlNode); } }); })();
```

功能：在网页上的超链接文字后面，用括号添加网址链接。

我们打印出来的纸质文章，会遇到超链接变成带下划线的文字，无法知道链接通往何方。因此补上这一环，能够方便溯源和参考。

**3、HTML 网页编辑。**

```
javascript:(function(){  document.body.contentEditable = !document.body.isContentEditable;  document.designMode = document.body.contentEditable ? %27on%27 : %27off%27;  document.querySelectorAll(%27img, video, iframe%27).forEach(el => {    el.contentEditable = document.body.contentEditable;  });})();
```

功能：点击后，激活编辑模式，可以随意修改网页上的文本；再次点击，退出编辑模式，保存修改。

你可以通过这个，去除网页上不需要的内容，甚至还能做恶作剧，比如到个人公众号主页，修改数据，看起来很唬人。

这次的折腾，也让我意识到，很多功能，并不需要太过复杂的工具（对于性能薄弱的电脑，插件装多了也会影响打开网页的流畅性），一枚复古的小书签足矣胜任。