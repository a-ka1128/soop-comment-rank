// 확장자를 붙여 두면 Vite뿐 아니라 node로도 그냥 돌아가 검증 스크립트를 쓰기 쉽다.
import { UNGROUPED_ID } from './groups.js'
import { CREWS } from './crews.js'

/**
 * 와우 직업. 댓글 양식 첫 줄이 "해보려는 직업"이라 본문 번호 목록 대신 직업으로 나눈다.
 *
 * 색은 블리자드 직업 색을 기본으로 하되, 어두운 바탕에서 순위 숫자로 읽히도록
 * 주술사(#0070DD)만 밝혔다.
 *
 * 줄임말은 실제 신청 댓글에서 나온 것만 넣었다. "보기"(보호 성기사)·"신기"는
 * "알아보기"·"신기하다"에 걸려서 뺐다. "냥"·"드"는 혼자 쓰일 때만 잡는다
 * ("냥,드" ○ / "망냥냥" ×).
 */
export const WOW_CLASSES = [
  {
    id: 'warrior',
    name: '전사',
    color: '#c69b6d',
    words: ['전사', '전탱', '딜전', '무전', '분전'],
  },
  { id: 'paladin', name: '성기사', color: '#f48cba', words: ['성기사', '성기'] },
  {
    id: 'hunter',
    name: '사냥꾼',
    color: '#aad372',
    words: ['사냥꾼', '냥꾼', '사냥쿤', '생냥', '야냥'],
    alone: ['냥'],
  },
  { id: 'rogue', name: '도적', color: '#fff468', words: ['도적', '돚거'] },
  { id: 'priest', name: '사제', color: '#f2f2f2', words: ['사제', 'ㅅㅏ제'] },
  {
    id: 'shaman',
    name: '주술사',
    color: '#4aa3f5',
    words: ['주술', '술사', '고술', '정술', '복술'],
  },
  { id: 'mage', name: '마법사', color: '#3fc7eb', words: ['마법사', '법사', '법ㅅㅏ'] },
  { id: 'warlock', name: '흑마법사', color: '#8788ee', words: ['흑마', '악흑'] },
  {
    id: 'druid',
    name: '드루이드',
    color: '#ff7c0a',
    words: ['드루', '조드', '회드', '야드'],
    alone: ['드'],
  },
]

const HANGUL = '[\\p{Script=Hangul}]'

function squash(text) {
  return text.toLowerCase().replace(/\s+/g, '')
}

/** 직업마다 "가장 먼저 나온 위치"를 찾는 함수 하나씩. */
const LOCATORS = WOW_CLASSES.map((cls) => {
  const alone = (cls.alone ?? []).map((w) => new RegExp(`(?<!${HANGUL})${w}(?!${HANGUL})`, 'u'))
  return (squashed, raw) => {
    let best = Infinity
    for (const w of cls.words) {
      const at = squashed.indexOf(w)
      if (at >= 0 && at < best) best = at
    }
    // 혼자 쓰인 한 글자는 공백이 뜻을 가르므로 원문에서 찾는다. 위치는 대략이면 된다.
    for (const re of alone) {
      const m = re.exec(raw)
      if (m) best = Math.min(best, squash(raw.slice(0, m.index)).length)
    }
    return best
  }
})

/**
 * 한 댓글이 처음 고른 직업.
 *
 * 고민 중인 사람은 여러 개를 적고("법사, 드루, 사제 중 고민"), 경력 칸에는 예전에 한
 * 직업을 적는다("하코 냥꾼 29렙"). 그래서 '직업'이라는 말 뒤에서 가장 먼저 나온
 * 직업을 고른다. '직업'이란 말이 없거나 그 뒤에 직업이 없으면 전체에서 가장 먼저
 * 나온 것을 쓴다.
 *
 * "흑마법사"에는 "마법사"도 들어 있지만 "흑마"가 두 글자 앞에서 먼저 걸려서 흑마가 된다.
 *
 * @returns {{ id: string|null, others: string[] }} others 는 같이 적은 다른 직업 이름
 */
export function pickClass(text) {
  const raw = (text || '').toLowerCase()
  const squashed = squash(raw)

  const scan = (s, r) =>
    LOCATORS.map((locate, i) => ({ cls: WOW_CLASSES[i], at: locate(s, r) }))
      .filter((x) => x.at !== Infinity)
      .sort((a, b) => a.at - b.at)

  const jobAt = raw.indexOf('직업')
  let hits = jobAt >= 0 ? scan(squash(raw.slice(jobAt)), raw.slice(jobAt)) : []
  if (hits.length === 0) hits = scan(squashed, raw)

  return {
    id: hits[0]?.cls.id ?? null,
    others: hits.slice(1).map((h) => h.cls.name),
  }
}

