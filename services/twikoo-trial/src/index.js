import upstream from './upstream.js';
// The upstream implementation stores request state in module globals.
// Serialize calls within each isolate so concurrent requests cannot share admin identity.
let pending = Promise.resolve();
export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/api') return new Response('Not found', {status:404});
    if (request.method === 'POST') {
      const raw = await request.clone().text();
      if (raw.length > 16384) return new Response('Request too large', {status:413});
      let event;
      try { event = JSON.parse(raw); } catch { return new Response('Invalid JSON', {status:400}); }
      if (event.event === 'COMMENT_SUBMIT' && (!String(event.nick || '').trim() || String(event.comment || '').length > 2000)) {
        return Response.json({code:1000,message:'请填写昵称，评论请控制在 2000 字以内。'});
      }
      if (['UPLOAD_IMAGE', 'EMAIL_TEST'].includes(event.event)) {
        return Response.json({code:1000,message:'试用期间暂未启用图片上传和邮件通知。'});
      }
    }
    const run = pending.then(() => upstream.fetch(request, env, ctx));
    pending = run.catch(() => {});
    return run;
  }
};
