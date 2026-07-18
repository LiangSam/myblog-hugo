(() => {
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast") || document.body.appendChild(document.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 1200);
  };
  const enabled = document.designMode.toLowerCase() !== "on";
  document.designMode = enabled ? "on" : "off";
  document.body.contentEditable = enabled ? "true" : "false";
  document.querySelectorAll("img,video,iframe").forEach((element) => {
    element.contentEditable = enabled ? "true" : "false";
  });
  toast(enabled ? "网页编辑已开启" : "网页编辑已关闭");
})();
