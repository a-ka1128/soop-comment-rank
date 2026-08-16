/**
 * VM의 수집기가 1분마다 쌓아 둔 기록을 읽는다.
 *
 * Firebase SDK를 쓰지 않는다. 읽기 전용 공개 데이터라 REST 한 줄이면 되고,
 * 그 편이 번들에 수백 KB를 더하지 않는다. 쓰기는 브라우저에서 아예 막혀 있다
 * (database.rules.json — 수집기만 서비스 계정으로 쓴다).
 */

// 값이 비어 있으면 기록 기능 전체가 조용히 꺼진다. 아직 백엔드를 안 붙였거나,
// 남이 이 저장소를 그대로 띄웠을 때 에러 대신 "기록 없음"으로 동작하게 하려는 것.
export const RTDB_URL = import.meta.env.VITE_RTDB_URL ?? ''

export const historyEnabled = () => RTDB_URL.length > 0

export const postKey = (bjId, postNo) => `${bjId}_${postNo}`

async function readJson(path) {
  const res = await fetch(`${RTDB_URL.replace(/\/$/, '')}/${path}.json`)
  if (!res.ok) throw new Error(`기록 서버 응답 실패 (HTTP ${res.status})`)
  return res.json()
}

/** 이 게시글이 수집 대상인지, 마지막으로 언제 찍혔는지. */
export async function fetchMeta(bjId, postNo) {
  if (!historyEnabled()) return null
  return readJson(`posts/${postKey(bjId, postNo)}/meta`)
}

/**
 * 한 사람의 좋아요 추이.
 * points/{commentId} 아래가 통째로 그 사람의 시계열이라 한 번에 읽힌다.
 *
 * @returns {Array<{t: Date, likes: number}>} 시간순
 */
export async function fetchSeries(bjId, postNo, commentId) {
  if (!historyEnabled()) return []
  const raw = await readJson(`posts/${postKey(bjId, postNo)}/points/${commentId}`)
  if (!raw) return []
  return Object.entries(raw)
    .map(([minute, likes]) => ({ t: new Date(Number(minute) * 60000), likes }))
    .sort((a, b) => a.t - b.t)
}
