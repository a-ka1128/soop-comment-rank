function rejectionReason(detection) {
  const candidates = detection?.candidates ?? []
  if (candidates.length < 2) return '본문에서 번호 매긴 목록을 찾지 못해 좋아요 순으로만 나열합니다.'

  const { coverage } = detection.check
  return (
    `본문에서 ${candidates.length}개짜리 목록을 찾았지만 댓글의 ` +
    `${Math.round(coverage * 100)}%만 들어맞아 분류하지 않았습니다. ` +
    '합격자 명단이나 신청 양식처럼 분류가 아닌 목록으로 보입니다.'
  )
}

/**
 * 그룹은 게시글 본문에서 자동으로 잡아 오므로 여기서 규칙을 편집하지 않는다.
 * 잘못 분류된 댓글은 댓글 카드에서 직접 그룹을 지정한다.
 */
export default function GroupPanel({ groups, counts, detection }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{groups.length > 0 ? '게시글에서 찾은 분류' : '분류 없음'}</h2>
        <p>
          {groups.length > 0
            ? '본문의 번호 목록을 그대로 가져왔습니다. 잘못 분류된 댓글은 카드 아래에서 직접 옮길 수 있습니다.'
            : rejectionReason(detection)}
        </p>
      </div>

      {groups.length > 0 && (
        <ul className="detected">
          {groups.map((group) => (
            <li key={group.id} style={{ '--group': group.color }}>
              <span className="swatch" aria-hidden="true" />
              <strong>{group.name}</strong>
              <span className="muted">{counts[group.id] ?? 0}개</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
