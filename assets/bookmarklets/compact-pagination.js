(() => {
  const documentRef = document;
  const styleId = "__lmyPrintPagination__";
  const imageClass = "__lmyPdfImage__";
  const heightProperty = "--lmy-pdf-max-height";
  const toast = (message) => {
    let node = documentRef.getElementById("_lmyBookmarkletToast") || documentRef.body.appendChild(documentRef.createElement("div"));
    node.id = "_lmyBookmarkletToast";
    node.textContent = message;
    node.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;padding:9px 14px;border-radius:8px;background:#000c;color:#fff;font:14px -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none";
    clearTimeout(window._lmyBookmarkletToastTimer);
    window._lmyBookmarkletToastTimer = setTimeout(() => node.remove(), 1200);
  };
  const resetImages = () => documentRef.querySelectorAll(`.${imageClass}`).forEach((image) => {
    image.classList.remove(imageClass);
    image.style.removeProperty(heightProperty);
  });
  const oldStyle = documentRef.getElementById(styleId);
  if (oldStyle) {
    oldStyle.remove();
    resetImages();
    toast("紧凑分页已关闭");
    return;
  }

  const images = [...documentRef.images].filter((image) => {
    const rect = image.getBoundingClientRect();
    return Math.max(rect.width, rect.height) >= 240;
  });
  images.forEach((image) => image.classList.add(imageClass));
  images.forEach((image) => {
    const group = image.closest("p, figure");
    const count = group ? group.querySelectorAll(`img.${imageClass}`).length : 1;
    const maxHeight = count === 1 ? 155 : Math.max(30, Math.floor((230 - 5 * (count - 1)) / count));
    image.style.setProperty(heightProperty, `${maxHeight}mm`);
  });

  const style = documentRef.createElement("style");
  style.id = styleId;
  style.textContent = `@media print{figure,pre,blockquote,li,tr{break-inside:avoid-page!important;page-break-inside:avoid!important}a:has(>img.${imageClass}){display:block!important;break-inside:avoid-page!important;page-break-inside:avoid!important}h1,h2,h3,h4,h5,h6{break-after:avoid-page!important;page-break-after:avoid!important}:is(h1,h2,h3,h4,h5,h6)+*{break-before:avoid-page!important;page-break-before:avoid!important}p,li,blockquote{orphans:3!important;widows:3!important}thead{display:table-header-group!important}tfoot{display:table-footer-group!important}img.${imageClass}{display:block!important;max-width:100%!important;max-height:var(${heightProperty},155mm)!important;width:auto!important;height:auto!important;margin:3mm auto!important;object-fit:contain!important;break-inside:avoid-page!important;page-break-inside:avoid!important}svg,video{max-width:100%!important;height:auto!important}pre,pre code{white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important}table{max-width:100%!important;border-collapse:collapse!important}}`;
  documentRef.head.appendChild(style);
  toast("紧凑分页已开启");
})();
