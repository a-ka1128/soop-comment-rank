/**
 * 신청자 중 지금 방송 중인 사람을 시청자 순으로 뽑아 JSON 으로 저장한다.
 * 같이 네이버 카페 데뷔 게시판 글을 받아 같은 폴더에 debut.json 으로 저장한다.
 *
 *   node scripts/watch-live.mjs [출력파일]
 *
 * SOOP 의 방송 중 목록 주소는 이 사이트(github.io)에서의 호출을 막아서(CORS) 브라우저가 직접
 * 부를 수 없다. 그래서 워크플로가 이 스크립트를 돌려 결과를 live-data 브랜치에 올리고,
 * 어드민 화면은 그 파일을 읽는다. 시청자 수는 이 스크립트가 돈 시점 기준이다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fetchAllComments } from '../src/lib/soop.js'
import { fetchDebutArticles } from '../src/lib/naver.js'
import { DEBUT_BOARD, DEBUT_POST, TARGET_POST } from '../src/lib/target.js'

const OUT = process.argv[2] || 'out/live.json'
const LIST = 'https://live.sooplive.com/api/main_broad_list_api.php'
/** 한 페이지 60명. 방송 중이 2천 명 안팎이라 40페이지면 넉넉하다. */
const MAX_PAGES = 40

const ids = new Set()
for (const post of [TARGET_POST, DEBUT_POST].filter(Boolean)) {
  const { comments } = await fetchAllComments(post.bjId, post.postNo)
  for (const c of comments) if (c.userId) ids.add(c.userId)
}

const live = []
let seen = 0
for (let page = 1; page <= MAX_PAGES; page += 1) {
  const url = `${LIST}?selectType=action&selectValue=all&orderType=view_cnt&pageNo=${page}&lang=ko`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`방송 목록 HTTP ${res.status} (${page}페이지)`)
  const data = await res.json()
  const rows = Array.isArray(data?.broad) ? data.broad : null
  if (!rows) throw new Error(`방송 목록 응답 모양이 다릅니다 (${page}페이지)`)
  if (rows.length === 0) break
  seen += rows.length
  for (const b of rows) {
    if (!ids.has(b.user_id)) continue
    live.push({
      userId: b.user_id,
      nick: b.user_nick,
      title: b.broad_title,
      viewers: Number(b.total_view_cnt) || 0,
      start: b.broad_start,
      broadNo: b.broad_no,
    })
  }
}

// 같은 사람이 목록 경계에서 두 번 잡힐 수 있다.
const unique = [...new Map(live.map((l) => [l.userId, l])).values()].sort(
  (a, b) => b.viewers - a.viewers,
)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), live: unique }))
console.log(`신청자 ${ids.size}명, 방송 중 ${seen}명 훑어 ${unique.length}명 일치`)

// 데뷔 게시판은 곁가지다. 못 읽어도 방송 중 목록은 이미 저장했으니 여기서 끊지 않고 알리기만 한다.
if (DEBUT_BOARD) {
  try {
    const comments = await fetchDebutArticles(DEBUT_BOARD)
    writeFileSync(
      join(dirname(OUT), 'debut.json'),
      JSON.stringify({ updatedAt: new Date().toISOString(), comments }),
    )
    console.log(`데뷔 게시판 글 ${comments.length}개`)
  } catch (err) {
    console.error(`데뷔 게시판을 못 읽었습니다: ${err.message}`)
  }
}
