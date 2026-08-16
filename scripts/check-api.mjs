/**
 * SOOP 비공식 API가 아직 우리가 기대하는 대로 동작하는지 확인한다.
 *
 * 이 사이트는 서버 없이 브라우저가 SOOP API를 직접 부르는 구조라, SOOP이 조용히 뭔가
 * 바꾸면 사이트가 틀린 답(예: "댓글 0개")을 내놓을 수 있다. 매일 한 번 여기서 먼저
 * 깨뜨려 보고 이슈로 알린다.
 *
 *   node scripts/check-api.mjs
 *
 * 실패하면 exit 1. 워크플로가 그걸 보고 이슈를 연다.
 */
import { API_BASE, fetchAllComments, fetchPost } from '../src/lib/soop.js'
import { TARGET_POST } from '../src/lib/target.js'
import { detectCategories, buildGroups } from '../src/lib/categories.js'
import { classify, UNGROUPED_ID } from '../src/lib/groups.js'

const { bjId, postNo, url } = TARGET_POST
const failures = []
const notes = []

function check(label, condition, detail) {
  if (condition) {
    notes.push(`  OK   ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    notes.push(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// 1. CORS. 브라우저에서 직접 부르는 구조의 생명줄이라 제일 먼저 본다.
try {
  const res = await fetch(`${API_BASE}/${bjId}/post/${postNo}/comment?page=1&cCommentNo=0`, {
    headers: { Origin: 'https://a-ka1128.github.io' },
  })
  const allowed = res.headers.get('access-control-allow-origin')
  check(
    'CORS 허용 헤더',
    allowed === 'https://a-ka1128.github.io' || allowed === '*',
    `access-control-allow-origin: ${allowed ?? '(없음)'}`
  )
} catch (err) {
  check('CORS 허용 헤더', false, `요청 자체 실패: ${err.message}`)
}

// 2. 본문. 여기가 404면 표본 글이 지워진 것이니 다른 글로 바꿔야 한다.
let post = null
try {
  post = await fetchPost(bjId, postNo)
  check('게시글 본문', post.html.length > 0, `${post.title} (본문 ${post.html.length}자)`)
} catch (err) {
  check('게시글 본문', false, `${err.kind ?? 'error'}: ${err.message} — 대상 글(${url})이 삭제됐다면 src/lib/target.js를 고칠 것`)
}

// 3. 댓글 전 페이지. 스키마 검증은 fetchAllComments 안에서 던진다.
let comments = []
if (post) {
  try {
    const result = await fetchAllComments(bjId, postNo)
    comments = result.comments
    check('댓글 수집', comments.length > 0, `원댓글 ${comments.length}개`)
    check(
      '댓글 필드',
      comments.every((c) => c.id !== undefined && typeof c.text === 'string' && Number.isFinite(c.likes)),
      'id · text · likes'
    )
    check(
      '좋아요 값',
      comments.some((c) => c.likes > 0),
      `최고 ${Math.max(0, ...comments.map((c) => c.likes))}`
    )
  } catch (err) {
    check('댓글 수집', false, `${err.kind ?? 'error'}: ${err.message}`)
  }
}

// 4. 분류 감지. 분류가 있는 글인지 아닌지는 그 글이 정하는 것이라 없다고 실패는 아니다.
//    (대상 글이 아르마3처럼 번호 목록이 없으면 여기는 그냥 "없음"이 정상이다.)
//    분류가 있는 글일 때만 적중률까지 확인한다. 그게 깨지면 본문 HTML 구조가 바뀐 것이다.
if (post && comments.length > 0) {
  const categories = detectCategories(post.html)
  notes.push(`  --   분류 감지 — ${categories.join(' / ') || '없음 (이 글에는 번호 목록이 없음)'}`)

  if (categories.length >= 2) {
    const buckets = classify(comments, buildGroups(categories))
    const classified = comments.length - buckets.get(UNGROUPED_ID).length
    const coverage = classified / comments.length
    check('분류 적중률', coverage >= 0.8, `${(coverage * 100).toFixed(1)}% (${classified}/${comments.length})`)
  }
}

console.log(`SOOP API 헬스체크 — ${url}`)
console.log(notes.join('\n'))

if (failures.length > 0) {
  console.log(`\n실패 ${failures.length}건:`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\n전부 통과.')
