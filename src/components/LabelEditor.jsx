import { useState } from 'react'
import { CLS_NONE, SELF_TAGS, WOW_CLASSES } from '../lib/wow'
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
  const [cls, setCls] = useState(label?.cls ?? '')
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
    setCls('')
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

      <label className="label-field">
        <span>직업</span>
        <select value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">자동 (댓글에서 판정)</option>
          {WOW_CLASSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={CLS_NONE}>미분류</option>
        </select>
      </label>

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
