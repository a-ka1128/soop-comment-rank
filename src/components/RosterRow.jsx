import { memo } from 'react'
import { seasonMatch } from '../lib/season'

/**
 * 명단 한 줄. 누르면 오른쪽 칸에 그 사람의 댓글이 펼쳐진다.
 *
 * 줄이 120개라 고른 줄만 다시 그려지도록 memo 를 씌운다.
 */
function RosterRow({ row, selected, onSelect }) {
  const seasons = seasonMatch(row)

  return (
    <button
      type="button"
      className={`row${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
    >
      <span className="rank-no">{row.rank}</span>

      {row.profile ? (
        <img className="avatar" src={row.profile} alt="" loading="lazy" />
      ) : (
        <span className="avatar avatar-empty" aria-hidden="true" />
      )}

      <span className="nick">{row.nick}</span>
      <span className="uid">{row.userId}</span>

      {row.role === 'fixed' && (
        <span className="badge fixed" title="우왁굳 방송국">
          우왁굳
        </span>
      )}
      {row.role === 'commander' && (
        <span className="badge commander" title="지휘관입니다">
          지휘관
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
