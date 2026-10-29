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
 * 댓글을 무엇으로 나누는지. 'post' 면 본문의 번호 목록, 'wow-class' 면 와우 직업(wow.js).
 * 헬스체크가 이걸 보고 본문 목록 적중률을 따질지 정한다.
 */
export const GROUP_BY = 'wow-class'

/** 대상 글이 정해졌는지. 스크립트들이 이걸 보고 일찍 멈춘다. */
export const HAS_TARGET = Boolean(TARGET_POST.bjId && TARGET_POST.postNo)

/**
 * 같이 보는 두 번째 목록 — 「리얼 뉴 와튜버 데뷔 하기」 게시판(네이버 카페). 와우 포에버를 하려고
 * 새로 데뷔하는 사람들이 여기 글을 올린다. 길드 신청 명단과 섞지 않고 따로 탭을 만든다.
 * 글을 읽는 건 서버(scripts/watch-live.mjs)라 브라우저는 live-data 브랜치의 debut.json 만 본다.
 * null 이면 탭을 그리지 않는다.
 *
 * exclude 는 이 게시판에 글을 올렸어도 데뷔로 치지 않을 SOOP userId. 이미 방송하던 사람 등.
 */
export const DEBUT_BOARD = {
  cafeId: '27842958',
  menuId: '1371',
  url: 'https://cafe.naver.com/f-e/cafes/27842958/menus/1371?viewType=L',
  exclude: ['nboxox182'], // 뱀부안범부
}

/**
 * 예전에 쓰던 SOOP 데뷔 글(ecvhao/210998813). 게시판이 네이버 카페로 옮겨 가서 더 읽지 않는다.
 * 수정 알림 스크립트들이 null 이면 건너뛴다.
 */
export const DEBUT_POST = null

/**
 * 컷 라인이 그어지는 순위. 이 순위까지가 통과고, 바로 아래에 선이 놓인다.
 * null 이면 선을 그리지 않는다.
 */
export const CUT_RANK = null
