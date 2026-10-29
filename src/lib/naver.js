/**
 * 「리얼 뉴 와튜버 데뷔」 게시판(네이버 카페)을 읽는다. 로그인 없이 읽히는 공개 목록 API 지만
 * 브라우저에서는 CORS 로 막혀서, 서버(워크플로·이 PC 의 스크립트)가 받아 debut.json 으로 올린다.
 *
 * 글 하나가 데뷔 신청 하나다. 글쓴이는 카페 닉네임만 있고 SOOP 아이디는 본문에 적은 방송국
 * 주소에서 뽑는다. 주소가 없으면 userId 를 비워 둔다(애청자 수·라벨은 그 사람만 건너뛴다).
 * 목록 API 는 본문을 앞부분(summary)만 준다.
 */
const LIST_API = 'https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes'
const MAX_PAGES = 20

const SOOP_ID = /(?:sooplive\.com\/(?:station\/|play\/)?|play\.sooplive\.com\/|bj\.afreecatv\.com\/|ch\.sooplive\.co\.kr\/)([A-Za-z0-9_]{2,20})(?![A-Za-z0-9_])/i

export function soopIdFrom(text) {
  const m = SOOP_ID.exec(text || '')
  if (!m) return ''
  // station/post 같은 경로 단어가 아이디로 잡히지 않게.
  return ['station', 'post', 'play', 'www'].includes(m[1].toLowerCase()) ? '' : m[1]
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

/** @returns {Promise<Array>} 댓글과 같은 모양(+ link)으로 맞춘 글 목록 */
export async function fetchDebutArticles({ cafeId, menuId }) {
  const out = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${LIST_API}/${cafeId}/menus/${menuId}/articles?page=${page}&pageSize=50&sortBy=TIME&viewType=L`
    const res = await fetch(url, { headers: { Referer: 'https://cafe.naver.com/' } })
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
  return out
}
