import { useEffect } from 'react'

const ECOSYSTEM_URL = 'https://wakfogg.netlify.app/'

/** 접속할 때 뜨는 운영 안내. 이미지 안의 "와포생태계 사이트" 부분을 누르면 그 사이트로 간다. 닫으면 이번 방문에서는 다시 뜨지 않는다. */
export default function NoticeModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fb-backdrop" onClick={onClose}>
      <div className="notice-card" role="dialog" aria-label="사이트 운영 안내" onClick={(e) => e.stopPropagation()}>
        <img
          className="notice-img"
          src={`${import.meta.env.BASE_URL}notice.webp`}
          alt="사이트 운영 안내: 11월 5일 오전 8시 와우 포에버가 오픈합니다. 오픈 이후에도 사이트는 계속 이용할 수 있지만 추가적인 업데이트 및 관리는 진행되지 않을 예정입니다. 앞으로는 와포생태계 사이트를 이용해 주세요."
        />
        {/* 이미지의 '앞으로는 아래 와포생태계 사이트를 이용해 주세요' 칸 위에 겹친 링크 */}
        <a
          className="notice-hit"
          href={ECOSYSTEM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="와포생태계 사이트로 이동"
        />
        <button type="button" className="notice-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
