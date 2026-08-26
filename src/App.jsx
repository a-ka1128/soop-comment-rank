import { useEffect, useMemo, useState } from 'react'
import RosterRow from './components/RosterRow'
import CommentDetail from './components/CommentDetail'
import { fetchAllComments } from './lib/soop'
import { TARGET_POST } from './lib/target'
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
    // 댓글이 없는 줄(우왁굳)이거나 지워진 줄.
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

export default function App() {
  const [live, setLive] = useState(() => new Map())
  const [selectedId, setSelectedId] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="./logo.png" alt="" width="48" height="48" />
          <div>
            <h1>아르마3 랜덤고지전 확정 명단</h1>
            <p>
              최종 합격자 {ALL_MEMBERS.length}명 · {TEAMS.length}개 팀. 이름을 누르면 그 사람의
              댓글이 보입니다.
            </p>
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

      <div className="layout">
        {TEAMS.map((team) => {
          const leader = team.members.find((m) => m.role === 'leader')
          return (
            <section className="team" key={team.id} style={{ '--team': team.color }}>
              <header className="team-head">
                <div className="team-name">
                  <strong>{team.name}</strong>
                  <span className="team-faction">{team.faction}</span>
                </div>
                <span className="team-count">{team.members.length}명</span>
                {leader && <span className="team-leader">총지휘관 {leader.nick}</span>}
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
    </div>
  )
}
