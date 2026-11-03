import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CONTACT_MAX, FEEDBACK_OPEN, MESSAGE_MAX, cooldownLeft, sendFeedback } from '../lib/feedback'

/** 방문자 피드백 창. 보내면 어드민 화면(#admin)에서 볼 수 있다. */
export default function FeedbackModal({ onClose }) {
  const [message, setMessage] = useState('')
  // 글이 길어지면 입력칸이 내용만큼 세로로 늘어난다(최소 6줄, 상한은 CSS max-height 에서 스크롤).
  const boxRef = useRef(null)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [message])
  const [contact, setContact] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (cooldownLeft() > 0) return setError('잠시 뒤에 다시 보내 주세요.')
    setState('sending')
    try {
      await sendFeedback({ message, contact })
      setState('done')
    } catch (err) {
      setError(err.message)
      setState('idle')
    }
  }

  return (
    <div className="fb-backdrop" onClick={onClose}>
      <div className="fb-modal" role="dialog" aria-label="피드백" onClick={(e) => e.stopPropagation()}>
        <div className="fb-head">
          <h2>피드백 보내기</h2>
          <button type="button" className="ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        {!FEEDBACK_OPEN ? (
          <div className="fb-body">
            <p>피드백 기능을 추가중입니다. 조금만 기다려 주세요.</p>
            <button type="button" className="primary" onClick={onClose}>
              확인
            </button>
          </div>
        ) : state === 'done' ? (
          <div className="fb-body">
            <p>보내 주셔서 감사합니다. 운영자가 확인할게요.</p>
            <button type="button" className="primary" onClick={onClose}>
              확인
            </button>
          </div>
        ) : (
          <form className="fb-body" onSubmit={submit}>
            <label>
              <span>의견·버그·잘못 분류된 사람 등</span>
              <textarea
                ref={boxRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MESSAGE_MAX}
                rows={6}
                placeholder="자유롭게 적어 주세요"
                required
              />
              <em className="fb-count">
                {message.length}/{MESSAGE_MAX}
              </em>
            </label>
            <label>
              <span>연락처 (선택 · 답을 받고 싶을 때만)</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={CONTACT_MAX}
                placeholder="닉네임, 디스코드 등"
              />
            </label>
            {error && <p className="fb-error">{error}</p>}
            <button type="submit" className="primary" disabled={state === 'sending' || !message.trim()}>
              {state === 'sending' ? '보내는 중…' : '보내기'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
