/**
 * 맨 위 광고 배너. 비워 두면(null) 일반 방문자에게는 아무것도 보이지 않고,
 * 어드민 화면(#admin)에서만 자리를 점선 상자로 보여 준다.
 *
 *   export const BANNER = {
 *     image: './banner.webp',   // public/ 에 넣은 파일이나 외부 주소. 비율 그대로 가로에 맞춰 보인다
 *     href: 'https://...',      // 눌렀을 때 열 주소. 없으면 눌러지지 않는다
 *     alt: '배너 설명',          // 이미지가 안 뜰 때·스크린리더용
 *     ad: true,                 // 광고면 true: 모서리에 "광고" 표시가 붙고 링크에 sponsored 가 들어간다
 *   }
 *
 * 이미지는 public/ 에 넣고 './파일이름' 으로 적는다(주소가 바뀌어도 사이트 안에서 찾는다).
 */
export const BANNER = {
  image: './banner.webp',
  href: 'https://www.sooplive.com/station/ecvhao/post/211138607',
  alt: '와우 포에버 질문 받습니다 - 이미지를 클릭해서 질문하기',
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
