(() => {
  const marker = "_lmyAppendedUrl";
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast") || document.body.appendChild(document.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 1200);
  };
  const oldNodes = document.querySelectorAll(`.${marker}`);
  if (oldNodes.length) {
    oldNodes.forEach((node) => node.remove());
    toast("链接地址已隐藏");
    return;
  }
  let count = 0;
  document.querySelectorAll("a[href]").forEach((link) => {
    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
    const node = document.createElement("span");
    node.className = marker;
    node.textContent = `（${link.href}）`;
    node.style.cssText = "color:#555;font-size:.78em;margin-left:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere";
    link.after(node);
    count += 1;
  });
  toast(count ? `已显示 ${count} 个链接地址` : "没有发现可显示的链接");
})();
