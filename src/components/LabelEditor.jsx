import { useState } from 'react'
import { CLS_NONE, SELF_TAGS, WOW_CLASSES, labelClasses } from '../lib/wow'
import { cleanLabel } from '../lib/labels'

/** 꼬리표 하나의 세 갈래. 저장할 때 true / false / (키 없음) 이 된다. */
const TAG_STATES = [
  { value: 'auto', label: '자동' },
  { value: 'on', label: '붙임' },
  { value: 'off', label: '뗌' },
]

function tagState(label, id) {
  const v = label?.tags?.[id]
  return v === true ? 'on' : v === false ? 'off' : 'auto'
}

/**
 * 어드민이 한 사람의 라벨을 고치는 칸. 카드를 펼쳤을 때만 보인다.
 * 저장하면 그 사람의 모든 댓글(두 글 모두)에 똑같이 적용된다 — 라벨은 사람에 붙는다.
 */
export default function LabelEditor({ userId, label, onSave }) {
  // 직업은 여러 개 고를 수 있다. 고른 순서를 지키고, 처음 고른 게 대표 직업이 된다.
  // 아무것도 안 고르면 자동, '미분류'를 고르면 직업 없이 고정.
  const [cls, setCls] = useState(() => labelClasses(label) ?? [])
  const toggleClass = (id) =>
    setCls((prev) => {
      if (id === CLS_NONE) return prev === CLS_NONE ? [] : CLS_NONE
      const list = prev === CLS_NONE ? [] : prev
      return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
    })
  const [tags, setTags] = useState(() =>
    Object.fromEntries(SELF_TAGS.map((t) => [t.id, tagState(label, t.id)])),
  )
  const [crews, setCrews] = useState((label?.crews ?? []).join(', '))
  const [status, setStatus] = useState({ kind: 'idle', text: '' })

  async function save(next) {
    setStatus({ kind: 'busy', text: '저장 중…' })
    try {
      await onSave(userId, next)
      setStatus({ kind: 'ok', text: '저장했습니다. 모든 방문자에게 바로 보입니다.' })
    } catch (err) {
      setStatus({ kind: 'error', text: err.message })
    }
  }

  function submit(e) {
    e.preventDefault()
    const tagValues = Object.fromEntries(
      Object.entries(tags)
        .filter(([, s]) => s !== 'auto')
        .map(([id, s]) => [id, s === 'on']),
    )
    save(cleanLabel({ cls, tags: tagValues, crews: crews.split(',') }))
  }

  function reset() {
    setCls([])
    setTags(Object.fromEntries(SELF_TAGS.map((t) => [t.id, 'auto'])))
    setCrews('')
    save(null)
  }

  return (
    <form className="label-editor" onSubmit={submit}>
      <div className="label-editor-head">
        <strong>라벨 고치기</strong>
        <span className="muted">{userId} — 이 사람의 모든 댓글에 적용</span>
      </div>

      <div className="label-field">
        <span>직업</span>
        <div>
          <div className="class-picks" role="group" aria-label="직업 여러 개 고르기">
            {WOW_CLASSES.map((c) => {
              const at = cls === CLS_NONE ? -1 : cls.indexOf(c.id)
              return (
                <button
                  type="button"
                  key={c.id}
                  className={at >= 0 ? 'on' : ''}
                  style={{ '--group': c.color }}
                  aria-pressed={at >= 0}
                  onClick={() => toggleClass(c.id)}
                >
                  <span className="dot" aria-hidden="true" />
                  {c.name}
                  {at === 0 && cls.length > 1 && <em>대표</em>}
                </button>
              )
            })}
            <button
              type="button"
              className={cls === CLS_NONE ? 'on' : ''}
              aria-pressed={cls === CLS_NONE}
              onClick={() => toggleClass(CLS_NONE)}
            >
              미분류
            </button>
          </div>
          <p className="muted class-picks-note">
            {cls === CLS_NONE
              ? '어느 직업에도 넣지 않습니다.'
              : cls.length === 0
                ? '아무것도 안 고르면 댓글에서 자동으로 판정합니다.'
                : '고른 직업 칸마다 들어갑니다. 처음 고른 직업이 대표(색)입니다.'}
          </p>
        </div>
      </div>

      <div className="label-field">
        <span>꼬리표</span>
        <div className="label-tags">
          {SELF_TAGS.map((t) => (
            <fieldset key={t.id} className="tri" title={t.hint}>
              <legend>{t.name}</legend>
              {TAG_STATES.map((s) => (
                <label key={s.value} className={tags[t.id] === s.value ? 'on' : ''}>
                  <input
                    type="radio"
                    name={`${userId}-${t.id}`}
                    value={s.value}
                    checked={tags[t.id] === s.value}
                    onChange={() => setTags((prev) => ({ ...prev, [t.id]: s.value }))}
                  />
                  {s.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </div>

      <label className="label-field">
        <span>크루</span>
        <input
          value={crews}
          onChange={(e) => setCrews(e.target.value)}
          placeholder="쉼표로 구분 — 예) 와우포에버즈, 잔디동"
        />
      </label>

      <div className="label-actions">
        <button type="submit" className="primary" disabled={status.kind === 'busy'}>
          저장
        </button>
        <button type="button" className="ghost" onClick={reset} disabled={status.kind === 'busy'}>
          전부 자동으로
        </button>
        {status.text && <span className={`label-status ${status.kind}`}>{status.text}</span>}
      </div>
    </form>
  )
}
