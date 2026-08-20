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
 * 슬라이더 최대치.
 *
 * 실제 최고는 30만 명 가까이 되지만 거기까지 늘리면 눈금 대부분이 사람 없는
 * 구간이 된다 — 5만 명이 넘는 사람은 203명 중 16명뿐이다. 5만에서 끊으면
 * 손잡이를 끝까지 밀었을 때 그 16명만 남는다.
 *
 * 정확한 수가 필요하면 옆 숫자 칸에 그대로 적으면 된다. 5만보다 큰 수도 받는다.
 */
export const FAN_MAX = 50000
