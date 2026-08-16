import { useEffect, useMemo, useState } from 'react'
import { fetchMeta, fetchSeries, historyEnabled } from '../lib/history'

/**
 * 검증을 통과한 계열 색. 화면의 올리브·갈색 팔레트는 한 계열이라 선끼리 구분되지
 * 않고 색약에서는 더 붙어 버린다. 색이 혼자 신원을 지는 자리라 여기만 따로 쓴다.
 * 다섯 색 모두 패널 표면에서 4.2:1 이상이고 색약 분리 검증을 통과한다.
 */
const HUES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']

/**
 * 10개 슬롯. 색은 다섯 가지뿐이고 나머지 절반은 점선으로 가른다.
 *
 * 색을 열 개로 늘리지 않는 이유: 검증을 통과하는 계열 색은 여덟이 상한이고,
 * 아홉 번째부터는 만들어 봐야 색약에서 기존 색과 구분되지 않는다. 색 하나에
 * 실선·점선을 얹는 편이 정직하다. 여기에 선 끝 이름표가 늘 붙으므로
 * 실제 신원은 색도 선모양도 아닌 글자가 진다.
 */
const SERIES = HUES.flatMap((color) => [
  { color, dash: null },
  { color, dash: '7 5' },
])
const MAX_SERIES = SERIES.length

const RANGES = [
  { id: '1h', label: '1시간', ms: 60 * 60 * 1000 },
  { id: '6h', label: '6시간', ms: 6 * 60 * 60 * 1000 },
  { id: '24h', label: '24시간', ms: 24 * 60 * 60 * 1000 },
  { id: 'all', label: '전체', ms: Infinity },
]

const W = 960
const H = 460
const PAD = { top: 20, right: 104, bottom: 30, left: 56 }
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
  const [refreshTick, setRefreshTick] = useState(0)

  // meta 도 매 주기 다시 읽는다. 한 번만 읽으면 "수집" 시각이 처음 값에 멈춰서,
  // 수집이 실제로 끊겼는지 화면만 낡은 건지 구분할 수 없게 된다.
  useEffect(() => {
    if (!historyEnabled() || !bjId) return
    let alive = true
    if (refreshTick === 0) setStatus('loading')
    fetchMeta(bjId, postNo)
      .then((m) => alive && (setMeta(m), setStatus(m ? 'ready' : 'untracked')))
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [bjId, postNo, refreshTick])

  // 수집기가 1분마다 쓰므로 화면도 1분마다 새로 읽는다.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setRefreshTick((n) => n + 1)
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  /**
   * 고른 사람 전원의 시계열을 매번 다시 읽는다.
   *
   * 예전에는 아직 안 받아 온 사람만 골라 받았는데, 그러면 한 번 받은 사람은 영영
   * 그 시점에 멈춰 버린다. 나중에 추가한 사람만 최신이라 선들의 끝 시각이 서로
   * 어긋나 보였다. 최대 5명이라 전원 다시 읽어도 요청 다섯 개다.
   */
  useEffect(() => {
    if (picked.length === 0) {
      setSeries({})
      return
    }
    let alive = true
    Promise.all(
      picked.map((c) => fetchSeries(bjId, postNo, c.id).then((points) => [c.id, points]))
    ).then((pairs) => {
      if (alive) setSeries(Object.fromEntries(pairs))
    })
    return () => {
      alive = false
    }
  }, [picked, refreshTick, bjId, postNo])

  const lines = useMemo(() => {
    const span = RANGES.find((r) => r.id === range)?.ms ?? Infinity
    const now = Date.now()
    return picked
      .map((c, i) => {
        const all = series[c.id] ?? []
        const points = span === Infinity ? all : all.filter((p) => now - p.t.getTime() <= span)
        const first = points[0]?.likes ?? 0
        const style = SERIES[i % MAX_SERIES]
        return {
          comment: c,
          color: style.color,
          dash: style.dash,
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

  /**
   * 선 끝 이름표 위치. 10명이면 끝점이 겹치는 일이 흔해서, 원래 자리에서 가까운
   * 순서대로 최소 간격만큼 밀어낸다. 겹쳐서 못 읽는 이름표는 없느니만 못하다.
   */
  const labels = useMemo(() => {
    if (!scale) return []
    const GAP = 14
    const placed = lines
      .map((line) => {
        const last = line.points[line.points.length - 1]
        return {
          id: line.comment.id,
          nick: line.comment.nick.length > 9 ? `${line.comment.nick.slice(0, 8)}…` : line.comment.nick,
          color: line.color,
          x: scale.x(last.t.getTime()) + 7,
          y: scale.y(last.v) + 4,
        }
      })
      .sort((a, b) => a.y - b.y)

    for (let i = 1; i < placed.length; i += 1) {
      if (placed[i].y - placed[i - 1].y < GAP) placed[i].y = placed[i - 1].y + GAP
    }
    // 아래로만 밀면 마지막이 그림 밖으로 나간다. 넘친 만큼 전체를 위로 되민다.
    const overflow = placed.length > 0 ? placed[placed.length - 1].y - (H - PAD.bottom) : 0
    if (overflow > 0) for (const l of placed) l.y -= overflow
    return placed
  }, [lines, scale])

  const shortlist = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? candidates.filter((c) => c.nick.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q))
      : candidates.slice(0, 24)
    return pool.slice(0, 24)
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
          <h2>개인 증가량 그래프</h2>
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
        <h2>개인 증가량 그래프</h2>
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
                const style = on ? SERIES[picked.findIndex((p) => p.id === c.id) % MAX_SERIES] : null
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip${on ? ' on' : ''}`}
                    style={style ? { '--chip': style.color } : undefined}
                    onClick={() => toggle(c)}
                  >
                    {style?.dash && <span className="dash-mark" aria-hidden="true" />}
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
                  {[0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => {
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

                  {[0, 0.25, 0.5, 0.75, 1].map((f) => {
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
                    return (
                      <path
                        key={line.comment.id}
                        d={d}
                        className="line"
                        style={{ stroke: line.color }}
                        strokeDasharray={line.dash ?? undefined}
                      />
                    )
                  })}

                  {/* 선마다 끝에 이름을 붙인다. 색도 선모양도 아닌 글자가 신원을 진다. */}
                  {labels.map((l) => (
                    <text
                      key={l.id}
                      x={l.x}
                      y={l.y}
                      className="line-label"
                      style={{ fill: l.color }}
                    >
                      {l.nick}
                    </text>
                  ))}
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
