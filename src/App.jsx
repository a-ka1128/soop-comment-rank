import { useEffect, useState } from 'react'
import RosterRow from './components/RosterRow'
import CommentDetail from './components/CommentDetail'
import { fetchAllComments } from './lib/soop'
import { TARGET_POST } from './lib/target'
import { FROZEN_ROSTER } from './lib/roster'
import './App.css'

/**
 * 확정된 명단에 지금 좋아요를 입힌다.
 *
 * 명단이 먼저고 댓글이 나중이다 — 순서도 인원도 roster.js 가 정하고, 여기서
 * 가져오는 건 본문과 최신 좋아요뿐이다. SOOP 에서 아무것도 못 받아도 명단은
 * 굳힌 값 그대로 나온다.
 */
function buildRows(comments) {
  const live = new Map(comments.map((c) => [c.id, c]))
  return FROZEN_ROSTER.map((entry) => {
    const found = live.get(entry.id)
    if (found) return { ...found, rank: entry.rank, role: entry.role }
    // 댓글이 없는 줄(우왁굳)이거나 지워진 줄.
    return {
      id: entry.id,
      userId: entry.userId,
      nick: entry.nick,
      likes: entry.likes,
      rank: entry.rank,
      role: entry.role,
      synthetic: true,
      text: '',
      date: '',
      profile: '',
      replyCount: 0,
      photo: '',
    }
  })
}

export default function App() {
  const [rows, setRows] = useState(() => buildRows([]))
  const [selectedId, setSelectedId] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetchAllComments(TARGET_POST.bjId, TARGET_POST.postNo, {
      signal: controller.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    })
      .then((result) => setRows(buildRows(result.comments)))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(`${err.message} 명단은 확정된 값으로 표시합니다.`)
      })
      .finally(() => setProgress(null))
    return () => controller.abort()
  }, [])

  const selected = rows.find((row) => row.id === selectedId) ?? null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="./logo.png" alt="" width="48" height="48" />
          <div>
            <h1>아르마3 랜덤고지전 확정 명단</h1>
            <p>선발이 끝났습니다. 순위는 확정된 명단 그대로이며 더 이상 바뀌지 않습니다.</p>
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
        <main className="list">
          {rows.map((row) => (
            <RosterRow
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </main>

        <aside className="detail-pane">
          <CommentDetail row={selected} bjId={TARGET_POST.bjId} postNo={TARGET_POST.postNo} />
        </aside>
      </div>
    </div>
  )
}
