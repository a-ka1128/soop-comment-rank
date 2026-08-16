import { useMemo, useState } from 'react'
import { formatNicknames, takeTop, toGridCsv } from '../lib/groups'

const DEFAULT_N = 33

function execCommandCopy(text) {
  const box = document.createElement('textarea')
  box.value = text
  box.style.position = 'fixed'
  box.style.opacity = '0'
  document.body.appendChild(box)
  box.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  box.remove()
  return ok
}

export default function NicknameExport({ sections }) {
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(sections.map((s) => [s.id, s.topN ?? DEFAULT_N]))
  )
  const [format, setFormat] = useState('lines')
  const [withRank, setWithRank] = useState(false)
  const [withLikes, setWithLikes] = useState(false)
  const [copied, setCopied] = useState('')
  const [failed, setFailed] = useState('')

  const results = useMemo(
    () =>
      sections.map((section) => {
        const n = counts[section.id] ?? DEFAULT_N
        const { picked, tie } = takeTop(section.items, n)
        return {
          ...section,
          n,
          picked,
          tie,
          text: formatNicknames(picked, { format, withRank, withLikes }),
        }
      }),
    [sections, counts, format, withRank, withLikes]
  )

  /**
   * 클립보드 API는 창이 포커스를 잃었거나 권한이 없으면 거절한다.
   * 그땐 임시 textarea + execCommand로 한 번 더 시도하고,
   * 그것도 막히면 보이는 textarea를 선택해 사용자가 바로 Ctrl+C 하게 한다.
   */
  async function copy(label, text, event) {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = execCommandCopy(text)
    }

    if (ok) {
      setCopied(label)
    } else {
      const box = event?.currentTarget?.closest('.export-group')?.querySelector('textarea')
      if (box) {
        box.focus()
        box.select()
      }
      setFailed(label)
    }

    setTimeout(() => {
      setCopied('')
      setFailed('')
    }, 2000)
  }

  const buttonLabel = (label, idle) =>
    copied === label ? '복사됨' : failed === label ? '직접 복사(Ctrl+C)' : idle

  const combined = results
    .map((r) => (results.length > 1 ? `[${r.name}]\n${r.text}` : r.text))
    .join('\n\n')

  return (
    <section className="export">
      <div className="export-head">
        <h2>닉네임 추출</h2>
        <div className="export-opts">
          <label>
            <input
              type="radio"
              name="fmt"
              checked={format === 'lines'}
              onChange={() => setFormat('lines')}
            />
            줄바꿈
          </label>
          <label>
            <input
              type="radio"
              name="fmt"
              checked={format === 'comma'}
              onChange={() => setFormat('comma')}
            />
            쉼표
          </label>
          <label>
            <input type="checkbox" checked={withRank} onChange={(e) => setWithRank(e.target.checked)} />
            순위
          </label>
          <label>
            <input
              type="checkbox"
              checked={withLikes}
              onChange={(e) => setWithLikes(e.target.checked)}
            />
            좋아요
          </label>
          <span className="spacer" />
          <button type="button" className="ghost" onClick={(e) => copy('전체', combined, e)}>
            {buttonLabel('전체', '전체 복사')}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={(e) => copy('csv', toGridCsv(results.flatMap((r) => r.picked)), e)}
            title="세로로 채운 3열 40행. 표에 붙이면 위에서 아래로 순위가 읽힙니다."
          >
            {buttonLabel('csv', 'CSV 3×40 복사')}
          </button>
        </div>
      </div>

      <div className="export-groups">
        {results.map((result) => (
          <div className="export-group" key={result.id} style={{ '--group': result.color }}>
            <div className="export-group-head">
              <span className="swatch" aria-hidden="true" />
              <strong>{result.name}</strong>
              <label className="take">
                상위
                <input
                  type="number"
                  min="0"
                  max={result.items.length}
                  value={result.n}
                  onChange={(e) =>
                    setCounts((prev) => ({ ...prev, [result.id]: Math.max(0, Number(e.target.value)) }))
                  }
                />
                명
              </label>
              <span className="muted">
                / {result.items.length}명 중 {result.picked.length}명
              </span>
              <span className="spacer" />
              <button
                type="button"
                className="ghost"
                onClick={(e) => copy(result.id, result.text, e)}
              >
                {buttonLabel(result.id, '복사')}
              </button>
            </div>

            {result.tie !== null && (
              <p className="tie">
                {result.n}위와 {result.n + 1}위가 좋아요 {result.tie.toLocaleString()}개로 동점입니다.
                여기서 자르면 자의적인 선이 됩니다.
              </p>
            )}

            <textarea readOnly value={result.text} rows={Math.min(result.picked.length + 1, 12)} />
          </div>
        ))}
      </div>
    </section>
  )
}
