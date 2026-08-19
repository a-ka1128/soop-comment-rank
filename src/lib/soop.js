export const API_BASE = 'https://api-channel.sooplive.com/v1.1/channel'

/**
 * 비공식 API라 언제든 바뀔 수 있다. 어떻게 깨졌는지를 kind로 구분해 두면
 * 사용자에게 "글 번호를 확인하세요" 같은 엉뚱한 소리를 하지 않을 수 있다.
 *
 * network  — 연결 자체 실패. CORS가 막혔거나 네트워크가 끊겼다.
 * forbidden— 볼 권한이 없다. 애청자 공개 게시판 같은 경우.
 * notfound — 게시글이 정말 없다.
 * endpoint — 글은 있는데 댓글 주소만 사라졌다. API 경로가 바뀐 것.
 * schema   — 200이 왔는데 응답 모양이 다르다. 이게 제일 위험하다.
 * server   — 그 밖의 오류 응답.
 */
export class SoopApiError extends Error {
  constructor(message, kind) {
    super(message)
    this.name = 'SoopApiError'
    this.kind = kind
  }
}

const API_CHANGED_HINT =
  ' SOOP이 비공식 API를 바꿨을 수 있습니다. 계속 이러면 소스의 API 주소를 확인해야 합니다.'

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

/**
 * 그 댓글이 하이라이트된 채로 열리는 주소.
 * SOOP 알림이 쓰는 앵커 형식이라 댓글 번호를 그대로 붙이면 된다.
 */
export function commentUrl(bjId, postNo, commentId) {
  return `${postUrl(bjId, postNo)}#comment_noti${encodeURIComponent(commentId)}`
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
    replyCount: item.cCommentCnt ?? 0,
    photo: safeHttpUrl(item.photo?.url),
  }
}

/** 게시글 본문. 카테고리 자동 감지에 쓴다. */
export async function fetchPost(bjId, postNo, { signal } = {}) {
  const data = await fetchJson(
    `${API_BASE}/${encodeURIComponent(bjId)}/post/${encodeURIComponent(postNo)}`,
    signal,
    // 여기서 404면 글이 정말 없는 것으로 본다. 뒤이어 부를 댓글 주소가 살아 있는지는
    // 이 요청이 성공했는지로 갈린다.
    'notfound'
  )
  if (data == null || typeof data !== 'object' || data.titleNo === undefined) {
    throw new SoopApiError(`게시글 응답 형식이 예상과 다릅니다.${API_CHANGED_HINT}`, 'schema')
  }
  return {
    title: decodeEntities(data.titleName ?? ''),
    html: typeof data.content?.content === 'string' ? data.content.content : '',
  }
}

/**
 * 우리가 실제로 읽는 필드가 그대로 있는지 확인한다.
 * 이게 없으면 필드명이 바뀌었을 때 조용히 "댓글 0개"로 보인다 — 틀린 답을
 * 자신 있게 내놓는 상태라, 차라리 실패로 끊는 게 낫다.
 *
 * 단, 댓글이 하나도 없는 글은 meta가 통째로 null로 온다. 그건 정상이므로
 * 페이지 정보와 항목 검사는 data가 실제로 있을 때만 한다.
 */
function assertCommentPage(payload, page) {
  const where = `댓글 ${page}페이지`
  if (payload == null || typeof payload !== 'object' || !Array.isArray(payload.data)) {
    throw new SoopApiError(`${where} 응답에 목록이 없습니다.${API_CHANGED_HINT}`, 'schema')
  }

  const sample = payload.data[0]
  if (!sample) return

  if (!Number.isFinite(payload.meta?.lastPage)) {
    throw new SoopApiError(`${where} 응답에 페이지 정보가 없습니다.${API_CHANGED_HINT}`, 'schema')
  }
  for (const field of ['pCommentNo', 'comment', 'likeCnt', 'regDate']) {
    if (sample[field] === undefined) {
      throw new SoopApiError(`${where}에 '${field}' 항목이 없습니다.${API_CHANGED_HINT}`, 'schema')
    }
  }
}

