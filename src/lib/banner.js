/**
 * 맨 위 광고 배너. 비워 두면(null) 일반 방문자에게는 아무것도 보이지 않고,
 * 어드민 화면(#admin)에서만 자리를 점선 상자로 보여 준다.
 *
 *   export const BANNER = null

/** http(s) 주소만 통과시킨다. javascript: 같은 스킴이 href 로 들어가지 않게. */
export function safeUrl(url) {
  try {
    const u = new URL(url, document.baseURI)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''
  } catch {
    return ''
  }
}
