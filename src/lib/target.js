/**
 * 이 사이트가 다루는 게시글. 주소 입력칸을 없앴으므로 여기가 유일한 지정 지점이다.
 *
 * 수집기의 collector/tracked.json 과 같은 글을 가리켜야 개인 증가량 그래프가 채워진다.
 * API 헬스체크도 이 글로 매일 확인한다.
 */
export const TARGET_POST = {
  bjId: 'ecvhao',
  postNo: '210996889',
  url: 'https://www.sooplive.com/station/ecvhao/post/210996889',
}

/**
 * 같이 보는 두 번째 글 — 「리얼 뉴 와튜버 데뷔 하기」. 와우 포에버를 하려고 새로 데뷔하는
 * 사람들이 여기 댓글을 단다. 길드 신청 명단과 섞지 않고 따로 탭을 만든다.
 * null 이면 탭을 그리지 않는다.
 */
export const DEBUT_POST = {
  bjId: 'ecvhao',
  postNo: '210998813',
  url: 'https://www.sooplive.com/station/ecvhao/post/210998813',
}

/**
 * 컷 라인이 그어지는 순위. 이 순위까지가 통과고, 바로 아래에 선이 놓인다.
 * null 이면 선을 그리지 않는다.
 */
export const CUT_RANK = null
