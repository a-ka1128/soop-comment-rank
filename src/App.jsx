import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GroupPanel from './components/GroupPanel'
import NicknameExport from './components/NicknameExport'
import CommentCard from './components/CommentCard'
import PersonChart from './components/PersonChart'
import { fetchAllComments, fetchPost, postUrl } from './lib/soop'
import { buildGroups, detectCategories } from './lib/categories'
import { FAN_MAX, FAN_STEP, loadFanCounts } from './lib/fans'
import { UNGROUPED_ID, classify, rank, validateGrouping } from './lib/groups'
import { CUT_RANK, TARGET_POST } from './lib/target'
import { FROZEN_ROSTER, ROSTER_BY_ID } from './lib/roster'
import { useFlipReorder } from './hooks/useFlipReorder'
import './App.css'

const overrideKey = (bjId, postNo) => `soopcomment.overrides.${bjId}.${postNo}`

const ALL_TAB = '__all__'
// 특정 분류에 속하지 않는 줄(전체·미분류)의 색. 순위 숫자에 그대로 쓰이므로
// 어두운 바탕에서 충분히 읽혀야 한다.
const NEUTRAL_COLOR = '#a39a7a'
// 실측: 이런 신청 글은 45초 사이 상위 30개 중 32개의 좋아요가 움직인다.
// 10초면 순위 변동이 눈에 보이면서 요청도 과하지 않다.
const REFRESH_SEC = 10
// 순위 변동 표시를 얼마나 붙들어 둘지. 10초마다 새로 그리면 화살표가 깜빡이고 지나가
// 무엇이 움직였는지 볼 틈이 없다. 다시 움직이지 않으면 이 시간까지 남긴다.
const MOVE_TTL_MS = 5 * 60 * 1000

/** 명단이 확정됐는지. 확정되면 좋아요가 아니라 명단이 순서를 정한다. */
const FROZEN = FROZEN_ROSTER.length > 0

/**
 * 확정된 명단의 순서를 입힌다. 명단에 없는 사람은 빠지고, 순위는 굳은 값을 쓴다.
 *
 * fillMissing 은 전체 목록에만 쓴다 — 댓글이 지워져도 뽑힌 사람이 명단에서
 * 사라지면 안 되므로, 그 자리는 굳힐 때 적어 둔 값으로 채운다.
 */
