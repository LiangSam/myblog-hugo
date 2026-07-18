(() => {
  const id = "_lmyElementRemover";
  if (document.getElementById(id)) return;

  let hovered = null;
  const removed = [];
  const bar = document.createElement("div");
  bar.id = id;
  bar.innerHTML = '<strong>网页修剪</strong><span>点击元素删除</span><button type="button" data-action="undo">撤销</button><button type="button" data-action="done">完成</button>';
  bar.style.cssText = "position:fixed;top:14px;right:14px;z-index:2147483647;display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid #9cc7a4;border-radius:9px;background:#effaf1;color:#173b20;box-shadow:0 6px 24px #0002;font:13px -apple-system,BlinkMacSystemFont,sans-serif";
  bar.querySelectorAll("button").forEach((button) => button.style.cssText = "border:1px solid #9cc7a4;border-radius:6px;background:#fff;color:#173b20;padding:4px 8px;cursor:pointer;font:inherit");
  document.body.appendChild(bar);

  const clearHover = () => {
    if (!hovered) return;
    hovered.style.removeProperty("outline");
    hovered.style.removeProperty("outline-offset");
    hovered = null;
  };
  const onMove = (event) => {
    if (event.target.closest(`#${id}`)) return clearHover();
    if (hovered === event.target) return;
    clearHover();
    hovered = event.target;
    hovered.style.setProperty("outline", "3px solid #ef4444", "important");
    hovered.style.setProperty("outline-offset", "2px", "important");
  };
  const onClick = (event) => {
    if (event.target.closest(`#${id}`)) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    clearHover();
    removed.push({ target, display: target.style.display });
    target.style.setProperty("display", "none", "important");
  };
  const finish = () => {
    clearHover();
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    bar.remove();
  };
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  bar.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (action === "done") finish();
    if (action === "undo") {
      const item = removed.pop();
      if (item) item.target.style.display = item.display;
    }
  });
})();
