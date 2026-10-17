import { createHash } from 'node:crypto';

const PUBLIC_ORIGIN = 'https://liangmouyin.com';
const MAX_BODY = 2000;
const MAX_NICKNAME = 40;
const SESSION_MS = 12 * 60 * 60 * 1000;

function allowedOrigin(origin) {
  return origin === PUBLIC_ORIGIN || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin || '');
}

function response(data, status = 200, origin = '') {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (allowedOrigin(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type, authorization, x-comment-voter';
    headers.vary = 'Origin';
  }
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}

function pagePath(value) {
  if (typeof value !== 'string' || value.length > 300 || !/^\/[a-zA-Z0-9/_-]+\/$/.test(value)) return null;
  return value;
}

function ipKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local-preview';
  return createHash('sha256').update(`${env.IP_SALT || 'local-only'}:${ip}`).digest('hex');
}

function voterKey(voterId, env) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(voterId || '')) return null;
  return createHash('sha256').update(`${env.IP_SALT}:vote:${voterId.toLowerCase()}`).digest('hex');
}

function avatarFor(email) {
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=80`;
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function sameSecret(left, right) {
  const a = await digest(left);
  const b = await digest(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function adminToken(env) {
  const expiry = Date.now() + SESSION_MS;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env.SESSION_SECRET), new TextEncoder().encode(String(expiry)));
  return `${expiry}.${base64url(new Uint8Array(signature))}`;
}

async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [expiry, signature] = token.split('.');
  if (!/^\d{13}$/.test(expiry || '') || Number(expiry) < Date.now() || !/^[A-Za-z0-9_-]+$/.test(signature || '')) return false;
  const expected = await adminTokenForExpiry(env.SESSION_SECRET, expiry);
  return await sameSecret(signature, expected);
}

async function adminTokenForExpiry(secret, expiry) {
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), new TextEncoder().encode(expiry));
  return base64url(new Uint8Array(signature));
}

function publicRow(row) {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    nickname: row.nickname,
    authorUrl: row.author_url || '',
    avatarUrl: row.avatar_url,
    body: row.body,
    createdAt: row.created_at,
    isAuthor: Boolean(row.is_author),
    voteScore: Number(row.vote_score || 0),
    viewerVote: Number(row.viewer_vote || 0)
  };
}

async function jsonBody(request) {
  if (Number(request.headers.get('content-length') || 0) > 8192) return null;
  try {
    const text = await request.text();
    return text.length <= 8192 ? JSON.parse(text) : null;
  } catch { return null; }
}

async function listComments(request, env, path, origin) {
  const viewer = env.IP_SALT ? voterKey(request.headers.get('x-comment-voter'), env) : null;
  const rows = await env.DB.prepare(`SELECT c.id, c.parent_id, c.nickname, c.author_url, c.avatar_url,
    c.body, c.created_at, c.is_author, COALESCE(SUM(v.value), 0) AS vote_score,
    COALESCE(MAX(CASE WHEN v.voter_key = ? THEN v.value END), 0) AS viewer_vote
    FROM simple_comments c LEFT JOIN simple_comment_votes v ON v.comment_id = c.id
    WHERE c.page_path = ? AND c.deleted_at IS NULL
    GROUP BY c.id ORDER BY c.created_at ASC LIMIT 500`).bind(viewer || '', path).all();
  return response({ comments: rows.results.map(publicRow) }, 200, origin);
}

async function postVote(request, env, origin) {
  if (!env.IP_SALT) return response({ error: '服务尚未配置。' }, 503, origin);
  const data = await jsonBody(request);
  const id = typeof data?.id === 'string' ? data.id : '';
  const value = data?.value;
  const voter = voterKey(data?.voterId, env);
  if (!id || id.length > 128 || !voter || ![-1, 0, 1].includes(value)) {
    return response({ error: '投票数据无效。' }, 400, origin);
  }
  const comment = await env.DB.prepare('SELECT id FROM simple_comments WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!comment) return response({ error: '留言不存在。' }, 404, origin);
  const key = ipKey(request, env);
  const banned = await env.DB.prepare('SELECT ip_key FROM simple_banned_ips WHERE ip_key = ?').bind(key).first();
  if (banned) return response({ error: '此网络暂时无法投票。' }, 403, origin);
  const now = Date.now();
  const permitted = await env.DB.prepare('INSERT INTO simple_post_limits(ip_key, last_at) VALUES(?, ?) ON CONFLICT(ip_key) DO UPDATE SET last_at = excluded.last_at WHERE simple_post_limits.last_at < ? RETURNING last_at').bind(`vote:${key}`, now, now - 300).first();
  if (!permitted) return response({ error: '操作太频繁，请稍后再试。' }, 429, origin);
  if (value === 0) {
    await env.DB.prepare('DELETE FROM simple_comment_votes WHERE comment_id = ? AND voter_key = ?').bind(id, voter).run();
  } else {
    await env.DB.prepare('INSERT INTO simple_comment_votes(comment_id, voter_key, value, created_at) VALUES(?, ?, ?, ?) ON CONFLICT(comment_id, voter_key) DO UPDATE SET value = excluded.value, created_at = excluded.created_at').bind(id, voter, value, now).run();
  }
  const tally = await env.DB.prepare('SELECT COALESCE(SUM(value), 0) AS score FROM simple_comment_votes WHERE comment_id = ?').bind(id).first();
  return response({ voteScore: Number(tally.score), viewerVote: value }, 200, origin);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function telegramSend(env, payload) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, disable_web_page_preview: true, ...payload })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(`Telegram sendMessage ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.result;
}

