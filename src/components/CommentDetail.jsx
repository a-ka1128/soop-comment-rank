import { useEffect, useRef } from 'react'
import { channelUrl, commentUrl } from '../lib/soop'
import { seasonMatch } from '../lib/season'
import { tagsOf } from '../lib/wow'
import LabelEditor from './LabelEditor'

function seasonTitle(label, hit) {
  return hit.via === 'nick'
    ? `${label} 참가자 — 명단의 '${hit.name}' 와 닉네임이 같습니다`
    : `${label} 참가자`
}

/**
 * 목록에서 고른 한 사람의 자세한 정보와 댓글 전문.
 * 넓은 화면에서는 목록 옆에 붙어 있고, 좁은 화면에서는 화면을 덮는 시트로 뜬다(App.css).
 */
export default function CommentDetail({
  comment,
  bjId,
  postNo,
  color,
  groupName,
  label,
  gameNick,
  defaultGameNick,
  admin,
  onSaveLabel,
  fanCount,
  alsoDebut,
  onClose,
}) {
  // 시트로 떠 있을 때 Esc 로 닫는다. 넓은 화면에서도 선택 해제로 같은 뜻이다.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 패널은 높이가 고정이고 안에서 스크롤된다. 다른 사람을 고르면 맨 위부터 보여 준다.
  const paneRef = useRef(null)
  const shownId = comment?.id
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0
  }, [shownId])

  if (!comment) {
    return (
      <aside className="detail detail-empty">
        <p>왼쪽 목록에서 사람을 누르면 자기소개 댓글과 자세한 정보가 여기 뜹니다.</p>
      </aside>
    )
  }

  const seasons = seasonMatch(comment)
  const tags = tagsOf(comment, label)

  return (
    <aside
      ref={paneRef}
      className="detail is-open"
      style={{ '--group': color }}
      aria-label={`${comment.nick} 자세히`}
    >
      <header className="detail-head">
        {comment.profile ? (
          <img className="detail-avatar" src={comment.profile} alt="" />
        ) : (
          <span className="detail-avatar avatar-empty" aria-hidden="true" />
        )}
        <div className="detail-who">
          <span className="detail-rank">
            {comment.rank}위
            {comment.overallRank ? <span className="muted"> · 전체 {comment.overallRank}위</span> : null}
          </span>
          <h2>{comment.nick}</h2>
          {gameNick && (
            <span className="detail-game-nick">
              인게임 <b>{gameNick}</b>
            </span>
          )}
          <span className="muted">{comment.userId || 'SOOP 아이디 없음'}</span>
        </div>
        <button type="button" className="detail-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </header>

      <dl className="detail-stats">
        <div>
          <dt>좋아요</dt>
          <dd className="detail-likes">♥ {comment.likes.toLocaleString()}</dd>
        </div>
        <div>
          <dt>즐겨찾기</dt>
          <dd>{fanCount != null ? fanCount.toLocaleString() : '—'}</dd>
        </div>
      </dl>

      <div className="detail-badges">
        {groupName && (
          <span
            className="badge group-badge"
            style={comment.classColor ? { '--group': comment.classColor } : undefined}
          >
            {groupName}
          </span>
        )}
        {comment.extraClasses?.map((c) => (
          <span key={c.id} className="badge group-badge" style={{ '--group': c.color }}>
            {c.name}
          </span>
        ))}
        {comment.alsoConsidering?.length > 0 && (
          <span className="badge considering" title="같이 고민 중이라고 적은 직업">
            +{comment.alsoConsidering.join('·')}
          </span>
        )}
        {alsoDebut && (
          <span
            className="badge debut"
            title="「리얼 뉴 와튜버 데뷔 하기」 글에도 댓글을 달았습니다"
          >
            뉴 데뷔
          </span>
        )}
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
        {tags.map((t) => (
          <span key={t.id} className={`badge tag-${t.look}`} title={t.hint}>
            {t.name}
          </span>
        ))}
        {comment.conflicts?.length > 0 && (
          <span
            className="badge warn"
            title={`이 분류에도 걸립니다: ${comment.conflicts.join(', ')}`}
          >
            중복 {comment.conflicts.length}
          </span>
        )}
      </div>

      <p className="text">{comment.text}</p>

      {comment.photo && (
        <a href={comment.photo} target="_blank" rel="noreferrer noopener">
          <img className="photo" src={comment.photo} alt="" loading="lazy" />
        </a>
      )}

      <footer className="card-foot">
        <a
          href={comment.link ?? commentUrl(bjId, postNo, comment.id)}
          target="_blank"
          rel="noreferrer noopener"
          className="channel"
        >
          {comment.link ? '카페 글 ↗' : '댓글 원본 ↗'}
        </a>
        {comment.userId && (
          <a
            href={channelUrl(comment.userId)}
            target="_blank"
            rel="noreferrer noopener"
            className="channel"
          >
            방송국 ↗
          </a>
        )}
        <span>{comment.date}</span>
        {comment.replyCount > 0 && <span>답글 {comment.replyCount}</span>}
      </footer>

      {/* 사람을 바꾸면 편집 중이던 값이 따라오지 않도록 새로 만든다. */}
      {admin && comment.userId && (
        <LabelEditor
          key={comment.userId}
          userId={comment.userId}
          label={label}
          defaultGameNick={defaultGameNick}
          onSave={onSaveLabel}
        />
      )}
    </aside>
  )
}
