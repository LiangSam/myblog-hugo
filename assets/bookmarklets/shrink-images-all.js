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
  document.querySelectorAll("img").forEach((image) => {
    const excluded = image.dataset.lmyShrunkAll === "1" || image.closest('header,nav,aside,footer,[class*="avatar" i],[id*="avatar" i],[class*="profile" i],[class*="logo" i],[class*="icon" i]') || image.matches('[alt*="avatar" i],[alt*="头像"],[alt*="logo" i]');
    const rect = image.getBoundingClientRect();
    if (excluded || rect.width <= 0 || rect.height <= 0 || Math.max(rect.width, rect.height) < 240) return;
    image.style.setProperty("width", `${Math.round(rect.width * 0.7)}px`, "important");
    image.style.setProperty("height", "auto", "important");
    image.dataset.lmyShrunkAll = "1";
    count += 1;
  });
  toast(count ? `已将 ${count} 张正文大图缩小 30%` : "没有尚未处理的正文大图");
})();
