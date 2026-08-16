/**
 * 게시글 본문에서 찾아낸 분류를 보여 준다. 분류를 못 찾은 글에서는 아예 뜨지 않는다
 * (그때는 탭도 없이 좋아요 순 한 줄이라, 설명할 것보다 자리만 차지했다).
 *
 * 규칙은 본문에서 자동으로 잡아 오므로 여기서 편집하지 않는다.
 * 잘못 분류된 댓글은 댓글 카드에서 직접 지정한다.
 */
export default function GroupPanel({ groups, counts }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>게시글에서 찾은 분류</h2>
        <p>
          본문의 번호 목록을 그대로 가져왔습니다. 잘못 분류된 댓글은 카드 아래에서 직접 옮길 수
          있습니다.
        </p>
      </div>

      <ul className="detected">
        {groups.map((group) => (
          <li key={group.id} style={{ '--group': group.color }}>
            <span className="swatch" aria-hidden="true" />
            <strong>{group.name}</strong>
            <span className="muted">{counts[group.id] ?? 0}개</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
