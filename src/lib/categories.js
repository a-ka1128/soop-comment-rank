// 확장자를 붙여 두면 Vite뿐 아니라 node로도 그냥 돌아가 검증 스크립트를 쓰기 쉽다.
import { decodeEntities } from './soop.js'
import { regexRule, textRule } from './groups.js'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<\/p>|<br\s*\/?>|<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/​/g, '')
    .trim()
}

export function toPlainText(html) {
  return stripTags(html || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * 게시글 본문에서 "신청 전형" 같은 번호 매긴 카테고리 목록을 찾는다.
 *
 * 1순위: <ol> 리스트. 에디터가 번호를 매긴 목록이라 가장 확실하다.
 * 2순위: "1. xxx" / "1번 xxx" 형태가 1부터 연달아 나오는 본문 줄.
 *
 * @returns {string[]} 못 찾으면 빈 배열
 */
export function detectCategories(html) {
  if (!html) return []

  for (const block of html.matchAll(/<ol[^>]*>([\s\S]*?)<\/ol>/gi)) {
    const items = [...block[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripTags(m[1]).split('\n')[0].trim())
      .filter((t) => t.length >= 2 && t.length <= 60)
    if (items.length >= 2 && items.length <= 9) return items
  }

  const numbered = new Map()
  for (const line of toPlainText(html).split('\n')) {
    const m = line.match(/^([1-9])\s*[.)번]\s*(.{2,50})$/)
    if (m && !numbered.has(m[1])) numbered.set(m[1], m[2].trim())
  }
  const sequence = []
  for (let n = 1; numbered.has(String(n)); n += 1) sequence.push(numbered.get(String(n)))
  return sequence.length >= 2 ? sequence : []
}

function tokenize(label) {
  return label.split(/[\s,·/()[\]]+/).filter(Boolean)
}

/**
 * 카테고리 이름들을 서로 비교해, 각 이름에만 나오는 낱말을 찾아 검색어로 삼는다.
 * "인기 남자 버튜버 TOP 33" / "인기 여자 버튜버 TOP 33" → "남자 버튜버" / "여자 버튜버".
 *
 * 낱말 하나만 쓰면("남자") 본문 아무 데나 걸리므로 옆 낱말을 붙여 구를 만든다.
 */
function distinctivePhrase(tokens, freq, fallback) {
  const index = tokens.findIndex((t) => freq.get(t) === 1 && !/^\d+$/.test(t))
  if (index < 0) return fallback
  const neighbour = tokens[index + 1] ?? tokens[index - 1]
  return neighbour ? `${tokens[index]} ${neighbour}` : tokens[index]
}

/** 카테고리 이름에 "TOP 33"처럼 뽑을 인원이 적혀 있으면 가져온다. */
function detectTopN(label) {
  const m = label.match(/TOP\s*(\d{1,4})|상위\s*(\d{1,4})\s*명|(\d{1,4})\s*명/i)
  if (!m) return null
  const n = Number(m[1] ?? m[2] ?? m[3])
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * 밀리터리 그린 계열 안에서 고른 분류 색. 전부 순위 숫자로도 쓰이므로
 * 패널 표면 기준 4.87:1 이상이 되도록 밝기를 맞췄다.
 *
 * 같은 색 계열이라 서로 완전히 구분되지는 않는다. 그래도 되는 이유는 이 화면에서
 * 분류 색 옆에는 항상 분류 이름이 글자로 붙기 때문이다 — 색이 혼자 신원을 지는
 * 곳(꺾은선 범례)에는 이 색들을 쓰지 않는다.
 */
export const GROUP_COLORS = [
  '#c6b683', // 밝은 카키
  '#9a8f63', // 올리브
  '#b08a5e', // 모래갈색
  '#c07c4c', // 테라코타
  '#a39a7a', // 카키
  '#a98460', // 흙갈색
  '#8e9a68', // 세이지
  '#869269', // 짙은 세이지
]

/**
 * 감지한 카테고리를 분류 그룹으로 바꾼다.
 * 댓글은 "2번", "2.", "2 ", "인기여자버튜버"처럼 제각각 적으므로
 * 번호 표기와 이름에서 뽑은 구를 모두 검색어로 넣는다.
 *
 * 이름에서 뽑은 구는 남이 쓴 글이므로 반드시 글자 그대로 찾는다(textRule).
 * 정규식은 여기서 번호로 직접 만든 것만 쓴다.
 */
export function buildGroups(labels) {
  const tokenSets = labels.map(tokenize)
  const freq = new Map()
  for (const tokens of tokenSets) {
    for (const token of new Set(tokens)) freq.set(token, (freq.get(token) ?? 0) + 1)
  }

  return labels.map((label, i) => {
    const number = i + 1
    return {
      id: `cat${number}`,
      name: label,
      topN: detectTopN(label),
      color: GROUP_COLORS[i % GROUP_COLORS.length],
      keywords: [
        textRule(`${number}번`),
        textRule(CIRCLED[i]),
        textRule(distinctivePhrase(tokenSets[i], freq, label)),
        regexRule(new RegExp(`^\\s*${number}[\\s.,)\\]]`)),
      ].filter(Boolean),
    }
  })
}
