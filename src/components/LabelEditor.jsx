import { useState } from 'react'
import { CLS_NONE, SELF_TAGS, WOW_CLASSES, labelClasses } from '../lib/wow'
import { CREWS } from '../lib/crews'
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
export default function LabelEditor({ userId, label, defaultGameNick, onSave }) {
  const [gameNick, setGameNick] = useState(() => label?.gameNick ?? '')
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
  // 크루는 두 갈래다. 어드민이 넣은 것(crews)과 crews.js 에 조사해 둔 것.
  // 조사해 둔 건 코드에 있어서 지울 수 없고, 라벨의 crewsOff 에 적어 화면에서 뺀다.
  const research = CREWS[userId] ?? []
  const [crews, setCrews] = useState(() => label?.crews ?? [])
  const [crewsOff, setCrewsOff] = useState(() => label?.crewsOff ?? [])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState({ kind: 'idle', text: '' })

  /** 입력칸의 이름들(쉼표로 여러 개)을 크루에 더한다. 조사해 둔 걸 다시 적으면 되살린다. */
  function addDraft(text = draft) {
    const names = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length === 0) return { crews, crewsOff }
    const nextOff = crewsOff.filter((n) => !names.includes(n))
    const nextCrews = [
      ...crews,
      ...names.filter((n) => !crews.includes(n) && !research.includes(n)),
    ]
    setCrews(nextCrews)
    setCrewsOff(nextOff)
    setDraft('')
    return { crews: nextCrews, crewsOff: nextOff }
  }

  // 직접 넣은 것과 조사해 둔 것이 같은 이름일 수 있다(문모모의 잔디동처럼). 둘 다 지워야 사라진다.
  function removeCrew(name) {
    setCrews(crews.filter((n) => n !== name))
    if (research.includes(name)) setCrewsOff([...new Set([...crewsOff, name])])
  }

  const restoreCrew = (name) => setCrewsOff(crewsOff.filter((n) => n !== name))

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
    // 입력칸에 적어 두고 추가를 안 누른 채 저장해도 들어가게 한다.
    const next = addDraft()
    save(cleanLabel({ cls, tags: tagValues, gameNick, ...next }))
  }

  function reset() {
    setGameNick('')
    setCls([])
    setTags(Object.fromEntries(SELF_TAGS.map((t) => [t.id, 'auto'])))
    setCrews([])
    setCrewsOff([])
    setDraft('')
    save(null)
  }

  // 화면에 보일 크루 칩: 살아 있는 것(조사 + 직접), 그다음 뺀 조사 크루(흐리게, 되살리기).
  const shown = [
    ...research.filter((n) => !crewsOff.includes(n)).map((name) => ({ name, from: 'research' })),
    ...crews.filter((n) => !research.includes(n)).map((name) => ({ name, from: 'admin' })),
  ]
  const hidden = research.filter((n) => crewsOff.includes(n))

  return (
    <form className="label-editor" onSubmit={submit}>
      <div className="label-editor-head">
        <strong>라벨 고치기</strong>
        <span className="muted">{userId} — 이 사람의 모든 댓글에 적용</span>
      </div>

      <div className="label-field">
        <span>인게임</span>
        <div>
          <input
            className="game-nick-input"
            value={gameNick}
            onChange={(e) => setGameNick(e.target.value)}
            placeholder={defaultGameNick ? `${defaultGameNick} (기본값)` : '인게임 닉네임'}
            aria-label="인게임 닉네임"
          />
          <p className="muted class-picks-note">
            {defaultGameNick
              ? '비워 두면 기본값(wakfogg에서 가져온 닉네임)을 보여 줍니다.'
              : '비워 두면 표시하지 않습니다.'}
          </p>
        </div>
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

      <div className="label-field">
        <span>크루</span>
        <div>
          <div className="crew-add">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter 는 폼 저장이 아니라 크루 추가로 쓴다.
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDraft()
                }
              }}
              placeholder="크루 이름 — 쉼표로 여러 개, Enter 로 추가"
              aria-label="크루 추가"
            />
            <button type="button" className="ghost" onClick={() => addDraft()}>
              추가
            </button>
          </div>

          {shown.length + hidden.length > 0 && (
            <ul className="crew-chips">
              {shown.map((c) => (
                <li key={c.name} className={`crew-chip from-${c.from}`}>
                  {c.name}
                  {c.from === 'research' && <em title="나무위키에서 조사해 넣은 크루">조사</em>}
                  <button
                    type="button"
                    onClick={() => removeCrew(c.name)}
                    aria-label={`${c.name} 빼기`}
                    title="빼기"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {hidden.map((name) => (
                <li key={name} className="crew-chip is-off">
                  <s>{name}</s>
                  <button
                    type="button"
                    onClick={() => restoreCrew(name)}
                    aria-label={`${name} 되살리기`}
                    title="되살리기"
                  >
                    ↺
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted crew-note">바꾼 내용은 저장을 눌러야 반영됩니다.</p>
        </div>
      </div>

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
