# 这个目录提供独立的简洁评论服务。

博客文章使用本目录的评论服务；正式 API 位于 `https://comment.liangmouyin.com`，同一个 Worker 也可通过 `https://lmy-comments.suihantarot.workers.dev` 访问。Giscus 的 GitHub Discussions 和 `hugo.toml` 参数仍保留，供需要时切回。

## 本地预览

1. 在本目录运行 `npm install`。
2. 新建本地数据库时运行 `npx wrangler d1 execute lmy-comments-trial --local --file schema.sql`；已有数据库运行 `npx wrangler d1 execute lmy-comments-trial --local --file migrations/002-votes.sql`。
3. 创建未纳入 Git 的 `.dev.vars`，设置 `ADMIN_PASSWORD`、`SESSION_SECRET` 和 `IP_SALT`，每项都使用独立的长随机字符串。
4. 运行 `npm run dev`，服务默认监听 `http://127.0.0.1:8788`。
5. 在仓库根目录运行 `hugo server`，打开任意文章测试留言。管理页位于 `/comments-admin/`；评论区不显示管理入口，管理员可收藏这个地址。

给本地文章或管理页网址加上 `?comments-api=stage`，就会连接云端 Worker；不加参数时连接本地 Worker。云端 Worker 的管理员密码保存在未纳入 Git 的 `.stage-secrets`，文件仅供本机账户读取。正式博客不接受此测试参数。

Worker `lmy-comments` 与此前的 Twikoo Worker 使用同一个 `lmy-comments-trial` D1。自建评论使用 `simple_comments`、`simple_comment_votes`、`simple_banned_ips` 和 `simple_post_limits` 四张表；Twikoo 的 `comment` 表不变。建表前的云端备份保存在未纳入 Git 的 `.backups/2026-10-17-before-simple-comments.sql`。云端导入旧评论时，使用 `npx wrangler d1 execute lmy-comments-trial --remote --file .legacy-import.sql`。现有数据库新增投票表时，运行 `npx wrangler d1 execute lmy-comments-trial --remote --file migrations/002-votes.sql`。

新评论默认直接显示。昵称必填，邮箱选填；昵称和填写的邮箱原文只保存在读者浏览器的 localStorage。填写邮箱时，服务把邮箱转换成 Gravatar 摘要，再保存头像地址；不填邮箱时不生成头像。评论数据保存在 D1 的 `simple_comments` 表中。每条留言允许赞成或反对，重复点击已选方向会取消，页面显示两种票相抵后的数字。浏览器会保存随机投票编号；Worker 使用 `IP_SALT` 计算编号摘要，D1 的 `simple_comment_votes` 表只保存摘要。清除浏览器数据会产生新编号，因此匿名投票无法保证一人一票。管理员登录 `/comments-admin/` 后，可直接在每条留言下回复，也可删除、恢复留言，按评论的网络编号封禁、解除封禁。网络编号由 IP 和仅存在于 Worker 配置的 `IP_SALT` 计算，评论列表不公开 IP。

## 导入此前的评论

`scripts/import-legacy.py` 从此前 Twikoo D1 的 SQL 备份生成可重复执行的导入语句。2026-10-16 的备份共有 86 条记录，其中 `/comments-trial/` 的 1 条为测试留言；脚本仅导入 `/blog/` 下的 85 条评论，保留原始评论 ID、作者、正文、发表时间、文章路径、回复关系和旧头像。示例：

脚本还会读取备份旁的 `giscus-comments.json`，按原评论 ID 恢复 GitHub 作者主页。旧备份已经导入本地 D1 时，先运行 `npx wrangler d1 execute lmy-comments-trial --local --file migrations/001-author-url.sql`，再重新生成和执行导入语句；重复导入只补充作者链接，不改动现有评论。新建 D1 时直接运行 `schema.sql`，无需执行这份字段更新文件。

```sh
python3 scripts/import-legacy.py ../twikoo-trial/.backups/2026-10-16/d1-after-custom-domain.sql .legacy-import.sql
npx wrangler d1 execute lmy-comments-trial --local --file .legacy-import.sql
```

`.legacy-import.sql` 已被 Git 忽略。再次从 Giscus 切换时，应先核对切换期间新增的留言，再导入缺少的评论。

