(() => {
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast") || document.body.appendChild(document.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 1200);
  };
  let count = 0;
  document.querySelectorAll("body *").forEach((element) => {
    const position = getComputedStyle(element).position;
    if (position !== "fixed" && position !== "sticky") return;
    element.style.setProperty("position", "static", "important");
    count += 1;
  });
  toast(count ? `已移除 ${count} 个悬浮元素` : "没有发现悬浮元素");
})();
