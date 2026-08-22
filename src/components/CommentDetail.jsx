import { channelUrl, commentUrl } from '../lib/soop'
import { seasonMatch } from '../lib/season'

/** 고른 사람의 댓글을 크게 보여 주는 칸. */
export default function CommentDetail({ row, bjId, postNo }) {
  if (!row) {
    return (
      <div className="detail detail-blank">
        <p>왼쪽 명단에서 이름을 누르면 그 사람의 댓글이 여기에 나옵니다.</p>
      </div>
    )
  }

  const seasons = seasonMatch(row)

  return (
    <article className="detail">
      <header className="detail-head">
        <span className="detail-rank">{row.rank}</span>
        {row.profile ? (
          <img className="detail-avatar" src={row.profile} alt="" />
        ) : (
          <span className="detail-avatar avatar-empty" aria-hidden="true" />
        )}
        <div className="detail-who">
          <strong className="detail-nick">{row.nick}</strong>
          <span className="uid">{row.userId}</span>
        </div>
        <span className="spacer" />
        <span className="likes detail-likes">
          {row.likes == null ? '—' : `♥ ${row.likes.toLocaleString()}`}
        </span>
      </header>

      <div className="detail-badges">
        {row.role === 'fixed' && <span className="badge fixed">우왁굳</span>}
        {row.role === 'commander' && <span className="badge commander">지휘관</span>}
        {seasons.season1 && <span className="badge season1">시즌1</span>}
        {seasons.season2 && <span className="badge season2">시즌2</span>}
      </div>

      {row.text ? (
        <p className="detail-text">{row.text}</p>
      ) : (
        <p className="detail-none">이 글에 남긴 댓글이 없습니다.</p>
      )}

      {row.photo && (
        <a href={row.photo} target="_blank" rel="noreferrer noopener">
          <img className="detail-photo" src={row.photo} alt="" loading="lazy" />
        </a>
      )}

      <footer className="detail-foot">
        {!row.synthetic && (
          <a
            href={commentUrl(bjId, postNo, row.id)}
            target="_blank"
            rel="noreferrer noopener"
            className="channel"
          >
            댓글 원본 ↗
          </a>
        )}
        <a
          href={channelUrl(row.userId)}
          target="_blank"
          rel="noreferrer noopener"
          className="channel"
        >
          방송국 ↗
        </a>
        <span className="spacer" />
        {row.date && <span className="muted">{row.date}</span>}
        {row.replyCount > 0 && <span className="muted">답글 {row.replyCount}</span>}
      </footer>
    </article>
  )
}
