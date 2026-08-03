import { useEffect, useMemo, useRef, useState } from 'react'
import GroupPanel from './components/GroupPanel'
import NicknameExport from './components/NicknameExport'
import CommentCard from './components/CommentCard'
import { fetchAllComments, fetchPost, parsePostUrl, postUrl } from './lib/soop'
import { buildGroups, detectCategories } from './lib/categories'
import { UNGROUPED_ID, classify, rank, toCsv, validateGrouping } from './lib/groups'
import { SAMPLE_POST } from './lib/sample'
import './App.css'

const STORE_URL = 'soopcomment.lastUrl'
const SAMPLE_URL = SAMPLE_POST.url
const overrideKey = (bjId, postNo) => `soopcomment.overrides.${bjId}.${postNo}`

const ALL_TAB = '__all__'
const UNGROUPED_COLOR = '#6b7280'

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

  const abortRef = useRef(null)

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
        color: UNGROUPED_COLOR,
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
      color: '#8b93a7',
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
    const map = { [UNGROUPED_ID]: UNGROUPED_COLOR }
    for (const g of groups) map[g.id] = g.color
    return map
  }, [groups])

  const activeSection =
    activeTab === ALL_TAB ? allSection : sections.find((s) => s.id === activeTab) ?? allSection

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
    localStorage.setItem(STORE_URL, rawInput)

    try {
      const post = await fetchPost(parsed.bjId, parsed.postNo, { signal })
      const categories = detectCategories(post.html)

      const result = await fetchAllComments(parsed.bjId, parsed.postNo, {
        signal,
        onProgress: (done, total) => setProgress({ done, total }),
      })

      setOverrides(loadStored(overrideKey(parsed.bjId, parsed.postNo), {}) ?? {})
      setData({ ...result, title: post.title, categories })
      setActiveTab(ALL_TAB)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || '댓글을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  function assign(commentId, groupId) {
    setOverrides((prev) => {
      const next = { ...prev }
      if (groupId) next[commentId] = groupId
      else delete next[commentId]
      return next
    })
  }

  function exportCsv() {
    const source = grouped ? sections : [allSection]
    const csv = toCsv(source.filter((s) => s && s.items.length > 0).map((s) => ({ ...s, group: s.name })))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `soop-${data.bjId}-${data.postNo}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
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
              onClick={() => load(urlInput)}
              disabled={loading}
            >
              새로고침
            </button>
            <button type="button" className="ghost" onClick={exportCsv}>
              CSV 내보내기
            </button>
            {Object.keys(overrides).length > 0 && (
              <button type="button" className="ghost" onClick={() => setOverrides({})}>
                수동 지정 {Object.keys(overrides).length}건 초기화
              </button>
            )}
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

          <GroupPanel groups={groups} counts={counts} detection={detection} />

          <nav className="tabs">
            {grouped && (
              <>
                <button
                  type="button"
                  className={activeTab === ALL_TAB ? 'active' : ''}
                  onClick={() => setActiveTab(ALL_TAB)}
                  style={{ '--group': '#8b93a7' }}
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

          <main className="list">
            {visibleItems.length === 0 && <p className="empty">표시할 댓글이 없습니다.</p>}

            {visibleItems.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                color={
                  activeTab === ALL_TAB
                    ? groupColorById[comment.groupId] ?? '#8b93a7'
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
