import { SEASON1_USER_IDS, SEASON1_UNRESOLVED } from './season1'
import { SEASON2_USER_IDS, SEASON2_UNRESOLVED } from './season2'

/**
 * 시즌 참가자 판정.
 *
 * userId 목록은 명단을 만들던 시점에 이미 댓글을 단 사람만 담고 있다. 그 뒤에
 * 새로 신청한 사람은 목록에 없으니 배지가 안 붙는다. 그래서 아직 못 찾은
 * 명단(UNRESOLVED)과 닉네임을 실시간으로 대조한다.
 *
 * 대조는 정규화 후 '완전 일치'만 인정한다. 접두/포함까지 열면 사람이 확인해 줄
 * 수 없는 자리에서 오답이 난다 — 실제로 히키킹9 가 히키☆(=히키comori) 에
 * 붙었었다. 정규화는 장식만 떼므로 히키☆ → '히키' 는 '히키킹9' 와 여전히 다르다.
 */

/** 장식(_ * . ~ ! ♬ ∥ 공백 …)을 떼고 소문자로. 글자와 숫자만 남는다. */
function normalizeNick(nick) {
  return (nick || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase()
}

function indexByNick(names) {
  const map = new Map()
  for (const name of names) {
    const key = normalizeNick(name)
    if (!key) continue
    // 정규화하면 같아지는 이름이 둘이면 어느 쪽인지 알 수 없다. 아예 빼 버린다.
    map.set(key, map.has(key) ? null : name)
  }
  return map
}

const SEASON1_BY_NICK = indexByNick(SEASON1_UNRESOLVED)
const SEASON2_BY_NICK = indexByNick(SEASON2_UNRESOLVED)

function match(comment, userIds, byNick) {
  if (userIds.has(comment.userId)) return { via: 'id' }
  const name = byNick.get(normalizeNick(comment.nick))
  return name ? { via: 'nick', name } : null
}

/**
 * @returns {{season1: null | {via: 'id'|'nick', name?: string},
 *            season2: null | {via: 'id'|'nick', name?: string}}}
 */
export function seasonMatch(comment) {
  return {
    season1: match(comment, SEASON1_USER_IDS, SEASON1_BY_NICK),
    season2: match(comment, SEASON2_USER_IDS, SEASON2_BY_NICK),
  }
}
