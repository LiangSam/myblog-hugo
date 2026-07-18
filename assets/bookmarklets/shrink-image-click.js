(() => {
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast") || document.body.appendChild(document.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 1200);
  };
  if (window._lmyShrinkImageClick) {
    toast("点击缩图模式已经开启");
    return;
  }
  window._lmyShrinkImageClick = true;
  document.addEventListener("click", (event) => {
    const image = event.target.closest?.("img");
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    const width = image.getBoundingClientRect().width;
    if (width <= 50) {
      toast("图片已到最小尺寸");
      return;
    }
    image.style.setProperty("width", `${Math.max(50, Math.round(width * 0.9))}px`, "important");
    image.style.setProperty("height", "auto", "important");
  }, true);
  toast("点击图片可缩小 10%");
})();
