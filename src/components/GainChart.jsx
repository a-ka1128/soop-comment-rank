import { useMemo, useRef, useState } from 'react'

const MAX_BARS = 120

// viewBox 좌표. 화면 폭에 맞춰 통째로 비율 유지하며 늘어난다.
const W = 960
const PLOT_H = 170
const PAD_L = 46
const PAD_R = 12
const PAD_T = 20
const AXIS_H = 30
const PLOT_W = W - PAD_L - PAD_R

/**
 * 관측 시작(또는 직전 갱신) 이후 각 댓글이 얻은 좋아요를 순위 순서대로 세운 막대그래프.
 *
 * 막대는 전부 한 가지 색이다. 값에 따라 색을 바꾸면 막대 길이가 이미 보여 주는 걸
 * 색으로 한 번 더 칠하는 셈이고, 분류 색으로 칠하면 색약에서 구분되지 않는
 * 팔레트에 식별을 떠넘기게 된다.
 */
export default function GainChart({ section, history, refreshedAt }) {
  const [mode, setMode] = useState('session')
  const [tableOpen, setTableOpen] = useState(false)
  const [hover, setHover] = useState(null)
  const svgRef = useRef(null)

  const rows = useMemo(() => {
    if (!section || !history) return []
    const base = mode === 'recent' ? history.previous : history.baseline
    return section.items.slice(0, MAX_BARS).map((c) => ({
      ...c,
      // 관측 시작 뒤에 올라온 댓글은 지금 가진 좋아요 전부를 그 사이에 얻은 것이다.
      gain: base.has(c.id) ? c.likes - base.get(c.id) : c.likes,
    }))
  }, [section, history, mode])

  const scale = useMemo(() => {
    if (rows.length === 0) return null
    const gains = rows.map((r) => r.gain)
    const max = Math.max(0, ...gains)
    const min = Math.min(0, ...gains)
    const span = max - min || 1
    const step = PLOT_W / rows.length
    return {
      max,
      min,
      step,
      barW: Math.max(2, step - 2),
      y: (v) => PAD_T + ((max - v) / span) * PLOT_H,
      zero: PAD_T + (max / span) * PLOT_H,
    }
  }, [rows])

  const totalGain = rows.reduce((sum, r) => sum + Math.max(0, r.gain), 0)
  const top = rows.reduce((best, r) => (!best || r.gain > best.gain ? r : best), null)

  function onMove(event) {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || !scale) return
    const x = ((event.clientX - box.left) / box.width) * W
    const index = Math.floor((x - PAD_L) / scale.step)
    setHover(index >= 0 && index < rows.length ? index : null)
  }

  if (!history) {
    return (
      <section className="panel chart">
        <div className="panel-head">
          <h2>좋아요 증가량</h2>
        </div>
        <p className="chart-empty">게시글을 먼저 불러오세요.</p>
      </section>
    )
  }

  const nothingYet = !scale || (scale.max === 0 && scale.min === 0)

  return (
    <section className="panel chart">
      <div className="panel-head">
        <h2>좋아요 증가량</h2>
      </div>

      <div className="chart-controls">
        <div className="seg">
          <button
            type="button"
            className={mode === 'session' ? 'on' : ''}
            onClick={() => setMode('session')}
          >
            관측 시작 이후
          </button>
          <button
            type="button"
            className={mode === 'recent' ? 'on' : ''}
            onClick={() => setMode('recent')}
          >
            직전 갱신 대비
          </button>
        </div>
        <span className="muted">
          {section?.name} 상위 {rows.length}위
          {mode === 'session' && ` · ${history.since.toTimeString().slice(0, 8)}부터`}
          {refreshedAt && ` · ${refreshedAt.toTimeString().slice(0, 8)} 갱신`}
        </span>
        <span className="spacer" />
        <span className="muted">
          합계 <strong className="gain-total">+{totalGain.toLocaleString()}</strong>
        </span>
        <button type="button" className="ghost" onClick={() => setTableOpen((v) => !v)}>
          {tableOpen ? '그래프로' : '표로 보기'}
        </button>
      </div>

      {nothingYet ? (
        <p className="chart-empty">
          아직 변화가 없습니다. <strong>실시간</strong>을 켜거나 <strong>새로고침</strong>을
          누르면 그 사이 늘어난 만큼이 여기 쌓입니다. SOOP은 과거 기록을 주지 않아서, 이 창을
          열어 둔 동안의 변화만 그릴 수 있습니다.
        </p>
      ) : tableOpen ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>닉네임</th>
                <th>증가</th>
                <th>좋아요</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.rank}</td>
                  <td className="cell-nick">{r.nick}</td>
                  <td className={r.gain > 0 ? 'cell-gain' : ''}>
                    {r.gain > 0 ? `+${r.gain.toLocaleString()}` : r.gain.toLocaleString()}
                  </td>
                  <td>{r.likes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-plot">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${PAD_T + PLOT_H + AXIS_H}`}
            role="img"
            aria-label={`상위 ${rows.length}위의 좋아요 증가량 막대그래프. 표로 보기에서 같은 값을 읽을 수 있습니다.`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            {/* 눈금선은 표면에서 한 단계만 밝은 실선. 점선은 임계값처럼 읽혀서 쓰지 않는다. */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const v = scale.max - t * (scale.max - scale.min)
              return (
                <g key={t}>
                  <line
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={scale.y(v)}
                    y2={scale.y(v)}
                    className={v === 0 ? 'axis-line' : 'grid-line'}
                  />
                  <text x={PAD_L - 8} y={scale.y(v) + 4} className="tick" textAnchor="end">
                    {Math.round(v).toLocaleString()}
                  </text>
                </g>
              )
            })}

            {rows.map((r, i) => {
              const x = PAD_L + i * scale.step + (scale.step - scale.barW) / 2
              const yTop = r.gain >= 0 ? scale.y(r.gain) : scale.zero
              const h = Math.max(1, Math.abs(scale.y(r.gain) - scale.zero))
              return (
                <rect
                  key={r.id}
                  x={x}
                  y={yTop}
                  width={scale.barW}
                  height={h}
                  rx={Math.min(2, scale.barW / 2)}
                  className={`bar${hover === i ? ' is-hover' : ''}${r.gain < 0 ? ' is-down' : ''}`}
                />
              )
            })}

            {/* 최고 증가만 직접 이름표를 단다. 막대마다 숫자를 붙이면 아무도 안 읽는다. */}
            {top && top.gain > 0 && (
              <text
                x={Math.min(
                  W - PAD_R,
                  Math.max(PAD_L + 40, PAD_L + rows.indexOf(top) * scale.step + scale.barW / 2)
                )}
                y={Math.max(12, scale.y(top.gain) - 7)}
                className="peak"
                textAnchor="middle"
              >
                {top.nick} +{top.gain.toLocaleString()}
              </text>
            )}

            {[1, 30, 60, 90, 120]
              .filter((n) => n <= rows.length)
              .map((n) => (
                <text
                  key={n}
                  x={PAD_L + (n - 0.5) * scale.step}
                  y={PAD_T + PLOT_H + 20}
                  className="tick"
                  textAnchor="middle"
                >
                  {n}위
                </text>
              ))}
          </svg>

          {hover !== null && rows[hover] && (
            <div
              className="chart-tip"
              style={{
                left: `${((PAD_L + (hover + 0.5) * scale.step) / W) * 100}%`,
              }}
            >
              <strong>
                {rows[hover].rank}위 {rows[hover].nick}
              </strong>
              <span className="cell-gain">
                {rows[hover].gain >= 0 ? '+' : ''}
                {rows[hover].gain.toLocaleString()}
              </span>
              <span className="muted">♥ {rows[hover].likes.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
