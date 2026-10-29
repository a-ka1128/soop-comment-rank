/**
 * 맨 위 광고 배너. 비워 두면(null) 일반 방문자에게는 아무것도 보이지 않고,
 * 어드민 화면(#admin)에서만 자리를 점선 상자로 보여 준다.
 *
 *   export const BANNER = {
 *     image: 'https://.../banner.png', // 포스터 같은 이미지. 960×300(16:5) 권장. 비율이 달라도 가운데 기준으로 잘려 맞춰진다(모바일은 2:1)
 *     href: 'https://...',             // 눌렀을 때 열 주소
 *     alt: '광고 설명',                 // 이미지가 안 뜰 때·스크린리더용
 *   }
 *
 * 이미지는 public/ 에 넣고 '/soop-comment-rank/banner.png' 처럼 적거나, 외부 주소를 그대로 적는다.
 */
export const BANNER = {
  image: `${import.meta.env.BASE_URL}banner-test.svg`,
  href: 'https://example.com',
  alt: '테스트 광고',
}

/** http(s) 주소만 통과시킨다. javascript: 같은 스킴이 href 로 들어가지 않게. */
export function safeUrl(url) {
  try {
    const u = new URL(url, document.baseURI)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''
  } catch {
    return ''
  }
}
