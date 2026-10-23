/*
  archive-rail.js — Archives 页的文章刻度条。
  一篇文章一格刻度，精选文章是强调色的长刻度加一个小圆点。
  鼠标靠近时指针附近的刻度像放大镜一样撑开，旁边浮出卡片；按住拖动，列表实时跟着跳。
  宽屏放在列表左边的留白里，窄屏贴在右边缘，手指按住就能搓。
  所有数值都只设目标值，由同一个 rAF 循环每帧朝目标插值，收敛后循环自己停下。
*/
(function () {
  var root = document.querySelector('.archive-root');
  if (!root) return;
  var rows = Array.prototype.slice.call(root.querySelectorAll('.archive-item'));
  var n = rows.length;
  if (n < 2) return;

  var docEl = document.documentElement;
  docEl.classList.add('has-archive-rail');
  root.querySelectorAll('details').forEach(function (d) { d.open = true; });

  var posts = rows.map(function (row) {
    return {
      row: row,
      title: row.querySelector('.archive-link').textContent.trim(),
      date: row.getAttribute('data-date') || '',
      featured: row.hasAttribute('data-featured'),
      top: 0
    };
  });
  // 每一年的第一篇，用来画年份标签
  var yearStarts = [];
  posts.forEach(function (p, i) {
    var y = p.date.slice(0, 4);
    if (!i || y !== posts[i - 1].date.slice(0, 4)) yearStarts.push({ i: i, year: y });
  });

  var rail = document.createElement('div');
  rail.className = 'archive-rail';
  rail.setAttribute('aria-hidden', 'true');
  var canvas = document.createElement('canvas');
  rail.appendChild(canvas);
  var card = document.createElement('div');
  card.className = 'archive-rail-card';
  card.setAttribute('aria-hidden', 'true');
  card.innerHTML = '<span class="archive-rail-date"></span><span class="archive-rail-title"></span>';
  var cardDate = card.firstChild;
  var cardTitle = card.lastChild;
  document.body.appendChild(rail);
  document.body.appendChild(card);
  var ctx = canvas.getContext('2d');

  var PAD = 8;          // 画布上下留白，给端点的圆点留位置
  var MAGNIFY = 7;      // 放大镜倍率：指针处的刻度间距放大到 (MAGNIFY + 1) 倍
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var side = 'left', W = 64, H = 400, railLeft = 0, railTop = 0, headerH = 56;
  var colors = {}, monoFont = 'monospace';

  // 目标值和当前值
  var hover = { t: 0, v: 0 };          // 0 = 平时，1 = 指针在上面
  var focus = { t: 0, v: 0 };          // 放大镜中心（画布坐标）
  var range = { a: 0, b: 0, ta: 0, tb: 0 };  // 当前屏幕上能看到的文章区间
  var cardY = { t: 0, v: 0 };
  var pointerY = 0, active = -1, dragging = false, pointerInside = false;
  var scrubRow = null, running = false;

  function readColors() {
    var cs = getComputedStyle(docEl);
    ['--color-text', '--color-text-soft', '--color-text-muted', '--color-accent', '--color-border'].forEach(function (k) {
      colors[k] = cs.getPropertyValue(k).trim();
    });
    var dateEl = root.querySelector('.archive-date');
    if (dateEl) monoFont = getComputedStyle(dateEl).fontFamily;
  }

  function layout() {
    headerH = parseFloat(getComputedStyle(docEl).getPropertyValue('--header-height')) || 56;
    var vw = docEl.clientWidth;
    var listLeft = root.getBoundingClientRect().left;
    side = listLeft >= 104 ? 'left' : 'right';
    docEl.classList.toggle('archive-rail-right', side === 'right');
    W = side === 'left' ? 72 : 28;
    railTop = headerH + 20;
    H = Math.max(120, window.innerHeight - railTop - 20 - PAD * 2);
    railLeft = side === 'left' ? Math.round(listLeft - W - 16) : vw - W;
    rail.style.left = railLeft + 'px';
    rail.style.top = railTop + 'px';
    rail.style.width = W + 'px';
    rail.style.height = (H + PAD * 2) + 'px';
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round((H + PAD * 2) * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var sy = window.scrollY;
    posts.forEach(function (p) { p.top = p.row.getBoundingClientRect().top + sy; });
    updateRange();
    kick();
  }

  // 第一个 top >= y 的文章下标
  function lowerBound(y) {
    var lo = 0, hi = n;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (posts[mid].top < y) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function updateRange() {
    var top = window.scrollY + headerH;
    var bottom = window.scrollY + window.innerHeight - 8;
    var a = Math.min(lowerBound(top), n - 1);
    var b = Math.max(lowerBound(bottom) - 1, a);
    range.ta = a;
    range.tb = b;
  }

  // 放大镜：把均匀分布的位置 u 按焦点做鱼眼变形，两端保持不动
  function warp(u, d) {
    if (d < 0.01) return u;
    var f = focus.v, span, x;
    if (u < f) {
      span = f;
      if (span <= 0) return u;
      x = (f - u) / span;
      return f - span * ((d + 1) * x / (d * x + 1));
    }
    span = H - f;
    if (span <= 0) return u;
    x = (u - f) / span;
    return f + span * ((d + 1) * x / (d * x + 1));
  }

  function indexAt(y) {
    var u = Math.min(Math.max(y, 0), H);
    return Math.round(u / H * (n - 1));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H + PAD * 2);
    var d = hover.v * MAGNIFY;
    var x0 = side === 'left' ? W - 10 : W - 8;
    var gap = H / (n - 1);

    // 底线
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors['--color-border'];
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, PAD);
    ctx.lineTo(x0 + 0.5, PAD + H);
    ctx.stroke();

    // 刻度按颜色分三批画
    var muted = new Path2D(), lit = new Path2D(), picks = new Path2D(), dots = [];
    var baseLen = side === 'left' ? 4 : 3;
    for (var i = 0; i < n; i++) {
      var y = PAD + warp(i * gap, d);
      var near = hover.v * Math.exp(-Math.pow((y - PAD - focus.v) / 26, 2));
      var p = posts[i];
      var len = (p.featured ? baseLen + 7 : baseLen) + near * (side === 'left' ? 12 : 8);
      var target = p.featured ? picks : (i >= range.a - 0.5 && i <= range.b + 0.5 ? lit : muted);
      target.moveTo(x0, y);
      target.lineTo(x0 - len, y);
      if (p.featured) dots.push([x0 - len - 2.5, y]);
    }
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = colors['--color-text-muted'];
    ctx.stroke(muted);
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = colors['--color-text-soft'];
    ctx.stroke(lit);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors['--color-accent'];
    ctx.lineWidth = 1.25;
    ctx.stroke(picks);
    ctx.fillStyle = colors['--color-accent'];
    dots.forEach(function (pt) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 1.7, 0, Math.PI * 2);
      ctx.fill();
    });

    // 当前屏幕范围：线上一段加粗的滑块
    var ya = PAD + warp(range.a * gap, d);
    var yb = PAD + warp(range.b * gap, d);
    if (yb - ya < 6) { var mid = (ya + yb) / 2; ya = mid - 3; yb = mid + 3; }
    ctx.strokeStyle = colors['--color-text'];
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, ya);
    ctx.lineTo(x0 + 0.5, yb);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 指针所在的那一篇
    if (active >= 0 && hover.v > 0.05) {
      var ay = PAD + warp(active * gap, d);
      ctx.globalAlpha = hover.v;
      ctx.strokeStyle = colors['--color-accent'];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0 + 3, ay);
      ctx.lineTo(x0 - (side === 'left' ? 24 : 18), ay);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 年份标签（只有宽屏放得下），挤在一起的就跳过
    if (side === 'left') {
      ctx.font = '10px ' + monoFont;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      var lastY = -Infinity;
      var currentYear = posts[Math.round(range.a)].date.slice(0, 4);
      yearStarts.forEach(function (ys) {
        var y = PAD + warp(ys.i * gap, d);
        y = Math.max(y, PAD + 5);
        if (y - lastY < 14) return;
        lastY = y;
        ctx.fillStyle = ys.year === currentYear ? colors['--color-text'] : colors['--color-text-muted'];
        ctx.globalAlpha = ys.year === currentYear ? 1 : 0.75;
        ctx.fillText(ys.year, x0 - 26, y);
      });
      ctx.globalAlpha = 1;
    }
  }

  function placeCard() {
    var h = card.offsetHeight;
    var y = railTop + PAD + cardY.v - h / 2;
    y = Math.max(railTop - 4, Math.min(y, window.innerHeight - h - 12));
    var x;
    if (side === 'left') {
      x = railLeft + W + 6;
    } else {
      x = railLeft - card.offsetWidth - 6;
    }
    card.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    var p = posts[i];
    cardDate.textContent = p.date;
    cardTitle.textContent = p.title;
    card.classList.toggle('is-featured', p.featured);
  }

  function step(v, k) {
    var diff = v.t - v.v;
    if (Math.abs(diff) < 0.01) { v.v = v.t; return false; }
    v.v += diff * k;
    return true;
  }

  function frame() {
    var k = reduceMotion.matches ? 1 : 0.22;
    var moving = false;
    moving = step(hover, k) || moving;
    moving = step(focus, reduceMotion.matches ? 1 : 0.35) || moving;
    moving = step(cardY, reduceMotion.matches ? 1 : 0.3) || moving;
    var ra = { t: range.ta, v: range.a }, rb = { t: range.tb, v: range.b };
    moving = step(ra, k) || moving;
    moving = step(rb, k) || moving;
    range.a = ra.v;
    range.b = rb.v;
    draw();
    if (card.classList.contains('is-visible')) placeCard();
    if (moving) {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function kick() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function railY(e) {
    return e.clientY - rail.getBoundingClientRect().top - PAD;
  }

  function showAt(y) {
    pointerY = Math.min(Math.max(y, 0), H);
    focus.t = pointerY;
    cardY.t = pointerY;
    if (hover.t === 0) { focus.v = pointerY; cardY.v = pointerY; }
    hover.t = 1;
    setActive(indexAt(pointerY));
    card.classList.add('is-visible');
    kick();
  }

  function hide() {
    hover.t = 0;
    card.classList.remove('is-visible');
    kick();
  }

  // 拖动时页面不加缓动，完全跟手；滚到让目标那一行落在屏幕三分之一处
  function jumpTo(i) {
    var p = posts[i];
    var y = p.top - headerH - (window.innerHeight - headerH) * 0.3;
    docEl.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.max(0, y));
    docEl.style.scrollBehavior = '';
    if (scrubRow !== p.row) {
      if (scrubRow) scrubRow.classList.remove('is-scrub');
      scrubRow = p.row;
      scrubRow.classList.add('is-scrub');
    }
  }

  rail.addEventListener('pointerenter', function (e) {
    pointerInside = true;
    if (e.pointerType === 'mouse') showAt(railY(e));
  });
  rail.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' && !dragging) return;
    showAt(railY(e));
    if (dragging) jumpTo(active);
  });
  rail.addEventListener('pointerleave', function () {
    pointerInside = false;
    if (!dragging) hide();
  });
  rail.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    rail.classList.add('is-dragging');
    rail.setPointerCapture(e.pointerId);
    showAt(railY(e));
    jumpTo(active);
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    rail.classList.remove('is-dragging');
    if (scrubRow) {
      var row = scrubRow;
      row.classList.remove('is-scrub');
      row.classList.remove('is-flash');
      void row.offsetWidth;
      row.classList.add('is-flash');
      setTimeout(function () { row.classList.remove('is-flash'); }, 1500);
      scrubRow = null;
    }
    if (e.pointerType !== 'mouse' || !pointerInside) hide();
  }
  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', endDrag);

  window.addEventListener('scroll', function () {
    updateRange();
    kick();
  }, { passive: true });
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(root);

  // 切换深浅色时重新取色
  new MutationObserver(function () { readColors(); kick(); })
    .observe(docEl, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { readColors(); kick(); });

  readColors();
  layout();
  range.a = range.ta;
  range.b = range.tb;
  kick();
})();