/**
 * 게시글의 원댓글을 전 페이지 순회하며 모두 가져온다.
 * 답글(cComment)은 포함하지 않는다.
 *
 * @param {string} bjId
 * @param {string} postNo
 * @param {{
 *   signal?: AbortSignal,
 *   onProgress?: (done: number, total: number) => void,
 *   postConfirmed?: boolean,
 * }} opts postConfirmed는 본문을 이미 확인했다는 뜻. 404 메시지를 가르는 데 쓴다.
 */
export async function fetchAllComments(bjId, postNo, { signal, onProgress, postConfirmed } = {}) {
  const url = (page) =>
    `${API_BASE}/${encodeURIComponent(bjId)}/post/${encodeURIComponent(postNo)}` +
    `/comment?page=${page}&orderBy=like_cnt&cCommentNo=0`

  const notFoundKind = postConfirmed ? 'endpoint' : 'notfound'
  const first = await fetchJson(url(1), signal, notFoundKind)
  assertCommentPage(first, 1)

  // 댓글이 없는 글은 meta가 null이다.
  const lastPage = Number.isFinite(first.meta?.lastPage) ? first.meta.lastPage : 1
  onProgress?.(1, lastPage)

  const byId = new Map()
  for (const item of first.data) byId.set(item.pCommentNo, normalize(item))

  for (let page = 2; page <= lastPage; page += 1) {
    const chunk = await fetchJson(url(page), signal, notFoundKind)
    assertCommentPage(chunk, page)
    for (const item of chunk.data) byId.set(item.pCommentNo, normalize(item))
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

async function readApiMessage(res) {
  try {
    const body = await res.json()
    return typeof body?.message === 'string' ? body.message : ''
  } catch {
    return ''
  }
}

async function fetchJson(url, signal, notFoundKind) {
  let res
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    // fetch가 거절하는 경우는 대개 오프라인이거나 CORS가 막힌 것이다.
    // 브라우저는 둘을 구분해 알려주지 않으므로 양쪽 다 짚어 준다.
    throw new SoopApiError(
      'SOOP 서버에 연결하지 못했습니다. 인터넷 연결이 끊겼거나, ' +
        'SOOP이 외부 사이트의 접근(CORS)을 막았을 수 있습니다.',
      'network'
    )
  }

  if (res.status === 404) {
    throw new SoopApiError(
      notFoundKind === 'endpoint'
        ? `게시글은 찾았는데 댓글 주소가 응답하지 않습니다.${API_CHANGED_HINT}`
        : '게시글을 찾을 수 없습니다. 삭제되었거나 주소가 잘못됐을 수 있습니다.' + API_CHANGED_HINT,
      notFoundKind ?? 'notfound'
    )
  }
  if (res.status === 401 || res.status === 403) {
    // SOOP이 이유를 한국어로 정확히 알려 준다 ("이 게시판은 애청자 공개입니다." 등).
    // 상태 코드만 보여 주는 것보다 그대로 전하는 편이 훨씬 쓸모 있다.
    const reason = await readApiMessage(res)
    throw new SoopApiError(
      reason || '로그인하거나 권한이 있어야 볼 수 있는 글입니다.',
      'forbidden'
    )
  }
  if (res.status === 429) {
    throw new SoopApiError('SOOP이 요청을 제한하고 있습니다. 잠시 후 다시 시도해 주세요.', 'server')
  }
  if (!res.ok) {
    const reason = await readApiMessage(res)
    throw new SoopApiError(
      `SOOP API 요청 실패 (HTTP ${res.status})${reason ? `: ${reason}` : ''}`,
      'server'
    )
  }

  try {
    return await res.json()
  } catch {
    throw new SoopApiError(`SOOP API가 JSON이 아닌 응답을 보냈습니다.${API_CHANGED_HINT}`, 'schema')
  }
}
