import { memo } from 'react'
import { seasonMatch } from '../lib/season'
import { EVENT } from '../lib/event'

/**
 * 명단 한 줄. 누르면 오른쪽 칸에 그 사람의 댓글이 펼쳐진다.
 *
 * 줄이 백 개를 넘어가므로 고른 줄만 다시 그려지도록 memo 를 씌운다.
 */
function RosterRow({ row, selected, onSelect }) {
  const seasons = seasonMatch(row)
  const role = row.role ? EVENT.roles[row.role] : null

  return (
    <button
      type="button"
      className={`row${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
    >
      <span className="rank-no">{row.seat}</span>

      {row.profile ? (
        <img className="avatar" src={row.profile} alt="" loading="lazy" />
      ) : (
        <span className="avatar avatar-empty" aria-hidden="true" />
      )}

      <span className="nick">{row.nick}</span>

      {/* 열이 좁아 글자로 쓰면 이름을 밀어낸다. 표식 하나로 줄인다. */}
      {role && (
        <span className={`badge mark ${row.role}`} title={role.label} aria-label={role.label}>
          {role.mark}
        </span>
      )}
      {seasons.season1 && (
        <span className="badge season1" title="시즌1 참가자">
          시즌1
        </span>
      )}
      {seasons.season2 && (
        <span className="badge season2" title="시즌2 참가자">
          시즌2
        </span>
      )}

      <span className="spacer" />
      <span className="likes">{row.likes == null ? '—' : `♥ ${row.likes.toLocaleString()}`}</span>
    </button>
  )
}

export default memo(RosterRow)
