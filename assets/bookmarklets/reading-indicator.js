(() => {
  if (window._lmyReadingIndicator) {
    window._lmyReadingIndicator.destroy();
    return;
  }

  const blocks = Array.from(document.querySelectorAll("p, ul, blockquote"));
  if (!blocks.length) return;

  let index = -1;

  function move(step) {
    const next = index === -1 ? (step > 0 ? 0 : blocks.length - 1) : index + step;
    if (next < 0 || next >= blocks.length) return;

    const block = blocks[index = next];
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(block);
    selection.removeAllRanges();
    selection.addRange(range);
    window.scrollTo({
      top: window.scrollY + block.getBoundingClientRect().top - window.innerHeight * 0.3,
      behavior: "smooth",
    });
  }

  function onKey(event) {
    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      destroy();
    }
  }

  function destroy() {
    document.removeEventListener("keydown", onKey, true);
    window.getSelection().removeAllRanges();
    window._lmyReadingIndicator = null;
  }

  document.addEventListener("keydown", onKey, true);
  window._lmyReadingIndicator = { destroy };
})();
