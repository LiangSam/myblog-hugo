(() => {
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast") || document.body.appendChild(document.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 4000);
  };
  const article = document.querySelector(".post-content");
  if (!article) {
    toast("当前页面没有找到博客正文");
    return;
  }

  /* 公众号专用样式，取自 md.doocs.org 用的 wechat-mdnice.css，和博客样式分开维护。 */
  const css = `
    :root{--color-accent:#1c6fcf;--color-accent-light:#eef3fa;--color-text:#1a1a1a;--color-text-soft:#4a5568;--color-text-muted:#6b7280;--color-bg-soft:#f4f8fd;--color-border:#d0e0f5}
    body{font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif;font-size:17px;line-height:1.8;color:var(--color-text)}
    h1{font-size:24px;font-weight:600;color:var(--color-text);margin:2em 0 1em;padding-bottom:.4em;border-bottom:2px solid var(--color-accent);letter-spacing:.02em}
    h2{font-size:21px;font-weight:600;color:var(--color-text);margin:1.8em 0 .8em;padding-bottom:.3em;border-bottom:1.5px solid var(--color-accent)}
    h3{font-size:18px;font-weight:600;color:var(--color-text);border-left:4px solid var(--color-accent);padding-left:10px;margin:1.5em 0 .8em}
    h4{font-size:17px;font-weight:600;color:var(--color-text-soft);margin:1.2em 0 .6em}
    h5{font-size:15px;font-weight:500;color:var(--color-text-muted);margin:1em 0 .5em}
    h6{font-size:14px;font-weight:500;color:var(--color-text-muted);margin:1em 0 .5em}
    p{color:var(--color-text);font-size:17px;line-height:1.8;margin:0 0 1.2em;letter-spacing:.02em}
    strong{font-weight:600;color:var(--color-accent)}
    em{font-style:italic;color:var(--color-text-soft)}
    a{color:var(--color-accent);text-decoration:none;border-bottom:1px solid #a0c4ef}
    blockquote{margin:1.5em 0;padding:.9em 1.2em;border-left:3px solid var(--color-accent);background:linear-gradient(to right,var(--color-accent-light),transparent);border-radius:0 6px 6px 0;color:var(--color-text-soft);font-size:16px;line-height:1.8}
    blockquote>p{margin:0;color:var(--color-text-soft)}
    code{font-family:"SF Mono","Fira Code",Consolas,monospace;font-size:15px;background-color:var(--color-accent-light);color:var(--color-accent);padding:2px 6px;border-radius:4px;word-break:break-all}
    pre{background-color:var(--color-bg-soft);border-radius:8px;padding:1em 1.2em;overflow-x:auto;margin:1.5em 0;border:1px solid var(--color-border)}
    pre>code{background:none;color:#1a2a3a;padding:0;font-size:14px;line-height:1.7;border-radius:0;word-break:normal}
    ul,ol{padding-left:1.5em;margin:.6em 0 1.2em;color:var(--color-text)}
    li{font-size:17px;line-height:1.8;color:var(--color-text);margin-bottom:.3em}
    table{border-collapse:collapse;font-size:16px;margin:1.5em 0}
    thead{background-color:var(--color-accent-light)}
    th{text-align:left;padding:.6em .9em;color:var(--color-accent);font-weight:600;border-bottom:2px solid var(--color-border)}
    td{padding:.5em .9em;color:var(--color-text);border-bottom:1px solid var(--color-border)}
    img{border-radius:6px;display:block;margin:1em auto}
    hr{border:none;border-top:1px solid var(--color-border);margin:2em 0}
    figure{margin:1.5em 0;text-align:center}
    figcaption{font-size:13px;color:var(--color-text-muted);margin-top:.5em}
  `;

  /* javascript: 网址里的百分号可能被浏览器解码，这里不直接写。 */
  const full = `100${String.fromCharCode(37)}`;
  const skipTags = new Set(["SCRIPT", "STYLE", "BUTTON", "INPUT", "NOSCRIPT", "SVG"]);
  const blockTags = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "TABLE", "TH", "TD", "FIGURE", "FIGCAPTION", "HR", "DIV", "SECTION"]);
  const sides = ["top", "right", "bottom", "left"];
  const links = [];
  let ownLinks = 0;
  let localImages = 0;
  let view;

  /* 公众号只认标签上的内联样式，所以逐个元素写入最终显示的样式。 */
  const inlineStyle = (node, computed) => {
    const out = [];
    const add = (name, value, skip) => {
      if (value && value !== skip) out.push(`${name}:${value}`);
    };
    add("color", computed.color);
    add("background-color", computed.backgroundColor, "rgba(0, 0, 0, 0)");
    add("background-image", computed.backgroundImage, "none");
    add("font-size", computed.fontSize);
    add("font-weight", computed.fontWeight, "400");
    add("font-style", computed.fontStyle, "normal");
    add("letter-spacing", computed.letterSpacing, "normal");
    add("text-decoration", computed.textDecorationLine, "none");
    add("border-radius", computed.borderRadius, "0px");
    sides.forEach((side) => {
      const width = computed.getPropertyValue(`border-${side}-width`);
      if (width === "0px" || computed.getPropertyValue(`border-${side}-style`) === "none") return;
      add(`border-${side}`, `${width} ${computed.getPropertyValue(`border-${side}-style`)} ${computed.getPropertyValue(`border-${side}-color`)}`);
    });
    const code = node.tagName === "CODE" || node.tagName === "PRE";
    if (code) {
      add("font-family", computed.fontFamily);
      add("word-break", computed.wordBreak, "normal");
      add("line-height", computed.lineHeight, "normal");
    }
    if (blockTags.has(node.tagName)) {
      add("line-height", computed.lineHeight, "normal");
      add("text-align", computed.textAlign, "start");
      sides.forEach((side) => add(`margin-${side}`, computed.getPropertyValue(`margin-${side}`)));
      sides.forEach((side) => add(`padding-${side}`, computed.getPropertyValue(`padding-${side}`)));
    } else {
      sides.forEach((side) => add(`padding-${side}`, computed.getPropertyValue(`padding-${side}`), "0px"));
    }
    if (node.tagName === "UL" || node.tagName === "OL") add("list-style-type", computed.listStyleType);
    if (node.tagName === "TABLE") out.push("border-collapse:collapse", `width:${full}`);
    if (node.tagName === "PRE") out.push("overflow-x:auto");
    return out.join(";");
  };

  /* 博客靠 CSS 在中英文之间留空，公众号不支持，粘贴前补成真正的空格。 */
  const autospace = (text) => text
    .replace(/([一-鿿])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([一-鿿])/g, "$1 $2");

  /* 公众号会压缩代码里的空白，换行和缩进要写成 br 和不换行空格。 */
  const preText = (text, parent) => {
    text.split("\n").forEach((line, index) => {
      if (index) parent.appendChild(document.createElement("br"));
      parent.appendChild(document.createTextNode(line.replace(/ /g, " ")));
    });
  };

  const renderChildren = (source, target, inPre, inCode) => {
    source.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        if (inPre) preText(child.textContent, target);
        else target.appendChild(document.createTextNode(inCode ? child.textContent : autospace(child.textContent)));
        return;
      }
      const rendered = child.nodeType === 1 && render(child, inPre, inCode);
      if (rendered) target.appendChild(rendered);
    });
    return target;
  };

  const renderLink = (node, computed, inPre, inCode) => {
    const raw = node.getAttribute("href") || "";
    const span = document.createElement("span");
    span.style.cssText = inlineStyle(node, computed);
    if (node.querySelector("img") || raw.startsWith("#")) {
      span.removeAttribute("style");
      return renderChildren(node, span, inPre, inCode);
    }
    if (/(^|\.)mp\.weixin\.qq\.com$/.test(node.hostname)) {
      const anchor = document.createElement("a");
      anchor.href = node.href;
      anchor.style.cssText = span.style.cssText;
      return renderChildren(node, anchor, inPre, inCode);
    }
    renderChildren(node, span, inPre, inCode);
    /* 博客文章的链接在公众号里要手动换成公众号链接，这里只保留样式，方便找到。 */
    if (node.hostname === location.hostname || /(^|\.)liangmouyin\.com$/.test(node.hostname)) {
      ownLinks += 1;
      return span;
    }
    const label = node.textContent.trim();
    if (label === node.href || label === node.href.replace(/^https?:\/\//, "")) return span;
    let index = links.findIndex((link) => link.href === node.href);
    if (index < 0) index = links.push({ label, href: node.href }) - 1;
    const wrap = document.createDocumentFragment();
    const sup = document.createElement("sup");
    sup.textContent = `[${index + 1}]`;
    sup.style.cssText = `color:${computed.color};font-size:12px`;
    wrap.append(span, sup);
    return wrap;
  };

  const render = (node, inPre, inCode) => {
    if (skipTags.has(node.tagName.toUpperCase()) || node.matches(".ln, .footnote-backref")) return null;
    const computed = view.getComputedStyle(node);
    if (computed.display === "none") return null;
    /* 博客的图片是 p 里套 figure，浏览器解析时会在图片前后各留一个空段落。 */
    if (node.tagName === "P" && !node.textContent.trim() && !node.querySelector("img")) return null;
    if (node.tagName === "A") return renderLink(node, computed, inPre, inCode);
    if (node.tagName === "IMG") {
      const image = document.createElement("img");
      image.src = node.currentSrc || node.src;
      image.alt = node.alt || "";
      if (/^(localhost|127\.|\[::1\])/.test(new URL(image.src).hostname)) localImages += 1;
      image.style.cssText = `max-width:${full};height:auto;vertical-align:bottom;border-radius:${computed.borderRadius}`;
      return image;
    }
    const copy = document.createElement(node.tagName);
    const style = inlineStyle(node, computed);
    if (style) copy.style.cssText = style;
    const pre = inPre || node.tagName === "PRE";
    return renderChildren(node, copy, pre, inCode || pre || node.tagName === "CODE");
  };

  /* 正文放进一个只有公众号样式的隐藏 iframe 里取值，博客样式和深浅色都不会混进来。 */
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;left:-9999px;top:0;width:677px;height:800px;border:0";
  document.body.appendChild(frame);
  let html;
  let text;
  try {
    view = frame.contentWindow;
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body></body></html>`);
    doc.close();
    const clone = article.cloneNode(true);
    clone.querySelectorAll("a[href]").forEach((link) => {
      if (!link.getAttribute("href").startsWith("#")) link.setAttribute("href", link.href);
    });
    clone.querySelectorAll("img").forEach((image) => image.setAttribute("src", image.currentSrc || image.src));
    /* 代码高亮的文字颜色保留，背景交给公众号样式。 */
    clone.querySelectorAll("pre[style]").forEach((block) => block.removeAttribute("style"));
    doc.body.innerHTML = clone.innerHTML;
    const computed = view.getComputedStyle(doc.body);
    const wrapper = document.createElement("section");
    wrapper.style.cssText = `color:${computed.color};font-size:${computed.fontSize};line-height:${computed.lineHeight};font-family:${computed.fontFamily}`;
    renderChildren(doc.body, wrapper, false, false);
    if (wrapper.firstElementChild) wrapper.firstElementChild.style.marginTop = "0";
    if (links.length) {
      const muted = "#6b7280";
      const heading = document.createElement("p");
      heading.textContent = "参考链接";
      heading.style.cssText = `margin:2em 0 .5em;color:${muted};font-size:14px;font-weight:700`;
      wrapper.appendChild(heading);
      links.forEach((link, index) => {
        const line = document.createElement("p");
        line.textContent = `[${index + 1}] ${link.label}：${link.href}`;
        line.style.cssText = `margin:0 0 .4em;color:${muted};font-size:13px;line-height:1.6;word-break:break-all`;
        wrapper.appendChild(line);
      });
    }
    html = wrapper.outerHTML;
    text = wrapper.textContent;
  } finally {
    frame.remove();
  }

  const done = () => {
    const notes = [];
    if (links.length) notes.push(`${links.length} 个链接转为文末参考`);
    if (ownLinks) notes.push(`${ownLinks} 处博客链接待手动替换`);
    if (localImages) notes.push(`有 ${localImages} 张本地图片，公众号看不到`);
    toast(`已复制，可到公众号粘贴${notes.length ? `（${notes.join("，")}）` : ""}`);
  };

  /* Safari 需要有选区才会触发 copy 事件，所以临时选中一个占位元素。 */
  let copied = false;
  const onCopy = (event) => {
    event.clipboardData.setData("text/html", html);
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    copied = true;
  };
  const selection = window.getSelection();
  const saved = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  const holder = document.body.appendChild(document.createElement("span"));
  holder.textContent = "x";
  holder.style.cssText = "position:fixed;left:-9999px";
  const range = document.createRange();
  range.selectNodeContents(holder);
  selection.removeAllRanges();
  selection.addRange(range);
  document.addEventListener("copy", onCopy, true);
  try {
    document.execCommand("copy");
  } catch (_) {
    copied = false;
  }
  document.removeEventListener("copy", onCopy, true);
  selection.removeAllRanges();
  if (saved) selection.addRange(saved);
  holder.remove();
  if (copied) {
    done();
    return;
  }
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" }),
    })]).then(done, () => toast("复制失败，请换一个浏览器试试"));
    return;
  }
  toast("复制失败，请换一个浏览器试试");
})();
