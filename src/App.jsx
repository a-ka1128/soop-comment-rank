import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NicknameExport from './components/NicknameExport'
import CommentCard from './components/CommentCard'
import CommentDetail from './components/CommentDetail'
import { fetchAllComments, fetchPost, postUrl } from './lib/soop'
import { loadFanCounts } from './lib/fans'
import { UNGROUPED_ID, rank } from './lib/groups'
import { CUT_RANK, DEBUT_BOARD, TARGET_POST } from './lib/target'
import { SELF_TAGS, WOW_CLASSES, classifyByClass, tagsOf, uniqueComments } from './lib/wow'
import { fetchLabels, saveLabel } from './lib/labels'
import { useAdmin } from './lib/admin'
import { findEdits, loadTexts, saveTexts } from './lib/edits'
import { fetchDebut, fetchLive } from './lib/live'
import { BANNER, safeUrl } from './lib/banner'
import { useFlipReorder } from './hooks/useFlipReorder'
import { useMediaQuery } from './hooks/useMediaQuery'
import './App.css'

const ALL_TAB = '__all__'
const DEBUT_TAB = '__debut__'
/** 신청 조건이 "즐찾 컷 1000명"이라 열자마자 그 기준으로 걸러 둔다. */
const MIN_FANS_RULE = 1000
const DEBUT_COLOR = '#e6c46a'
// 특정 분류에 속하지 않는 줄(전체·미분류)의 색. 점과 왼쪽 막대에만 쓰인다.
const NEUTRAL_COLOR = '#a7a089'
// 목록 옆에 상세 패널을 둘 자리가 있는 폭. App.css 의 860px 경계와 맞춘다.
const WIDE_QUERY = '(min-width: 861px)'
// 1분마다 다시 읽는다. 어드민 창에서는 이때 수정된 댓글도 같이 찾는다(lib/edits).
const REFRESH_SEC = 60
// 순위 변동 표시를 얼마나 붙들어 둘지. 갱신마다 새로 그리면 화살표가 깜빡이고 지나가
// 무엇이 움직였는지 볼 틈이 없다. 다시 움직이지 않으면 이 시간까지 남긴다.
const MOVE_TTL_MS = 5 * 60 * 1000

