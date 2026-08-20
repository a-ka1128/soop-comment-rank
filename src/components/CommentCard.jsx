import { useState } from 'react'
import { channelUrl, commentUrl } from '../lib/soop'
import { UNGROUPED_ID } from '../lib/groups'
import { seasonMatch } from '../lib/season'

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

function seasonTitle(label, hit) {
  return hit.via === 'nick'
    ? `${label} 참가자 — 명단의 '${hit.name}' 와 닉네임이 같습니다`
    : `${label} 참가자`
}

export default function CommentCard({
  comment,
  fanCount,
  bjId,
  postNo,
  color,
  showGroupName,
  groupName,
  groups,
  onAssign,
  move,
  hasSnapshot,
}) {
  const [open, setOpen] = useState(false)
  const seasons = seasonMatch(comment)

  return (
    <article
      className={`card${open ? ' is-open' : ''}`}
      style={{ '--group': color }}
      data-flip-id={comment.id}
    >
      <button
        type="button"
        className="card-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="rank-no">{comment.rank}</span>
        <RankDelta move={move} hasSnapshot={hasSnapshot} />

        {comment.profile ? (
          <img className="avatar" src={comment.profile} alt="" loading="lazy" />
        ) : (
          <span className="avatar avatar-empty" aria-hidden="true" />
        )}

        <span className="nick">{comment.nick}</span>
        <span className="uid">{comment.userId}</span>

        {seasons.season1 && (
          <span className="badge season1" title={seasonTitle('시즌1', seasons.season1)}>
            시즌1
          </span>
        )}
        {seasons.season2 && (
          <span className="badge season2" title={seasonTitle('시즌2', seasons.season2)}>
            시즌2
          </span>
        )}
        {showGroupName && groupName && <span className="badge group-badge">{groupName}</span>}
        {comment.manual && (
          <span className="badge manual" title="수동으로 지정한 분류입니다">
            수동
          </span>
        )}
        {comment.conflicts?.length > 0 && (
          <span
            className="badge warn"
            title={`이 분류에도 걸립니다: ${comment.conflicts.join(', ')}`}
          >
            중복 {comment.conflicts.length}
          </span>
        )}

        <span className="spacer" />
        {typeof fanCount === 'number' && (
          <span className="fans" title={`방송국 애청자 ${fanCount.toLocaleString()}명`}>
            ★{fanCount.toLocaleString()}
          </span>
        )}
        <span className="likes">♥ {comment.likes.toLocaleString()}</span>
        {/* 순위 변동이 ▲▼라서, 펼침 표시는 헷갈리지 않게 다른 모양을 쓴다. */}
        <span className="chevron" aria-hidden="true">
          {open ? '⌃' : '⌄'}
        </span>
      </button>

      {open && (
        <div className="card-detail">
          <p className="text">{comment.text}</p>

          {comment.photo && (
            <a href={comment.photo} target="_blank" rel="noreferrer noopener">
              <img className="photo" src={comment.photo} alt="" loading="lazy" />
            </a>
          )}

          <footer className="card-foot">
            <a
              href={commentUrl(bjId, postNo, comment.id)}
              target="_blank"
              rel="noreferrer noopener"
              className="channel"
            >
              댓글 원본 ↗
            </a>
            <a
              href={channelUrl(comment.userId)}
              target="_blank"
              rel="noreferrer noopener"
              className="channel"
            >
              방송국 ↗
            </a>
            <span>{comment.date}</span>
            {comment.replyCount > 0 && <span>답글 {comment.replyCount}</span>}
            <span className="spacer" />
            {groups.length > 0 && (
              <label className="assign">
                <span className="sr-only">분류 지정</span>
                <select
                  value={comment.manual ? comment.groupId : ''}
                  onChange={(e) => onAssign(comment.id, e.target.value)}
                >
                  <option value="">자동 분류</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}(으)로 지정
                    </option>
                  ))}
                  <option value={UNGROUPED_ID}>미분류로 지정</option>
                </select>
              </label>
            )}
          </footer>
        </div>
      )}
    </article>
  )
}
