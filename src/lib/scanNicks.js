/**
 * 방송국 사진을 로컬 모델로 읽어 얻은 인게임 닉네임 후보(scanNicks.json).
 * 어드민 화면(#admin)에서만 불러온다. 별도 덩어리로 나뉘어 있어 일반 방문자는 내려받지 않는다.
 */

/** @returns {Promise<Record<string, {name: string, class: string, n: number}[]>>} userId -> 후보(많이 읽힌 순) */
export const loadScanNicks = () => import('./scanNicks.json').then((m) => m.default)

const norm = (s) => String(s ?? '').replace(/\s+/g, '')

/** 알려진 닉네임과 스캔 후보가 하나라도 겹치는지. */
export function scanAgrees(known, cands) {
  const k = norm(known)
  return !!k && cands.some((c) => {
    const n = norm(c.name)
    return n === k || n.includes(k) || k.includes(n)
  })
}
