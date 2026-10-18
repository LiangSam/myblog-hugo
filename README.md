# 梁某银的博客

Hugo 站点，主题在 `themes/lmy`，部署在 Cloudflare Pages（`.github/workflows/schedule_build.yml` 每天北京时间 21:05 触发一次构建）。评论服务见 `services/comments/README.md`。

## Hugo 版本

本地构建和检查使用 Hugo **v0.167.0 extended**：

```sh
hugo --gc --minify -d /tmp/blogcheck
```

Cloudflare Pages 项目的环境变量 `HUGO_VERSION` 应设为同一版本（`0.167.0`），升级 Hugo 时两边一起改，避免线上和本地构建结果不一致。
