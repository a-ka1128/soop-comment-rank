/**
 * 신청 글·데뷔 글의 댓글이 수정되면 디스코드 웹훅으로 알린다.
 *
 *   DISCORD_WEBHOOK_URL=... node scripts/watch-edits.mjs [상태파일]
 *
 * 숲 댓글 API 에는 수정 시각이 없어서 본문을 직접 비교한다. 지난 실행의 본문은 상태 파일
 * (기본 .watch-state/texts.json)에 남기고, 워크플로가 그 파일을 캐시로 이어 준다.
 *
 * - 상태 파일이 없으면(첫 실행·캐시 만료) 기준만 잡고 알리지 않는다.
 * - 새로 달린 댓글과 지워진 댓글은 알리지 않는다. 수정만 알린다.
 * - 알림을 못 보내면 exit 1 로 끝내고 상태 파일을 고치지 않는다 — 다음 실행이 다시 시도한다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { commentUrl, fetchAllComments } from '../src/lib/soop.js'
import { DEBUT_POST, TARGET_POST } from '../src/lib/target.js'

const STATE_FILE = process.argv[2] || '.watch-state/texts.json'
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL

const POSTS = [
  { label: '길드 신청', ...TARGET_POST },
  ...(DEBUT_POST ? [{ label: '뉴 와튜버 데뷔', ...DEBUT_POST }] : []),
]

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

async function notify(edits) {
  // 한 메시지에 임베드는 10개까지다.
  for (let i = 0; i < edits.length; i += 10) {
    const chunk = edits.slice(i, i + 10)
    const body = {
      content: i === 0 ? `✏️ 수정된 댓글 ${edits.length}개` : undefined,
      // 댓글에 @everyone 이 들어 있어도 디스코드가 사람을 부르지 않게 한다.
      allowed_mentions: { parse: [] },
      embeds: chunk.map((e) => ({
        title: `${e.nick} (${e.userId})`,
        url: commentUrl(e.bjId, e.postNo, e.id),
        description: `**${e.label}** 글`,
        color: 0xe6c46a,
        fields: [
          { name: '수정 전', value: clip(e.before || '(빈 댓글)', 1000) },
          { name: '수정 후', value: clip(e.after || '(빈 댓글)', 1000) },
        ],
      })),
    }
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`디스코드 웹훅 실패: HTTP ${res.status} ${await res.text()}`)
  }
}

const before = readState()
const next = {}
const edits = []

for (const post of POSTS) {
  const { comments } = await fetchAllComments(post.bjId, post.postNo)
  next[post.postNo] = Object.fromEntries(comments.map((c) => [c.id, c.text]))
  const old = before?.[post.postNo]
  if (!old) continue
  for (const c of comments) {
    const prev = old[c.id]
    if (prev !== undefined && prev !== c.text) {
      edits.push({ ...post, id: c.id, userId: c.userId, nick: c.nick, before: prev, after: c.text })
    }
  }
}

console.log(
  `댓글 ${Object.values(next).reduce((n, p) => n + Object.keys(p).length, 0)}개 확인` +
    (before ? `, 수정 ${edits.length}개` : ' — 첫 실행이라 기준만 저장'),
)

if (edits.length > 0) {
  if (!WEBHOOK) {
    console.error('DISCORD_WEBHOOK_URL 이 없어 알릴 수 없습니다.')
    process.exit(1)
  }
  await notify(edits)
  console.log('디스코드로 알림을 보냈습니다.')
}

mkdirSync(dirname(STATE_FILE), { recursive: true })
writeFileSync(STATE_FILE, JSON.stringify(next))
