import { useEffect, useMemo, useRef, useState } from 'react'
import GroupPanel from './components/GroupPanel'
import NicknameExport from './components/NicknameExport'
import CommentCard from './components/CommentCard'
import PersonChart from './components/PersonChart'
import { fetchAllComments, fetchPost, parsePostUrl, postUrl } from './lib/soop'
import { buildGroups, detectCategories } from './lib/categories'
import { UNGROUPED_ID, classify, rank, validateGrouping } from './lib/groups'
import { SAMPLE_POST } from './lib/sample'
import { useFlipReorder } from './hooks/useFlipReorder'
import './App.css'

const STORE_URL = 'soopcomment.lastUrl'
const SAMPLE_URL = SAMPLE_POST.url
const overrideKey = (bjId, postNo) => `soopcomment.overrides.${bjId}.${postNo}`

const ALL_TAB = '__all__'
// 특정 분류에 속하지 않는 줄(전체·미분류)의 색. 순위 숫자에 그대로 쓰이므로
// 어두운 바탕에서 충분히 읽혀야 한다.
const NEUTRAL_COLOR = '#a39a7a'
// 실측: 이런 신청 글은 45초 사이 상위 30개 중 32개의 좋아요가 움직인다.
// 10초면 순위 변동이 눈에 보이면서 요청도 과하지 않다.
const REFRESH_SEC = 10


function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [urlInput, setUrlInput] = useState(() => localStorage.getItem(STORE_URL) || '')

  const [data, setData] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState(ALL_TAB)
  const [query, setQuery] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  const [personOpen, setPersonOpen] = useState(false)

  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)
  // 직전 갱신 시점의 순위. 분류별로 따로 담아야 탭을 옮겨도 맞는 변동이 보인다.
  const [prevRanks, setPrevRanks] = useState(null)

  const abortRef = useRef(null)
  const refreshRef = useRef(null)
  const renderRef = useRef({ allSection: null, sections: [] })
  const listRef = useRef(null)
  const animateNextRef = useRef(false)

  useEffect(() => {
    if (!data) return
    localStorage.setItem(overrideKey(data.bjId, data.postNo), JSON.stringify(overrides))
  }, [overrides, data])

  /** 본문에서 뽑은 후보 그룹과, 그게 실제 댓글에 들어맞는지에 대한 판정. */
  const detection = useMemo(() => {
    if (!data) return null
    const candidates = buildGroups(data.categories)
    return { candidates, check: validateGrouping(data.comments, candidates) }
  }, [data])

  const groups = useMemo(
    () => (detection?.check.ok ? detection.candidates : []),
    [detection]
  )
  const grouped = groups.length > 0

  const buckets = useMemo(
    () => (data ? classify(data.comments, groups, overrides) : null),
    [data, groups, overrides]
  )

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
      items: rank([...buckets.values()].flat()),
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
    activeTab === ALL_TAB ? allSection : sections.find((s) => s.id === activeTab) ?? allSection

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

  // 순위가 바뀌면 줄이 새 자리로 미끄러진다. 갱신으로 바뀐 경우에만 건다.
  useFlipReorder(listRef, () => {
    const should = animateNextRef.current
    animateNextRef.current = false
    return should
  })

  const visibleItems = useMemo(() => {
    if (!activeSection) return []
    const q = query.trim().toLowerCase()
    if (!q) return activeSection.items
    return activeSection.items.filter(
      (c) =>
        c.nick.toLowerCase().includes(q) ||
        c.userId.toLowerCase().includes(q) ||
        c.text.toLowerCase().includes(q)
    )
  }, [activeSection, query])

  /**
   * 닉네임 추출은 그룹이 있으면 그룹별로, 없으면 전체 하나로.
   * 미분류는 뽑을 대상이 아니라 남은 찌꺼기라 여기서 뺀다 (미분류 탭에서 확인).
   */
  const exportSections = grouped
    ? sections.filter((s) => s.id !== UNGROUPED_ID)
    : allSection
      ? [allSection]
      : []

  async function load(rawInput) {
    const parsed = parsePostUrl(rawInput)
    if (!parsed) {
      setError(
        '게시글 주소를 인식하지 못했습니다. 예: https://www.sooplive.com/station/ecvhao/post/203249055'
      )
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setLoading(true)
    setError('')
    setProgress({ done: 0, total: 1 })
    setPrevRanks(null)
    setRefreshedAt(null)
    localStorage.setItem(STORE_URL, rawInput)

    try {
      // 본문은 분류를 찾는 데만 쓴다. 애청자 공개 게시판처럼 본문만 막힌 글도 있는데
      // (댓글은 누구나 읽힌다) 그때 전체를 실패시키면 정작 필요한 걸 못 보게 된다.
      let post = { title: '', html: '', error: '' }
      try {
        post = { ...(await fetchPost(parsed.bjId, parsed.postNo, { signal })), error: '' }
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
      const fresh = await fetchAllComments(data.bjId, data.postNo, { postConfirmed: !data.postError })
      animateNextRef.current = true
      setPrevRanks(captureRanks())
      setData((prev) => (prev ? { ...prev, ...fresh } : prev))
      setRefreshedAt(new Date())
      setError('')
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || '갱신하지 못했습니다.')
    }
  }

  refreshRef.current = refreshComments

  function assign(commentId, groupId) {
    setOverrides((prev) => {
      const next = { ...prev }
      if (groupId) next[commentId] = groupId
      else delete next[commentId]
      return next
    })
  }


  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>SOOP 댓글 좋아요 랭킹</h1>
          <p>게시글 댓글을 분류별로 나누고 좋아요 순위를 매겨 상위 N명을 뽑아냅니다.</p>
        </div>

        <form
          className="loader"
          onSubmit={(e) => {
            e.preventDefault()
            load(urlInput)
          }}
        >
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.sooplive.com/station/ecvhao/post/203249055"
            spellCheck={false}
          />
          <button type="submit" disabled={loading}>
            {loading ? '불러오는 중…' : '불러오기'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setUrlInput(SAMPLE_URL)
              load(SAMPLE_URL)
            }}
            disabled={loading}
          >
            예시 글
          </button>
        </form>

        {progress && (
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
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
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="닉네임 · 내용 검색"
            />
          </nav>

          <main className="list" ref={listRef}>
            {visibleItems.length === 0 && <p className="empty">표시할 댓글이 없습니다.</p>}

            {visibleItems.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                prevRank={prevRanks?.get(activeSection.id)?.get(comment.id)}
                hasSnapshot={!!prevRanks}
                color={
                  activeTab === ALL_TAB
                    ? groupColorById[comment.groupId] ?? NEUTRAL_COLOR
                    : activeSection.color
                }
                showGroupName={grouped && activeTab === ALL_TAB}
                groupName={groupNameById[comment.groupId]}
                groups={groups}
                onAssign={assign}
              />
            ))}
          </main>
        </>
      )}

      {!data && !loading && (
        <p className="placeholder">
          SOOP 방송국 게시글 주소를 붙여넣고 <strong>불러오기</strong>를 누르세요.
        </p>
      )}
    </div>
  )
}
