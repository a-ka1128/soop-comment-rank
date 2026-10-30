import { useEffect, useMemo, useState } from 'react'
import { QA_ASK_POST, fetchQa } from '../lib/qa'
import { postUrl } from '../lib/soop'

/** 우왁굳 와포 Q&A. 열 때 한 번 읽어 온다(lib/qa.js). */
export default function QaModal({ onClose }) {
  const [groups, setGroups] = useState(null)
  const [failed, setFailed] = useState(false)
  /** 번호 순서. 기본은 Q1 부터 아래로. */
  const [asc, setAsc] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchQa({ signal: controller.signal })
      .then(setGroups)
      .catch((err) => err.name !== 'AbortError' && setFailed(true))
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      controller.abort()
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const total = groups?.reduce((n, g) => n + g.items.length, 0) ?? 0

  // 글에는 최신이 위로 쌓인다. 번호는 오래된 글부터 이어 붙여(답변 1 이 Q1~) 순서만 뒤집어 보여 준다.
  const shown = useMemo(() => {
    if (!groups) return null
    const numbered = groups.map((g, gi) => {
      const older = groups.slice(gi + 1).reduce((n, x) => n + x.items.length, 0)
      return { ...g, items: g.items.map((it, i) => ({ ...it, n: older + g.items.length - i })) }
    })
    if (!asc) return numbered
    return numbered
      .map((g) => ({ ...g, items: [...g.items].reverse() }))
      .reverse()
  }, [groups, asc])

  return (
    <div className="qa-backdrop" onClick={onClose}>
      <section
        className="qa-modal"
        role="dialog"
        aria-modal="true"
        aria-label="우왁굳 와포 Q&A"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="qa-head">
          <div>
            <h2>우왁굳 와포 Q&amp;A</h2>
            <p className="muted">
              답변된 질문만 모았습니다{groups ? ` · ${total}개` : ''}. 계속 업데이트 됩니다.
            </p>
            <div className="qa-sort" role="group" aria-label="번호 순서">
              <button type="button" className={asc ? 'on' : ''} onClick={() => setAsc(true)}>
                Q1부터 ↓
              </button>
              <button type="button" className={asc ? '' : 'on'} onClick={() => setAsc(false)}>
                최신부터 ↑
              </button>
            </div>
          </div>
          <button type="button" className="qa-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="qa-body">
          {failed && <p className="muted">Q&amp;A를 불러오지 못했습니다. 잠시 뒤 다시 열어 보세요.</p>}
          {!groups && !failed && <p className="muted">불러오는 중…</p>}
          {shown?.map((g) => (
            <div key={g.postNo} className="qa-group">
              <h3>
                {g.title}
                <a href={g.url} target="_blank" rel="noopener noreferrer">
                  원문 ↗
                </a>
              </h3>
              {!g.ok && <p className="muted">이 글을 읽지 못했습니다.</p>}
              {g.items.map((it) => (
                <article key={it.img} className="qa-item">
                  <span className="qa-num">Q{it.n}</span>
                  <a href={it.img} target="_blank" rel="noopener noreferrer">
                    <img className="qa-q" src={it.img} alt="질문 캡처" loading="lazy" />
                  </a>
                  <p className="qa-a">
                    <b>A</b>
                    {it.answer}
                  </p>
                </article>
              ))}
            </div>
          ))}
        </div>

        <footer className="qa-foot muted">
          질문은{' '}
          <a href={postUrl(QA_ASK_POST.bjId, QA_ASK_POST.postNo)} target="_blank" rel="noopener noreferrer">
            이 글 댓글
          </a>
          로 받습니다.
        </footer>
      </section>
    </div>
  )
}
