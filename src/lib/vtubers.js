/**
 * '버튜버만' 거르기 기준. 아래 중 하나라도 해당하면 버튜버로 센다.
 *   1. VTUBER_IDS 에 userId 를 적은 사람(확인한 사람)
 *   2. 크루가 VTUBER_CREWS 에 있는 사람
 *   3. 댓글 본문에 '버튜버'라고 적은 사람(본인이 쓴 말이라 확인된 사실은 아니다)
 * '웰컴 버추얼'은 방송 프로그램 이름이라 본문 검사에서 뺀다.
 */
export const VTUBER_IDS = [
  'ebequal2b', // 여고생 버튜버라고 적음
  'pugomm', // 푸곰 — 곰팡이 버튜버
]

export const VTUBER_CREWS = ['이세계아이돌']

const TEXT = /버튜버|브이튜버|vtuber/i

export function isVtuber(comment, tags) {
  return (
    VTUBER_IDS.includes(comment.userId) ||
    tags.some((t) => t.kind === 'crew' && VTUBER_CREWS.includes(t.name)) ||
    TEXT.test(comment.text ?? '')
  )
}
