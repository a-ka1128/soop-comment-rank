/**
 * SOOP 게시글의 좋아요를 1분마다 찍어 Firebase Realtime Database에 쌓는다.
 * systemd 타이머가 1분마다 이 스크립트를 한 번씩 돌린다 (상주하지 않는다 —
 * 죽어 있는 프로세스보다 못 돈 1분이 낫고, 재시작 관리를 systemd에 맡길 수 있다).
 *
 *   node collector/collect.mjs
 *
 * 필요한 환경변수 (.env 아님, systemd EnvironmentFile 또는 셸):
 *   SOOP_RTDB_URL            https://프로젝트-default-rtdb.firebaseio.com
 *   SOOP_SERVICE_ACCOUNT     서비스 계정 JSON 파일 경로
 *   SOOP_TRACKED             수집 대상 목록 JSON 경로 (기본: collector/tracked.json)
 */
import { readFile } from 'node:fs/promises'
import { fetchAllComments, fetchPost, parsePostUrl } from '../src/lib/soop.js'
import { Rtdb } from './lib/rtdb.mjs'

// 하루가 지난 기록은 촘촘할 필요가 없다. 1분 간격 그대로 두면 RTDB 1GB를
// 게시글 하나가 두 달쯤에 다 쓴다. 오래된 구간은 5분 간격만 남긴다.
const THIN_AFTER_MS = 24 * 60 * 60 * 1000
const THIN_KEEP_EVERY = 5

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`환경변수 ${name} 가 필요합니다.`)
  return value
}

const postKey = (bjId, postNo) => `${bjId}_${postNo}`

/** 분 단위 유닉스 시각. 키로 정렬하면 그대로 시간순이 되도록 0을 채운다. */
const tickKey = (date) => String(Math.floor(date.getTime() / 60000)).padStart(12, '0')

async function collectOne(db, entry, now) {
  const parsed = parsePostUrl(entry.url ?? `${entry.bjId}/${entry.postNo}`)
  if (!parsed) throw new Error(`수집 대상 주소를 읽을 수 없습니다: ${JSON.stringify(entry)}`)
  const { bjId, postNo } = parsed
  const key = postKey(bjId, postNo)

  let title = ''
  try {
    title = (await fetchPost(bjId, postNo)).title
  } catch (err) {
    // 애청자 공개 게시판처럼 본문만 막힌 글이 있다. 댓글만 있으면 수집은 계속한다.
    if (err.kind === 'notfound') throw err
  }

  const { comments, totalWithReplies } = await fetchAllComments(bjId, postNo, {
    postConfirmed: !!title,
  })

  const tick = tickKey(now)

  // 쓰는 위치를 좁게 잡는다. 예전에는 루트에 한 번에 PATCH했는데, RTDB가 "쓰는 위치의
  // 데이터 크기"로 한계를 걸기 때문에 데이터베이스가 커지자 하루 만에 거부당했다.
  await db.put(`posts/${key}/meta`, {
    bjId,
    postNo,
    title,
    updatedAt: now.toISOString(),
    commentCount: comments.length,
    totalWithReplies,
  })

  // 댓글 정보는 작은 서브트리라 한 번에 보내도 된다.
  // 닉네임은 바뀔 수 있으니 매번 덮어쓴다.
  const profile = {}
  for (const c of comments) {
    profile[`${c.id}/nick`] = c.nick
    profile[`${c.id}/userId`] = c.userId
    profile[`${c.id}/regDate`] = c.date
    profile[`${c.id}/likes`] = c.likes
  }
  await db.update(`posts/${key}/comments`, profile)

  // 시계열은 통째로 크므로 사람별로 나눠 쓴다. 각 요청이 닿는 곳은 그 사람의 기록뿐이다.
  await Rtdb.inBatches(comments, 8, (c) =>
    db.update(`posts/${key}/points/${c.id}`, { [tick]: c.likes })
  )

  return { key, title, count: comments.length, tick }
}

/** 하루보다 오래된 구간을 5분 간격만 남기고 지운다. */
async function thin(db, key, now) {
  const cutoff = Math.floor((now.getTime() - THIN_AFTER_MS) / 60000)
  const points = await db.get(`posts/${key}/points`)
  if (!points) return 0

  const perComment = new Map()
  let removed = 0
  for (const [commentId, series] of Object.entries(points)) {
    const drop = {}
    for (const tick of Object.keys(series)) {
      const minute = Number(tick)
      if (minute < cutoff && minute % THIN_KEEP_EVERY !== 0) {
        drop[tick] = null
        removed += 1
      }
    }
    if (Object.keys(drop).length > 0) perComment.set(commentId, drop)
  }

  // 여기도 사람별로 나눠 보낸다. 한 번에 몰면 수만 개가 되어 같은 한계에 걸린다.
  await Rtdb.inBatches([...perComment], 8, ([commentId, drop]) =>
    db.update(`posts/${key}/points/${commentId}`, drop)
  )
  return removed
}

const now = new Date()

// 설정이 틀렸을 때 VM 로그에 스택 트레이스가 쌓이면 읽을 사람이 고생한다.
// 무엇이 없는지 한 줄로 말하고 끝낸다.
let db
let tracked
try {
  const account = JSON.parse(await readFile(required('SOOP_SERVICE_ACCOUNT'), 'utf8'))
  if (!account.client_email || !account.private_key) {
    throw new Error('서비스 계정 JSON에 client_email / private_key 가 없습니다.')
  }
  db = new Rtdb(required('SOOP_RTDB_URL'), account)
  const trackedPath = process.env.SOOP_TRACKED ?? new URL('./tracked.json', import.meta.url)
  tracked = JSON.parse(await readFile(trackedPath, 'utf8'))
} catch (err) {
  console.error(`설정 오류: ${err.message}`)
  console.error('collector.env 의 SOOP_RTDB_URL / SOOP_SERVICE_ACCOUNT 를 확인하세요.')
  process.exit(2)
}

let failed = 0
for (const entry of tracked.posts ?? []) {
  try {
    const result = await collectOne(db, entry, now)
    let note = ''
    // 정각마다 한 번만 솎아낸다. 매 분 전체를 훑을 이유가 없다.
    if (now.getMinutes() === 0) {
      const removed = await thin(db, result.key, now)
      if (removed > 0) note = ` · 오래된 기록 ${removed}개 정리`
    }
    console.log(`[${now.toISOString()}] ${result.key} 댓글 ${result.count}개 기록${note}`)
  } catch (err) {
    failed += 1
    console.error(`[${now.toISOString()}] ${entry.url ?? entry.postNo} 실패: ${err.message}`)
  }
}

process.exit(failed > 0 ? 1 : 0)
