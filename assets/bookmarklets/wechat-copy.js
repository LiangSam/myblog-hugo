(() => {
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast") || document.body.appendChild(document.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 3000);
  };
  const article = document.querySelector(".post-content");
  if (!article) {
    toast("当前页面没有找到博客正文");
    return;
  }

  /* javascript: 网址里的百分号可能被浏览器解码，这里不直接写。 */
  const full = `100${String.fromCharCode(37)}`;
  const skipTags = new Set(["SCRIPT", "STYLE", "BUTTON", "INPUT", "NOSCRIPT", "SVG"]);
  const blockTags = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "TABLE", "TH", "TD", "FIGURE", "FIGCAPTION", "HR", "DIV", "SECTION"]);
  const sides = ["top", "right", "bottom", "left"];
  const links = [];
  let localImages = 0;

  /* 公众号只认标签上的内联样式，所以逐个元素写入最终显示的样式。 */
  const inlineStyle = (node, computed) => {
    const out = [];
    const add = (name, value, skip) => {
      if (value && value !== skip) out.push(`${name}:${value}`);
    };
    add("color", computed.color);
    add("background-color", computed.backgroundColor, "rgba(0, 0, 0, 0)");
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
    if (code) add("font-family", computed.fontFamily);
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
    const computed = getComputedStyle(node);
    if (computed.display === "none") return null;
    if (node.tagName === "A") return renderLink(node, computed, inPre, inCode);
    if (node.tagName === "IMG") {
      const image = document.createElement("img");
      image.src = node.currentSrc || node.src;
      image.alt = node.alt || "";
      if (/^(localhost|127\.|\[::1\])/.test(new URL(image.src).hostname)) localImages += 1;
      image.style.cssText = `display:block;max-width:${full};height:auto;margin:${computed.marginTop} auto ${computed.marginBottom};border-radius:${computed.borderRadius}`;
      return image;
    }
    const copy = document.createElement(node.tagName);
    const style = inlineStyle(node, computed);
    if (style) copy.style.cssText = style;
    const pre = inPre || node.tagName === "PRE";
    return renderChildren(node, copy, pre, inCode || pre || node.tagName === "CODE");
  };

  const root = document.documentElement;
  const theme = root.getAttribute("data-theme");
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}";
  document.head.appendChild(freeze);
  root.setAttribute("data-theme", "light");
  let html;
  let text;
  try {
    const rootStyle = getComputedStyle(root);
    const computed = getComputedStyle(article);
    const wrapper = document.createElement("section");
    wrapper.style.cssText = `color:${computed.color};font-size:${computed.fontSize};line-height:${computed.lineHeight}`;
    renderChildren(article, wrapper, false, false);
    if (links.length) {
      const muted = rootStyle.getPropertyValue("--color-text-muted").trim();
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
    if (theme === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    freeze.remove();
  }

  const done = () => {
    const notes = [];
    if (links.length) notes.push(`${links.length} 个链接转为文末参考`);
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
