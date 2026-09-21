import { useEffect, useMemo, useState } from 'react'
import RosterRow from './components/RosterRow'
import CommentDetail from './components/CommentDetail'
import { fetchAllComments } from './lib/soop'
import { HAS_TARGET, TARGET_POST } from './lib/target'
import { EVENT } from './lib/event'
import { ALL_MEMBERS, TEAMS } from './lib/teams'

import './App.css'

/**
 * 편성이 먼저고 댓글이 나중이다.
 *
 * 누가 어느 팀 몇 번째인지는 teams.js 가 정하고, SOOP 에서 가져오는 건 본문과
 * 지금 좋아요뿐이다. API 가 죽어도 명단과 편성은 굳힌 값 그대로 나온다.
 */
function mergeLive(member, live) {
  const found = live.get(member.id)
  if (!found) {
    // 댓글 없이 세운 줄이거나, 댓글이 지워진 줄.
    return { ...member, synthetic: true, text: '', date: '', profile: '', photo: '', replyCount: 0 }
  }
  return {
    ...member,
    likes: found.likes,
    text: found.text,
    date: found.date,
    profile: found.profile,
    photo: found.photo,
    replyCount: found.replyCount,
  }
}

/** 아직 아무것도 안 채운 상태. 다음에 뭘 해야 하는지만 말해 준다. */
function Empty() {
  return (
    <section className="empty">
      <h2>명단이 아직 없습니다</h2>
      <ol>
        <li>
          <code>src/lib/target.js</code> 에 대상 게시글을 적습니다.
        </li>
        <li>
          선발이 끝나면 <code>node scripts/freeze-roster.mjs --top N</code> 으로 순위를 굳힙니다.
        </li>
        <li>
          <code>scripts/team-order.json</code> 에 편성을 적고{' '}
          <code>node scripts/build-teams.mjs</code> 를 돌립니다.
        </li>
      </ol>
      <p>
        간판(제목 · 역할 이름 · 로고)은 <code>src/lib/event.js</code> 한 곳에 있습니다.
      </p>
    </section>
  )
}

export default function App() {
  const [live, setLive] = useState(() => new Map())
  const [selectedId, setSelectedId] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // 대상 글이 없으면 부를 데가 없다. 빈 주소로 찔러 봐야 에러만 뜬다.
    if (!HAS_TARGET) return

    const controller = new AbortController()
    fetchAllComments(TARGET_POST.bjId, TARGET_POST.postNo, {
      signal: controller.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    })
      .then((result) => setLive(new Map(result.comments.map((c) => [c.id, c]))))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(`${err.message} 명단은 확정된 값으로 표시합니다.`)
      })
      .finally(() => setProgress(null))
    return () => controller.abort()
  }, [])

  const rowsById = useMemo(() => {
    const map = new Map()
    for (const member of ALL_MEMBERS) map.set(member.id, mergeLive(member, live))
    return map
  }, [live])

  const selected = selectedId === null ? null : (rowsById.get(selectedId) ?? null)
  const leaderLabel = EVENT.roles.leader?.label ?? ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {EVENT.logo && (
            <img className="brand-logo" src={EVENT.logo} alt="" width="48" height="48" />
          )}
          <div>
            <h1>{EVENT.title}</h1>
            {EVENT.description && <p>{EVENT.description}</p>}
          </div>
        </div>

        {progress && (
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
            <span>
              {progress.done} / {progress.total} 페이지
            </span>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </header>

      {TEAMS.length === 0 ? (
        <Empty />
      ) : (
        <div className="layout" style={{ '--team-count': TEAMS.length }}>
          {TEAMS.map((team) => {
            const leader = team.members.find((m) => m.role === 'leader')
            return (
              <section className="team" key={team.id} style={{ '--team': team.color }}>
                <header className="team-head">
                  <div className="team-name">
                    <strong>{team.name}</strong>
                    {team.faction && <span className="team-faction">{team.faction}</span>}
                  </div>
                  <span className="team-count">{team.members.length}명</span>
                  {leader && (
                    <span className="team-leader">
                      {leaderLabel} {leader.nick}
                    </span>
                  )}
                </header>

                {team.members.map((member) => (
                  <RosterRow
                    key={member.id}
                    row={rowsById.get(member.id)}
                    selected={member.id === selectedId}
                    onSelect={setSelectedId}
                  />
                ))}
              </section>
            )
          })}

          <aside className="detail-pane">
            <CommentDetail row={selected} bjId={TARGET_POST.bjId} postNo={TARGET_POST.postNo} />
          </aside>
        </div>
      )}
    </div>
  )
}
