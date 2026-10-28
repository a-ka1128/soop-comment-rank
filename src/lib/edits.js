/**
 * 댓글 수정 감지. 갱신할 때마다 지난번 본문과 비교해서 바뀐 댓글을 골라 낸다.
 *
 * SOOP 댓글 API 에는 수정 시각이 없다(regDate 는 처음 단 시각 그대로). 그래서 본문 글자를
 * 직접 비교한다. 지난번 본문은 이 브라우저에 남겨 둬서, 어드민 창을 닫았다 다시 열어도
 * 그사이 고쳐진 댓글이 알림으로 뜬다.
 */

const KEY = (postNo) => `soop-comment-texts:${postNo}`

/** @returns {Map<string, string> | null} 저장된 게 없거나 못 읽으면 null */
export function loadTexts(postNo) {
  try {
    const raw = localStorage.getItem(KEY(postNo))
    return raw ? new Map(Object.entries(JSON.parse(raw))) : null
  } catch {
    return null
  }
}

export function saveTexts(postNo, comments) {
  try {
    localStorage.setItem(
      KEY(postNo),
      JSON.stringify(Object.fromEntries(comments.map((c) => [c.id, c.text]))),
    )
  } catch {
    // 저장이 막힌 브라우저면 이번 창이 열려 있는 동안만 감지한다.
  }
}

/**
 * 지난번과 본문이 달라진 댓글. 새로 달린 댓글은 수정이 아니라 뺀다.
 *
 * @param {Map<string, string>} before 댓글 id -> 지난번 본문
 * @returns {Array<{id, userId, nick, before: string, after: string}>}
 */
export function findEdits(before, comments) {
  const out = []
  for (const c of comments) {
    const old = before.get(String(c.id))
    if (old !== undefined && old !== c.text) {
      out.push({ id: c.id, userId: c.userId, nick: c.nick, before: old, after: c.text })
    }
  }
  return out
}
