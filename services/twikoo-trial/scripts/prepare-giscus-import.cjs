#!/usr/bin/env node
// Convert locally saved, public GitHub Discussion pages into a reviewable D1 import.
// Run from the repository only after backing up every Discussion HTML page.
const fs = require('node:fs')
const path = require('node:path')
const cheerio = require('cheerio')

const backupDir = process.argv[2]
if (!backupDir) throw new Error('Usage: node scripts/prepare-giscus-import.cjs BACKUP_DIR')
const pagesDir = path.join(backupDir, 'github')
const pages = fs.readdirSync(pagesDir)
  .filter(name => /^\d+\.html$/.test(name))
  .sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]))

const normalize = value => value.replace(/\s+/g, ' ')
const children = ($, node) => (node.children || []).map(child => render($, child)).join('')
function render ($, node) {
  if (node.type === 'text') return normalize(node.data || '')
  if (node.type !== 'tag') return ''
  const name = node.name
  const inner = children($, node)
  if (name === 'br') return '\n'
  if (name === 'p') return `${inner.trim()}\n\n`
  if (name === 'strong' || name === 'b') return `**${inner.trim()}**`
  if (name === 'em' || name === 'i') return `*${inner.trim()}*`
  if (name === 'code') return `\`${inner}\``
  if (name === 'pre') return `\n\n\`\`\`\n${$(node).text()}\n\`\`\`\n\n`
  if (name === 'a') {
    const href = $(node).attr('href') || ''
    return href ? `[${inner.trim()}](${href})` : inner
  }
  if (name === 'img') return `![${$(node).attr('alt') || ''}](${$(node).attr('src') || ''})`
  if (name === 'blockquote') return `\n\n${inner.trim().split('\n').map(line => `> ${line}`).join('\n')}\n\n`
  if (name === 'ul' || name === 'ol') {
    return `\n${$(node).children('li').toArray().map((li, i) =>
      `${name === 'ol' ? `${i + 1}.` : '-'} ${children($, li).trim()}`
    ).join('\n')}\n\n`
  }
  return inner
}

function sqlText (value) {
  if (String(value).includes('\0')) throw new Error('NUL byte in comment')
  return `'${String(value).replace(/'/g, "''")}'`
}

const records = []
const discussionIds = new Set()
const ids = new Set()
const timestamps = new Set()
const skipped = []
for (const page of pages) {
  const number = Number(page.split('.')[0])
  const $ = cheerio.load(fs.readFileSync(path.join(pagesDir, page), 'utf8'))
  const title = $('h1').first().text().replace(/\s*#\d+\s*$/, '').trim()
  if (!/^blog\/[^\s]+\/$/.test(title)) {
    skipped.push({ number, title })
    continue
  }
  const url = `/${title}`
  if (discussionIds.has(url)) throw new Error(`Duplicate discussion path: ${url}`)
  discussionIds.add(url)
  const comments = $('.js-discussion-comment').toArray()
  if (!comments.length) throw new Error(`Missing discussion body: ${number}`)
  for (const element of comments.slice(1)) {
    const wrapper = $(element)
    const ancestry = wrapper.parents('[data-gid^="DC_"]').toArray()
    const id = ancestry.length ? $(ancestry[0]).attr('data-gid') : ''
    if (!id || ids.has(id)) throw new Error(`Missing or duplicate comment ID: ${number} ${id}`)
    ids.add(id)
    const parentId = ancestry.map(node => $(node).attr('data-gid')).find(gid => gid !== id) || ''
    const body = wrapper.find('.js-comment-body').first()
    const html = (body.html() || '').trim()
    const markdown = body.toArray().map(node => children($, node)).join('').trim()
    const author = wrapper.find('a[data-hydro-click*="USER_PROFILE_LINK"]').first()
    const authorLogin = author.text().trim()
    const authorUrl = author.attr('href') ? `https://github.com${author.attr('href')}` : ''
    const avatar = wrapper.find('img.avatar').first().attr('src') || ''
    const createdAt = wrapper.find('relative-time').map((_, node) => $(node).attr('datetime')).get()
      .find(value => /^\d{4}-\d\d-\d\dT/.test(value))
    const created = Date.parse(createdAt)
    const anchor = wrapper.parent().closest('[id^="discussioncomment-"]').attr('id') || ''
    if (!html || !markdown || !authorLogin || !Number.isFinite(created) || !anchor) {
      throw new Error(`Incomplete comment: discussion ${number}, ID ${id}`)
    }
    const timestampKey = `${url}\0${created}`
    if (timestamps.has(timestampKey)) throw new Error(`D1 timestamp collision: ${number} ${createdAt}`)
    timestamps.add(timestampKey)
    records.push({
      id, discussionNumber: number, url,
      sourceUrl: `https://github.com/LiangSam/myblog-hugo/discussions/${number}#${anchor}`,
      parentId, rootId: '', authorLogin, authorUrl, avatar, createdAt, created, html, markdown
    })
  }
}

const byId = new Map(records.map(record => [record.id, record]))
for (const record of records) {
  if (!record.parentId) continue
  let parent = byId.get(record.parentId)
  if (!parent || parent.url !== record.url) throw new Error(`Missing parent: ${record.id}`)
  while (parent.parentId) {
    parent = byId.get(parent.parentId)
    if (!parent) throw new Error(`Missing root: ${record.id}`)
  }
  record.rootId = parent.id
}

const cols = [
  '_id', 'uid', 'nick', 'mail', 'mailMd5', 'link', 'ua', 'ip', 'ipRegion',
  'master', 'url', 'href', 'comment', 'pid', 'rid', 'isSpam', 'created',
  'updated', 'like', 'top', 'avatar'
]
const sql = records.map(record => {
  const values = [
    record.id, `github:${record.id}`, record.authorLogin, '', '', record.authorUrl,
    '', '', '', Number(record.authorLogin === 'LiangSam'), record.url,
    `https://liangmouyin.com${record.url}`, record.markdown,
    record.parentId, record.rootId, 0, record.created, record.created, '[]', 0, record.avatar
  ]
  const encoded = values.map(value => typeof value === 'number' ? String(value) : sqlText(value))
  return `INSERT INTO comment (${cols.join(', ')}) SELECT ${encoded.join(', ')} ` +
    `WHERE NOT EXISTS (SELECT 1 FROM comment WHERE _id = ${sqlText(record.id)});`
}).join('\n') + '\n'

const output = path.join(backupDir, 'giscus-comments.json')
const sqlOutput = path.join(backupDir, 'giscus-import.sql')
fs.writeFileSync(output, JSON.stringify({ source: 'LiangSam/myblog-hugo Discussions', skipped, records }, null, 2) + '\n', { mode: 0o600 })
fs.writeFileSync(sqlOutput, sql, { mode: 0o600 })
console.log(JSON.stringify({ discussions: discussionIds.size, comments: records.length, replies: records.filter(r => r.parentId).length, skipped, output, sqlOutput }))
