import { memo, useState } from 'react'
import { channelUrl, commentUrl } from '../lib/soop'
import { seasonMatch } from '../lib/season'
import { tagsOf } from '../lib/wow'
import LabelEditor from './LabelEditor'

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

/**
 * 줄이 200개가 넘는다. 슬라이더를 끌 때처럼 부모가 자주 다시 그려지는 상황에서
 * 내용이 그대로인 줄까지 다시 그리면 눈에 띄게 걸린다.
 */
function CommentCard({
  comment,
  bjId,
  postNo,
  color,
  showGroupName,
  groupName,
  label,
  admin,
  onSaveLabel,
  move,
  hasSnapshot,
  fanCount,
  joinedAt,
  alsoDebut,
}) {
  const [open, setOpen] = useState(false)
  const seasons = seasonMatch(comment)
  const tags = tagsOf(comment, label)

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
        {comment.alsoConsidering?.length > 0 && (
          <span className="badge considering" title="같이 고민 중이라고 적은 직업">
            +{comment.alsoConsidering.join('·')}
          </span>
        )}
        {alsoDebut && (
          <span className="badge debut" title="「리얼 뉴 와튜버 데뷔 하기」 글에도 댓글을 달았습니다">
            뉴 데뷔
          </span>
        )}
        {tags.map((t) => (
          <span key={t.id} className={`badge tag-${t.kind}`} title={t.hint}>
            {t.name}
          </span>
        ))}
        {comment.manual && (
          <span className="badge manual" title="어드민이 직업을 확인했습니다">
            확인
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

        {/* 줄이 좁아 감길 때 숫자들이 흩어지지 않도록 한 덩어리로 묶어 오른쪽에 붙인다. */}
        <span className="card-meta">
          {fanCount != null && (
            <span className="station-info" title="방송국 애청자(즐겨찾기) 수">
              즐찾 {fanCount.toLocaleString()}
            </span>
          )}
          {joinedAt && (
            <span className="station-info" title="SOOP 방송국 가입일 — 데뷔일과 다를 수 있습니다">
              {joinedAt.slice(0, 7).replace('-', '.')} 가입
            </span>
          )}
          <span className="likes">♥ {comment.likes.toLocaleString()}</span>
          {/* 순위 변동이 ▲▼라서, 펼침 표시는 헷갈리지 않게 다른 모양을 쓴다. */}
          <span className="chevron" aria-hidden="true">
            {open ? '⌃' : '⌄'}
          </span>
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
          </footer>

          {admin && <LabelEditor userId={comment.userId} label={label} onSave={onSaveLabel} />}
        </div>
      )}
    </article>
  )
}

export default memo(CommentCard)
