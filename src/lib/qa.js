import { decodeEntities, fetchPost, postUrl } from './soop'

/**
 * 우왁굳의 와포 Q&A. 질문은 스크린샷 이미지, 답변은 그 바로 아래 인용 블록으로 올라오는
 * 「와우 질문에 대한 답변」 글(상시 업데이트)을 그대로 읽어 온다. 새 답변이 글에 붙으면
 * 사이트는 고칠 것 없이 다음 열람 때 따라온다.
 *
 * 최신 글이 앞에 오도록 적는다. 새 글(답변 3…)이 생기면 여기에 한 줄만 더하면 된다.
 */
export const QA_POSTS = [
  { bjId: 'ecvhao', postNo: '211182651', title: '와우 질문에 대한 답변 2' },
  { bjId: 'ecvhao', postNo: '211178831', title: '와우 질문에 대한 답변 1' },
]

/** 질문을 모으던 글(댓글로 받았다). 모달 아래에 링크로만 건다. */
export const QA_ASK_POST = { bjId: 'ecvhao', postNo: '211138607' }

const safeImg = (u) => (/^https:\/\//.test(u ?? '') ? u : '')

/**
 * 본문 HTML 에서 (이미지 → 인용 블록) 쌍을 뽑는다. 이미지 뒤에 답이 없으면 아직 답변 전이라 뺀다.
 * @returns {{img: string, answer: string}[]} 글에 적힌 순서대로
 */
export function parseQa(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = []
  let img = ''
  for (const el of doc.body.querySelectorAll('figure img, blockquote')) {
    if (el.tagName === 'IMG') {
      img = safeImg(el.getAttribute('src'))
    } else if (img) {
      el.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
      const answer = decodeEntities((el.textContent ?? '').replace(/ /g, ' ')).trim()
      if (answer) out.push({ img, answer })
      img = ''
    }
  }
  return out
}

/** 글마다 따로 읽어 한 글이 안 읽혀도 나머지는 보여 준다. */
export async function fetchQa({ signal } = {}) {
  const groups = await Promise.all(
    QA_POSTS.map(async (p) => {
      try {
        const { html } = await fetchPost(p.bjId, p.postNo, { signal })
        return { ...p, url: postUrl(p.bjId, p.postNo), items: parseQa(html), ok: true }
      } catch (err) {
        if (err.name === 'AbortError') throw err
        return { ...p, url: postUrl(p.bjId, p.postNo), items: [], ok: false }
      }
    }),
  )
  return groups
}
