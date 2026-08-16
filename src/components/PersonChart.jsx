import { useEffect, useMemo, useState } from 'react'
import { fetchMeta, fetchSeries, historyEnabled } from '../lib/history'

/**
 * 검증을 통과한 계열 색. 우리 밀리터리 팔레트는 색약에서 서로 붙어 버려
 * (황동↔필드그린 ΔE 1.6) 선 구분에는 쓸 수 없다. 이 다섯은 패널 표면 #1c1b13
 * 기준으로 명도대·채도·색약분리·정상시야분리·대비 전부 통과한다.
 */
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']
const MAX_SERIES = SERIES.length

const RANGES = [
  { id: '1h', label: '1시간', ms: 60 * 60 * 1000 },
  { id: '6h', label: '6시간', ms: 6 * 60 * 60 * 1000 },
  { id: '24h', label: '24시간', ms: 24 * 60 * 60 * 1000 },
  { id: 'all', label: '전체', ms: Infinity },
]

const W = 960
const H = 240
const PAD = { top: 18, right: 90, bottom: 28, left: 52 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const hhmm = (d) => d.toTimeString().slice(0, 5)

export default function PersonChart({ bjId, postNo, candidates }) {
  const [picked, setPicked] = useState([])
  const [series, setSeries] = useState({})
  const [range, setRange] = useState('6h')
  const [relative, setRelative] = useState(true)
  const [query, setQuery] = useState('')
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!historyEnabled() || !bjId) return
    let alive = true
    setStatus('loading')
    fetchMeta(bjId, postNo)
      .then((m) => alive && (setMeta(m), setStatus(m ? 'ready' : 'untracked')))
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [bjId, postNo])

  // 고른 사람의 시계열만 가져온다. points/{댓글id} 아래가 곧 그 사람 기록이라
  // 한 사람 추가에 요청 하나면 끝난다.
  useEffect(() => {
    const missing = picked.filter((c) => !series[c.id])
    if (missing.length === 0) return
    let alive = true
    Promise.all(
      missing.map((c) => fetchSeries(bjId, postNo, c.id).then((points) => [c.id, points]))
    ).then((pairs) => {
      if (alive) setSeries((prev) => ({ ...prev, ...Object.fromEntries(pairs) }))
    })
    return () => {
      alive = false
    }
  }, [picked, series, bjId, postNo])

  const lines = useMemo(() => {
    const span = RANGES.find((r) => r.id === range)?.ms ?? Infinity
    const now = Date.now()
    return picked
      .map((c, i) => {
        const all = series[c.id] ?? []
        const points = span === Infinity ? all : all.filter((p) => now - p.t.getTime() <= span)
        const first = points[0]?.likes ?? 0
        return {
          comment: c,
          color: SERIES[i % MAX_SERIES],
          points: points.map((p) => ({ t: p.t, v: relative ? p.likes - first : p.likes })),
        }
      })
      .filter((l) => l.points.length > 0)
  }, [picked, series, range, relative])

  const scale = useMemo(() => {
    const all = lines.flatMap((l) => l.points)
    if (all.length < 2) return null
    const t0 = Math.min(...all.map((p) => p.t.getTime()))
    const t1 = Math.max(...all.map((p) => p.t.getTime()))
    const vMin = Math.min(0, ...all.map((p) => p.v))
    const vMax = Math.max(...all.map((p) => p.v))
    const tSpan = t1 - t0 || 1
    const vSpan = vMax - vMin || 1
    return {
      t0,
      t1,
      vMin,
      vMax,
      x: (t) => PAD.left + ((t - t0) / tSpan) * PLOT_W,
      y: (v) => PAD.top + ((vMax - v) / vSpan) * PLOT_H,
    }
  }, [lines])

  const shortlist = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? candidates.filter((c) => c.nick.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q))
      : candidates.slice(0, 12)
    return pool.slice(0, 12)
  }, [candidates, query])

  function toggle(comment) {
    setPicked((prev) => {
      if (prev.some((c) => c.id === comment.id)) return prev.filter((c) => c.id !== comment.id)
      if (prev.length >= MAX_SERIES) return prev
      return [...prev, comment]
    })
  }

  if (!historyEnabled()) {
    return (
      <section className="panel chart">
        <div className="panel-head">
          <h2>개인 추이</h2>
        </div>
        <p className="chart-empty">
          기록 서버가 설정되지 않았습니다. <code>VITE_RTDB_URL</code>을 넣고 다시 빌드하면
          수집기가 쌓아 둔 기록으로 개인별 추이를 그립니다.
        </p>
      </section>
    )
  }

  return (
    <section className="panel chart">
      <div className="panel-head">
        <h2>개인 추이</h2>
      </div>

      {status === 'untracked' && (
        <p className="chart-empty">
          이 게시글은 수집 대상이 아닙니다. <code>collector/tracked.json</code>에 추가하면 다음
          분부터 기록이 쌓입니다.
        </p>
      )}
      {status === 'error' && <p className="chart-empty">기록 서버를 읽지 못했습니다.</p>}

      {status === 'ready' && (
        <>
          <div className="chart-controls">
            <div className="seg">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={range === r.id ? 'on' : ''}
                  onClick={() => setRange(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="seg">
              <button
                type="button"
                className={relative ? 'on' : ''}
                onClick={() => setRelative(true)}
              >
                구간 증가분
              </button>
              <button
                type="button"
                className={!relative ? 'on' : ''}
                onClick={() => setRelative(false)}
              >
                누적 좋아요
              </button>
            </div>
            <span className="spacer" />
            <span className="muted">
              {meta?.updatedAt ? `${new Date(meta.updatedAt).toTimeString().slice(0, 8)} 수집` : ''}
            </span>
          </div>

          <div className="picker">
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`닉네임 검색 — 최대 ${MAX_SERIES}명`}
            />
            <div className="chips">
              {shortlist.map((c) => {
                const on = picked.some((p) => p.id === c.id)
                const color = on ? SERIES[picked.findIndex((p) => p.id === c.id) % MAX_SERIES] : null
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip${on ? ' on' : ''}`}
                    style={color ? { '--chip': color } : undefined}
                    onClick={() => toggle(c)}
                  >
                    {c.rank}. {c.nick}
                  </button>
                )
              })}
            </div>
          </div>

          {!scale ? (
            <p className="chart-empty">
              사람을 고르면 그 사람의 좋아요 추이를 그립니다. 기록이 두 시점 이상 쌓여야 선이
              그려집니다.
            </p>
          ) : (
            <>
              <div className="chart-plot">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  role="img"
                  aria-label={`선택한 ${lines.length}명의 좋아요 추이 꺾은선 그래프`}
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                    const v = scale.vMax - f * (scale.vMax - scale.vMin)
                    return (
                      <g key={f}>
                        <line
                          x1={PAD.left}
                          x2={W - PAD.right}
                          y1={scale.y(v)}
                          y2={scale.y(v)}
                          className={v === 0 ? 'axis-line' : 'grid-line'}
                        />
                        <text x={PAD.left - 8} y={scale.y(v) + 4} className="tick" textAnchor="end">
                          {Math.round(v).toLocaleString()}
                        </text>
                      </g>
                    )
                  })}

                  {[0, 0.5, 1].map((f) => {
                    const t = scale.t0 + f * (scale.t1 - scale.t0)
                    return (
                      <text
                        key={f}
                        x={scale.x(t)}
                        y={H - 8}
                        className="tick"
                        textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
                      >
                        {hhmm(new Date(t))}
                      </text>
                    )
                  })}

                  {lines.map((line) => {
                    const d = line.points
                      .map((p, i) => `${i === 0 ? 'M' : 'L'}${scale.x(p.t.getTime())},${scale.y(p.v)}`)
                      .join(' ')
                    const last = line.points[line.points.length - 1]
                    return (
                      <g key={line.comment.id}>
                        <path d={d} className="line" style={{ stroke: line.color }} />
                        {/* 선마다 끝에 이름을 붙인다. 색만으로 누구인지 알게 두지 않는다. */}
                        <text
                          x={scale.x(last.t.getTime()) + 6}
                          y={scale.y(last.v) + 4}
                          className="line-label"
                          style={{ fill: line.color }}
                        >
                          {line.comment.nick}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              <div className="chart-table-wrap">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>닉네임</th>
                      <th>기록 수</th>
                      <th>{relative ? '구간 증가' : '현재'}</th>
                      <th>시작</th>
                      <th>끝</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.comment.id}>
                        <td className="cell-nick">{l.comment.nick}</td>
                        <td>{l.points.length}</td>
                        <td className="cell-gain">
                          {l.points[l.points.length - 1].v.toLocaleString()}
                        </td>
                        <td>{hhmm(l.points[0].t)}</td>
                        <td>{hhmm(l.points[l.points.length - 1].t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
