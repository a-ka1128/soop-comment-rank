import { useEffect } from 'react'

const ECOSYSTEM_URL = 'https://wakfogg.netlify.app/'

/** 접속할 때 뜨는 종료 공지. 닫으면 이번 방문에서는 다시 뜨지 않는다. */
export default function NoticeModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fb-backdrop" onClick={onClose}>
      <div className="fb-modal" role="dialog" aria-label="공지" onClick={(e) => e.stopPropagation()}>
        <div className="fb-head">
          <h2>공지</h2>
          <button type="button" className="ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="fb-body notice-body">
          <p>
            <strong>11월 5일 아침 8시</strong>에 와우 포에버가 열리면, 이 사이트는 더 이상 관리하지 않습니다.
          </p>
          <p>그동안 이용해 주셔서 감사합니다. 앞으로는 아래 와포생태계 사이트를 이용해 주세요.</p>
          <a className="primary notice-link" href={ECOSYSTEM_URL} target="_blank" rel="noopener noreferrer">
            와포생태계 사이트로 이동
          </a>
        </div>
      </div>
    </div>
  )
}
