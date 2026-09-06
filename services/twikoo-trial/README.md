# 这个目录提供独立的 Cloudflare 评论试用服务。

打开 https://lmy-comments-trial.suihantarot.workers.dev 即可试用。昵称必填，邮箱选填，留言保存在 Cloudflare D1 的 `lmy-comments-trial` 数据库中。页面使用独立的 `/comments-trial/` 评论路径。

本项目作为独立试用服务保存，Hugo 评论模板仍使用 Giscus，GitHub Discussions 中的旧评论尚未迁移。图片上传和邮件测试接口暂时关闭，发信凭据尚未配置。没有创建 R2 或开通付费套餐。

## 管理员可以使用本地保存的密码登录。

管理员密码保存在本目录的 `.admin-password` 文件中，该文件权限为 600，并已被 Git 忽略。评论列表上方的齿轮按钮提供管理入口。正式使用前需要完成管理员登录和邮件设置。

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
python3 scripts/smoke.py https://lmy-comments-trial.suihantarot.workers.dev/api
```

备份云端评论时执行以下命令，并妥善保存导出的文件，因为备份包括邮箱和管理配置：

```sh
npx wrangler d1 export lmy-comments-trial --remote --output /private/tmp/lmy-comments-trial-backup.sql
```

## 本次验证覆盖了留言、回复和管理权限。

2026-09-06 的云端测试通过了匿名留言、邮箱留空、回复读取、未登录管理访问拒绝、未登录密码修改拒绝、管理员读取和删除、图片上传拒绝及测试数据清理。本地浏览器验证了邮箱留空的留言提交，云端浏览器确认表单显示正确。邮件投递和手机实机访问尚未验证。

评论组件由测试服务自身提供，文件约 594 KiB（未压缩）。Worker 发布后的压缩体积约 295 KiB；构建工具报告启动耗时 124 ms，这不是页面访问延迟。评论操作会产生 Workers 请求和 D1 读写，Hugo 编译流程没有改变。

## 本项目保留了上游来源及本次改动记录。

上游仓库：https://github.com/twikoojs/twikoo-cloudflare

来源提交：`64c0048671e1a483d6a056968f08f08407b5bf8a`。`src/upstream.js` 保留上游版权说明，移除了记录请求内容、响应内容和配置内容的日志，避免管理员密码和邮箱进入日志。依赖及网页组件使用 Twikoo 1.6.44。

`src/index.js` 禁止试用期间上传图片和测试发信，要求非空昵称并限制评论长度。上游用模块变量保存请求身份，本文件让同一 Worker 实例的请求依次执行，防止并发请求混用身份。正式启用邮件前还需验证上游异步通知任务的生命周期。

`wrangler.jsonc` 仅绑定 D1；未配置 R2。三个不可用依赖通过构建别名排除，无须修改 `node_modules`。兼容日期使用已安装 Wrangler 4.68.0 实际支持的 2026-03-02。

此目录用于评估评论体验，正式替换博客前仍需完成邮件通知验证和旧评论迁移决策。
