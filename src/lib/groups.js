export const UNGROUPED_ID = '__ungrouped__'

function squash(text) {
  return text.toLowerCase().replace(/\s+/g, '')
}

/**
 * 글자 그대로 찾는 검색어. 공백을 모두 무시하고 비교하므로
 * "여자 버튜버"가 "인기여자버튜버"에도 걸린다.
 */
export function textRule(keyword) {
  const value = squash(keyword ?? '')
  return value ? { type: 'text', value } : null
}

/**
 * 정규식 검색어. 반드시 코드가 만든 RegExp만 넘긴다.
 *
 * 예전에는 "/패턴/" 모양의 문자열을 보면 정규식으로 컴파일했는데,
 * 검색어가 게시글 본문에서 자동 생성되는 지금 구조에서는 그게 곧
 * 남이 쓴 글이 내 정규식이 된다는 뜻이었다. 목록 항목을 `/(a+)+(b+)+$/`로
 * 두 개 적어 두면 방문자 브라우저가 댓글 하나에 몇 분씩 멈춘다(실측).
 */
export function regexRule(pattern) {
  return pattern instanceof RegExp ? { type: 'regex', value: pattern } : null
}

function groupMatches(group, raw, squashed) {
  return group.keywords.some((rule) =>
    rule.type === 'regex' ? rule.value.test(raw) : squashed.includes(rule.value)
  )
}

/**
 * 댓글 전문을 훑어 그룹별로 나눈다.
 * - 여러 그룹에 걸리면 앞 순서 그룹이 이기고, 해당 댓글에 conflicts가 기록된다.
 * - overrides에 지정된 댓글은 자동 분류를 무시하고 그 그룹으로 간다.
 * - 어디에도 안 걸리면 미분류로 간다.
 *
 * @param {Array} comments
 * @param {Array} groups
 * @param {Record<string, string>} overrides commentId -> groupId
 */
export function classify(comments, groups, overrides = {}) {
  const validIds = new Set([...groups.map((g) => g.id), UNGROUPED_ID])
  const buckets = new Map(groups.map((g) => [g.id, []]))
  buckets.set(UNGROUPED_ID, [])

  for (const comment of comments) {
    const raw = comment.text.toLowerCase()
    const squashed = squash(raw)
    const hits = groups.filter((g) => groupMatches(g, raw, squashed))

    const override = overrides[comment.id]
    const manual = override && validIds.has(override)
    const target = manual ? override : (hits[0]?.id ?? UNGROUPED_ID)

    buckets.get(target).push({
      ...comment,
      groupId: target,
      manual: !!manual,
      conflicts: !manual && hits.length > 1 ? hits.slice(1).map((g) => g.name) : [],
    })
  }

  return buckets
}

/**
 * 본문에서 찾은 목록이 정말 "댓글에 적는 분류"인지 실제 댓글로 확인한다.
 *
 * 방송국 글은 합격자 명단이나 신청 양식도 번호 목록으로 쓴다. 그런 목록으로 그룹을 만들면
 * 댓글이 거의 안 걸리거나(명단), 한 댓글이 전 항목에 다 걸린다(양식). 둘 다 분류가 아니다.
 * 실측: 진짜 전형 글은 적중 98.9% / 중복 4.5%, 명단·양식 글은 적중 0%.
 */
export function validateGrouping(comments, groups) {
  const empty = { ok: false, coverage: 0, conflictRate: 0, filled: 0 }
  if (groups.length < 2 || comments.length === 0) return empty

  const buckets = classify(comments, groups)
  const classified = comments.length - buckets.get(UNGROUPED_ID).length
  const conflicts = [...buckets.values()].flat().filter((c) => c.conflicts.length > 0).length
  const coverage = classified / comments.length
  const conflictRate = classified > 0 ? conflicts / classified : 0
  const filled = groups.filter((g) => buckets.get(g.id).length > 0).length

  return {
    ok: coverage >= 0.4 && conflictRate <= 0.6 && filled >= 2,
    coverage,
    conflictRate,
    filled,
  }
}

/** 좋아요 내림차순. 동점이면 먼저 쓴 댓글이 위로. */
export function rank(list) {
  return [...list]
    .sort((a, b) => b.likes - a.likes || a.date.localeCompare(b.date))
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

/**
 * 상위 n명을 잘라낸다.
 * n번째와 n+1번째의 좋아요가 같으면 어디서 끊든 자의적이므로 tie로 알린다.
 */
export function takeTop(items, n) {
  const count = Math.max(0, Math.min(n, items.length))
  const boundary = items[count - 1]
  const next = items[count]
  return {
    picked: items.slice(0, count),
    tie: boundary && next && boundary.likes === next.likes ? boundary.likes : null,
  }
}

export function formatNicknames(items, { format = 'lines', withRank = false, withLikes = false }) {
  const line = (c) =>
    [withRank ? `${c.rank}.` : '', c.nick, withLikes ? `(${c.likes.toLocaleString()})` : '']
      .filter(Boolean)
      .join(' ')
  return items.map(line).join(format === 'comma' ? ', ' : '\n')
}

// Excel은 따옴표를 벗겨낸 뒤 =, +, -, @로 시작하는 칸을 수식으로 해석한다.
// 닉네임과 댓글은 남이 쓴 글이고 "- 안녕하세요" 같은 건 흔하므로 앞에 '를 붙여 텍스트로 못박는다.
const FORMULA_LEAD = /^[=+\-@\t\r]/

export function toCsv(sections) {
  const esc = (v) => {
    const raw = String(v ?? '')
    const safe = FORMULA_LEAD.test(raw) ? `'${raw}` : raw
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [['그룹', '순위', '닉네임', '아이디', '좋아요', '작성일', '내용'].join(',')]
  for (const { group, items } of sections) {
    for (const item of items) {
      rows.push(
        [
          esc(group),
          item.rank,
          esc(item.nick),
          esc(item.userId),
          Number(item.likes) || 0,
          esc(item.date),
          esc(item.text.replace(/\r?\n/g, ' ')),
        ].join(',')
      )
    }
  }
  // Excel이 UTF-8로 열도록 BOM을 붙인다.
  return '﻿' + rows.join('\r\n')
}
