import { useState } from 'react'
import { channelUrl } from '../lib/soop'
import { UNGROUPED_ID } from '../lib/groups'

/** 직전 갱신 대비 순위 변동. 스냅샷이 없으면(첫 로드) 아무것도 보이지 않는다. */
function RankDelta({ rank, prevRank, hasSnapshot }) {
  if (!hasSnapshot) return null
  if (prevRank === undefined) return <span className="delta new">NEW</span>
  const moved = prevRank - rank
  if (moved === 0) return null
  return (
    <span className={`delta ${moved > 0 ? 'up' : 'down'}`}>
      {moved > 0 ? '▲' : '▼'}
      {Math.abs(moved)}
    </span>
  )
}

export default function CommentCard({
  comment,
  color,
  showGroupName,
  groupName,
  groups,
  onAssign,
  prevRank,
  hasSnapshot,
}) {
  const [open, setOpen] = useState(false)

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
        <RankDelta rank={comment.rank} prevRank={prevRank} hasSnapshot={hasSnapshot} />

        {comment.profile ? (
          <img className="avatar" src={comment.profile} alt="" loading="lazy" />
        ) : (
          <span className="avatar avatar-empty" aria-hidden="true" />
        )}

        <span className="nick">{comment.nick}</span>
        <span className="uid">{comment.userId}</span>

        {comment.isBest && <span className="badge best">BEST</span>}
        {showGroupName && groupName && <span className="badge group-badge">{groupName}</span>}
        {comment.manual && (
          <span className="badge manual" title="수동으로 지정한 분류입니다">
            수동
          </span>
        )}
        {comment.conflicts?.length > 0 && (
          <span className="badge warn" title={`이 분류에도 걸립니다: ${comment.conflicts.join(', ')}`}>
            중복 {comment.conflicts.length}
          </span>
        )}

        <span className="spacer" />
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
