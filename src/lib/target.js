/**
 * 이 사이트가 다루는 게시글. 주소 입력칸을 없앴으므로 여기가 유일한 지정 지점이다.
 *
 * 수집기의 collector/tracked.json 과 같은 글을 가리켜야 개인 증가량 그래프가 채워진다.
 * API 헬스체크도 이 글로 매일 확인한다 — 비어 있으면 헬스체크는 그냥 건너뛴다.
 *
 * 예)
 *   bjId: '방송국주소', postNo: '게시글번호',
 *   url: 'https://www.sooplive.com/station/방송국주소/post/게시글번호'
 */
export const TARGET_POST = {
  bjId: '',
  postNo: '',
  url: '',
}

/** 대상 글이 정해졌는지. 스크립트들이 이걸 보고 일찍 멈춘다. */
export const HAS_TARGET = Boolean(TARGET_POST.bjId && TARGET_POST.postNo)

/**
 * 컷 라인이 그어지는 순위. 이 순위까지가 통과고, 바로 아래에 선이 놓인다.
 * null 이면 선을 그리지 않는다.
 */
export const CUT_RANK = null
