#!/usr/bin/env node
// Read comment metadata from D1 and report nickname changes for administrator review.
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const wrangler = path.join(root, 'node_modules', '.bin', 'wrangler')
const database = 'lmy-comments-trial'
const sql = `
SELECT _id, uid, nick, ua, ip, ipRegion, created, href, comment
FROM comment
WHERE master = 0
ORDER BY created DESC
`.trim()

const run = spawnSync(wrangler, [
  'd1', 'execute', database, '--remote', '--json', '--command', sql
], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
})

if (run.error) throw run.error
if (run.status !== 0) {
  process.stderr.write(run.stderr)
  process.exit(run.status || 1)
}

let response
try {
  response = JSON.parse(run.stdout)
} catch {
  process.stderr.write(run.stderr)
  throw new Error('Wrangler 没有返回可解析的 JSON。')
}

const result = Array.isArray(response) ? response[0] : response
const rows = Array.isArray(result?.results) ? result.results : []
const normalize = value => String(value || '').trim()
const nicknames = comments => [...new Set(comments.map(row => normalize(row.nick) || '匿名'))]
const shorten = (value, max = 100) => {
  const text = normalize(value).replace(/\s+/g, ' ')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
const formatTime = value => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false
}).format(new Date(Number(value)))

function groupBy (keyOf) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()]
    .filter(([, comments]) => nicknames(comments).length > 1)
    .sort((a, b) => Number(b[1][0].created) - Number(a[1][0].created))
}

const uidGroups = groupBy(row => normalize(row.uid))
const networkGroups = groupBy(row => {
  const ip = normalize(row.ip)
  const ua = normalize(row.ua)
  return ip && ua ? `${ip}\0${ua}` : ''
})

function printGroups (title, groups, describe) {
  console.log(`\n${title}：${groups.length} 组`)
  if (!groups.length) {
    console.log('  未发现使用多个昵称的记录。')
    return
  }
  for (const [key, comments] of groups) {
    console.log(`\n- ${describe(key, comments)}`)
    console.log(`  昵称：${nicknames(comments).join('、')}`)
    console.log(`  评论：${comments.length} 条`)
    for (const row of [...comments].sort((a, b) => Number(a.created) - Number(b.created))) {
      console.log(`  ${formatTime(row.created)}  ${normalize(row.nick) || '匿名'}  ${normalize(row.href)}`)
      console.log(`    ${shorten(row.comment)}`)
    }
  }
}

console.log(`已读取 ${rows.length} 条非作者评论。查询没有修改 D1 数据。`)
printGroups('相同浏览器编号使用多个昵称', uidGroups, (uid, comments) => {
  const ips = [...new Set(comments.map(row => normalize(row.ip)).filter(Boolean))]
  return `浏览器编号 ${shorten(uid, 18)}；IP ${ips.join('、') || '无记录'}`
})
printGroups('相同 IP 和浏览器信息使用多个昵称', networkGroups, (key, comments) => {
  const [ip, ua] = key.split('\0')
  const regions = [...new Set(comments.map(row => normalize(row.ipRegion)).filter(Boolean))]
  return `IP ${ip}；地区 ${regions.join('、') || '无记录'}；浏览器 ${shorten(ua, 80)}`
})

console.log('\n这些结果只能辅助审核，不能单独证明现实中是同一个人。')
