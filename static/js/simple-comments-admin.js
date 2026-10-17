(() => {
  const localPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const cloudPreview = localPreview && new URLSearchParams(location.search).get('comments-api') === 'stage';
  const api = cloudPreview ? 'https://lmy-comments.suihantarot.workers.dev'
    : localPreview ? 'http://127.0.0.1:8788' : 'https://comment.liangmouyin.com';
  const loginSection = document.getElementById('login-section');
  const manageSection = document.getElementById('manage-section');
  const loginForm = document.getElementById('login-form');
  const status = document.getElementById('status');
  const commentsBox = document.getElementById('comments');
  const bansBox = document.getElementById('bans');
  const more = document.getElementById('more');
  const tokenKey = cloudPreview ? 'lmy-comment-admin-stage-token' : 'lmy-comment-admin-token';
  let token = sessionStorage.getItem(tokenKey) || '';
  let nextBefore = null;
  let banned = new Set();
  let activeReplyForm = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  async function request(path, options = {}) {
    const result = await fetch(`${api}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${token}` }
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || '请求失败。');
    return data;
  }

  async function act(action, values) {
    status.textContent = '正在处理…';
    try {
      await request('/api/admin/action', { method: 'POST', body: JSON.stringify({ action, ...values }) });
      status.textContent = '已保存。';
      await load(true);
    } catch (error) { status.textContent = error.message; }
  }

  function action(label, className, handler) {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function renderBans(rows) {
    banned = new Set(rows.map(row => row.ip_key));
    bansBox.replaceChildren();
    if (!rows.length) { bansBox.append(el('p', 'muted', '尚无封禁记录。')); return; }
    for (const row of rows) {
      const line = el('div', 'ban');
      line.append(el('code', '', row.ip_key.slice(0, 12)), action('解除封禁', '', () => act('unban', { ipKey: row.ip_key })));
      bansBox.append(line);
    }
  }

  function showReplyForm(item, row) {
    if (activeReplyForm) {
      const sameComment = activeReplyForm.parentElement === item;
      activeReplyForm.remove();
      activeReplyForm = null;
      if (sameComment) return;
    }
    const form = el('form', 'reply-form');
    const textarea = el('textarea');
    textarea.placeholder = `回复 ${row.nickname}…`;
    textarea.setAttribute('aria-label', `回复 ${row.nickname}`);
    textarea.maxLength = 2000;
    textarea.required = true;
    const controls = el('div', 'reply-controls');
    const send = el('button', 'primary', '发送回复');
    send.type = 'submit';
    controls.append(send, action('取消', '', () => { form.remove(); activeReplyForm = null; }));
    const notice = el('p', 'muted');
    form.append(textarea, controls, notice);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!textarea.value.trim()) return;
      send.disabled = true;
      notice.textContent = '正在发送…';
      try {
        await request('/api/comments', { method: 'POST', body: JSON.stringify({ path: row.page_path, parentId: row.id, body: textarea.value }) });
        activeReplyForm = null;
        status.textContent = '回复已发送。';
        await load(true);
      } catch (error) {
        notice.textContent = error.message;
        send.disabled = false;
      }
    });
    item.append(form);
    activeReplyForm = form;
    textarea.focus();
  }

  function renderComment(row) {
    const item = el('article', `item${row.deleted_at ? ' deleted' : ''}`);
    const head = el('div', 'item-head');
    head.append(el('strong', '', row.nickname));
    head.append(el('span', 'muted', new Date(row.created_at).toLocaleString('zh-CN')));
    const link = el('a', '', row.page_path);
    link.href = `${row.page_path}#comments`;
    head.append(link);
    item.append(head, el('p', 'item-body', row.body));
    const actions = el('div', 'item-actions');
    if (!row.deleted_at) actions.append(action('回复', '', () => showReplyForm(item, row)));
    actions.append(action(row.deleted_at ? '恢复' : '删除', row.deleted_at ? '' : 'danger', () => act(row.deleted_at ? 'restore' : 'delete', { id: row.id })));
    if (row.ip_key) {
      actions.append(action(banned.has(row.ip_key) ? '解除 IP 封禁' : '封禁 IP', '', () => act(banned.has(row.ip_key) ? 'unban' : 'ban', { ipKey: row.ip_key })));
      const nicknames = el('span', 'muted');
      actions.append(action('查看同网络昵称', '', async () => {
        nicknames.textContent = '正在读取…';
        try {
          const data = await request(`/api/admin/nicknames?ipKey=${row.ip_key}`);
          nicknames.textContent = `使用过的昵称：${data.nicknames.map(entry => `${entry.nickname}（${entry.comments} 条）`).join('、')}${data.hasMore ? '，还有更多' : ''}`;
        } catch (error) { nicknames.textContent = error.message; }
      }));
      actions.append(el('code', '', `网络编号 ${row.ip_key.slice(0, 12)}`));
      item.append(nicknames);
    }
    item.append(actions);
    return item;
  }

  async function load(reset = false) {
    try {
      const suffix = reset || !nextBefore ? '' : `?before=${nextBefore}`;
      const data = await request(`/api/admin/comments${suffix}`);
      if (reset) {
        activeReplyForm = null;
        commentsBox.replaceChildren();
      }
      renderBans(data.bans);
      for (const row of data.comments) commentsBox.append(renderComment(row));
      if (!commentsBox.children.length) commentsBox.append(el('p', 'muted', '还没有留言。'));
      nextBefore = data.nextBefore;
      more.hidden = !nextBefore;
      loginSection.hidden = true;
      manageSection.hidden = false;
    } catch (error) {
      if (/登录/.test(error.message)) {
        token = '';
        sessionStorage.removeItem(tokenKey);
        loginSection.hidden = false;
        manageSection.hidden = true;
      }
      status.textContent = error.message;
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = '正在登录…';
    try {
      const data = await fetch(`${api}/api/admin/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: loginForm.elements.password.value })
      }).then(async result => { const data = await result.json(); if (!result.ok) throw new Error(data.error || '登录失败。'); return data; });
      token = data.token;
      sessionStorage.setItem(tokenKey, token);
      loginForm.reset();
      status.textContent = '';
      await load(true);
    } catch (error) { status.textContent = error.message; }
  });
  document.getElementById('logout').addEventListener('click', () => {
    token = '';
    sessionStorage.removeItem(tokenKey);
    loginSection.hidden = false;
    manageSection.hidden = true;
    status.textContent = '已退出管理。';
  });
  more.addEventListener('click', () => load());
  if (token) load(true);
})();
