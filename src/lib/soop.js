const API_BASE = 'https://api-channel.sooplive.com/v1.1/channel'

/**
 * 게시글 URL(또는 "bjId/postNo" 형태)에서 방송국 ID와 글 번호를 뽑아낸다.
 * @returns {{bjId: string, postNo: string} | null}
 */
export function parsePostUrl(input) {
  const raw = (input || '').trim()
  if (!raw) return null

  const urlMatch =
    raw.match(/sooplive\.com\/station\/([^/?#]+)\/post\/(\d+)/i) ||
    raw.match(/sooplive\.com\/([^/?#]+)\/post\/(\d+)/i) ||
    raw.match(/ch\.sooplive\.co\.kr\/([^/?#]+)\/post\/(\d+)/i)
  if (urlMatch) return { bjId: urlMatch[1], postNo: urlMatch[2] }

  // "ecvhao/203249055", "ecvhao 203249055"
  const pairMatch = raw.match(/^([A-Za-z0-9_-]+)[\s/]+(\d+)$/)
  if (pairMatch) return { bjId: pairMatch[1], postNo: pairMatch[2] }

  return null
}

export function postUrl(bjId, postNo) {
  return `https://www.sooplive.com/station/${encodeURIComponent(bjId)}/post/${encodeURIComponent(postNo)}`
}

export function channelUrl(userId) {
  return `https://www.sooplive.com/station/${encodeURIComponent(userId)}`
}

/**
 * API가 준 이미지 주소를 그대로 href/src에 꽂지 않는다.
 * React는 href를 소독해 주지 않으므로 javascript: 같은 스킴이 섞여 들어오면
 * 클릭 한 번에 실행된다. http(s)만 통과시키고 나머지는 버린다.
 */
function safeHttpUrl(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
  } catch {
    return ''
  }
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * API는 댓글을 HTML 이스케이프된 채로 준다 ("열 혈" → &quot;열 혈&quot;).
 * 화면에는 텍스트로만 넣으므로 여기서 풀어 준다.
 *
 * textarea.innerHTML 같은 DOM 트릭은 본문에 </textarea>가 들어오면 깨지므로 쓰지 않는다.
 * 한 번만 훑기 때문에 &amp;quot; 는 &quot; 로 남는다 (원문 그대로가 맞다).
 */
export function decodeEntities(text) {
  if (!text || !text.includes('&')) return text
  return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole
      return String.fromCodePoint(code)
    }
    const named = NAMED_ENTITIES[body.toLowerCase()]
    return named ?? whole
  })
}

function normalize(item) {
  return {
    id: item.pCommentNo,
    nick: decodeEntities(item.userNick ?? ''),
    userId: item.userId ?? '',
    text: decodeEntities(item.comment ?? ''),
    likes: item.likeCnt ?? 0,
    date: item.regDate ?? '',
    profile: safeHttpUrl(item.profileImage),
    isBest: !!item.isBestTop,
    replyCount: item.cCommentCnt ?? 0,
    photo: safeHttpUrl(item.photo?.url),
  }
}

/** 게시글 본문. 카테고리 자동 감지에 쓴다. */
export async function fetchPost(bjId, postNo, { signal } = {}) {
  const data = await fetchJson(
    `${API_BASE}/${encodeURIComponent(bjId)}/post/${encodeURIComponent(postNo)}`,
    signal
  )
  return {
    title: decodeEntities(data.titleName ?? ''),
    html: data.content?.content ?? '',
  }
}

/**
 * 게시글의 원댓글을 전 페이지 순회하며 모두 가져온다.
 * 답글(cComment)은 포함하지 않는다.
 *
 * @param {string} bjId
 * @param {string} postNo
 * @param {{ signal?: AbortSignal, onProgress?: (done: number, total: number) => void }} opts
 */
export async function fetchAllComments(bjId, postNo, { signal, onProgress } = {}) {
  const url = (page) =>
    `${API_BASE}/${encodeURIComponent(bjId)}/post/${encodeURIComponent(postNo)}` +
    `/comment?page=${page}&orderBy=like_cnt&cCommentNo=0`

  const first = await fetchJson(url(1), signal)
  const lastPage = first.meta?.lastPage ?? 1
  onProgress?.(1, lastPage)

  const byId = new Map()
  for (const item of first.data ?? []) byId.set(item.pCommentNo, normalize(item))

  for (let page = 2; page <= lastPage; page += 1) {
    const chunk = await fetchJson(url(page), signal)
    for (const item of chunk.data ?? []) byId.set(item.pCommentNo, normalize(item))
    onProgress?.(page, lastPage)
  }

  return {
    bjId,
    postNo,
    comments: [...byId.values()],
    // commentCount는 답글까지 포함한 숫자라 원댓글 수와 다를 수 있다.
    totalWithReplies: first.commentCount ?? byId.size,
    fetchedAt: new Date(),
  }
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? '게시글을 찾을 수 없습니다. 방송국 ID와 글 번호를 확인해 주세요.'
        : `SOOP API 요청 실패 (HTTP ${res.status})`
    )
  }
  return res.json()
}
