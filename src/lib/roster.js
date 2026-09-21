/**
 * 확정된 선발 명단. 아직 비어 있다.
 *
 * scripts/freeze-roster.mjs 가 만드는 파일이다. 손으로 채우지 말 것 —
 * 스크립트가 모든 닉네임을 실제 댓글과 대조하고, 하나라도 안 맞으면 멈춘다.
 *
 *   node scripts/freeze-roster.mjs --top 120
 *
 * 한 줄의 모양:
 *   { rank: 1, id: 119905929, userId: 'taegeuk0159', nick: '...', likes: 3381, role: 'commander' }
 *   role 은 없으면 빼고, 댓글 없이 세우는 줄은 id 가 'fixed-<userId>' 에 likes 가 null 이다.
 */
export const FROZEN_ROSTER = []

/** id 로 바로 찾기. 명단에 없는 댓글은 화면에서 뺀다. */
export const ROSTER_BY_ID = new Map(FROZEN_ROSTER.map((r) => [r.id, r]))
