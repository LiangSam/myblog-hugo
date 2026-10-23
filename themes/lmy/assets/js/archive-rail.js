/*
  archive-rail.js — Archives 页的文章导航线。
  一根细线从上到下按篇数均分，每篇文章占一样长；精选文章是线上的小圆点，年份处有一道短横。
  加粗的一段是当前屏幕上能看到的文章。鼠标移上去有一根小横线跟着指针，旁边浮出卡片；
  靠近精选圆点时会吸附过去。按住拖动，列表实时跟着跳。
  宽屏放在列表左边的留白里，窄屏贴在右边缘。
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
  var picks = [];
  var yearStarts = [];
  posts.forEach(function (p, i) {
    if (p.featured) picks.push(i);
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

  var PAD = 8;    // 画布上下留白，给端点的圆点留位置
  var SNAP = 6;   // 指针离精选圆点这么近（px）就吸附过去
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var side = 'left', W = 64, H = 400, railLeft = 0, railTop = 0, headerH = 56;
  var colors = {}, monoFont = 'monospace';

  // 目标值 t 和当前值 v
  var hover = { t: 0, v: 0 };
  var mark = { t: 0, v: 0 };     // 小横线的位置
  var cardY = { t: 0, v: 0 };
  var ra = { t: 0, v: 0 }, rb = { t: 0, v: 0 };  // 当前屏幕上能看到的文章区间
  var active = -1, dragging = false, pointerInside = false;
  var scrubRow = null, running = false;

  function readColors() {
    var cs = getComputedStyle(docEl);
    ['--color-bg', '--color-text', '--color-text-muted', '--color-accent', '--color-border'].forEach(function (k) {
      colors[k] = cs.getPropertyValue(k).trim();
    });
    var dateEl = root.querySelector('.archive-date');
    if (dateEl) monoFont = getComputedStyle(dateEl).fontFamily;
  }

  function yOf(i) { return PAD + i / (n - 1) * H; }

  function layout() {
    headerH = parseFloat(getComputedStyle(docEl).getPropertyValue('--header-height')) || 56;
    var vw = docEl.clientWidth;
    var listLeft = root.getBoundingClientRect().left;
    side = listLeft >= 104 ? 'left' : 'right';
    docEl.classList.toggle('archive-rail-right', side === 'right');
    W = side === 'left' ? 64 : 28;
    railTop = headerH + 20;
    H = Math.max(120, window.innerHeight - railTop - 20 - PAD * 2);
    railLeft = side === 'left' ? Math.round(listLeft - W - 20) : vw - W;
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
    ra.t = a;
    rb.t = Math.max(lowerBound(bottom) - 1, a);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H + PAD * 2);
    var x = (side === 'left' ? W - 12 : W - 10) + 0.5;

    // 细线
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors['--color-text-muted'];
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(x, PAD);
    ctx.lineTo(x, PAD + H);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 年份短横和标签，挤在一起的标签就跳过
    var currentYear = posts[Math.min(n - 1, Math.round(ra.v))].date.slice(0, 4);
    ctx.strokeStyle = colors['--color-text-muted'];
    ctx.globalAlpha = 0.6;
    yearStarts.forEach(function (ys) {
      var y = Math.round(yOf(ys.i)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x - 3.5, y);
      ctx.lineTo(x + 4, y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    if (side === 'left') {
      ctx.font = '10px ' + monoFont;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      var lastY = -Infinity;
      yearStarts.forEach(function (ys) {
        var y = Math.max(yOf(ys.i), PAD + 5);
        if (y - lastY < 14) return;
        lastY = y;
        var isCurrent = ys.year === currentYear;
        ctx.fillStyle = isCurrent ? colors['--color-text'] : colors['--color-text-muted'];
        ctx.globalAlpha = isCurrent ? 1 : 0.7;
        ctx.fillText(ys.year, x - 10, y);
      });
      ctx.globalAlpha = 1;
    }

    // 当前屏幕范围：线上加粗的一段
    var ya = yOf(ra.v), yb = yOf(rb.v);
    if (yb - ya < 10) { var mid = (ya + yb) / 2; ya = mid - 5; yb = mid + 5; }
    ctx.strokeStyle = colors['--color-text'];
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, ya);
    ctx.lineTo(x, yb);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 精选圆点：外面描一圈背景色，把线挖开，圆点浮在线上
    var hoverPick = active >= 0 && posts[active].featured ? active : -1;
    picks.forEach(function (i) {
      var y = yOf(i);
      var r = i === hoverPick ? 2.5 + hover.v * 1.5 : 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = colors['--color-bg'];
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = colors['--color-accent'];
      ctx.fill();
    });

    // 跟着指针的小横线
    if (hover.v > 0.02) {
      var my = Math.round(mark.v) + 0.5;
      ctx.globalAlpha = hover.v;
      ctx.strokeStyle = colors['--color-accent'];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 6, my);
      ctx.lineTo(x + 6 + 8 * hover.v, my);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function placeCard() {
    var h = card.offsetHeight;
    var y = railTop + cardY.v - h / 2;
    y = Math.max(railTop - 4, Math.min(y, window.innerHeight - h - 12));
    var x = side === 'left' ? railLeft + W + 6 : railLeft - card.offsetWidth - 2;
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

  function ease(v, k) {
    var diff = v.t - v.v;
    if (Math.abs(diff) < 0.01) { v.v = v.t; return false; }
    v.v += diff * k;
    return true;
  }

  function frame() {
    var instant = reduceMotion.matches;
    var moving = false;
    moving = ease(hover, instant ? 1 : 0.2) || moving;
    moving = ease(mark, instant ? 1 : 0.45) || moving;
    moving = ease(cardY, instant ? 1 : 0.3) || moving;
    moving = ease(ra, instant ? 1 : 0.25) || moving;
    moving = ease(rb, instant ? 1 : 0.25) || moving;
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

  // 指针在画布上的 y 换算成文章下标；附近有精选圆点就吸过去
  function pick(e) {
    var y = e.clientY - rail.getBoundingClientRect().top;
    var i = Math.round(Math.min(Math.max((y - PAD) / H, 0), 1) * (n - 1));
    for (var k = 0; k < picks.length; k++) {
      if (Math.abs(yOf(picks[k]) - y) <= SNAP) { i = picks[k]; break; }
    }
    return i;
  }

  function showAt(i) {
    setActive(i);
    var y = yOf(i);
    mark.t = y;
    cardY.t = y;
    if (hover.t === 0) { mark.v = y; cardY.v = y; }
    hover.t = 1;
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
    if (e.pointerType === 'mouse') showAt(pick(e));
  });
  rail.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' && !dragging) return;
    showAt(pick(e));
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
    showAt(pick(e));
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
  ra.v = ra.t;
  rb.v = rb.t;
  kick();
})();
