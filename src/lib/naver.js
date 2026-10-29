/**
 * 「리얼 뉴 와튜버 데뷔」 게시판(네이버 카페)을 읽는다. 로그인 없이 읽히는 공개 목록 API 지만
 * 브라우저에서는 CORS 로 막혀서, 서버(워크플로·이 PC 의 스크립트)가 받아 debut.json 으로 올린다.
 *
 * 글 하나가 데뷔 신청 하나다. 글쓴이는 카페 닉네임만 있고 SOOP 아이디는 본문에 적은 방송국
 * 주소에서 뽑는다. 주소가 없으면 userId 를 비워 둔다(애청자 수·라벨은 그 사람만 건너뛴다).
 * 목록 API 는 본문을 앞부분(summary)만 주고, 주소를 링크 카드로 붙인 글은 summary 에 주소가 없다.
 * 그런 글만 글 상세 API 로 본문 전체를 읽어 링크 카드의 주소를 찾는다.
 */
const LIST_API = 'https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes'
const MAX_PAGES = 20
const ARTICLE_API = 'https://apis.naver.com/cafe-web/cafe-articleapi/v2.1/cafes'
const HEADERS = { Referer: 'https://cafe.naver.com/', 'User-Agent': 'Mozilla/5.0' }

// 방송국 주소 형태만 받는다. 'sooplive.com/player/번호'(다시보기)처럼 경로 첫 마디를 아이디로 착각하지 않게.
// 목록의 summary 는 잘려서 주소 중간에서 '...' 로 끝날 수 있다. 그때는 아이디가 반쪽이라 버린다.
const SOOP_ID =
  /(?:sooplive\.com\/station\/|ch\.sooplive\.co\.kr\/|bj\.afreecatv\.com\/)([A-Za-z0-9_]{2,20})(?![A-Za-z0-9_]|\.\.\.|…)/i

export function soopIdFrom(text) {
  const m = SOOP_ID.exec(text || '')
  return m ? m[1] : ''
}

export function articleUrl(cafeId, articleId) {
  return `https://cafe.naver.com/f-e/cafes/${cafeId}/articles/${articleId}`
}

function normalize(item, cafeId) {
  const summary = String(item.summary ?? '')
  const subject = String(item.subject ?? '')
  const image = String(item.representImage ?? '')
  return {
    id: String(item.articleId),
    nick: item.writerInfo?.nickName ?? '',
    userId: soopIdFrom(summary) || soopIdFrom(subject),
    text: summary ? `${subject}\n${summary}` : subject,
    likes: Number(item.likeCount) || 0,
    // 한국 시간으로. 서버(UTC)에서 돌아도 같은 글자가 나오게 9시간을 더한다.
    date: new Date((Number(item.writeDateTimestamp) || 0) + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' '),
    profile: '',
    replyCount: Number(item.commentCount) || 0,
    photo: image.startsWith('https://') ? image : '',
    link: articleUrl(cafeId, item.articleId),
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[body.toLowerCase()] ?? whole
  })
}

/**
 * 스마트에디터 본문(contentHtml)에서 글자만 뽑는다. 줄은 문단(<p class="se-text-paragraph">)마다 하나.
 * 링크 카드·이미지는 문단이 아니라서 빠진다(링크 카드 안의 "~님의 방송국에 오신 것을 환영합니다" 같은 글).
 * 문단이 하나도 없는 예전 편집기 글은 태그를 모두 걷어 낸다.
 */
export function htmlToText(html) {
  const paras = html.match(/<p class="se-text-paragraph[^>]*>[\s\S]*?<\/p>/g)
  const lines = paras
    ? paras.map((p) => p.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    : [html.replace(/<(?:br|\/p|\/div)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')]
  return decode(lines.join('\n'))
    .replace(/[​﻿]/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 글 상세 API 로 본문 전체를 읽는다. 비공개 글 등 못 읽으면 null. 링크 카드의 href 도 본문 HTML 에 들어 있다. */
async function readArticle(cafeId, articleId) {
  try {
    const res = await fetch(`${ARTICLE_API}/${cafeId}/articles/${articleId}?query=&useCafeId=true&requestFrom=A`, {
      headers: HEADERS,
    })
    if (!res.ok) return null
    const html = (await res.json())?.result?.article?.contentHtml
    return typeof html === 'string' ? { text: htmlToText(html), userId: soopIdFrom(html) } : null
  } catch {
    return null
  }
}

/** @returns {Promise<Array>} 댓글과 같은 모양(+ link)으로 맞춘 글 목록 */
export async function fetchDebutArticles({ cafeId, menuId, manual = {} }) {
  const out = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${LIST_API}/${cafeId}/menus/${menuId}/articles?page=${page}&pageSize=50&sortBy=TIME&viewType=L`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`네이버 카페 목록 HTTP ${res.status} (${page}페이지)`)
    const data = await res.json()
    const list = data?.result?.articleList
    if (!Array.isArray(list)) throw new Error('네이버 카페 목록 응답 모양이 다릅니다')
    for (const row of list) {
      const item = row?.item
      if (item && row.type === 'ARTICLE' && !item.blindArticle) out.push(normalize(item, cafeId))
    }
    if (!data.result.pageInfo?.visibleNextButton) break
  }


  // 목록의 summary 는 앞부분만이라, 글마다 본문 전체를 읽어 바꿔 넣는다. 한 번에 몇 개씩만 묻는다.
  // 못 읽은 글(비공개 등)은 summary 그대로 둔다.
  for (let i = 0; i < out.length; i += 4) {
    await Promise.all(
      out.slice(i, i + 4).map(async (c) => {
        const full = await readArticle(cafeId, c.id)
        if (!full) return
        if (full.text) c.text = `${c.text.split('\n')[0]}\n${full.text}`
        if (!c.userId) c.userId = full.userId || soopIdFrom(full.text)
      }),
    )
  }

  // 손으로 적어 둔 내용이 마지막에 덮는다(비공개 글은 본문을 읽을 수 없다).
  for (const c of out) {
    const m = manual[c.id]
    if (!m) continue
    if (m.userId) c.userId = m.userId
    if (m.text) c.text = `${c.text.split('\n')[0]}\n${m.text}`
  }
  return out
}
