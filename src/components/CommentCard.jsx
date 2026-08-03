import { channelUrl } from '../lib/soop'
import { UNGROUPED_ID } from '../lib/groups'

export default function CommentCard({ comment, color, showGroupName, groupName, groups, onAssign }) {
  return (
    <article className="card" style={{ '--group': color }}>
      <div className="card-rank">
        <span className="rank-no">{comment.rank}</span>
        {comment.isBest && <span className="badge best">BEST</span>}
      </div>

      <div className="card-body">
        <header className="card-head">
          {comment.profile ? (
            <img className="avatar" src={comment.profile} alt="" loading="lazy" />
          ) : (
            <span className="avatar avatar-empty" aria-hidden="true" />
          )}
          <a
            className="nick"
            href={channelUrl(comment.userId)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {comment.nick}
          </a>
          <span className="uid">{comment.userId}</span>
          {showGroupName && groupName && <span className="badge group-badge">{groupName}</span>}
          {comment.manual && (
            <span className="badge manual" title="수동으로 지정한 그룹입니다">
              수동
            </span>
          )}
          {comment.conflicts?.length > 0 && (
            <span
              className="badge warn"
              title={`이 그룹에도 걸립니다: ${comment.conflicts.join(', ')}`}
            >
              중복 {comment.conflicts.length}
            </span>
          )}
          <span className="spacer" />
          <span className="likes">♥ {comment.likes.toLocaleString()}</span>
        </header>

        <p className="text">{comment.text}</p>

        {comment.photo && (
          <a href={comment.photo} target="_blank" rel="noreferrer noopener">
            <img className="photo" src={comment.photo} alt="" loading="lazy" />
          </a>
        )}

        <footer className="card-foot">
          <span>{comment.date}</span>
          {comment.replyCount > 0 && <span>답글 {comment.replyCount}</span>}
          <span className="spacer" />
          {groups.length > 0 && (
            <label className="assign">
              <span className="sr-only">그룹 지정</span>
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
    </article>
  )
}