export default function App() {
  const [data, setData] = useState(null)
  /** 「리얼 뉴 와튜버 데뷔 하기」 글의 댓글. 못 불러와도 본 화면은 그대로 뜬다. */
  const [debut, setDebut] = useState(null)
  const [tagFilter, setTagFilter] = useState(null)
  /**
   * 어드민이 고친 라벨(userId -> 라벨). 모든 방문자가 같은 값을 본다.
   * 예전의 '수동 지정'은 그 브라우저에만 남아 남에게 안 보였다 — 그래서 없앴다.
   */
  const [labels, setLabels] = useState({})
  const admin = useAdmin()
  // 어드민으로 로그인해 있을 때만 수정된 댓글을 찾고 알린다.
  const watchEdits = admin.route && !!admin.user
  /** 갱신 사이에 본문이 바뀐 댓글. 새것이 앞. 어드민이 확인하면 지운다. */
  const [edits, setEdits] = useState([])
  const [live, setLive] = useState(null)
  const [notifyPerm, setNotifyPerm] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  /** 글 번호 -> (댓글 id -> 지난번 본문). */
  const textsRef = useRef(new Map())
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState(ALL_TAB)
  const [query, setQuery] = useState('')
  // 목록에서 고른 댓글. 옆 패널(좁은 화면에선 시트)에 자세히 뜬다.
  const [selectedId, setSelectedId] = useState(null)
  const closeDetail = useCallback(() => setSelectedId(null), [])
  const wide = useMediaQuery(WIDE_QUERY)
  const [exportOpen, setExportOpen] = useState(false)


  /** userId -> 애청자 수. null 은 '알 수 없음'이고, 그 사람은 걸러 내지 않는다. */
  const [fans, setFans] = useState(() => new Map())
  const [fansLoading, setFansLoading] = useState(false)

  /**
   * 분류별 { 댓글id -> { delta, at } }. delta 는 마지막으로 움직인 폭이고
   * at 은 그때 시각이다. 갱신마다 갈아엎지 않고, 다시 움직일 때까지 들고 있는다.
   */
  const [moves, setMoves] = useState(new Map())

  const abortRef = useRef(null)
  const prevRanksRef = useRef(null)
  const refreshRef = useRef(null)
  const loadRef = useRef(null)
  const renderRef = useRef({ allSection: null, sections: [] })
  const listRef = useRef(null)
  const animateNextRef = useRef(false)
  /** 이미 물어본 userId. 1분마다 갱신될 때 같은 사람을 다시 묻지 않기 위한 것. */
  const fansAskedRef = useRef(new Set())

  // 다룰 글이 하나로 정해져 있으므로 열자마자 불러온다.
  useEffect(() => {
    loadRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 분류는 본문에서 찾지 않고 와우 직업으로 고정한다. 댓글 양식 첫 줄이 직업이다. */
  const groups = useMemo(
    () => WOW_CLASSES.map((c) => ({ id: c.id, name: c.name, color: c.color, topN: null })),
    [],
  )
  const grouped = true

  const buckets = useMemo(
    () => (data ? classifyByClass(data.comments, labels) : null),
    [data, labels],
  )

  /** 데뷔 글 댓글. 직업 색을 칠하려고 같은 규칙으로 나눈 뒤 한 줄로 편다. */
  const debutSection = useMemo(() => {
    if (!debut) return null
    const items = uniqueComments([...classifyByClass(debut.comments, labels).values()].flat()).map(
      (c) => ({ ...c, postNo: debut.postNo, debut: true }),
    )
    return {
      id: DEBUT_TAB,
      name: '뉴 와튜버 데뷔',
      color: DEBUT_COLOR,
      topN: null,
      items: rank(items),
    }
  }, [debut, labels])

  /** 데뷔 글에도 댓글을 단 길드 신청자. 카드에 표시한다. */
  const debutUserIds = useMemo(() => new Set(debut?.comments.map((c) => c.userId) ?? []), [debut])

  /** 그룹 탭들. 그룹이 하나도 없으면 빈 배열이고 전체 탭만 남는다. */
  const sections = useMemo(() => {
    if (!buckets || !grouped) return []
    const list = groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      topN: g.topN,
      items: rank(buckets.get(g.id) ?? []),
    }))
    const ungrouped = buckets.get(UNGROUPED_ID) ?? []
    if (ungrouped.length > 0) {
      list.push({
        id: UNGROUPED_ID,
        name: '미분류',
        color: NEUTRAL_COLOR,
        topN: null,
        items: rank(ungrouped),
      })
    }
    return list
  }, [buckets, groups, grouped])

  const allSection = useMemo(() => {
    if (!buckets) return null
    return {
      id: ALL_TAB,
      name: '전체',
      color: NEUTRAL_COLOR,
      topN: null,
      items: rank(uniqueComments([...buckets.values()].flat())),
    }
  }, [buckets])

  const counts = useMemo(() => {
    const map = {}
    for (const s of sections) map[s.id] = s.items.length
    return map
  }, [sections])

  const groupNameById = useMemo(() => {
    const map = { [UNGROUPED_ID]: '미분류' }
    for (const g of groups) map[g.id] = g.name
    return map
  }, [groups])

  const groupColorById = useMemo(() => {
    const map = { [UNGROUPED_ID]: NEUTRAL_COLOR }
    for (const g of groups) map[g.id] = g.color
    return map
  }, [groups])

  const activeSection =
    activeTab === ALL_TAB
      ? allSection
      : activeTab === DEBUT_TAB
        ? (debutSection ?? allSection)
        : (sections.find((s) => s.id === activeTab) ?? allSection)

  /** 지금 탭에 있는 꼬리표와 사람 수. 누르면 그 꼬리표가 붙은 사람만 남는다. */
  const tagCounts = useMemo(() => {
    const map = new Map()
    for (const c of activeSection?.items ?? []) {
      for (const t of tagsOf(c, labels[c.userId])) {
        const entry = map.get(t.id) ?? { ...t, count: 0 }
        entry.count += 1
        map.set(t.id, entry)
      }
    }
    // 자기소개 꼬리표는 SELF_TAGS 순서대로, 그 뒤에 크루를 사람 많은 순으로.
    const order = new Map(SELF_TAGS.map((t, i) => [t.id, i]))
    return [...map.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'self' ? -1 : 1
      if (a.kind === 'self') return order.get(a.id) - order.get(b.id)
      return b.count - a.count || a.name.localeCompare(b.name, 'ko')
    })
  }, [activeSection, labels])

  // 갱신 직전 순위를 찍어 두기 위해, 화면에 그려진 최신 결과를 항상 들고 있는다.
  useEffect(() => {
    renderRef.current = {
      allSection,
      sections: debutSection ? [...sections, debutSection] : sections,
    }
  })

  // 자동 갱신. 늘 켜져 있고 화면에는 따로 드러내지 않는다.
  // 탭이 뒤에 있을 때는 쉬게 해서 헛된 요청을 보내지 않는다. 어드민 창은 예외 —
  // 다른 일을 하는 동안에도 수정 알림이 와야 한다.
  const hasData = !!data
  useEffect(() => {
    if (!hasData) return
    const timer = setInterval(() => {
      if (watchEdits || !document.hidden) refreshRef.current?.()
    }, REFRESH_SEC * 1000)
    return () => clearInterval(timer)
  }, [hasData, watchEdits])

  // 지금 방송 중인 신청자(어드민 화면). 파일은 서버가 5분마다 갱신하므로 1분마다 읽으면 충분하다.
  useEffect(() => {
    if (!admin.route) return
    const ctrl = new AbortController()
    const load = () =>
      fetchLive({ signal: ctrl.signal })
        .then((d) => setLive(d ?? { live: [], updatedAt: null }))
        .catch(() => {})
    load()
    const timer = setInterval(load, 60 * 1000)
    return () => {
      ctrl.abort()
      clearInterval(timer)
    }
  }, [admin.route])

  /**
   * 새로 받은 댓글을 지난번 본문과 비교한다. 지난번은 이 창에서 마지막으로 본 것,
   * 없으면 이 브라우저에 남겨 둔 것이다. 둘 다 없는 첫 방문은 기준만 잡는다.
   */
  useEffect(() => {
    if (!watchEdits) return
    const found = []
    for (const post of [data, debut]) {
      if (!post?.postNo) continue
      const before = textsRef.current.get(post.postNo) ?? loadTexts(post.postNo)
      if (before) {
        for (const e of findEdits(before, post.comments)) {
          found.push({ ...e, postNo: post.postNo, debut: post === debut, at: Date.now() })
        }
      }
      textsRef.current.set(post.postNo, new Map(post.comments.map((c) => [String(c.id), c.text])))
      saveTexts(post.postNo, post.comments)
    }
    if (found.length === 0) return
    const key = (e) => `${e.postNo}:${e.id}`
    const fresh = new Set(found.map(key))
    setEdits((prev) => [...found, ...prev.filter((e) => !fresh.has(key(e)))])
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(`수정된 댓글 ${found.length}개`, {
          body: found.map((e) => e.nick).join(', '),
          tag: 'comment-edit',
        })
      } catch {
        // 알림을 못 띄워도 화면의 목록은 남는다.
      }
    }
  }, [data, debut, watchEdits])

  /**
   * 애청자 수는 댓글 API 에 없어서 사람마다 따로 묻는다. 갱신 때마다 200번씩 다시
   * 물을 수는 없으니, 아직 안 물어본 사람만 골라 낸다. 새로 댓글을 단 사람은
   * 다음 갱신에서 한 명분 요청으로 채워진다.
   */
  useEffect(() => {
    if (!data) return
    const missing = [...data.comments, ...(debut?.comments ?? [])]
      .map((c) => c.userId)
      .filter((id) => id && !fansAskedRef.current.has(id))
    if (missing.length === 0) return
    const asked = fansAskedRef.current
    for (const id of missing) asked.add(id)
    /** 아직 답을 못 받은 사람. 중간에 끊기면 다음 차례에 다시 묻도록 '물어봄'에서 뺀다. */
    const pending = new Set(missing)

    const controller = new AbortController()
    setFansLoading(true)
    loadFanCounts(missing, {
      signal: controller.signal,
      onUpdate: (partial) => {
        for (const id of partial.keys()) pending.delete(id)
        setFans((prev) => {
          const next = new Map(prev)
          for (const [id, info] of partial) next.set(id, info.n)
          return next
        })
      },
    })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setFansLoading(false)
      })
    return () => {
      controller.abort()
      for (const id of pending) asked.delete(id)
    }
  }, [data, debut])

  /**
   * 새 순위가 그려진 뒤, 직전 순위와 비교해 이동 기록을 갱신한다.
   * 움직이지 않은 줄은 예전 기록을 그대로 들고 있다가 MOVE_TTL_MS 가 지나면 놓는다.
   */
  useEffect(() => {
    if (!data) return
    const current = captureRanks()
    const previous = prevRanksRef.current
    prevRanksRef.current = current
    if (!previous) return

    const now = Date.now()
    setMoves((kept) => {
      const next = new Map()
      for (const [sectionId, ranks] of current) {
        const was = previous.get(sectionId)
        const keptHere = kept.get(sectionId) ?? new Map()
        const out = new Map()
        for (const [id, rankNow] of ranks) {
          const rankBefore = was?.get(id)
          if (rankBefore === undefined) {
            out.set(id, { delta: null, at: now })
          } else if (rankBefore !== rankNow) {
            out.set(id, { delta: rankBefore - rankNow, at: now })
          } else {
            const old = keptHere.get(id)
            if (old && now - old.at < MOVE_TTL_MS) out.set(id, old)
          }
        }
        next.set(sectionId, out)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // 순위가 바뀌면 줄이 새 자리로 미끄러진다. 갱신으로 바뀐 경우에만 건다.
  useFlipReorder(listRef, () => {
    const should = animateNextRef.current
    animateNextRef.current = false
    return should
  })

  /**
   * 직업별 인원. 대표 직업(처음 고른 직업)으로만 센다 — 직업을 여러 개 고른 사람을 칸마다
   * 세면 합이 신청자보다 커진다. also 는 대표는 아니지만 이 직업도 같이 고른 사람.
   */
  const classCounts = useMemo(
    () =>
      sections.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        total: s.items.filter((c) => c.groupId === s.id).length,
        also: s.items.filter((c) => c.groupId !== s.id).length,
      })),
    [sections],
  )
  const maxClassCount = Math.max(1, ...classCounts.map((s) => s.total))

  /**
   * 목록에는 애청자가 모자란 사람도 그대로 둔다. 숨기는 대신 줄에 lowFans(그 사람의 애청자 수)를
   * 달아 노란 배지를 붙인다. 순위도 그대로다. 직업별 인원과 닉네임 추출도 전부 센다.
   * 데뷔 글은 이제 막 데뷔하는 사람들이라 즐찾 1000 조건을 걸 대상이 아니다.
   */
  const cutItems = useMemo(() => {
    const items = activeSection?.items ?? []
    if (activeTab === DEBUT_TAB) return items
    return items.map((c) => {
      const count = fans.get(c.userId)
      return count != null && count < MIN_FANS_RULE ? { ...c, lowFans: count } : c
    })
  }, [activeSection, activeTab, fans])

  /**
   * 검색은 자르는 게 아니라 찾는 것이다. 여기서는 순위를 다시 매기지 않는다 —
   * 한 사람을 검색했다고 그 사람이 1등이 되면 곤란하다.
   */
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const tagged = tagFilter
      ? cutItems.filter((c) => tagsOf(c, labels[c.userId]).some((t) => t.id === tagFilter))
      : cutItems
    if (!q) return tagged
    return tagged.filter(
      (c) =>
        c.nick.toLowerCase().includes(q) ||
        c.userId.toLowerCase().includes(q) ||
        c.text.toLowerCase().includes(q),
    )
  }, [cutItems, query, tagFilter, labels])

  /** 이 탭에서 기준에 모자란 사람 수. 애청자 수를 모르는 사람은 모자란 쪽에 넣지 않는다. */
  const filterInfo = useMemo(() => {
    const items = activeSection?.items ?? []
    let low = 0
    let unknown = 0
    for (const c of items) {
      const count = fans.get(c.userId)
      if (count == null) unknown += 1
      else if (count < MIN_FANS_RULE) low += 1
    }
    return { total: items.length, low, unknown }
  }, [activeSection, fans])

  /**
   * 컷 위아래의 좋아요 차이. 검색으로 119등이 가려져 있어도 흔들리지 않게
   * 화면에 보이는 이웃이 아니라 컷 적용 후의 순위에서 직접 뽑는다.
   * 애청자로 걸러 낸 뒤라면 그 안에서의 119등이 기준이 된다.
   */
  const cutInfo = useMemo(() => {
    if (!CUT_RANK || cutItems.length <= CUT_RANK) return null
    const last = cutItems[CUT_RANK - 1]
    const next = cutItems[CUT_RANK]
    return { gap: last.likes - next.likes, likes: next.likes }
  }, [cutItems])

  /**
   * 닉네임 추출은 그룹이 있으면 그룹별로, 없으면 전체 하나로.
   * 미분류는 뽑을 대상이 아니라 남은 찌꺼기라 여기서 뺀다 (미분류 탭에서 확인).
   */
  const exportSections = useMemo(() => {
    const base = grouped
      ? sections.filter((s) => s.id !== UNGROUPED_ID)
      : allSection
        ? [allSection]
        : []
    return base.map((s) => ({ ...s, items: s.items }))
  }, [grouped, sections, allSection])

  async function load() {
    const parsed = TARGET_POST

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setLoading(true)
    setError('')
    setProgress({ done: 0, total: 1 })
    setMoves(new Map())
    prevRanksRef.current = null

    try {
      // 본문은 분류를 찾는 데만 쓴다. 애청자 공개 게시판처럼 본문만 막힌 글도 있는데
      // (댓글은 누구나 읽힌다) 그때 전체를 실패시키면 정작 필요한 걸 못 보게 된다.
      let post = { title: '', html: '', error: '' }
      try {
        post = {
          ...(await fetchPost(parsed.bjId, parsed.postNo, { signal })),
          error: '',
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.kind === 'notfound') throw err
        post = { title: '', html: '', error: err.message }
      }

      const result = await fetchAllComments(parsed.bjId, parsed.postNo, {
        signal,
        postConfirmed: !post.error,
        onProgress: (done, total) => setProgress({ done, total }),
      })

      setData({
        ...result,
        title: post.title,
        postError: post.error,
      })
      loadDebut(signal)
      setActiveTab(ALL_TAB)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || '댓글을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  /**
   * 데뷔 글과 어드민 라벨은 곁가지라, 실패해도 오류를 띄우지 않는다.
   * 데뷔 글이 안 오면 탭만 안 그리고, 라벨이 안 오면 자동 판정 그대로 보인다.
   * 라벨도 갱신마다 같이 읽는다 — 어드민이 고친 게 열어 둔 화면에도 따라오게.
   */
  function loadDebut(signal) {
    fetchLabels({ signal })
      .then(setLabels)
      .catch(() => {})
    if (!DEBUT_BOARD) return
    const exclude = new Set(DEBUT_BOARD.exclude ?? [])
    fetchDebut({ signal })
      .then((d) => d && setDebut({ ...d, comments: d.comments.filter((c) => !exclude.has(c.userId)) }))
      .catch(() => {})
  }

  /** 지금 화면에 그려진 순위를 분류별로 찍어 둔다. 갱신 후 변동을 계산하는 기준. */
  function captureRanks() {
    const snapshot = new Map()
    const add = (section) => {
      if (section) snapshot.set(section.id, new Map(section.items.map((i) => [i.id, i.rank])))
    }
    add(renderRef.current.allSection)
    renderRef.current.sections.forEach(add)
    return snapshot
  }

  /**
   * 댓글만 다시 가져온다. 본문은 다시 읽지 않는다 — 분류는 그대로고,
   * 갱신할 때마다 요청을 두 배로 늘릴 이유가 없다.
   */
  async function refreshComments() {
    if (!data || loading) return
    try {
      const fresh = await fetchAllComments(data.bjId, data.postNo, {
        postConfirmed: !data.postError,
      })
      loadDebut()
      animateNextRef.current = true
      setData((prev) => (prev ? { ...prev, ...fresh } : prev))
      setError('')
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || '갱신하지 못했습니다.')
    }
  }

  refreshRef.current = refreshComments
  loadRef.current = load

  // 매 렌더마다 새 함수를 만들면 아래 CommentCard 의 memo 가 아무 일도 못 한다.
  const { getToken } = admin
  const saveLabelFor = useCallback(
    async (userId, label) => {
      await saveLabel(userId, label, await getToken())
      setLabels((prev) => {
        const next = { ...prev }
        if (label) next[userId] = label
        else delete next[userId]
        return next
      })
    },
    // getToken 은 렌더마다 새로 만들어지지만 하는 일은 같다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const isEditing = watchEdits

  /** 알림에서 고른 댓글을 목록에서 펼친다. 필터에 가려 있으면 안 보이니 검색·꼬리표는 푼다. */
  const openEdit = (e) => {
    setActiveTab(e.debut ? DEBUT_TAB : ALL_TAB)
    setTagFilter(null)
    setQuery('')
    setSelectedId(e.id)
  }
  const dismissEdit = (e) =>
    setEdits((prev) => prev.filter((x) => !(x.postNo === e.postNo && x.id === e.id)))

  // 전체·데뷔 탭에서는 줄마다 그 사람의 직업 색을, 직업 탭에서는 탭의 색을 쓴다.
  const mixedTab = activeTab === ALL_TAB || activeTab === DEBUT_TAB
  const colorOf = (comment) =>
    mixedTab ? (groupColorById[comment.groupId] ?? NEUTRAL_COLOR) : activeSection.color
  // 옆자리가 있는 넓은 화면에서는 아무도 안 골랐을 때 맨 위 사람을 보여 준다. 빈 패널은 자리만 차지한다.
  const selected =
    (selectedId && visibleItems.find((c) => c.id === selectedId)) ||
    (wide ? (visibleItems[0] ?? null) : null)

  return (
    <div className="app">
      {BANNER ? (
        BANNER.href ? (
          <a
            className="ad-banner"
            href={safeUrl(BANNER.href) || undefined}
            target="_blank"
            rel={BANNER.ad ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
          >
            <img src={safeUrl(BANNER.image)} alt={BANNER.alt ?? ''} />
            {BANNER.ad && <span className="ad-tag">광고</span>}
          </a>
        ) : (
          <div className="ad-banner">
            <img src={safeUrl(BANNER.image)} alt={BANNER.alt ?? ''} />
            {BANNER.ad && <span className="ad-tag">광고</span>}
          </div>
        )
      ) : (
        admin.route && (
          <div className="ad-banner ad-empty">
            광고 배너 자리 · 960×300 · <code>src/lib/banner.js</code> 에 이미지와 주소를 적으면 여기에 뜹니다
            (일반 방문자에게는 비어 있는 동안 보이지 않습니다)
          </div>
        )
      )}
      <header className="topbar">
        <div className="brand">
          <div>
            <span className="kicker">WORLD OF WARCRAFT · FOREVER</span>
            <h1>와우 포에버 · 우왁굳 길드 사전 신청</h1>
            <p>
              신청 댓글을 해보려는 직업별로 나눠 좋아요 순으로 세웁니다. 신청 조건이 SOOP 버튜버 ·
              즐찾 {MIN_FANS_RULE.toLocaleString()}명 이상이라, 모자란 사람은 노란 배지로 표시해 둡니다.
            </p>
          </div>
        </div>

        {admin.route && (
          <div className="adminbar">
            <strong>어드민</strong>
            {!admin.configured ? (
              <span className="muted">
                Firebase 설정(VITE_FIREBASE_API_KEY · VITE_FIREBASE_AUTH_DOMAIN · VITE_RTDB_URL)이
                없어 로그인할 수 없습니다.
              </span>
            ) : admin.user ? (
              <>
                <span className="muted">
                  {admin.user.email} · uid <code>{admin.user.uid}</code>
                </span>
                <span className="muted">카드를 펼치면 라벨을 고칠 수 있습니다.</span>
                <span className="spacer" />
                <button type="button" className="ghost" onClick={() => admin.signOut()}>
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <span className="muted">라벨을 고치려면 로그인하세요.</span>
                <span className="spacer" />
                <button
                  type="button"
                  className="primary"
                  onClick={() => admin.signIn().catch((e) => setError(e.message))}
                >
                  Google 로그인
                </button>
              </>
            )}
          </div>
        )}

        {admin.route && live && (
          <details className="live-panel" open>
            <summary>
              <strong>지금 방송 중 {live.live.length}명</strong>
              <span className="muted">
                {live.updatedAt
                  ? `${new Date(live.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준 · 시청자 순`
                  : '아직 집계 전'}
              </span>
            </summary>
            <div className="live-grid">
              {live.live.map((l) => (
                <a
                  className="live-card"
                  key={l.userId}
                  href={`https://play.sooplive.com/${encodeURIComponent(l.userId)}/${encodeURIComponent(l.broadNo)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="live-thumb-wrap">
                    <img
                      className="live-thumb"
                      src={`https://liveimg.sooplive.com/m/${encodeURIComponent(l.broadNo)}?t=${encodeURIComponent(live.updatedAt ?? '')}`}
                      alt=""
                    />
                    <span className="live-viewers">{l.viewers.toLocaleString()}</span>
                  </span>
                  <span className="live-nick">{l.nick}</span>
                  <span className="live-title muted">{l.title}</span>
                </a>
              ))}
            </div>
          </details>
        )}

        {watchEdits && (
          <div className="edit-alerts">
            <div className="edit-alerts-head">
              <strong>수정된 댓글 {edits.length}</strong>
              <span className="muted">{REFRESH_SEC / 60}분마다 본문을 비교합니다.</span>
              <span className="spacer" />
              {notifyPerm === 'default' && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => Notification.requestPermission().then(setNotifyPerm)}
                >
                  브라우저 알림 켜기
                </button>
              )}
              {edits.length > 0 && (
                <button type="button" className="ghost" onClick={() => setEdits([])}>
                  모두 지우기
                </button>
              )}
            </div>
            {edits.map((e) => (
              <div className="edit-item" key={`${e.postNo}:${e.id}`}>
                <div className="edit-item-head">
                  <button type="button" className="edit-nick" onClick={() => openEdit(e)}>
                    {e.nick}
                  </button>
                  <span className="muted">
                    {new Date(e.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    {e.debut ? ' · 데뷔 글' : ''}
                  </span>
                  <span className="spacer" />
                  <button type="button" className="ghost" onClick={() => dismissEdit(e)}>
                    지우기
                  </button>
                </div>
                <div className="edit-diff">
                  <p className="edit-before">{e.before}</p>
                  <p className="edit-after">{e.after}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {progress && (
          <div className="progress">
            <div
              className="progress-bar"
              style={{
                width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`,
              }}
            />
            <span>
              {progress.done} / {progress.total} 페이지
            </span>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </header>

      {data && (
        <>
          <section className="summary">
            <div className="stat">
              <strong>{data.comments.length.toLocaleString()}</strong>
              <span>원댓글</span>
            </div>
            <div className="stat">
              <strong>{data.totalWithReplies.toLocaleString()}</strong>
              <span>답글 포함</span>
            </div>
            {grouped && (
              <div className="stat">
                <strong>{counts[UNGROUPED_ID] ?? 0}</strong>
                <span>미분류</span>
              </div>
            )}
            <span className="spacer" />
            <a
              className="post-link"
              href={postUrl(data.bjId, data.postNo)}
              target="_blank"
              rel="noreferrer noopener"
              title={data.title}
            >
              원문 보기 ↗
            </a>
            <button
              type="button"
              className={exportOpen ? 'primary' : 'ghost'}
              onClick={() => setExportOpen((v) => !v)}
              aria-expanded={exportOpen}
            >
              닉네임 추출 {exportOpen ? '닫기' : ''}
            </button>
          </section>

          {exportOpen && exportSections.length > 0 && <NicknameExport sections={exportSections} />}

          {/* 직업별 인원. 애청자 하한을 넘긴 사람 수가 크게, 신청한 전체는 옆에 작게. */}
          {grouped && (
            <section className="class-counts" aria-label="직업별 인원">
              <h2>
                직업별 인원
                <span className="cc-legend">
                  전체 신청 · 대표 직업 기준
                </span>
              </h2>
              <ul>
                {classCounts.map((s) => (
                  <li key={s.id} style={{ '--group': s.color }}>
                    <button
                      type="button"
                      className={activeTab === s.id ? 'on' : ''}
                      onClick={() => setActiveTab(s.id)}
                      title={`${s.name} 보기`}
                    >
                      <span className="cc-name">
                        <span className="dot" aria-hidden="true" />
                        {s.name}
                      </span>
                      <span className="cc-num">
                        <strong>{s.total}</strong>
                      </span>
                      <span className="cc-bar" aria-hidden="true">
                        <span style={{ width: `${(s.total / maxClassCount) * 100}%` }} />
                      </span>
                      {s.also > 0 && (
                        <span
                          className="cc-also"
                          title={`대표 직업은 따로 있고 ${s.name}도 같이 고민 중인 사람`}
                        >
                          +{s.also} 고민 중
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <nav className="tabs">
            {grouped && (
              <>
                <button
                  type="button"
                  className={activeTab === ALL_TAB ? 'active' : ''}
                  onClick={() => setActiveTab(ALL_TAB)}
                  style={{ '--group': NEUTRAL_COLOR }}
                >
                  전체
                </button>
                {sections.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={activeTab === s.id ? 'active' : ''}
                    onClick={() => setActiveTab(s.id)}
                    style={{ '--group': s.color }}
                  >
                    {s.name}
                  </button>
                ))}
              </>
            )}
          </nav>

          {/* 거르는 도구는 한 판에 모은다. 탭(무엇을 볼지)과 섞이면 둘 다 읽기 어렵다. */}
          <section className="filters">
            <div className="filter-row">
              <input
                className="search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="닉네임 · 내용 검색"
              />
              <span
                className="fanfilter-note"
                title="기준에 모자란 사람도 숨기지 않고 노란 배지로 표시합니다"
              >
                {fansLoading
                  ? '애청자 수 불러오는 중…'
                  : `즐찾 ${MIN_FANS_RULE.toLocaleString()}명 미만 ${filterInfo.low}명` +
                    (filterInfo.unknown > 0 ? ` · 미확인 ${filterInfo.unknown}명` : '')}
              </span>
            </div>

          {(tagCounts.length > 0 || debutSection) && (
            <div className="tagbar">
              <span
                className="tagbar-label"
                title="댓글에 본인이 적은 말에서 뽑았습니다. 확인된 사실이 아닙니다."
              >
                자기소개
              </span>
              {/* 데뷔 글은 다른 글이라 꼬리표가 아니라 목록 자체를 바꾼다. 다시 누르면 전체로. */}
              {debutSection && (
                <button
                  type="button"
                  className={`tag tag-debut${activeTab === DEBUT_TAB ? ' active' : ''}`}
                  title="「리얼 뉴 와튜버 데뷔 하기」 글에 댓글을 단 사람"
                  onClick={() => setActiveTab((v) => (v === DEBUT_TAB ? ALL_TAB : DEBUT_TAB))}
                >
                  뉴 와튜버 데뷔 <em>{debutSection.items.length}</em>
                </button>
              )}
              {tagCounts.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`tag tag-${t.look}${tagFilter === t.id ? ' active' : ''}`}
                  title={t.hint}
                  onClick={() => setTagFilter((v) => (v === t.id ? null : t.id))}
                >
                  {t.name} <em>{t.count}</em>
                </button>
              ))}
            </div>
          )}
          </section>

          <div className={`board${selected ? ' has-selection' : ''}`}>
            <main className="list" ref={listRef}>
              {visibleItems.length === 0 && <p className="empty">표시할 댓글이 없습니다.</p>}

              {visibleItems.map((comment, index) => {
                const prev = visibleItems[index - 1]
                const crossesCut =
                  CUT_RANK && prev && prev.rank <= CUT_RANK && comment.rank > CUT_RANK
                // 컷 바로 위아래의 좋아요 차이. 지금 몇 개 차이로 갈리는지가
                // 이 선을 보는 사람이 실제로 알고 싶은 숫자다.
                const cutGap = cutInfo?.gap ?? 0
                return (
                  <div key={comment.id}>
                    {crossesCut && (
                      <div className="cutline">
                        <span className="cutline-label">{CUT_RANK}위 컷</span>
                        {cutInfo && cutGap === 0 ? (
                          // 동점이면 컷이 좋아요로 갈린 게 아니라 작성 시각으로 갈린 것이다.
                          // "0개 차이"로 적으면 그 사실이 묻힌다.
                          <span className="cutline-gap is-tie">
                            동점 ♥{cutInfo.likes.toLocaleString()} — 작성 순서로 갈림
                          </span>
                        ) : (
                          <span className="cutline-gap">♥{cutGap.toLocaleString()}개 차이</span>
                        )}
                      </div>
                    )}
                    <CommentCard
                      comment={comment}
                      move={moves.get(activeSection.id)?.get(comment.id)}
                      hasSnapshot={!!prevRanksRef.current}
                      color={colorOf(comment)}
                      groupName={groupNameById[comment.groupId]}
                      selected={comment.id === selected?.id}
                      onSelect={setSelectedId}
                    />
                  </div>
                )
              })}
            </main>

            <CommentDetail
              comment={selected}
              bjId={data.bjId}
              postNo={selected?.postNo ?? data.postNo}
              color={selected ? colorOf(selected) : undefined}
              groupName={selected ? groupNameById[selected.groupId] : undefined}
              label={selected ? labels[selected.userId] : undefined}
              admin={isEditing}
              onSaveLabel={saveLabelFor}
              fanCount={selected ? fans.get(selected.userId) : undefined}
              alsoDebut={!!selected && activeTab !== DEBUT_TAB && debutUserIds.has(selected.userId)}
              onClose={closeDetail}
            />
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <p className="placeholder">댓글을 불러오는 중입니다…</p>
      )}
    </div>
  )
}
