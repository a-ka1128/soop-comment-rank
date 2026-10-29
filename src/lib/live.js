/**
 * 지금 방송 중인 신청자. 워크플로(watch-live.yml)가 5분마다 live-data 브랜치에 올리는 파일을 읽는다.
 * raw.githubusercontent.com 은 어느 출처에서든 읽을 수 있다.
 */
const LIVE_URL = 'https://raw.githubusercontent.com/a-ka1128/soop-comment-rank/live-data/live.json'

/** @returns {Promise<{updatedAt: string, live: Array<{userId:string,nick:string,title:string,viewers:number,start:string,broadNo:string}>}|null>} 아직 파일이 없으면 null */
export async function fetchLive({ signal } = {}) {
  const res = await fetch(`${LIVE_URL}?t=${Date.now()}`, { signal, cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`방송 목록 HTTP ${res.status}`)
  const data = await res.json()
  if (!data || !Array.isArray(data.live)) throw new Error('방송 목록 모양이 다릅니다')
  return data
}
