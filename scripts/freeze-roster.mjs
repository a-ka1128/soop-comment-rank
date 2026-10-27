/**
 * 확정 명단(src/lib/roster.js)을 만든다.
 *
 * 선발이 끝나면 순위를 굳혀야 한다. 좋아요는 마감 뒤에도 계속 들어오는데,
 * 그걸로 순서가 바뀌면 그건 이미 발표한 것과 다른 명단이다.
 *
 *   node scripts/freeze-roster.mjs --top 120
 *   node scripts/freeze-roster.mjs --order order.json --fixed 방송국주소=닉네임 --commander "A,B,C"
 *
 * --top N        좋아요 상위 N명을 그 순서대로 굳힌다.
 * --order 파일   닉네임 배열 JSON. 발표한 이미지처럼 정해진 순서가 따로 있을 때 쓴다.
 *                모든 이름이 댓글과 정확히 하나씩 맞아야 하고, 아니면 멈춘다.
 * --fixed id=닉  댓글 없이 맨 앞에 세울 사람(방송인 본인 등). 좋아요 자리는 비운다.
 * --commander    쉼표로 구분한 닉네임. --fixed 다음 자리로 끌어올린다.
 * --out 경로     기본 src/lib/roster.js
 *
 * 이름은 눈으로 옮기지 말고 반드시 이 스크립트의 검증을 통과시킬 것.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fetchAllComments } from '../src/lib/soop.js'
import { HAS_TARGET, TARGET_POST } from '../src/lib/target.js'

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const out = arg('out', 'src/lib/roster.js')
const top = Number(arg('top', 0))
const orderPath = arg('order')
const fixed = arg('fixed')
const commanders = (arg('commander') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

if (!HAS_TARGET) {
  console.error('src/lib/target.js 에 대상 게시글을 먼저 적으세요.')
  process.exit(2)
}

if (!top && !orderPath) {
  console.error('--top 이나 --order 중 하나는 있어야 합니다.')
  process.exit(2)
}

const { comments } = await fetchAllComments(TARGET_POST.bjId, TARGET_POST.postNo, {})
const sorted = [...comments].sort((a, b) => b.likes - a.likes || a.date.localeCompare(b.date))
console.log(`댓글 ${comments.length}개를 읽었습니다.`)

/** 닉네임으로 댓글을 찾는다. 겹치는 닉이 있으면 어느 쪽인지 알 수 없으니 멈춘다. */
const byNick = new Map()
for (const c of comments) {
  if (byNick.has(c.nick)) byNick.set(c.nick, 'DUP')
  else byNick.set(c.nick, c)
}
function find(nick, where) {
  const hit = byNick.get(nick)
  if (!hit) throw new Error(`${where}: '${nick}' 과 같은 닉네임의 댓글이 없습니다.`)
  if (hit === 'DUP') throw new Error(`${where}: '${nick}' 이 여러 명입니다. userId 로 직접 지정하세요.`)
  return hit
}

const rows = []

if (fixed) {
  const [userId, nick] = fixed.split('=')
  if (!userId || !nick) throw new Error("--fixed 는 'userId=닉네임' 형식입니다.")
  // 댓글이 없는 줄이라 id 를 만들어 준다. 화면에서는 좋아요가 '—' 로 나온다.
  rows.push({ id: `fixed-${userId}`, userId, nick, likes: null, role: 'fixed' })
}
for (const nick of commanders) {
  const c = find(nick, '--commander')
  rows.push({ id: c.id, userId: c.userId, nick: c.nick, likes: c.likes, role: 'commander' })
}

const promoted = new Set(rows.map((r) => r.nick))

if (orderPath) {
  const order = JSON.parse(await readFile(orderPath, 'utf8'))
  const listed = order.map((nick) => find(nick, '--order'))

  // 적어 준 순서가 실제 상위권과 같은 사람들인지 본다. 눈으로 옮기다 한 명을
  // 빠뜨리면 여기서 걸린다.
  const expected = sorted.slice(0, listed.length + promoted.size - (fixed ? 1 : 0))
  const missing = expected.filter((c) => !order.includes(c.nick) && !promoted.has(c.nick))
  if (missing.length > 0) {
    console.warn(`경고: 상위권인데 --order 에 없는 사람 ${missing.length}명 —`,
      missing.map((c) => `${c.nick}(${c.likes})`).join(', '))
  }
  for (const c of listed) {
    rows.push({ id: c.id, userId: c.userId, nick: c.nick, likes: c.likes, role: null })
  }
} else {
  for (const c of sorted) {
    if (rows.length >= top) break
    if (promoted.has(c.nick)) continue
    rows.push({ id: c.id, userId: c.userId, nick: c.nick, likes: c.likes, role: null })
  }
}

const q = (s) => JSON.stringify(s)
const line = (r, i) =>
  `  { rank: ${i + 1}, id: ${typeof r.id === 'string' ? q(r.id) : r.id}, userId: ${q(r.userId)},` +
  ` nick: ${q(r.nick)}, likes: ${r.likes === null ? 'null' : r.likes}` +
  `${r.role ? `, role: ${q(r.role)}` : ''} },`

const header = [
  '/**',
  ` * 확정된 선발 명단 ${rows.length}명.`,
  ' *',
  ' * scripts/freeze-roster.mjs 가 만든 파일이다. 손으로 고치지 말고 다시 돌릴 것.',
  ' *',
  ' * 선발이 끝났으므로 좋아요는 계속 움직여도 순위는 여기서 굳는다.',
  ' * likes 는 굳힌 순간의 값이고, 화면에는 지금 값이 나온다.',
  ' *',
  ` * 대상 글: ${TARGET_POST.bjId}/${TARGET_POST.postNo}`,
  ` * 굳힌 시각: ${new Date().toISOString()}`,
  ' */',
  'export const FROZEN_ROSTER = [',
].join('\n')

const body = [
  header,
  rows.map(line).join('\n'),
  ']',
  '',
  '/** id 로 바로 찾기. 명단에 없는 댓글은 화면에서 뺀다. */',
  'export const ROSTER_BY_ID = new Map(FROZEN_ROSTER.map((r) => [r.id, r]))',
  '',
].join('\n')

await writeFile(out, body, 'utf8')
console.log(`${out} 에 ${rows.length}명을 적었습니다.`)
console.log(`  1위 ${rows[0].nick}   ...   ${rows.length}위 ${rows[rows.length - 1].nick}`)
if (fixed) console.log('  고정 1명, 부리더', commanders.length, '명')
console.log('prettier 로 한 번 다듬으세요: npx prettier --write --single-quote --no-semi --print-width 100', out)
