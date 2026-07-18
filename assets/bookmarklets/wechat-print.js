(() => {
  const id = "_lmyWechatPrintStyle";
  const toast = (message) => {
    let node = document.getElementById("_lmyBookmarkletToast") || document.body.appendChild(document.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 1200);
  };
  let style = document.getElementById(id);
  if (style) {
    style.remove();
    toast("公众号打印样式已关闭");
    return;
  }
  style = document.createElement("style");
  style.id = id;
  style.textContent = "#js_content,#js_content p,#js_content span,#js_content li{font-size:18px!important;color:#000!important;line-height:1.8!important}";
  document.head.appendChild(style);
  toast("公众号打印样式已开启");
})();
