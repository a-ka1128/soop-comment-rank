import { memo } from 'react'
import { scanAgrees } from '../lib/scanNicks'

/**
 * 마지막으로 움직였을 때의 순위 변동. 갱신마다 지워지지 않고, 다시 움직이거나
 * 정해진 시간이 지날 때까지 남는다(App 의 MOVE_TTL_MS).
 */
function RankDelta({ move, hasSnapshot }) {
  if (!hasSnapshot || !move) return null
  if (move.delta === null) return <span className="delta new">NEW</span>
  const moved = move.delta
  if (moved === 0) return null
  return (
    <span className={`delta ${moved > 0 ? 'up' : 'down'}`}>
      {moved > 0 ? '▲' : '▼'}
      {Math.abs(moved)}
    </span>
  )
}

/**
 * 목록의 한 줄 — 순위, 누구인지, 직업, 좋아요만. 자세한 건 누르면 옆(CommentDetail)에 뜬다.
 *
 * 줄이 200개가 넘는다. 슬라이더를 끌 때처럼 부모가 자주 다시 그려지는 상황에서
 * 내용이 그대로인 줄까지 다시 그리면 눈에 띄게 걸린다.
 */
function CommentCard({
  comment,
  color,
  groupName,
  gameNick,
  scan,
  isedol,
  selected,
  onSelect,
  move,
  hasSnapshot,
}) {
  return (
    <article
      className={`card${selected ? ' is-open' : ''}${comment.lowFans != null ? ' is-low' : ''}${isedol ? ' is-isedol' : ''}`}
      style={{ '--group': color }}
      data-flip-id={comment.id}
    >
      <button
        type="button"
        className="card-row"
        onClick={() => onSelect(comment.id)}
        aria-pressed={selected}
      >
        <span className="rank-no">{comment.rank}</span>
        <RankDelta move={move} hasSnapshot={hasSnapshot} />

        {comment.profile ? (
          <img className="avatar" src={comment.profile} alt="" loading="lazy" />
        ) : (
          <span className="avatar avatar-empty" aria-hidden="true" />
        )}

        <span className="nick-col">
          <span className="nick-line">
            <span className="nick">{comment.nick}</span>
            {isedol && (
              <span className="badge isedol-badge" title="이세계아이돌">
                ISEGYE IDOL
              </span>
            )}
            {/* 목록에는 대표 직업 하나만. 나머지 직업은 오른쪽 자세히 보기에 있다. */}
            {groupName && (
              <span
                className="badge group-badge"
                style={comment.classColor ? { '--group': comment.classColor } : undefined}
              >
                {groupName}
              </span>
            )}
            {comment.lowFans != null && (
              <span className="badge low-fans" title="즐찾이 1,000명 기준에 모자랍니다">
                즐찾 {comment.lowFans.toLocaleString()}명
              </span>
            )}
          </span>
          {gameNick && (
            <span className="game-nick" title="인게임 닉네임">
              {gameNick}
              {scan && !scanAgrees(gameNick, scan) && (
                <em className="scan-diff" title={`사진 스캔은 다르게 읽음: ${scan.map((c) => c.name).join(' / ')}`}>
                  ≠
                </em>
              )}
            </span>
          )}
          {!gameNick && scan && (
            <span className="game-nick scan-only" title="사진 스캔 후보 (확인 안 됨)">
              {scan[0].name}
            </span>
          )}
        </span>

        <span className="likes">♥ {comment.likes.toLocaleString()}</span>
      </button>
    </article>
  )
}

export default memo(CommentCard)
