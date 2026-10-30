const RTDB_URL = import.meta.env.VITE_RTDB_URL ?? ''

/**
 * 어드민이 손으로 고친 라벨. Firebase Realtime Database 의 labels/{userId} 에 있다.
 *
 * 읽기는 누구나(REST 한 줄 — SDK 없이), 쓰기는 database.rules.json 에 적힌 어드민 uid 만.
 * 쓰기 권한은 브라우저가 아니라 DB 규칙이 지킨다. 화면의 어드민 모드는 편집칸을 보여 줄
 * 뿐이고, 남이 #admin 으로 들어와 로그인해도 저장이 거절된다.
 *
 * 한 사람의 라벨 모양:
 *   {
 *     cls: ['mage', 'priest'],             직업 id 목록(첫 번째가 대표). 'none' 이면 미분류.
 *                                          없으면 자동. 예전 라벨은 'mage' 처럼 하나짜리 문자열
 *     tags: { watuber: true, forevers: false },   true 붙임 / false 뗌. 없으면 자동
 *     crews: ['와우포에버즈'],              어드민이 넣은 크루
 *     crewsOff: ['천타버스'],               crews.js 에 조사해 둔 크루 중 어드민이 뺀 것
 *     gameNick: '징버거 영택이의친구',      인게임 닉네임. 없으면 gameNicks.json 의 값을 쓴다
 *   }
 *
 * 글이 아니라 사람(userId)에 붙인다. 같은 사람이 두 글에 댓글을 달아도 라벨은 하나다.
 */

export const labelsEnabled = () => RTDB_URL.length > 0

const url = (path, token) =>
  `${RTDB_URL.replace(/\/$/, '')}/${path}.json${token ? `?auth=${encodeURIComponent(token)}` : ''}`

/** @returns {Promise<Record<string, object>>} 비어 있으면 {} */
export async function fetchLabels({ signal } = {}) {
  if (!labelsEnabled()) return {}
  const res = await fetch(url('labels'), { signal })
  if (!res.ok) throw new Error(`라벨을 읽지 못했습니다 (HTTP ${res.status})`)
  return (await res.json()) ?? {}
}

/** 아무것도 안 고친 라벨은 지운다. 빈 객체를 남겨 두면 "자동"과 구분이 안 된다. */
export function cleanLabel(label) {
  const out = {}
  const cls = label?.cls
  if (cls === 'none') out.cls = cls
  else if (Array.isArray(cls)) {
    const ids = [...new Set(cls.filter(Boolean))]
    if (ids.length > 0) out.cls = ids
  } else if (cls) out.cls = [cls]
  const tags = Object.fromEntries(
    Object.entries(label?.tags ?? {}).filter(([, v]) => typeof v === 'boolean'),
  )
  if (Object.keys(tags).length > 0) out.tags = tags
  const crews = [...new Set((label?.crews ?? []).map((c) => c.trim()).filter(Boolean))]
  if (crews.length > 0) out.crews = crews
  const crewsOff = [...new Set((label?.crewsOff ?? []).map((c) => c.trim()).filter(Boolean))]
  if (crewsOff.length > 0) out.crewsOff = crewsOff
  const gameNick = typeof label?.gameNick === 'string' ? label.gameNick.trim() : ''
  if (gameNick) out.gameNick = gameNick
  return Object.keys(out).length > 0 ? out : null
}

/**
 * @param {string} userId
 * @param {object|null} label cleanLabel 을 거친 값. null 이면 지운다
 * @param {string} idToken Firebase 로그인 토큰
 */
export async function saveLabel(userId, label, idToken) {
  const res = await fetch(url(`labels/${encodeURIComponent(userId)}`, idToken), {
    method: label ? 'PUT' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: label ? JSON.stringify(label) : undefined,
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error('저장 권한이 없습니다. 어드민 계정으로 로그인했는지 확인하세요.')
  }
  if (!res.ok) throw new Error(`저장하지 못했습니다 (HTTP ${res.status})`)
}
