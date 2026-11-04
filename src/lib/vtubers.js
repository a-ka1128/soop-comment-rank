/**
 * '버튜버만' 거르기 기준. 신청자는 전원 버튜버로 보고, 아닌 사람만 NOT_VTUBER_IDS 에 userId 로 적는다.
 * (userId 는 화면의 닉네임 옆 회색 글씨, 방송국 주소 끝부분)
 *
 *   export const NOT_VTUBER_IDS = [
 *     'someone', // 닉네임
 *   ]
 */
export const NOT_VTUBER_IDS = []

export function isVtuber(comment) {
  return !NOT_VTUBER_IDS.includes(comment.userId)
}
