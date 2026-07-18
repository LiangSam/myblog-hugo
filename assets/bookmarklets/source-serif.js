(() => {
  const id = "_lmySourceSerifStyle";
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
    toast("思源宋体样式已关闭");
    return;
  }
  style = document.createElement("style");
  style.id = id;
  style.textContent = 'body,p,div,span,a,li,td,th{font-family:"Source Han Serif CN","Noto Serif CJK SC","Noto Serif SC",serif!important;font-weight:500!important}h1,h2,h3,h4,h5,h6,b,strong{font-family:"Source Han Serif CN","Noto Serif CJK SC","Noto Serif SC",serif!important;font-weight:900!important}';
  document.head.appendChild(style);
  toast("已切换为思源宋体");
})();
