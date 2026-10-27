/**
 * 지난 시즌 참가자 명단 (둘째 칸). 아직 비어 있어 배지가 붙지 않는다.
 *
 * 닉네임이 아니라 userId 로 들고 있다. 닉네임은 수시로 바뀌고 장식이 붙지만
 * userId 는 그대로다. 대조 규칙과 그렇게 정한 이유는 season.js 에 적어 뒀다.
 *
 *   SEASON2_USER_IDS    이 글에 댓글을 단 게 확인된 사람. 주석에 원래 닉을 남길 것
 *   SEASON2_UNRESOLVED  아직 못 찾은 사람의 닉네임. 화면에서 실시간으로 대조한다
 *
 * 애매해서 일부러 안 붙인 건 여기 주석으로 이유를 남겨 둘 것. 나중에 "왜 이건
 * 안 붙였지" 하며 되살리는 걸 막는다.
 */
export const SEASON2_USER_IDS = new Set([])

export const SEASON2_UNRESOLVED = []
