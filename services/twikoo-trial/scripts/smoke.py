"""Verify an explicitly selected trial API; remove only comments created by this run."""
import json, sys, subprocess, uuid
from pathlib import Path
base = sys.argv[1]
if base not in ('http://localhost:8787/api', 'https://lmy-comments-trial.suihantarot.workers.dev/api'):
    raise SystemExit('Only the local or deployed trial API is allowed.')
password = (Path(__file__).resolve().parent.parent / '.admin-password').read_text().strip()
path = '/automated-test/' + uuid.uuid4().hex + '/'
created = []
def call(event, **kw):
    response = subprocess.run(['curl', '--fail-with-body', '--silent', '--show-error', '--max-time', '30', '-H', 'Content-Type: application/json', '--data-binary', '@-', base], input=json.dumps(dict(event=event, **kw)), text=True, capture_output=True, check=True)
    return json.loads(response.stdout)

def require(condition, label):
    if not condition:
        raise RuntimeError(label)
    print('PASS:', label)
try:
    require(call('GET_CONFIG')['config']['REQUIRED_FIELDS'] == 'nick', 'nickname is the only required identity field')
    require(call('COMMENT_GET_FOR_ADMIN', per=10, page=1)['code'] == 1024, 'anonymous admin access denied')
    require(call('SET_PASSWORD', password='invalid-test-password')['code'] != 0, 'anonymous password replacement denied')
    require(call('UPLOAD_IMAGE')['code'] != 0, 'image upload disabled')
    require(call('COMMENT_SUBMIT', url=path, nick='', ua='Mozilla/5.0', comment='test')['code'] != 0, 'empty nickname rejected')
    parent = call('COMMENT_SUBMIT', nick='测试读者', mail='', ua='Mozilla/5.0', url=path, href=base, comment='自动验证留言；测试完成后删除。')
    require(bool(parent.get('id')), 'anonymous comment without email saved')
    created.append(parent['id'])
    reply = call('COMMENT_SUBMIT', nick='测试回复', mail='', ua='Mozilla/5.0', url=path, href=base, comment='自动验证回复。', pid=parent['id'], rid=parent['id'])
    require(bool(reply.get('id')), 'reply saved')
    created.append(reply['id'])
    rows = call('COMMENT_GET', url=path)['data']
    require(len(rows)==1 and len(rows[0]['replies'])==1, 'parent and reply read back together')
    require(all(k not in rows[0] for k in ('mail','ip')), 'public response omits raw email and IP')
    require(call('COMMENT_GET_FOR_ADMIN', per=10,page=1, accessToken=password).get('code')==0, 'administrator access works')
finally:
    for comment_id in reversed(created):
        require(call('COMMENT_DELETE_FOR_ADMIN', id=comment_id, accessToken=password).get('code')==0, 'own test comment deleted')
if created:
    require(call('COMMENT_GET',url=path).get('count')==0, 'test comments cleaned up')
