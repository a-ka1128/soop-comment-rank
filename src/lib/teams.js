/**
 * 팀 편성. 아직 비어 있다 — 화면은 "명단이 아직 없습니다" 만 띄운다.
 *
 * scripts/build-teams.mjs 가 만드는 파일이다. 손으로 고치지 말고 다시 돌릴 것.
 * 편성은 scripts/team-order.json 에 적고, 사람 정보는 확정 명단에서 그대로 가져온다.
 *
 *   node scripts/build-teams.mjs
 *
 * 한 팀의 모양:
 *   { id: 'a', name: 'A팀', faction: null, color: '#7f8b9e', members: [...] }
 *   rank  전체 확정 명단에서의 순위
 *   seat  팀 안에서의 자리
 *   role  src/lib/event.js 의 roles 키 (leader · commander)
 */
export const TEAMS = []

/** 팀을 가로지르는 전체 인원. */
export const ALL_MEMBERS = TEAMS.flatMap((t) => t.members)
