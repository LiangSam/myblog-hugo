// Archives 页：年份栏跟着滚动高亮、只看精选、每年展开时画一张写作热力图
(function () {
  var root = document.querySelector('.archive-root');
  var bar = document.querySelector('.archive-bar');
  if (!root || !bar) return;

  var html = document.documentElement;
  var groups = Array.prototype.slice.call(root.querySelectorAll('.archive-year-group'));
  var links = {};
  bar.querySelectorAll('.archive-bar-year').forEach(function (a) { links[a.dataset.year] = a; });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function behavior() { return reduce.matches ? 'auto' : 'smooth'; }

  function headerBottom() {
    var h = document.querySelector('.site-header');
    return h ? h.getBoundingClientRect().bottom : 0;
  }

  // ---- 年份栏 ----
  bar.addEventListener('click', function (e) {
    var a = e.target.closest('.archive-bar-year');
    if (!a) return;
    var g = document.getElementById('year-' + a.dataset.year);
    if (!g) return;
    e.preventDefault();
    g.open = true;
    g.scrollIntoView({ behavior: behavior(), block: 'start' });
    history.replaceState(null, '', '#' + g.id);
  });

  var current = null;
  var ticking = false;
  function spy() {
    ticking = false;
    var top = bar.getBoundingClientRect().top;
    bar.classList.toggle('is-stuck', top <= headerBottom() + 0.5 && window.scrollY > 0);
    var line = bar.getBoundingClientRect().bottom + 12;
    var active = null;
    for (var i = 0; i < groups.length; i++) {
      if (!groups[i].offsetParent) continue;
      if (!active || groups[i].getBoundingClientRect().top <= line) active = groups[i];
      else break;
    }
    var year = active && active.dataset.year;
    if (year === current) return;
    if (current && links[current]) links[current].removeAttribute('aria-current');
    if (year && links[year]) links[year].setAttribute('aria-current', 'true');
    current = year;
  }
  function requestSpy() {
    if (!ticking) { ticking = true; requestAnimationFrame(spy); }
  }
  window.addEventListener('scroll', requestSpy, { passive: true });
  window.addEventListener('resize', requestSpy);

  // ---- 只看精选 ----
  var filter = bar.querySelector('.archive-bar-filter');
  var saved = null;
  if (filter) {
    filter.hidden = false;
    filter.addEventListener('click', function () {
      var on = filter.getAttribute('aria-pressed') !== 'true';
      filter.setAttribute('aria-pressed', String(on));
      html.classList.toggle('archive-picks', on);
      if (on) {
        saved = groups.map(function (g) { return g.open; });
        groups.forEach(function (g) { g.open = true; });
      } else if (saved) {
        groups.forEach(function (g, i) { g.open = saved[i]; });
      }
      // 列表长度变化很大，回到列表开头，免得停在一片空白里
      if (bar.classList.contains('is-stuck')) {
        var y = root.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().bottom - 8;
        window.scrollTo({ top: y, behavior: 'instant' });
      }
      requestSpy();
    });
  }

  // ---- 热力图 ----
  var tip = document.createElement('div');
  tip.className = 'archive-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function flash(li) {
    li.classList.remove('is-flash');
    void li.offsetWidth;
    li.classList.add('is-flash');
  }

  function jumpTo(li) {
    li.scrollIntoView({ behavior: behavior(), block: 'center' });
    flash(li);
  }

  function build(g) {
    var year = +g.dataset.year;
    if (g.dataset.heat || !year) return;
    g.dataset.heat = '1';

    var byDay = {};
    g.querySelectorAll('.archive-item').forEach(function (li) {
      var k = li.dataset.date;
      (byDay[k] = byDay[k] || []).push(li);
    });

    // 一周从周一开始，第一列前面空出 1 月 1 日之前的那几天
    var offset = (new Date(year, 0, 1).getDay() + 6) % 7;
    var days = Math.round((new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 864e5);
    var weeks = Math.ceil((offset + days) / 7);
    var today = keyOf(new Date());

    var wrap = el('div', 'archive-heat');
    wrap.style.setProperty('--weeks', weeks);

    var months = el('div', 'archive-heat-months');
    months.setAttribute('aria-hidden', 'true');
    for (var m = 0; m < 12; m++) {
      var doy = Math.round((new Date(year, m, 1) - new Date(year, 0, 1)) / 864e5);
      var label = el('span', null, String(m + 1));
      label.appendChild(el('i', null, '月'));
      label.style.gridColumnStart = Math.floor((offset + doy) / 7) + 1;
      months.appendChild(label);
    }

    var grid = el('div', 'archive-heat-grid');
    grid.setAttribute('aria-hidden', 'true');
    for (var p = 0; p < offset; p++) grid.appendChild(el('span', 'archive-heat-pad'));

    var active = 0, run = 0, best = 0;
    for (var d = 0; d < days; d++) {
      var k = keyOf(new Date(year, 0, 1 + d));
      var posts = byDay[k];
      var cell = el('span');
      cell.dataset.date = k;
      if (posts) {
        active++;
        run++;
        if (run > best) best = run;
        cell.className = 'is-on' +
          (posts.length > 1 ? ' is-many' : '') +
          (posts.some(function (li) { return li.hasAttribute('data-featured'); }) ? ' is-pick' : '');
      } else {
        run = 0;
        if (k > today) cell.className = 'is-future';
      }
      grid.appendChild(cell);
    }

    var foot = el('div', 'archive-heat-foot');
    foot.appendChild(el('span', 'archive-heat-stats',
      '写了 ' + active + ' 天 · 最长连续 ' + best + ' 天'));
    var legend = el('span', 'archive-heat-legend');
    legend.setAttribute('aria-hidden', 'true');
    legend.appendChild(el('i', 'is-on'));
    legend.appendChild(document.createTextNode('有文章'));
    legend.appendChild(el('i', 'is-pick'));
    legend.appendChild(document.createTextNode('精选'));
    foot.appendChild(legend);

    wrap.appendChild(months);
    wrap.appendChild(grid);
    wrap.appendChild(foot);
    g.insertBefore(wrap, g.querySelector('summary').nextSibling);

    function cellAt(e) {
      var t = e.target;
      return t.parentNode === grid && t.dataset.date ? t : null;
    }

    grid.addEventListener('pointerover', function (e) {
      var cell = cellAt(e);
      if (!cell) return;
      var k = cell.dataset.date;
      var posts = byDay[k] || [];
      var date = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
      tip.textContent = '';
      tip.appendChild(el('span', 'archive-tip-date', k.slice(5) + ' · ' + WEEKDAYS[date.getDay()]));
      if (!posts.length) {
        tip.appendChild(el('span', 'archive-tip-empty', k > today ? '还没到' : '没有文章'));
      }
      posts.forEach(function (li) {
        var t = el('span', 'archive-tip-title', li.querySelector('.archive-link').textContent);
        if (li.hasAttribute('data-featured')) t.classList.add('is-pick');
        tip.appendChild(t);
      });
      var r = cell.getBoundingClientRect();
      tip.classList.add('is-visible');
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
      var y = r.top - h - 8;
      if (y < headerBottom() + 4) y = r.bottom + 8;
      tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    });
    grid.addEventListener('pointerleave', hideTip);
    grid.addEventListener('click', function (e) {
      var cell = cellAt(e);
      var posts = cell && byDay[cell.dataset.date];
      if (!posts) return;
      hideTip();
      jumpTo(posts[0]);
    });
  }

  function hideTip() { tip.classList.remove('is-visible'); }
  window.addEventListener('scroll', hideTip, { passive: true });

  groups.forEach(function (g) {
    if (g.open) build(g);
    g.addEventListener('toggle', function () {
      if (g.open) build(g);
      requestSpy();
    });
  });

  // 从 #year-2024 这样的链接进来时，把那一年展开
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && target.classList.contains('archive-year-group')) target.open = true;

  spy();
})();
