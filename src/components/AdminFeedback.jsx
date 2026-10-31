import { useCallback, useEffect, useState } from 'react'
import { deleteFeedback, fetchFeedback } from '../lib/feedback'

/** 어드민 화면의 피드백 목록. 로그인한 어드민에게만 그려진다. */
export default function AdminFeedback({ getToken }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setItems(await fetchFeedback(await getToken()))
    } catch (e) {
      setError(e.message)
    }
    // getToken 은 렌더마다 새로 만들어지지만 하는 일은 같다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id) => {
    try {
      await deleteFeedback(id, await getToken())
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <details className="live-panel fb-admin" open={!!items?.length}>
      <summary>
        <strong>피드백 {items ? items.length : '…'}건</strong>
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
          <li key={it.id}>
            <div className="fb-meta">
              <time>{new Date(it.createdAt).toLocaleString('ko-KR')}</time>
              {it.contact && <span className="muted">연락처: {it.contact}</span>}
              <button type="button" className="ghost" onClick={() => remove(it.id)}>
                삭제
              </button>
            </div>
            <p>{it.message}</p>
          </li>
        ))}
        {items?.length === 0 && <li className="muted">아직 없습니다.</li>}
      </ul>
    </details>
  )
}