/**
 * 자동 판정이 틀리는 걸 코드로 고정해 둔 것. userId -> 직업 id, null 이면 미분류.
 * 어드민 라벨(labels.js)이 있으면 그쪽이 이긴다. 새로 고칠 건 어드민 화면에서 고친다.
 */
export const CLASS_FIXES = {
  baythebass: null, // "법사, 흑마 빼고 고민중" — 뺀다고 적은 직업에 걸린다
}

/** 어드민 라벨의 cls 값 중 '미분류로 둔다'는 뜻. 비어 있음(자동)과 구분한다. */
export const CLS_NONE = 'none'

const CLASS_BY_ID = new Map(WOW_CLASSES.map((c) => [c.id, c]))

/**
 * 어드민 라벨의 cls 를 읽는다. 예전 라벨은 직업 하나(문자열)이고, 지금은 여러 개(배열)를
 * 고를 수 있다. 배열의 첫 직업이 대표(색·전체 탭의 자리)다.
 *
 * @returns {string[] | 'none' | null} 직업 id 목록, 미분류로 고정, 또는 자동(null)
 */
export function labelClasses(label) {
  const cls = label?.cls
  if (cls === CLS_NONE) return CLS_NONE
  const ids = (Array.isArray(cls) ? cls : [cls]).filter((id) => CLASS_BY_ID.has(id))
  return ids.length > 0 ? [...new Set(ids)] : null
}

/**
 * 직업으로 나눈 결과를 groups.classify 와 같은 모양(Map<groupId, comments[]>)으로 낸다.
 * 어드민 라벨 > CLASS_FIXES > 자동 판정 순으로 이긴다.
 *
 * 어드민이 직업을 여러 개 고른 사람은 고른 직업 칸마다 들어간다. 그래서 칸을 모두
 * 이어 붙이면 같은 댓글이 여러 번 나온다 — 전체 목록을 만들 땐 uniqueComments 를 거친다.
 *
 * @param {Array} comments
 * @param {Record<string, {cls?: string|string[]}>} labels userId -> 어드민 라벨
 */
export function classifyByClass(comments, labels = {}) {
  const buckets = new Map(WOW_CLASSES.map((c) => [c.id, []]))
  buckets.set(UNGROUPED_ID, [])

  for (const comment of comments) {
    const picked = pickClass(comment.text)
    if (comment.userId in CLASS_FIXES) {
      picked.id = CLASS_FIXES[comment.userId]
      picked.others = []
    }
    const chosen = labelClasses(labels[comment.userId])
    const manual = chosen !== null
    const targets = !manual
      ? [picked.id ?? UNGROUPED_ID]
      : chosen === CLS_NONE
        ? [UNGROUPED_ID]
        : chosen
    const item = {
      ...comment,
      groupId: targets[0],
      // 대표 직업의 색. 직업 탭에서는 줄 색이 탭 색이라, 배지는 이걸로 따로 칠한다.
      classColor: CLASS_BY_ID.get(targets[0])?.color,
      manual,
      // 대표 직업 말고 어드민이 같이 고른 직업. 줄에 배지로 붙는다.
      extraClasses: targets.slice(1).map((id) => CLASS_BY_ID.get(id)),
      // 화면에서 '중복' 경고로 쓰던 자리. 여기서는 같이 고민 중인 직업이다.
      alsoConsidering: manual ? [] : picked.others,
      conflicts: [],
    }
    for (const id of targets) buckets.get(id).push(item)
  }
  return buckets
}

/** 여러 직업 칸에 들어간 댓글을 한 번씩만 남긴다. 순서는 처음 나온 자리. */
export function uniqueComments(list) {
  const seen = new Set()
  return list.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
}

/**
 * 본인이 댓글에 적은 경력에서 뽑는 꼬리표.
 *
 * 인터넷에 크루 명단이 정리돼 있지 않아서(동아리 최종 명단은 방송으로만 발표됐다)
 * 확인할 수 있는 건 본인이 쓴 말뿐이다. 그래서 '자기소개' 꼬리표라고 화면에 밝힌다.
 * 확인된 크루는 crews.js 에 따로 적는다.
 *
 * 순서가 화면에 붙는 순서다(자기소개 줄과 줄마다 붙는 배지 모두). 크루는 이 뒤에 온다.
 * 맨 앞의 '뉴 와튜버 데뷔' 칩은 꼬리표가 아니라 App 이 따로 붙인다.
 */
