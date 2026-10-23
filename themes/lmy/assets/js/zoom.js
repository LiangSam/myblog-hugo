// 文章图片点击放大：从原位置平滑放大到屏幕中间，再点一下、按 Esc 或滚动页面就收回去
(function () {
  var content = document.querySelector('.post-content');
  if (!content) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var MARGIN = 24;
  var open = null;

  // 图床缩放图（1440 宽）换成 2560 宽那一档，放大后截图里的小字也看得清
  function bigSrc(src) {
    return src.replace(/\/cdn-cgi\/image\/width=1440,/, '/cdn-cgi/image/width=2560,');
  }

  // 放大后能看到的最大尺寸：铺满屏幕，但不超过图片本身的像素
  function target(img) {
    var r = img.getBoundingClientRect();
    var maxW = bigSrc(img.currentSrc) !== img.currentSrc && img.naturalWidth >= 1440 ? Infinity : img.naturalWidth;
    var s = Math.min(
      (window.innerWidth - MARGIN * 2) / r.width,
      (window.innerHeight - MARGIN * 2) / r.height,
      maxW / r.width
    );
    return { r: r, s: s };
  }

  function mark(img) {
    if (img.closest('a') || !img.naturalWidth) return;
    img.classList.toggle('is-zoomable', target(img).s > 1.15);
  }

  var imgs = content.querySelectorAll('img');
  imgs.forEach(function (img) {
    if (img.complete) mark(img);
    else img.addEventListener('load', function () { mark(img); }, { once: true });
  });
  window.addEventListener('resize', function () { imgs.forEach(mark); });

  content.addEventListener('click', function (e) {
    var img = e.target.closest('img.is-zoomable');
    if (!img || open) return;
    e.preventDefault();
    zoomIn(img);
  });

  function zoomIn(img) {
    var t = target(img);
    var r = t.r;
    var overlay = document.createElement('div');
    overlay.className = 'zoom-overlay';
    var clone = img.cloneNode();
    clone.className = 'zoom-image';
    clone.removeAttribute('loading');
    clone.removeAttribute('srcset');
    clone.src = img.currentSrc;
    clone.alt = img.alt;
    clone.style.left = r.left + 'px';
    clone.style.top = r.top + 'px';
    clone.style.width = r.width + 'px';
    clone.style.height = r.height + 'px';
    document.body.appendChild(overlay);
    document.body.appendChild(clone);
    img.classList.add('is-zoomed');

    var tx = (window.innerWidth - r.width * t.s) / 2 - r.left;
    var ty = (window.innerHeight - r.height * t.s) / 2 - r.top;
    // 先让元素在原位置画一帧，再加上变换，过渡才会生效
    void clone.offsetWidth;
    overlay.classList.add('is-open');
    clone.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + t.s + ')';

    var big = bigSrc(img.currentSrc);
    if (big !== img.currentSrc) {
      var pre = new Image();
      pre.onload = function () { if (open && open.clone === clone) clone.src = big; };
      pre.src = big;
    }

    open = { img: img, clone: clone, overlay: overlay, y: window.scrollY };
    overlay.addEventListener('click', zoomOut);
    clone.addEventListener('click', zoomOut);
  }

  function zoomOut() {
    if (!open) return;
    var o = open;
    open = null;
    // 页面可能滚动过一点，收回到图片现在的位置
    var r = o.img.getBoundingClientRect();
    var from = o.clone.getBoundingClientRect();
    var dx = r.left - parseFloat(o.clone.style.left);
    var dy = r.top - parseFloat(o.clone.style.top);
    o.overlay.classList.remove('is-open');
    o.clone.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    var done = function () {
      o.clone.remove();
      o.overlay.remove();
      o.img.classList.remove('is-zoomed');
    };
    if (reduce.matches || !from.width) done();
    else {
      o.clone.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 400);
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') zoomOut();
  });
  window.addEventListener('scroll', function () {
    if (open && Math.abs(window.scrollY - open.y) > 40) zoomOut();
  }, { passive: true });
  window.addEventListener('resize', zoomOut);
})();
