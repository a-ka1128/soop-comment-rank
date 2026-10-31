const RTDB_URL = import.meta.env.VITE_RTDB_URL ?? ''

/**
 * 방문자 피드백. Firebase Realtime Database 의 feedback/{id} 에 쌓인다.
 *
 * 보내기는 누구나 — 새 글을 만드는 것만 되고 고치거나 지울 수는 없다(database.rules.json).
 * 읽기·삭제는 어드민 uid 만. 규칙이 글자 수(본문 1000자, 연락처 100자)와 시각(서버 시각)도 검사한다.
 *
 * 한 건의 모양: { message, contact?, createdAt }
 */

export const feedbackEnabled = () => RTDB_URL.length > 0

const url = (path, token) =>
  `${RTDB_URL.replace(/\/$/, '')}/${path}.json${token ? `?auth=${encodeURIComponent(token)}` : ''}`

export const MESSAGE_MAX = 1000
export const CONTACT_MAX = 100

/** 연달아 보내는 걸 막는 최소 간격(ms). 규칙이 못 하는 속도 제한을 브라우저에서 거는 정도다. */
const COOLDOWN_MS = 30_000
const LAST_KEY = 'feedback-last-sent'

export function cooldownLeft() {
  try {
    const last = Number(localStorage.getItem(LAST_KEY)) || 0
    return Math.max(0, COOLDOWN_MS - (Date.now() - last))
  } catch {
    return 0
  }
}

export async function sendFeedback({ message, contact }) {
  const text = message.trim()
  if (!text) throw new Error('내용을 적어 주세요.')
  if (cooldownLeft() > 0) throw new Error('잠시 뒤에 다시 보내 주세요.')
  const body = { message: text, createdAt: { '.sv': 'timestamp' } }
  const c = contact?.trim()
  if (c) body.contact = c
  const res = await fetch(url('feedback'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`보내지 못했습니다 (HTTP ${res.status})`)
  try {
    localStorage.setItem(LAST_KEY, String(Date.now()))
  } catch {
    // 저장이 막힌 브라우저면 간격 제한만 없어진다.
  }
}

/** @returns {Promise<Array<{id: string, message: string, contact?: string, createdAt: number}>>} 최신이 위 */
export async function fetchFeedback(idToken) {
  const res = await fetch(url('feedback', idToken))
  if (res.status === 401 || res.status === 403) throw new Error('읽을 권한이 없습니다. 어드민 계정으로 로그인하세요.')
  if (!res.ok) throw new Error(`피드백을 읽지 못했습니다 (HTTP ${res.status})`)
  const data = (await res.json()) ?? {}
  return Object.entries(data)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteFeedback(id, idToken) {
  const res = await fetch(url(`feedback/${encodeURIComponent(id)}`, idToken), { method: 'DELETE' })
  if (!res.ok) throw new Error(`지우지 못했습니다 (HTTP ${res.status})`)
}
