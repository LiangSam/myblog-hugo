(() => {
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "_lmyBookmarkletToast";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 1400);
  };

  const render = () => {
    const source = location.href;
    const article = new Readability(document.cloneNode(true)).parse();
    if (!article || !article.content) {
      toast("没有识别到文章正文");
      return;
    }

    const title = document.createElement("h1");
    title.textContent = article.title || document.title;

    const meta = document.createElement("p");
    meta.className = "lmy-reader-meta";
    const parts = [];
    if (article.byline) parts.push(document.createTextNode(`作者：${article.byline}`));
    const link = document.createElement("a");
    link.href = source;
    link.textContent = "原文链接";
    link.target = "_blank";
    if (parts.length) parts.push(document.createTextNode(" · "));
    parts.push(link);
    meta.append(...parts);

    const content = document.createElement("article");
    content.innerHTML = article.content;

    document.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    document.title = article.title || "阅读模式";
    const style = document.createElement("style");
    style.textContent = `body{max-width:720px;margin:0 auto;padding:48px 24px 80px;color:#111;background:#fff;font:18px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}h1{font-size:2rem;line-height:1.3;text-align:center;margin:0 0 10px}h2,h3,h4{line-height:1.4;margin:1.8em 0 .7em}.lmy-reader-meta{text-align:center;color:#666;font-size:13px;margin:0 0 36px;word-break:break-all}a{color:#1769aa}p{margin:0 0 1.2em}img,video,svg{display:block;max-width:100%;height:auto;margin:1.5em auto}figure{margin:1.5em 0}figcaption{text-align:center;color:#777;font-size:.85em}blockquote{color:#555;margin:1.5em 0;padding:.2em 1.2em;border-left:4px solid #ccc}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:1em;border-radius:6px}code{overflow-wrap:anywhere;background:#f2f2f2;padding:.12em .32em;border-radius:3px}pre code{background:none;padding:0}table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}th,td{border:1px solid #ddd;padding:.4em .6em}@media(max-width:600px){body{padding:28px 18px 60px;font-size:17px}h1{font-size:1.65rem}}`;
    document.head.appendChild(style);
    document.body.replaceChildren(title, meta, content);
  };

  if (window.Readability) {
    render();
    return;
  }
  toast("正在整理正文…");
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/gh/mozilla/readability/Readability.js";
  script.onload = render;
  script.onerror = () => toast("阅读模式载入失败");
  document.head.appendChild(script);
})();
