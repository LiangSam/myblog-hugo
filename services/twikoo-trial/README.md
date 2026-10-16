# 这个目录提供博客准备使用的 Cloudflare 评论服务。

评论服务使用 https://comment.liangmouyin.com，昵称必填，邮箱选填，留言保存在 Cloudflare D1 的 `lmy-comments-trial` 数据库中。服务首页使用独立的 `/comments-trial/` 评论路径。

本地 Hugo 文章模板已从 Giscus 改为加载本服务。图片上传和邮件测试接口暂时关闭，发信凭据尚未配置。没有创建 R2 或开通付费套餐。

## 旧评论已经备份并导入。

2026-10-16 从 `LiangSam/myblog-hugo` 的 46 个博客讨论中导入了 85 条评论，其中 49 条是回复。导入保留了 GitHub 的原始评论 ID、作者、发表时间、正文和回复关系。另有 1 条原有试用评论留在 `/comments-trial/` 路径。

同日将 40 条原作者为 `LiangSam` 的旧评论在 Twikoo 中显示为“梁某银”，头像改为博客的 `/images/favicon.png`，作者链接改为博客首页。GitHub 原始评论 ID、正文、发表时间和回复关系没有修改。更新前的 D1 备份及本次使用的 SQL 分别是 `.backups/2026-10-16/d1-before-owner-display-update.sql` 和 `.backups/2026-10-16/owner-display-update.sql`。

导入前的 D1 数据库备份、GitHub 讨论原始网页、提取后的 JSON 和导入 SQL 保存在 `.backups/2026-10-16/`。该目录只保存在本机，已被 Git 忽略，并限制了其他本机用户的读取权限。`scripts/prepare-giscus-import.cjs` 可以从备份网页重新生成 JSON 和 SQL；SQL 按评论 ID 跳过已经导入的记录。

同日验证管理员网页登录时，发现初始化配置保存的密码结果少了一次 Twikoo 网页端使用的转换，导致网页提示密码错误。修复前备份为 `.backups/2026-10-16/d1-pre-publish.sql`，修复语句为 `.backups/2026-10-16/fix-admin-password-encoding.sql`，修复后备份为 `.backups/2026-10-16/d1-after-admin-login-fix.sql`。管理员继续使用 `.admin-password` 中的原密码；本地 `.seed.sql` 和验证脚本已同步。修复后确认网页管理面板可登录，数据库仍有 86 条评论。

正式博客需要发布当前 Hugo 改动后才会显示 Twikoo。Worker 已绑定 `comment.liangmouyin.com`；原有 `workers.dev` 地址继续保留为故障排查入口。

## 管理员可以使用本地保存的密码登录。

管理员密码保存在本目录的 `.admin-password` 文件中，该文件权限为 600，并已被 Git 忽略。评论列表上方的齿轮按钮提供管理入口，网页管理员登录已验证。邮件设置仍未完成。

## 开发者可以运行服务并验证留言。

在终端执行以下命令；本地测试使用单独的模拟数据库。

```sh
cd /Users/bob/HUGO/services/twikoo-trial
npm ci
npx wrangler d1 execute lmy-comments-trial --local --file schema.sql
npx wrangler d1 execute lmy-comments-trial --local --file .seed.sql
npm run dev
```

`.seed.sql` 包含本机生成的初始配置和密码摘要，已被 Git 忽略。该文件仅用于初始化空的测试环境，请勿用它覆盖已经修改过的云端配置。另一台电脑需要另外初始化管理员密码。

验证脚本只接受本地地址和本次云端测试地址。脚本会新增测试留言和回复，并在完成后删除自己新增的记录：

```sh
python3 scripts/smoke.py https://comment.liangmouyin.com/api
```

备份云端评论时执行以下命令，并妥善保存导出的文件，因为备份包括邮箱和管理配置：

```sh
npx wrangler d1 export lmy-comments-trial --remote --output /private/tmp/lmy-comments-trial-backup.sql
```

管理员需要检查同一浏览器或同一 IP 与浏览器信息是否使用过多个昵称时，执行以下只读查询：

```sh
cd /Users/bob/HUGO/services/twikoo-trial
node scripts/comment-identity-history.cjs
```

脚本读取非作者评论的浏览器编号、IP、浏览器信息、昵称、时间、文章地址和评论内容，不读取邮箱，也不修改 D1。结果分为“相同浏览器编号”和“相同 IP 与浏览器信息”两部分，只列出使用过多个昵称的记录。IP 地址可能由家庭、公司或移动网络共同使用，浏览器编号也会在读者清理网站数据、使用无痕窗口或更换浏览器后改变，因此查询结果只能辅助审核。

## 本次验证覆盖了留言、回复和管理权限。

2026-09-06 的云端测试通过了匿名留言、邮箱留空、回复读取、未登录管理访问拒绝、未登录密码修改拒绝、管理员读取和删除、图片上传拒绝及测试数据清理。本地浏览器验证了邮箱留空的留言提交，云端浏览器确认表单显示正确。邮件投递和手机实机访问尚未验证。

2026-10-16 再次运行云端验证脚本，确认管理员登录、管理员读取和删除、匿名留言与回复以及测试数据清理均通过。

同日为 Worker 绑定 `comment.liangmouyin.com`，Cloudflare 自动创建 DNS 记录和 HTTPS 证书。服务首页和前端脚本均返回 200；完整验证通过新 `/api` 地址运行，创建的测试留言和回复已由脚本删除。

绑定前后的 D1 备份分别为 `.backups/2026-10-16/d1-before-custom-domain.sql` 和 `.backups/2026-10-16/d1-after-custom-domain.sql`。两份文件均为 65,048 字节，SHA-256 相同，权限为 600；部署和验证没有改变原有 86 条评论。

评论组件由测试服务自身提供，文件约 594 KiB（未压缩）。Worker 发布后的压缩体积约 295 KiB；构建工具报告启动耗时 124 ms，这不是页面访问延迟。评论操作会产生 Workers 请求和 D1 读写，Hugo 编译流程没有改变。

## 本项目保留了上游来源及本次改动记录。

上游仓库：https://github.com/twikoojs/twikoo-cloudflare

来源提交：`64c0048671e1a483d6a056968f08f08407b5bf8a`。`src/upstream.js` 保留上游版权说明，移除了记录请求内容、响应内容和配置内容的日志，避免管理员密码和邮箱进入日志。依赖及网页组件使用 Twikoo 1.6.44。

`src/index.js` 禁止上传图片和测试发信，要求非空昵称并限制评论长度。上游用模块变量保存请求身份，本文件让同一 Worker 实例的请求依次执行，防止并发请求混用身份。正式启用邮件前还需验证上游异步通知任务的生命周期。

`wrangler.jsonc` 仅绑定 D1；未配置 R2。三个不可用依赖通过构建别名排除，无须修改 `node_modules`。兼容日期使用已安装 Wrangler 4.68.0 实际支持的 2026-03-02。

邮件通知仍需配置并验证。图片上传和邮件测试接口继续关闭。