export const SELF_TAGS = [
  {
    id: 'legacy70',
    name: '와점기 70렙',
    hint: '지난 불타는 성전 서버에서 70레벨을 찍었다고 적은 사람',
    test: /70\s*(렙|레벨|랩)|레거시|만렙\s*찍고\s*불뱀/,
  },
  {
    id: 'legacy60',
    name: '와점기 60렙',
    hint: '지난 불타는 성전 서버에서 60레벨을 찍었다고 적은 사람',
    // 그냥 '60렙'만 보면 하드코어 서버 60레벨까지 걸린다(그건 '하코 출신'). 서버 이름이
    // 바로 앞에 있을 때만 잡는다.
    test: /(불성|와점기|레거시|클래식)(?:(?!하코|하드코어)[^\n]){0,12}60\s*(렙|레벨|랩)/,
  },
  {
    id: 'hardcore',
    name: '하코 출신',
    hint: '와우 클래식 하드코어 서버를 했다고 적은 사람',
    test: /하코|하드코어|하트코어/,
  },
  {
    id: 'newbie',
    name: '와우 처음',
    hint: '와우를 해 본 적이 없다고 적은 사람',
    test: /(^|[^\d])0\s*시간|처음\s*(입니|이에|예요)|아예\s*(x|없|처음)|쌩\s*(뉴비|신입|처음)|찐\s*뉴비|생애\s*첫\s*와우|인생\s*첫\s*설치|와우.{0,8}해\s*본\s*적(이|도)\s*없|한\s*번도\s*(없|안\s*해)|뉴\s*와튜버|뉴걸|와린이/i,
  },
  {
    id: 'forevers',
    name: '와우포에버즈',
    hint: '와우포에버즈 소속이라고 적은 사람',
    test: /와우\s*포에버즈/,
  },
  {
    id: 'watuber',
    name: '와튜버',
    hint: '와우(불타는 성전)로 방송을 시작했다고 적은 사람',
    // '와트너'(와우 파트너 스트리머)는 와튜버 데뷔가 아니다 — 단즈가 그렇게 잘못 붙었다.
    test: /와튜버\s*(로|로서)?\s*(방송\s*)?데뷔|와우로\s*(뒤늦게\s*)?(방송\s*)?데뷔|순혈\s*와튜버|와튜버\s*1기|와튜버\s*2기|와튜버로\s*데뷔/,
  },
]

/**
 * 글자로는 걸리지만 사실이 아닌 꼬리표. userId -> 뗄 꼬리표 id 들. 사람이 확인한 것만 적는다.
 */
export const TAG_FIXES = {
  kwonmingomem: ['forevers'], // 권민 — "심상치 않은 와우 포에버즈"는 게임 얘기다
  kawa11az: ['forevers'], // 아즈 — "와우포에버즈 히누히누 동생"이라 본인은 소속이 아니다
}

/**
 * 한 사람의 크루. crews.js 에 조사해 둔 것(from: 'research') 중 어드민이 뺀 것을 지우고,
 * 어드민이 직접 넣은 것(from: 'admin')을 더한다. 같은 이름은 한 번만.
 *
 * @returns {Array<{name: string, from: 'research'|'admin'}>}
 */
export function crewsOf(userId, label) {
  const off = new Set(label?.crewsOff ?? [])
  const out = []
  const seen = new Set()
  const add = (name, from) => {
    if (seen.has(name)) return
    seen.add(name)
    out.push({ name, from })
  }
  for (const name of CREWS[userId] ?? []) if (!off.has(name)) add(name, 'research')
  for (const name of label?.crews ?? []) add(name, 'admin')
  return out
}

/**
 * @param {object} comment
 * @param {{tags?: Record<string, boolean>, crews?: string[], crewsOff?: string[]}} [label]
 *   어드민 라벨. tags 의 true 는 글과 상관없이 붙이고 false 는 뗀다. 없는 꼬리표는 자동.
 *   crewsOff 는 crews.js 에 조사해 둔 크루 중 어드민이 뺀 것.
 * @returns {Array<{id: string, name: string, hint: string, kind: 'self'|'crew'}>}
 */
export function tagsOf(comment, label) {
  // 데뷔 글 댓글은 와우를 처음 하는 새 와튜버라, 다른 꼬리표 없이 '와우 처음' 하나만 단다.
  if (comment.debut) {
    const t = SELF_TAGS.find((s) => s.id === 'newbie')
    return [{ id: t.id, name: t.name, hint: '뉴 와튜버 데뷔 글에 댓글을 단 사람', kind: 'self' }]
  }
  const text = comment.text || ''
  const removed = TAG_FIXES[comment.userId] ?? []
  const forced = label?.tags ?? {}
  const self = SELF_TAGS.filter((t) =>
    t.id in forced ? forced[t.id] : !removed.includes(t.id) && t.test.test(text),
  ).map((t) => ({
    id: t.id,
    name: t.name,
    hint: t.id in forced ? `${t.hint} — 어드민 확인` : t.hint,
    kind: 'self',
  }))
  const crewNames = crewsOf(comment.userId, label).map((c) => c.name)
  const crews = crewNames.map((name) => ({
    id: `crew:${name}`,
    name,
    hint: '확인된 소속',
    kind: 'crew',
  }))
  // 자기소개 꼬리표가 먼저, 크루가 뒤. 크루가 꼬리표와 같은 이름이면 크루 쪽만 남긴다.
  return [...self.filter((t) => !crewNames.includes(t.name)), ...crews]
}
