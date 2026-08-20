import { fetchFanCount } from './soop'

/**
 * 방송국 애청자(즐겨찾기) 수를 사람마다 받아 온다.
 *
 * 댓글 API 한 번으로는 안 되고 사람당 요청이 하나씩 붙는다. 200명이면 200번이라
 * 두 가지로 줄인다 — 한 번 받은 수는 localStorage 에 캐시하고(애청자 수는 분 단위로
 * 움직이는 값이 아니다), 새로 댓글을 단 사람만 다시 묻는다.
 *
 * 실측(203명, 동시 4): 캐시가 비었을 때 1~2초. 캐시가 차 있으면 요청이 0이다.
 */

const CACHE_KEY = 'soopcomment.fans'
const TTL_MS = 6 * 60 * 60 * 1000
/** 남의 서버에 한꺼번에 몰지 않을 만큼만. */
const CONCURRENCY = 4
/** 오래 안 본 사람까지 계속 들고 있을 이유는 없다. */
const PRUNE_MS = 30 * 24 * 60 * 60 * 1000

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function writeCache(cache) {
  const now = Date.now()
  const kept = {}
  for (const [id, entry] of Object.entries(cache)) {
    if (entry && now - entry.t < PRUNE_MS) kept[id] = entry
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(kept))
  } catch {
    // 용량이 찼거나 저장이 막힌 브라우저. 캐시는 있으면 좋은 것일 뿐이라 넘어간다.
  }
}

/**
 * @param {string[]} userIds
 * @param {{signal?: AbortSignal, onUpdate?: (partial: Map<string, number|null>) => void}} opts
 * @returns {Promise<Map<string, number|null>>} null 은 '알 수 없음'(탈퇴·방송국 없음 등)
 */
export async function loadFanCounts(userIds, { signal, onUpdate } = {}) {
  const cache = readCache()
  const now = Date.now()
  const result = new Map()
  const todo = []

  for (const id of new Set(userIds.filter(Boolean))) {
    const hit = cache[id]
    if (hit && now - hit.t < TTL_MS) result.set(id, hit.n)
    else todo.push(id)
  }
  onUpdate?.(new Map(result))
  if (todo.length === 0) return result

  const queue = [...todo]
  let sinceReport = 0

  async function worker() {
    while (queue.length > 0) {
      if (signal?.aborted) return
      const id = queue.shift()
      let count = null
      try {
        count = await fetchFanCount(id, { signal })
      } catch (err) {
        if (err.name === 'AbortError') return
        // 한 사람을 못 읽었다고 전체를 세울 이유는 없다. 그 사람만 '모름'이 된다.
      }
      result.set(id, count)
      cache[id] = { n: count, t: Date.now() }
      sinceReport += 1
      // 다 끝날 때까지 기다렸다 한 번에 바꾸면 목록이 통째로 덜컹인다.
      if (sinceReport >= 20) {
        sinceReport = 0
        onUpdate?.(new Map(result))
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  writeCache(cache)
  onUpdate?.(new Map(result))
  return result
}

/**
 * 슬라이더 손잡이 위치(0~1000)와 실제 애청자 수 사이의 변환.
 *
 * 애청자 수는 15명부터 30만 명까지 퍼져 있다. 위치를 인원수에 그대로 비례시키면
 * 한 칸이 300명이라 1명·2명 단위로는 세울 수가 없고, 반대로 한 칸을 1명으로 잡으면
 * 30만 칸짜리 슬라이더가 된다.
 *
 * 그래서 두 구간으로 나눈다.
 *   왼쪽 100칸 — 한 칸이 정확히 1명. 0, 1, 2, 3 … 100 을 하나씩 짚을 수 있다.
 *   나머지 900칸 — 로그. 100명에서 최대치까지 비율로 늘어난다.
 * 정확한 값이 필요하면 옆의 숫자 칸에 그대로 적으면 된다.
 */
export const FAN_SLIDER_STEPS = 1000
/** 여기까지는 한 칸 = 1명 */
const LINEAR_UNTIL = 100

/** 손잡이 위치 → 애청자 수 */
export function fanValueAt(pos, max) {
  if (!(max > 0)) return 0
  const p = Math.min(Math.max(pos, 0), FAN_SLIDER_STEPS)
  if (max <= LINEAR_UNTIL) return Math.round((p / FAN_SLIDER_STEPS) * max)
  if (p <= LINEAR_UNTIL) return Math.round(p)
  const t = (p - LINEAR_UNTIL) / (FAN_SLIDER_STEPS - LINEAR_UNTIL)
  return Math.min(Math.round(LINEAR_UNTIL * (max / LINEAR_UNTIL) ** t), max)
}

/** 애청자 수 → 손잡이 위치 (숫자를 직접 적었을 때 손잡이를 맞춰 주려고) */
export function fanPosOf(value, max) {
  if (!(max > 0) || value <= 0) return 0
  const v = Math.min(value, max)
  if (max <= LINEAR_UNTIL) return Math.round((v / max) * FAN_SLIDER_STEPS)
  if (v <= LINEAR_UNTIL) return Math.round(v)
  const t = Math.log(v / LINEAR_UNTIL) / Math.log(max / LINEAR_UNTIL)
  return Math.round(LINEAR_UNTIL + t * (FAN_SLIDER_STEPS - LINEAR_UNTIL))
}
