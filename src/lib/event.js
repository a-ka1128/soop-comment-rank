/**
 * 이벤트 하나에만 해당하는 간판. 다음 이벤트로 갈아끼울 때 고칠 첫 번째 파일이다.
 *
 * 화면에 나오는 이름·역할 라벨을 전부 여기 모아 뒀다. 컴포넌트는 이 값을 읽기만
 * 하므로, 이벤트가 바뀌어도 App.jsx / RosterRow / CommentDetail 은 안 건드려도 된다.
 *
 * 대상 게시글은 target.js, 팀 이름·색은 scripts/team-order.json 에 있다.
 */
export const EVENT = {
  /**
   * 머리말 제목. index.html 의 <title> 도 같이 고칠 것 —
   * 그쪽은 빌드 전에 읽히는 정적 파일이라 이 값을 못 가져간다.
   */
  title: '확정 명단',

  /** 제목 아래 한 줄. null 이면 안 그린다. */
  description: '이름을 누르면 그 사람의 댓글이 보입니다.',

  /**
   * 머리말 로고. public/ 에 파일을 넣고 './파일명' 으로 적는다.
   * null 이면 로고 자리 자체를 비운다.
   */
  logo: null,

  /**
   * 역할 표시. 키는 teams.js 의 role 값과 짝이 맞아야 한다
   * (scripts/build-teams.mjs 가 team-order.json 의 leader/commander 로 붙인다).
   *
   *   label  댓글 칸에 글자로 나온다
   *   mark   명단 줄에 붙는 표식. 열이 좁아 글자를 쓰면 이름을 밀어내므로 한 글자만 쓴다
   */
  roles: {
    leader: { label: '리더', mark: '★' },
    commander: { label: '부리더', mark: '☆' },
  },
}
