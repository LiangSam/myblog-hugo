// Archives 页：年份栏跟着滚动高亮、只看精选
(function () {
  var root = document.querySelector('.archive-root');
  var bar = document.querySelector('.archive-bar');
  if (!root || !bar) return;

  var html = document.documentElement;
  var groups = Array.prototype.slice.call(root.querySelectorAll('.archive-year-group'));
  var links = {};
  bar.querySelectorAll('.archive-bar-year').forEach(function (a) { links[a.dataset.year] = a; });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

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


  groups.forEach(function (g) {
    g.addEventListener('toggle', requestSpy);
  });

  // 从 #year-2024 这样的链接进来时，把那一年展开
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && target.classList.contains('archive-year-group')) target.open = true;

  spy();
})();