function applyRoster(items, { fillMissing = false } = {}) {
  const live = new Map(items.map((c) => [c.id, c]))
  if (fillMissing) {
    return FROZEN_ROSTER.map((entry) => {
      const found = live.get(entry.id)
      if (found) return { ...found, rank: entry.rank }
      return {
        id: entry.id,
        userId: entry.userId,
        nick: entry.nick,
        likes: entry.likes,
        rank: entry.rank,
        text: '',
        date: '',
        profile: '',
        replyCount: 0,
        photo: '',
      }
    })
  }
  return items
    .filter((c) => ROSTER_BY_ID.has(c.id))
    .map((c) => ({ ...c, rank: ROSTER_BY_ID.get(c.id).rank }))
    .sort((a, b) => a.rank - b.rank)
}

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [data, setData] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState(ALL_TAB)
  const [query, setQuery] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  const [personOpen, setPersonOpen] = useState(false)

  /** userId -> 애청자 수. null 은 '알 수 없음'이고, 그 사람은 걸러 내지 않는다. */
  const [fans, setFans] = useState(() => new Map())
  const [fansLoading, setFansLoading] = useState(false)
  const [minFans, setMinFans] = useState(0)
  /** 실제로 목록에 적용된 하한. 손잡이를 놓거나 잠깐 멈췄을 때 따라온다. */
  const [appliedMinFans, setAppliedMinFans] = useState(0)

  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)
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
  /** 이미 물어본 userId. 10초마다 갱신될 때 같은 사람을 다시 묻지 않기 위한 것. */
  const fansAskedRef = useRef(new Set())

  useEffect(() => {
    if (!data) return
    localStorage.setItem(overrideKey(data.bjId, data.postNo), JSON.stringify(overrides))
  }, [overrides, data])

  // 다룰 글이 하나로 정해져 있으므로 열자마자 불러온다.
  useEffect(() => {
    loadRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 본문에서 뽑은 후보 그룹과, 그게 실제 댓글에 들어맞는지에 대한 판정. */
  const detection = useMemo(() => {
    if (!data) return null
    const candidates = buildGroups(data.categories)
    return { candidates, check: validateGrouping(data.comments, candidates) }
  }, [data])

  const groups = useMemo(() => (detection?.check.ok ? detection.candidates : []), [detection])
  const grouped = groups.length > 0

  const buckets = useMemo(
    () => (data ? classify(data.comments, groups, overrides) : null),
    [data, groups, overrides],
  )

  /** 그룹 탭들. 그룹이 하나도 없으면 빈 배열이고 전체 탭만 남는다. */
  const sections = useMemo(() => {
    if (!buckets || !grouped) return []
    const list = groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      topN: g.topN,
      items: FROZEN ? applyRoster(buckets.get(g.id) ?? []) : rank(buckets.get(g.id) ?? []),
    }))
    const ungrouped = buckets.get(UNGROUPED_ID) ?? []
    if (ungrouped.length > 0) {
      list.push({
        id: UNGROUPED_ID,
        name: '미분류',
        color: NEUTRAL_COLOR,
        topN: null,
        items: FROZEN ? applyRoster(ungrouped) : rank(ungrouped),
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
      items: FROZEN
        ? applyRoster([...buckets.values()].flat(), { fillMissing: true })
        : rank([...buckets.values()].flat()),
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
    activeTab === ALL_TAB ? allSection : (sections.find((s) => s.id === activeTab) ?? allSection)

  // 갱신 직전 순위를 찍어 두기 위해, 화면에 그려진 최신 결과를 항상 들고 있는다.
  useEffect(() => {
    renderRef.current = { allSection, sections }
  })

  // 자동 갱신. 탭이 뒤에 있을 때는 쉬게 해서 헛된 요청을 보내지 않는다.
  useEffect(() => {
    if (!autoRefresh || !data) return
    const timer = setInterval(() => {
      if (!document.hidden) refreshRef.current?.()
    }, REFRESH_SEC * 1000)
    return () => clearInterval(timer)
  }, [autoRefresh, data])

  /**
   * 손잡이를 끄는 동안 목록을 매번 다시 세우면, 줄이 사라질 때마다 아래 줄이
   * 위로 올라붙어 화면이 덜그럭거린다. 특히 5만 근처는 한 번 움직일 때마다
   * 수십 명이 빠져서 더 심하다. 손이 잠깐 멈춘 뒤에 한 번만 반영한다.
   */
  useEffect(() => {
    const timer = setTimeout(() => setAppliedMinFans(minFans), 140)
    return () => clearTimeout(timer)
  }, [minFans])

  /**
   * 애청자 수는 댓글 API 에 없어서 사람마다 따로 묻는다. 갱신 때마다 200번씩 다시
   * 물을 수는 없으니, 아직 안 물어본 사람만 골라 낸다. 새로 댓글을 단 사람은
   * 다음 갱신에서 한 명분 요청으로 채워진다.
   */
  useEffect(() => {
    if (!data) return
    const missing = data.comments
      .map((c) => c.userId)
      .filter((id) => id && !fansAskedRef.current.has(id))
    if (missing.length === 0) return
    for (const id of missing) fansAskedRef.current.add(id)

    const controller = new AbortController()
    setFansLoading(true)
    loadFanCounts(missing, {
      signal: controller.signal,
      onUpdate: (partial) =>
        setFans((prev) => {
          const next = new Map(prev)
          for (const [id, n] of partial) next.set(id, n)
          return next
        }),
    })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setFansLoading(false)
      })
    return () => controller.abort()
  }, [data])

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
   * 애청자 수로 자르고 남은 사람들. 자른 뒤에는 순위를 다시 매긴다 —
   * 이 조건에서 뽑는다면 남은 사람들이 곧 1등부터이기 때문이다.
   * 목록과 닉네임 추출이 같은 함수를 쓴다. 화면에서 자른 사람이 추출에는 남아
   * 있으면, 어느 쪽이 맞는지 알 수 없는 명단이 나온다.
   */
  const applyCut = useCallback(
    (items) => {
      if (appliedMinFans === 0) return items
      return items
        .filter((c) => {
          const count = fans.get(c.userId)
          // 아직 못 받았거나 방송국이 없는 사람은 숨기지 않는다. 자료가 없다는 이유로
          // 사람을 지우면, 방금 댓글을 단 사람이 조용히 사라진다.
          return count == null || count >= appliedMinFans
        })
        // 명단이 확정된 뒤에는 걸러도 번호를 다시 매기지 않는다. 그 번호가 결과다.
        .map((c, i) => (FROZEN ? c : { ...c, rank: i + 1 }))
    },
    [fans, appliedMinFans],
  )

  const cutItems = useMemo(
    () => applyCut(activeSection?.items ?? []),
    [applyCut, activeSection],
  )

  /**
   * 검색은 자르는 게 아니라 찾는 것이다. 여기서는 순위를 다시 매기지 않는다 —
   * 한 사람을 검색했다고 그 사람이 1등이 되면 곤란하다.
   */
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cutItems
    return cutItems.filter(
      (c) =>
        c.nick.toLowerCase().includes(q) ||
        c.userId.toLowerCase().includes(q) ||
        c.text.toLowerCase().includes(q),
    )
  }, [cutItems, query])

  /**
   * 손잡이가 설 자리. 눈금 위에만 선다. 숫자 칸에 눈금 사이 값을 적으면 손잡이는
   * 가장 가까운 눈금에 놓이지만, 거르는 기준은 적어 넣은 수 그대로다.
   */
  const handlePos = Math.round(Math.min(minFans, FAN_MAX) / FAN_STEP) * FAN_STEP

  /** 이 조건에서 몇 명이 남는지. 애청자 수를 모르는 사람은 남는 쪽에 넣는다(숨기지 않으므로). */
  const filterInfo = useMemo(() => {
    const items = activeSection?.items ?? []
    let remaining = 0
    let unknown = 0
    for (const c of items) {
      const count = fans.get(c.userId)
      if (count == null) {
        unknown += 1
        remaining += 1
      } else if (count >= appliedMinFans) {
        remaining += 1
      }
    }
    return { remaining, unknown }
  }, [activeSection, fans, appliedMinFans])

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
    return base.map((s) => ({ ...s, items: applyCut(s.items) }))
  }, [grouped, sections, allSection, applyCut])

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
    setRefreshedAt(null)

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

      setOverrides(loadStored(overrideKey(parsed.bjId, parsed.postNo), {}) ?? {})
      setData({
        ...result,
        title: post.title,
        postError: post.error,
        categories: detectCategories(post.html),
      })
      setActiveTab(ALL_TAB)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || '댓글을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
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
      animateNextRef.current = true
      setData((prev) => (prev ? { ...prev, ...fresh } : prev))
      setRefreshedAt(new Date())
      setError('')
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || '갱신하지 못했습니다.')
    }
  }

  refreshRef.current = refreshComments
  loadRef.current = load

  // 매 렌더마다 새 함수를 만들면 아래 CommentCard 의 memo 가 아무 일도 못 한다.
  const assign = useCallback((commentId, groupId) => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (groupId) next[commentId] = groupId
      else delete next[commentId]
      return next
    })
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="./logo.png" alt="" width="48" height="48" />
          <div>
            <h1>아르마3 랜덤고지전3 좋아요 랭킹</h1>
            <p>
              {FROZEN
                ? '선발이 끝났습니다. 순위는 확정된 명단 그대로이며 더 이상 바뀌지 않습니다.'
                : '게시글 댓글을 좋아요 순으로 세우고, 개인별 증가량을 기록합니다.'}
            </p>
          </div>
        </div>

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
              <strong>
                {(FROZEN ? FROZEN_ROSTER.length : data.comments.length).toLocaleString()}
              </strong>
              <span>{FROZEN ? '확정 명단' : '원댓글'}</span>
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
              className="ghost"
              onClick={() => refreshComments()}
              disabled={loading}
            >
              새로고침
            </button>
            <label className="live">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              실시간 {REFRESH_SEC}초
            </label>
            {refreshedAt && (
              <span className="muted">{refreshedAt.toTimeString().slice(0, 8)} 갱신</span>
            )}
            {Object.keys(overrides).length > 0 && (
              <button type="button" className="ghost" onClick={() => setOverrides({})}>
                수동 지정 {Object.keys(overrides).length}건 초기화
              </button>
            )}
            <button
              type="button"
              className={personOpen ? 'primary' : 'ghost'}
              onClick={() => setPersonOpen((v) => !v)}
              aria-expanded={personOpen}
            >
              개인 증가량 그래프 {personOpen ? '닫기' : ''}
            </button>
            <button
              type="button"
              className={exportOpen ? 'primary' : 'ghost'}
              onClick={() => setExportOpen((v) => !v)}
              aria-expanded={exportOpen}
            >
              닉네임 추출 {exportOpen ? '닫기' : ''}
            </button>
          </section>

          {personOpen && (
            <PersonChart
              bjId={data.bjId}
              postNo={data.postNo}
              candidates={activeSection?.items ?? []}
            />
          )}

          {exportOpen && exportSections.length > 0 && <NicknameExport sections={exportSections} />}

          {grouped && <GroupPanel groups={groups} counts={counts} />}

          <nav className="tabs">
            {grouped && (
              <>
                <button
                  type="button"
                  className={activeTab === ALL_TAB ? 'active' : ''}
                  onClick={() => setActiveTab(ALL_TAB)}
                  style={{ '--group': NEUTRAL_COLOR }}
                >
                  전체 <em>{data.comments.length}</em>
                </button>
                {sections.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={activeTab === s.id ? 'active' : ''}
                    onClick={() => setActiveTab(s.id)}
                    style={{ '--group': s.color }}
                  >
                    {s.name} <em>{s.items.length}</em>
                  </button>
                ))}
              </>
            )}
            <span className="spacer" />
            <label className="fanfilter">
              <span className="fanfilter-label">애청자</span>
              <input
                type="range"
                min="0"
                max={FAN_MAX}
                step={FAN_STEP}
                value={handlePos}
                onChange={(e) => setMinFans(Number(e.target.value))}
                disabled={fans.size === 0}
                style={{ '--fill': `${(handlePos / FAN_MAX) * 100}%` }}
                aria-label="애청자 수 하한"
              />
              {/* 슬라이더로는 정확히 1,000 같은 수에 세우기 어렵다. 직접 적을 수도 있게 둔다. */}
              <input
                className="fanfilter-num"
                type="number"
                min="0"
                step={FAN_STEP}
                value={minFans}
                onChange={(e) => setMinFans(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                aria-label="애청자 수 하한 직접 입력"
              />
              <span className="fanfilter-unit">명 이상</span>
              <span className="fanfilter-note">
                {fansLoading
                  ? '불러오는 중…'
                  : `${filterInfo.remaining}명 남음` +
                    (appliedMinFans > 0 && filterInfo.unknown > 0
                      ? ` · 미확인 ${filterInfo.unknown}명 포함`
                      : '')}
              </span>
            </label>
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="닉네임 · 내용 검색"
            />
          </nav>

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
                    bjId={data.bjId}
                    postNo={data.postNo}
                    move={moves.get(activeSection.id)?.get(comment.id)}
                    hasSnapshot={!!prevRanksRef.current}
                    color={
                      activeTab === ALL_TAB
                        ? (groupColorById[comment.groupId] ?? NEUTRAL_COLOR)
                        : activeSection.color
                    }
                    showGroupName={grouped && activeTab === ALL_TAB}
                    groupName={groupNameById[comment.groupId]}
                    groups={groups}
                    onAssign={assign}
                  />
                </div>
              )
            })}
          </main>
        </>
      )}

      {!data && !loading && !error && (
        <p className="placeholder">댓글을 불러오는 중입니다…</p>
      )}
    </div>
  )
}
