(() => {
  const root = document.querySelector('.simple-comments');
  if (!root) return;
  const localPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const cloudPreview = localPreview && new URLSearchParams(location.search).get('comments-api') === 'stage';
  const api = cloudPreview ? 'https://lmy-comments.suihantarot.workers.dev'
    : localPreview ? 'http://127.0.0.1:8788' : root.dataset.api;
  const tokenKey = cloudPreview ? 'lmy-comment-admin-stage-token' : 'lmy-comment-admin-token';
  const page = root.dataset.page;
  const form = root.querySelector('form');
  const list = root.querySelector('.simple-comments-list');
  const fields = root.querySelector('.simple-comments-fields');
  const identityButton = root.querySelector('.simple-comments-identity-toggle');
  const count = root.querySelector('.simple-comments-count');
  const message = root.querySelector('.simple-comments-message');
  const replying = root.querySelector('.simple-comments-replying');
  const nameInput = form.elements.nickname;
  const emailInput = form.elements.email;
  let voterId;
  try {
    voterId = localStorage.getItem('lmy-comment-voter');
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(voterId || '')) {
      voterId = crypto.randomUUID();
      localStorage.setItem('lmy-comment-voter', voterId);
    }
  } catch { voterId = crypto.randomUUID(); }
  let parentId = null;
  let comments = [];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('lmy-comment-identity') || '{}') || {}; } catch {}
  if (saved.nickname) {
    nameInput.value = saved.nickname;
    emailInput.value = saved.email || '';
    fields.hidden = true;
    identityButton.textContent = saved.nickname;
  } else {
    fields.hidden = false;
    identityButton.setAttribute('aria-expanded', 'true');
  }

  identityButton.addEventListener('click', () => {
    fields.hidden = !fields.hidden;
    identityButton.setAttribute('aria-expanded', String(!fields.hidden));
    if (!fields.hidden) nameInput.focus();
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function commentTimeText(date, now = new Date()) {
    const elapsed = now - date;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (elapsed >= 0 && elapsed < minute) return '刚刚';
    if (elapsed >= 0 && elapsed < hour) return `${Math.floor(elapsed / minute)}分钟前`;
    if (elapsed >= 0 && elapsed < day) return `${Math.floor(elapsed / hour)}小时前`;
    if (elapsed >= 0 && elapsed < 7 * day) return `${Math.floor(elapsed / day)}天前`;
    if (elapsed >= 0 && elapsed < 28 * day) return `${Math.floor(elapsed / (7 * day))}周前`;
    if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function commentNode(comment, depth) {
    const article = el('article', 'simple-comment');
    article.style.setProperty('--comment-depth', Math.min(depth, 3));
    const initialAvatar = () => {
      const initial = Array.from((comment.nickname || '').trim())[0] || '?';
      const span = el('span', 'simple-comment-avatar simple-comment-avatar-initial', initial.toUpperCase());
      span.setAttribute('aria-hidden', 'true');
      return span;
    };
    const avatarSrc = comment.isAuthor ? '/images/favicon.png' : comment.avatarUrl;
    if (avatarSrc) {
      const avatar = el('img', 'simple-comment-avatar');
      avatar.src = avatarSrc;
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.referrerPolicy = 'no-referrer';
      avatar.addEventListener('error', () => avatar.replaceWith(initialAvatar()), { once: true });
      article.append(avatar);
    } else {
      article.append(initialAvatar());
    }
    const content = el('div', 'simple-comment-content');
    const meta = el('div', 'simple-comment-meta');
    const nickname = el('strong', '', comment.nickname);
    if (/^https:\/\/github\.com\/[A-Za-z0-9-]+\/?$/.test(comment.authorUrl || '')) {
      const link = el('a', 'simple-comment-author-link');
      link.href = comment.authorUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(nickname);
      meta.append(link);
    } else {
      meta.append(nickname);
    }
    if (comment.isAuthor) meta.append(el('span', 'simple-comment-author', '作者'));
    const date = new Date(comment.createdAt);
    const time = el('time', '', commentTimeText(date));
    time.dateTime = date.toISOString();
    time.title = date.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    meta.append(time);
    content.append(meta, el('p', 'simple-comment-body', comment.body));
    const reply = el('button', 'simple-comment-reply', '回复');
    reply.type = 'button';
    reply.addEventListener('click', () => {
      parentId = comment.id;
      replying.hidden = false;
      replying.textContent = `回复 ${comment.nickname} · `;
      const cancel = el('button', '', '取消');
      cancel.type = 'button';
      cancel.addEventListener('click', () => { parentId = null; replying.hidden = true; });
      replying.append(cancel);
      form.elements.body.focus();
    });
    const actions = el('div', 'simple-comment-actions');
    const votes = el('div', 'simple-comment-votes');
    const up = el('button', 'simple-comment-vote', '▲');
    const down = el('button', 'simple-comment-vote', '▼');
    const score = el('span', 'simple-comment-score');
    const voteError = el('span', 'simple-comment-vote-error');
    voteError.setAttribute('role', 'status');
    up.type = down.type = 'button';
    up.setAttribute('aria-label', '赞成这条留言');
    down.setAttribute('aria-label', '反对这条留言');
    score.setAttribute('aria-live', 'polite');
    function updateVotes(previousScore = null) {
      const nextScore = Number(comment.voteScore || 0);
      score.classList.remove('is-rising', 'is-falling');
      if (previousScore !== null && previousScore !== nextScore && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const oldValue = el('span', 'simple-comment-score-old', String(previousScore));
        const newValue = el('span', 'simple-comment-score-new', String(nextScore));
        oldValue.setAttribute('aria-hidden', 'true');
        newValue.setAttribute('aria-hidden', 'true');
        score.replaceChildren(oldValue, newValue);
        score.classList.add(nextScore > previousScore ? 'is-rising' : 'is-falling');
        const finish = () => {
          if (!score.contains(newValue)) return;
          score.classList.remove('is-rising', 'is-falling');
          score.textContent = String(nextScore);
        };
        newValue.addEventListener('animationend', finish, { once: true });
        window.setTimeout(finish, 300);
      } else {
        score.textContent = String(nextScore);
      }
      score.setAttribute('aria-label', `留言净票数 ${nextScore}`);
      up.setAttribute('aria-pressed', String(comment.viewerVote === 1));
      down.setAttribute('aria-pressed', String(comment.viewerVote === -1));
    }
    async function vote(direction) {
      const value = comment.viewerVote === direction ? 0 : direction;
      up.disabled = down.disabled = true;
      voteError.textContent = '';
      try {
        const result = await fetch(`${api}/api/comments/vote`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: comment.id, voterId, value })
        });
        const data = await result.json();
        if (!result.ok) throw new Error(data.error || '投票失败。');
        const previousScore = Number(comment.voteScore || 0);
        comment.voteScore = data.voteScore;
        comment.viewerVote = data.viewerVote;
        updateVotes(previousScore);
      } catch (error) {
        voteError.textContent = error.message;
      } finally {
        up.disabled = down.disabled = false;
      }
    }
    up.addEventListener('click', () => vote(1));
    down.addEventListener('click', () => vote(-1));
    updateVotes();
    votes.append(up, score, down);
    actions.append(votes, reply, voteError);
    content.append(actions);
    article.append(content);
    return article;
  }

  function render() {
    count.textContent = comments.length ? String(comments.length) : '';
    list.replaceChildren();
    if (!comments.length) {
      const emptyText = root.classList.contains('simple-comments-compact')
        ? '这里还很安静，欢迎写下第一条留言。' : '还没有留言。';
      list.append(el('p', 'simple-comments-empty', emptyText));
      return;
    }
    const children = new Map();
    const ids = new Set(comments.map(c => c.id));
    for (const comment of comments) {
      const parent = ids.has(comment.parentId) ? comment.parentId : null;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(comment);
    }
    const seen = new Set();
    function add(parent, depth) {
      for (const comment of children.get(parent) || []) {
        if (seen.has(comment.id)) continue;
        seen.add(comment.id);
        list.append(commentNode(comment, depth));
        add(comment.id, depth + 1);
      }
    }
    add(null, 0);
  }

  async function load() {
    try {
      const result = await fetch(`${api}/api/comments?path=${encodeURIComponent(page)}`, { headers: { 'x-comment-voter': voterId } });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || '留言读取失败。');
      comments = data.comments;
      render();
    } catch {
      list.replaceChildren(el('p', 'simple-comments-error', '留言暂时无法读取，请稍后刷新。'));
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    if (!form.reportValidity()) return;
    const send = root.querySelector('.simple-comments-send');
    send.disabled = true;
    send.textContent = '发送中…';
    try {
      const token = sessionStorage.getItem(tokenKey);
      const result = await fetch(`${api}/api/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ path: page, nickname: nameInput.value, email: emailInput.value, body: form.elements.body.value, parentId, website: form.elements.website.value })
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || '发送失败。');
      try { localStorage.setItem('lmy-comment-identity', JSON.stringify({ nickname: nameInput.value.trim(), email: emailInput.value.trim() })); } catch {}
      identityButton.textContent = nameInput.value.trim();
      fields.hidden = true;
      identityButton.setAttribute('aria-expanded', 'false');
      form.elements.body.value = '';
      parentId = null;
      replying.hidden = true;
      message.textContent = '已发送。';
      comments.push(data.comment);
      render();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      send.disabled = false;
      send.textContent = '发送';
    }
  });

  load();
})();
