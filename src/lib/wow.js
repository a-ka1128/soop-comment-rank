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
  { id: 'warrior', name: '전사', color: '#c69b6d', words: ['전사', '전탱', '딜전', '무전', '분전'] },
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
  const alone = (cls.alone ?? []).map(
    (w) => new RegExp(`(?<!${HANGUL})${w}(?!${HANGUL})`, 'u'),
  )
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
 * 자동 판정이 틀리는 걸 사람이 확인한 경우. userId -> 직업 id, null 이면 미분류.
 * 모든 방문자에게 똑같이 적용된다(카드에서 고르는 수동 지정은 그 브라우저에만 남는다).
 */
export const CLASS_FIXES = {
  baythebass: null, // "법사, 흑마 빼고 고민중" — 뺀다고 적은 직업에 걸린다
}

/**
 * 직업으로 나눈 결과를 groups.classify 와 같은 모양(Map<groupId, comments[]>)으로 낸다.
 * 수동 지정(overrides)이 자동 판정을 이긴다.
 */
export function classifyByClass(comments, overrides = {}) {
  const valid = new Set([...WOW_CLASSES.map((c) => c.id), UNGROUPED_ID])
  const buckets = new Map(WOW_CLASSES.map((c) => [c.id, []]))
  buckets.set(UNGROUPED_ID, [])

  for (const comment of comments) {
    const picked = pickClass(comment.text)
    if (comment.userId in CLASS_FIXES) {
      picked.id = CLASS_FIXES[comment.userId]
      picked.others = []
    }
    const override = overrides[comment.id]
    const manual = !!override && valid.has(override)
    const target = manual ? override : (picked.id ?? UNGROUPED_ID)
    buckets.get(target).push({
      ...comment,
      groupId: target,
      manual,
      // 화면에서 '중복' 경고로 쓰던 자리. 여기서는 같이 고민 중인 직업이다.
      alsoConsidering: manual ? [] : picked.others,
      conflicts: [],
    })
  }
  return buckets
}

/**
 * 본인이 댓글에 적은 경력에서 뽑는 꼬리표.
 *
 * 인터넷에 크루 명단이 정리돼 있지 않아서(동아리 최종 명단은 방송으로만 발표됐다)
 * 확인할 수 있는 건 본인이 쓴 말뿐이다. 그래서 '자기소개' 꼬리표라고 화면에 밝힌다.
 * 확인된 크루는 crews.js 에 따로 적는다.
 *
 * 순서가 화면에 붙는 순서다.
 */
export const SELF_TAGS = [
  {
    id: 'watuber',
    name: '와튜버 데뷔',
    hint: '와우(불타는 성전)로 방송을 시작했다고 적은 사람',
    test: /와튜버\s*(로|로서)?\s*(방송\s*)?데뷔|와우로\s*(뒤늦게\s*)?(방송\s*)?데뷔|순혈\s*와튜버|와튜버\s*1기|와튜버\s*2기|와튜버로\s*데뷔|와트너/,
  },
  {
    id: 'legacy70',
    name: '와점기 70렙',
    hint: '지난 불타는 성전 서버에서 70레벨을 찍었다고 적은 사람',
    test: /70\s*(렙|레벨|랩)|레거시|만렙\s*찍고\s*불뱀/,
  },
  {
    id: 'hardcore',
    name: '하코 출신',
    hint: '와우 클래식 하드코어 서버를 했다고 적은 사람',
    test: /하코|하드코어|하트코어/,
  },
  {
    id: 'raidlead',
    name: '공대장',
    hint: '레이드 공대장을 해 봤다고 적은 사람 (와우 밖 게임 포함)',
    test: /공대장(?!의)/,
  },
  {
    id: 'forevers',
    name: '와우포에버즈',
    hint: '와우포에버즈 소속이라고 적은 사람',
    test: /와우\s*포에버즈/,
  },
  {
    id: 'wakchi2',
    name: '왁치동2',
    hint: '왁치동2 소속이라고 적은 사람',
    test: /왁치동\s*2/,
  },
  {
    id: 'newbie',
    name: '와우 처음',
    hint: '와우를 해 본 적이 없다고 적은 사람',
    test: /(^|[^\d])0\s*시간|처음\s*(입니|이에|예요)|아예\s*(x|없|처음)|쌩\s*(뉴비|신입|처음)|찐\s*뉴비|생애\s*첫\s*와우|인생\s*첫\s*설치|와우.{0,8}해\s*본\s*적(이|도)\s*없|한\s*번도\s*(없|안\s*해)|뉴\s*와튜버|뉴걸|와린이/i,
  },
]

/**
 * @returns {Array<{id: string, name: string, hint: string, kind: 'self'|'crew'}>}
 */
export function tagsOf(comment) {
  const text = comment.text || ''
  const self = SELF_TAGS.filter((t) => t.test.test(text)).map((t) => ({
    id: t.id,
    name: t.name,
    hint: t.hint,
    kind: 'self',
  }))
  const crews = (CREWS[comment.userId] ?? []).map((name) => ({
    id: `crew:${name}`,
    name,
    hint: '확인된 소속 (crews.js)',
    kind: 'crew',
  }))
  // 확인된 크루가 자기소개 꼬리표와 같은 이름이면 확인된 쪽만 남긴다.
  const crewNames = new Set(crews.map((c) => c.name))
  return [...crews, ...self.filter((t) => !crewNames.has(t.name))]
}