async function notifyTelegram(env, row, path) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const chars = Array.from(row.body.replace(/\s+/g, ' '));
  const excerpt = chars.length > 200 ? `${chars.slice(0, 200).join('')}…` : chars.join('');
  const text = [
    `💬 <b>${escapeHtml(row.nickname)}</b> ${row.parent_id ? '回复了一条留言' : '留言了'}`,
    '',
    escapeHtml(excerpt),
    '',
    `页面：${escapeHtml(`${PUBLIC_ORIGIN}${path}#comments`)}`,
    `管理：${PUBLIC_ORIGIN}/comments-admin/`,
    `ID：<code>${row.id}</code>`,
    '直接回复这条消息即可以作者身份回复。'
  ].join('\n');
  try {
    const sent = await telegramSend(env, { text, parse_mode: 'HTML' });
    if (sent?.message_id) {
      await env.DB.prepare('INSERT OR REPLACE INTO simple_telegram_messages(message_id, comment_id, created_at) VALUES(?, ?, ?)')
        .bind(sent.message_id, row.id, Date.now()).run()
        .catch(error => console.error('Telegram mapping save failed', error?.message || error));
    }
  } catch (error) {
    console.error('Telegram notify error', error?.message || error);
  }
}

const UUID_RE = /[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i;

async function commentForTelegramReply(env, replyTo) {
  let commentId = null;
  try {
    const mapped = await env.DB.prepare('SELECT comment_id FROM simple_telegram_messages WHERE message_id = ?').bind(replyTo.message_id).first();
    commentId = mapped?.comment_id || null;
  } catch (error) {
    console.error('Telegram mapping lookup failed', error?.message || error);
  }
  if (!commentId) commentId = (String(replyTo.text || '').match(UUID_RE) || [])[0] || null;
  if (!commentId) return null;
  return env.DB.prepare('SELECT id, page_path FROM simple_comments WHERE id = ? AND deleted_at IS NULL').bind(commentId).first();
}

async function telegramWebhook(request, env) {
  const ok = () => new Response('ok');
  if (!env.TELEGRAM_WEBHOOK_SECRET || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return new Response('not configured', { status: 404 });
  if (!await sameSecret(request.headers.get('x-telegram-bot-api-secret-token') || '', env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response('unauthorized', { status: 401 });
  }
  let update;
  try { update = await request.json(); } catch { return ok(); }
  const message = update?.message;
  if (!message || String(message.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) return ok();
  const reply = (text, extra = {}) => telegramSend(env, { text, reply_to_message_id: message.message_id, ...extra })
    .catch(error => console.error('Telegram reply error', error?.message || error));
  const body = String(message.text || '').trim();
  if (!message.reply_to_message) {
    await reply('要回复读者，请直接"回复"那条新留言通知，再输入内容。');
    return ok();
  }
  if (!body) {
    await reply('只支持文字回复。');
    return ok();
  }
  if (body.length > MAX_BODY) {
    await reply(`回复太长了，请控制在 ${MAX_BODY} 字以内。`);
    return ok();
  }
  try {
    const parent = await commentForTelegramReply(env, message.reply_to_message);
    if (!parent) {
      await reply('找不到对应的留言（可能已被删除），没有发布。');
      return ok();
    }
    const now = Date.now();
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO simple_comments(id, page_path, parent_id, nickname, avatar_url, body, created_at, ip_key, is_author) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, parent.page_path, parent.id, '梁某银', '', body, now, 'telegram', 1).run();
    await reply(`已回复 ✅\n${PUBLIC_ORIGIN}${parent.page_path}#comments`);
  } catch (error) {
    console.error('Telegram webhook error', error?.message || error);
    await reply('回复失败，请稍后再试或去管理页回复。');
  }
  return ok();
}

async function postComment(request, env, origin, ctx) {
  if (!env.IP_SALT) return response({ error: '服务尚未配置。' }, 503, origin);
  const data = await jsonBody(request);
  if (!data || data.website) return response({ error: '留言未提交。' }, 400, origin);
  const path = pagePath(data.path);
  const nickname = String(data.nickname || '').trim();
  const email = String(data.email || '').trim();
  const body = String(data.body || '').trim();
  const parentId = data.parentId ? String(data.parentId) : null;
  const admin = await isAdmin(request, env);
  if (!path || !body || body.length > MAX_BODY || (!admin && (!nickname || nickname.length > MAX_NICKNAME || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || email.length > 254))) {
    return response({ error: '请检查昵称、邮箱格式和留言内容。' }, 400, origin);
  }
  if (parentId) {
    const parent = await env.DB.prepare('SELECT id FROM simple_comments WHERE id = ? AND page_path = ? AND deleted_at IS NULL').bind(parentId, path).first();
    if (!parent) return response({ error: '要回复的留言不存在。' }, 400, origin);
  }
  const key = ipKey(request, env);
  const now = Date.now();
  if (!admin) {
    const banned = await env.DB.prepare('SELECT ip_key FROM simple_banned_ips WHERE ip_key = ?').bind(key).first();
    if (banned) return response({ error: '此网络暂时无法留言。' }, 403, origin);
    const permitted = await env.DB.prepare('INSERT INTO simple_post_limits(ip_key, last_at) VALUES(?, ?) ON CONFLICT(ip_key) DO UPDATE SET last_at = excluded.last_at WHERE simple_post_limits.last_at < ? RETURNING last_at').bind(key, now, now - 30_000).first();
    if (!permitted) return response({ error: '发送太频繁，请稍后再试。' }, 429, origin);
  }
  const row = {
    id: crypto.randomUUID(), parent_id: parentId, nickname: admin ? '梁某银' : nickname,
    avatar_url: admin || !email ? '' : avatarFor(email),
    body, created_at: now, is_author: admin ? 1 : 0
  };
  await env.DB.prepare('INSERT INTO simple_comments(id, page_path, parent_id, nickname, avatar_url, body, created_at, ip_key, is_author) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(row.id, path, row.parent_id, row.nickname, row.avatar_url, row.body, now, key, row.is_author).run();
  if (!admin && ctx) ctx.waitUntil(notifyTelegram(env, row, path));
  return response({ comment: publicRow(row) }, 201, origin);
}

async function adminLogin(request, env, origin) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.IP_SALT) return response({ error: '管理功能尚未配置。' }, 503, origin);
  const data = await jsonBody(request);
  if (!data || typeof data.password !== 'string') return response({ error: '请输入密码。' }, 400, origin);
  const key = `login:${ipKey(request, env)}`;
  const now = Date.now();
  const permitted = await env.DB.prepare('INSERT INTO simple_post_limits(ip_key, last_at) VALUES(?, ?) ON CONFLICT(ip_key) DO UPDATE SET last_at = excluded.last_at WHERE simple_post_limits.last_at < ? RETURNING last_at').bind(key, now, now - 3_000).first();
  if (!permitted) return response({ error: '请稍后再试。' }, 429, origin);
  if (!await sameSecret(data.password, env.ADMIN_PASSWORD)) return response({ error: '密码错误。' }, 401, origin);
  return response({ token: await adminToken(env), expiresAt: now + SESSION_MS }, 200, origin);
}

async function adminList(env, origin, before) {
  const cursor = Number(before) || Date.now() + 1;
  const comments = await env.DB.prepare('SELECT id, page_path, parent_id, nickname, body, created_at, ip_key, deleted_at FROM simple_comments WHERE created_at < ? ORDER BY created_at DESC LIMIT 101').bind(cursor).all();
  const bans = await env.DB.prepare('SELECT ip_key, created_at FROM simple_banned_ips ORDER BY created_at DESC LIMIT 200').all();
  const hasMore = comments.results.length > 100;
  const page = comments.results.slice(0, 100);
  return response({ comments: page, bans: bans.results, nextBefore: hasMore ? page.at(-1).created_at : null }, 200, origin);
}

async function adminNicknames(env, origin, key) {
  if (!/^[a-f0-9]{64}$/.test(key || '')) return response({ error: '网络编号无效。' }, 400, origin);
  const rows = await env.DB.prepare('SELECT nickname, COUNT(*) AS comments FROM simple_comments WHERE ip_key = ? GROUP BY nickname ORDER BY comments DESC, nickname LIMIT 101').bind(key).all();
  return response({ nicknames: rows.results.slice(0, 100), hasMore: rows.results.length > 100 }, 200, origin);
}

async function adminAction(request, env, origin) {
  const data = await jsonBody(request);
  if (!data || !['delete', 'restore', 'ban', 'unban'].includes(data.action)) return response({ error: '操作无效。' }, 400, origin);
  if (data.action === 'delete' || data.action === 'restore') {
    const id = String(data.id || '');
    if (!id || id.length > 128) return response({ error: '留言 ID 无效。' }, 400, origin);
    const result = await env.DB.prepare('UPDATE simple_comments SET deleted_at = ? WHERE id = ?').bind(data.action === 'delete' ? Date.now() : null, id).run();
    if (!result.meta.changes) return response({ error: '留言不存在。' }, 404, origin);
  } else {
    const key = String(data.ipKey || '');
    if (!/^[a-f0-9]{64}$/.test(key)) return response({ error: '网络编号无效。' }, 400, origin);
    if (data.action === 'ban') await env.DB.prepare('INSERT OR IGNORE INTO simple_banned_ips(ip_key, created_at) VALUES(?, ?)').bind(key, Date.now()).run();
    else await env.DB.prepare('DELETE FROM simple_banned_ips WHERE ip_key = ?').bind(key).run();
  }
  return response({ ok: true }, 200, origin);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('origin') || '';
    if (origin && !allowedOrigin(origin)) return response({ error: '来源未获允许。' }, 403);
    if (request.method === 'OPTIONS') return response({}, 204, origin);
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/telegram/webhook') return telegramWebhook(request, env);
      if (request.method === 'GET' && url.pathname === '/api/health') return response({ ok: true }, 200, origin);
      if (request.method === 'GET' && url.pathname === '/api/comments') {
        const path = pagePath(url.searchParams.get('path'));
        return path ? listComments(request, env, path, origin) : response({ error: '文章地址无效。' }, 400, origin);
      }
      if (request.method === 'POST' && url.pathname === '/api/comments') return postComment(request, env, origin, ctx);
      if (request.method === 'POST' && url.pathname === '/api/comments/vote') return postVote(request, env, origin);
      if (request.method === 'POST' && url.pathname === '/api/admin/login') return adminLogin(request, env, origin);
      if (url.pathname.startsWith('/api/admin/')) {
        if (!await isAdmin(request, env)) return response({ error: '请先登录管理页。' }, 401, origin);
        if (request.method === 'GET' && url.pathname === '/api/admin/comments') return adminList(env, origin, url.searchParams.get('before'));
        if (request.method === 'GET' && url.pathname === '/api/admin/nicknames') return adminNicknames(env, origin, url.searchParams.get('ipKey'));
        if (request.method === 'POST' && url.pathname === '/api/admin/action') return adminAction(request, env, origin);
      }
      return response({ error: '地址不存在。' }, 404, origin);
    } catch (error) {
      console.error(error);
      return response({ error: '服务暂时不可用。' }, 500, origin);
    }
  }
};