2026-10-17 已将公开的 46 个博客 Discussion 页面保存到未纳入 Git 的 `.backups/2026-10-17-giscus-refresh/github/`。本次提取到 85 条评论；与 2026-10-16 备份逐条比较，评论 ID、正文、作者、时间和回复关系均一致，没有新增、删除或修改。正式切换前，D1 导出保存在 `.backups/2026-10-17-before-production-switch.sql`，SHA-256 为 `a07477c56b2d6d00c38e5c96d306c013d615473fe849452067f3dbd9ae6d9e32`；导出包含这 85 条自建评论以及原 Twikoo 的 `comment` 表。切换前的 Worker 配置和文章模板保存在 `.backups/2026-10-17-cutover/`。以上备份均只保存在本机，未纳入 Git。

## 切回 Giscus 或 Twikoo

只切回 Giscus 时，恢复 `themes/lmy/layouts/_default/single.html` 中原有的 Giscus 脚本并重新发布 Hugo 网站；`hugo.toml` 的 Giscus 参数和 GitHub Discussions 保留着。此操作只改变文章页面显示的评论区，D1 中的自建评论仍保留。

需要同时把 `comment.liangmouyin.com` 切回 Twikoo 时，先从 `services/comments/wrangler.jsonc` 移除 `routes` 并部署 `lmy-comments`，再从 `.backups/2026-10-17-cutover/twikoo-wrangler.jsonc` 恢复 `services/twikoo-trial/wrangler.jsonc` 的域名配置并部署 `lmy-comments-trial`。旧 Worker 的 `workers.dev` 地址仍为 `https://lmy-comments-trial.suihantarot.workers.dev`。回退页面或域名时，不要直接把旧 SQL 导出覆盖到 D1：切换后可能已经产生新留言，应先另行导出当前 D1 并核对差异。

## 新留言 Telegram 通知

读者（非管理员）发表新留言或回复成功后，Worker 用 `ctx.waitUntil` 在后台调用 Telegram Bot API，发送昵称、约 200 字摘要、页面链接和管理页链接。未设置 `TELEGRAM_BOT_TOKEN` 或 `TELEGRAM_CHAT_ID` 时不发送；Telegram 出错只记录日志，不影响留言提交。

两项都是 Worker secret，不写入仓库或 `wrangler.jsonc`。在本目录运行：

```sh
npx wrangler secret put TELEGRAM_BOT_TOKEN   # 粘贴 @BotFather 给的 token
npx wrangler secret put TELEGRAM_CHAT_ID     # 你的 chat id（先给机器人发一条消息，再用 getUpdates 查看）
npx wrangler deploy
```

本地测试时可以把这两项写进未纳入 Git 的 `.dev.vars`。

## 在 Telegram 里直接回复留言

在 Telegram 中“回复”某条新留言通知并输入文字，Worker 会以作者身份（昵称“梁某银”、作者标记）在同一页面发布对那条留言的回复，并回一条“已回复 ✅”和页面链接。回复不会再触发通知。非回复消息只会收到一句用法提示；其他聊天发来的消息直接忽略。

Webhook 地址是 `https://comment.liangmouyin.com/telegram/webhook`，页面上没有任何入口。Worker 校验 Telegram 发来的 `X-Telegram-Bot-Api-Secret-Token`，不等于 `TELEGRAM_WEBHOOK_SECRET` 时返回 401。通知消息 ID 与留言 ID 的对应关系保存在 D1 的 `simple_telegram_messages` 表；查不到时，从通知末尾的“ID：…”解析留言 ID。

首次设置（在本目录运行，前提是已按上一节设置好 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`）：

```sh
# 1. 新增消息对应表
npx wrangler d1 execute lmy-comments-trial --remote --file migrations/003-telegram-messages.sql
# 2. 设置 webhook 密钥（自取一串随机字符，只用字母、数字、_ 和 -，例如 openssl rand -hex 32 生成）
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# 3. 部署
npx wrangler deploy
# 4. 告诉 Telegram 把消息推到 Worker（<TOKEN> 和 <SECRET> 换成真实值）
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url=https://comment.liangmouyin.com/telegram/webhook \
  -d secret_token=<SECRET> \
  -d 'allowed_updates=["message"]'
```

可用 `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` 检查状态。注意：设置 webhook 后，`getUpdates` 不再可用；如需重新查 chat id，先运行 `deleteWebhook`。
