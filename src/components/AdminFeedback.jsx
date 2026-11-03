import { useCallback, useEffect, useState } from 'react'
import { FEEDBACK_STATUSES, deleteFeedback, fetchFeedback, fetchFeedbackStatus, setFeedbackStatus } from '../lib/feedback'

/** 어드민 화면의 피드백 목록. 로그인한 어드민에게만 그려진다. 처리 상태를 매기거나, 지우기 버튼으로 아예 지운다. */
export default function AdminFeedback({ getToken }) {
  const [items, setItems] = useState(null)
  const [status, setStatus] = useState({})
  const [error, setError] = useState('')
  // 보는 칸: 'new'(아직 상태 없음)가 기본. 나머지는 탭을 눌러야 보인다.
  const [view, setView] = useState('new')

  const load = useCallback(async () => {
    setError('')
    try {
      const token = await getToken()
      const [list, st] = await Promise.all([
        fetchFeedback(token),
        fetchFeedbackStatus(token).catch((e) => {
          setError(e.message)
          return {}
        }),
      ])
      setItems(list)
      setStatus(st)
    } catch (e) {
      setError(e.message)
    }
    // getToken 은 렌더마다 새로 만들어지지만 하는 일은 같다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 이미 고른 버튼을 다시 누르면 미처리로 되돌린다.
  const mark = async (id, next) => {
    const value = status[id] === next ? null : next
    try {
      await setFeedbackStatus(id, value, await getToken())
      setStatus((prev) => {
        const copy = { ...prev }
        if (value) copy[id] = value
        else delete copy[id]
        return copy
      })
    } catch (e) {
      setError(e.message)
    }
  }

  // 지우면 복구할 수 없어서 한 번 묻는다.
  const remove = async (id) => {
    if (!window.confirm('이 피드백을 아예 지울까요? 되돌릴 수 없습니다.')) return
    try {
      await deleteFeedback(id, await getToken())
      setItems((prev) => prev.filter((it) => it.id !== id))
      setStatus((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    } catch (e) {
      setError(e.message)
    }
  }

  const pending = items ? items.filter((it) => !status[it.id]).length : 0
  const tabs = [{ id: 'new', label: 'NEW' }, ...FEEDBACK_STATUSES]
  const countOf = (id) =>
    items ? items.filter((it) => (id === 'new' ? !status[it.id] : status[it.id] === id)).length : 0
  const shown = items?.filter((it) => (view === 'new' ? !status[it.id] : status[it.id] === view))

  return (
    <details className="live-panel fb-admin" open={!!items?.length}>
      <summary>
        <strong>피드백 {items ? items.length : '…'}건</strong>
        {items && <span className="muted">미처리 {pending}건</span>}
        <button
          type="button"
          className="ghost"
          onClick={(e) => {
            e.preventDefault()
            load()
          }}
        >
          새로고침
        </button>
      </summary>
      {error && <p className="fb-error">{error}</p>}
      <div className="fb-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={view === t.id}
            className={view === t.id ? `fb-tab ${t.id} active` : `fb-tab ${t.id}`}
            onClick={() => setView(t.id)}
          >
            {t.label} <span className="fb-tab-n">{countOf(t.id)}</span>
          </button>
        ))}
      </div>
      <ul className="fb-list">
        {shown?.map((it) => (
          <li key={it.id}>
            <div className="fb-meta">
              <time>{new Date(it.createdAt).toLocaleString('ko-KR')}</time>
              {it.contact && <span className="muted">연락처: {it.contact}</span>}
              <span className="fb-status">
                {FEEDBACK_STATUSES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={status[it.id] === s.id ? `fb-st-btn ${s.id} active` : `fb-st-btn ${s.id}`}
                    aria-pressed={status[it.id] === s.id}
                    onClick={() => mark(it.id, s.id)}
                  >
                    {s.label}
                  </button>
                ))}
                <button type="button" className="fb-st-btn fb-del" onClick={() => remove(it.id)}>
                  지우기
                </button>
              </span>
            </div>
            <p>{it.message}</p>
          </li>
        ))}
        {shown?.length === 0 && (
          <li className="muted">{view === 'new' ? '새 피드백이 없습니다.' : '이 칸에 든 피드백이 없습니다.'}</li>
        )}
      </ul>
    </details>
  )
}
