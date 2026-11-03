import { useCallback, useEffect, useState } from 'react'
import { FEEDBACK_STATUSES, fetchFeedback, fetchFeedbackStatus, setFeedbackStatus } from '../lib/feedback'

/** 어드민 화면의 피드백 목록. 로그인한 어드민에게만 그려진다. 지우지 않고 처리 상태만 매긴다. */
export default function AdminFeedback({ getToken }) {
  const [items, setItems] = useState(null)
  const [status, setStatus] = useState({})
  const [error, setError] = useState('')

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

  const pending = items ? items.filter((it) => !status[it.id]).length : 0

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
      <ul className="fb-list">
        {items?.map((it) => (
          <li key={it.id} className={status[it.id] ? `fb-st-${status[it.id]}` : undefined}>
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
              </span>
            </div>
            <p>{it.message}</p>
          </li>
        ))}
        {items?.length === 0 && <li className="muted">아직 없습니다.</li>}
      </ul>
    </details>
  )
}
