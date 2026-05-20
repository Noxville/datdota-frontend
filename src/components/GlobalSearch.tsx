import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import { useSearchIndex, type SearchEntity, type SearchEntityType } from '../api/searchIndex'
import { SEARCH_PAGES, type SearchPage } from '../data/searchPages'
import { teamLogoUrl, leagueLogoUrl } from '../config'
import styles from './GlobalSearch.module.css'

type FilterType = SearchEntityType | 'query'

interface TypeDef {
  type: FilterType
  label: string
  aliases: string[]
}

const TYPES: TypeDef[] = [
  { type: 'player', label: 'Players', aliases: ['player', 'players', 'p'] },
  { type: 'team', label: 'Teams', aliases: ['team', 'teams', 't'] },
  { type: 'league', label: 'Leagues', aliases: ['league', 'leagues', 'l'] },
  { type: 'query', label: 'Pages', aliases: ['query', 'queries', 'q', 'page', 'pages'] },
]

function resolveType(token: string): FilterType | null {
  const t = token.toLowerCase()
  return TYPES.find((d) => d.aliases.includes(t))?.type ?? null
}

function canonicalAlias(type: FilterType): string {
  return TYPES.find((d) => d.type === type)!.aliases[0]
}

interface Parsed {
  type: FilterType | null
  text: string
  // user is mid-typing the type token (after `t:`, before a space)
  typingToken: string | null
}

function parseQuery(raw: string): Parsed {
  const m = raw.match(/^t:(\w*)( ?)(.*)$/is)
  if (!m) return { type: null, text: raw.trim(), typingToken: null }
  const [, token, space, rest] = m
  if (!space) {
    // still typing the type — offer suggestions, no text query yet
    return { type: null, text: '', typingToken: token }
  }
  return { type: resolveType(token), text: rest.trim(), typingToken: null }
}

type Result =
  | { kind: 'entity'; entity: SearchEntity }
  | { kind: 'page'; page: SearchPage }

interface Section {
  key: string
  label: string | null
  items: Result[]
}

interface Candidate {
  result: Result
  type: FilterType
  score: number
  strong: boolean
  w: number
}

const SECTION_CAP = 5
const TOTAL_CAP = 12
const ENTITY_LIMIT = 8

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Turn a raw fuse score (0 = perfect … 1 = poor; lower is better) into a final
// rank score, boosting exact and prefix matches so the most helpful link wins.
// `strong` marks matches good enough to pin to the very top.
function rankScore(fuseScore: number, query: string, name: string) {
  const q = norm(query)
  const n = norm(name)
  let score = fuseScore
  let strong = false
  if (n === q) {
    score -= 0.7
    strong = true
  } else if (n.startsWith(q)) {
    score -= 0.4
    strong = true
  } else if (n.split(/\s+/).some((w) => w.startsWith(q))) {
    // match begins a later word (e.g. "spirit" in "Team Spirit")
    score -= 0.3
    strong = true
  }
  return { score, strong }
}

function compareCandidates(a: Candidate, b: Candidate) {
  if (Math.abs(a.score - b.score) > 0.001) return a.score - b.score
  return b.w - a.w // popularity tie-breaker
}

// Score every relevant entity/page for `text` and return them best-first.
function gatherCandidates(
  type: FilterType | null,
  text: string,
  entities: SearchEntity[],
  entitiesFuse: Fuse<SearchEntity>,
  pagesFuse: Fuse<SearchPage>,
): Candidate[] {
  const cands: Candidate[] = []

  if (type !== 'query') {
    const fuse = type
      ? new Fuse(entities.filter((e) => e.t === type), {
          keys: ['n'],
          threshold: 0.4,
          ignoreLocation: true,
          minMatchCharLength: 1,
          includeScore: true,
        })
      : entitiesFuse
    for (const r of fuse.search(text, { limit: 50 })) {
      const e = r.item
      const { score, strong } = rankScore(r.score ?? 1, text, e.n)
      // leagues are noisy (nudge down on ties); semi-pro leagues deprioritised further
      const leaguePenalty = e.t === 'league' ? (e.ti === 3 ? 0.3 : 0.05) : 0
      cands.push({
        result: { kind: 'entity', entity: e },
        type: e.t,
        score: score + leaguePenalty,
        strong,
        w: e.w ?? 0,
      })
    }
  }

  if (type === null || type === 'query') {
    for (const r of pagesFuse.search(text, { limit: 20 })) {
      const p = r.item
      const { score, strong } = rankScore(r.score ?? 1, text, p.label)
      cands.push({
        result: { kind: 'page', page: p },
        type: 'query',
        score: score + (type === null ? 0.08 : 0), // don't let a page edge out an equal entity hit
        strong,
        w: 0,
      })
    }
  }

  return cands.sort(compareCandidates)
}

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const { data: entities = [] } = useSearchIndex(true)

  const entitiesFuse = useMemo(
    () =>
      new Fuse(entities, {
        keys: ['n'],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 1,
        includeScore: true,
      }),
    [entities],
  )
  const pagesFuse = useMemo(
    () =>
      new Fuse(SEARCH_PAGES, {
        keys: [{ name: 'label', weight: 2 }, 'keywords'],
        threshold: 0.4,
        ignoreLocation: true,
        includeScore: true,
      }),
    [],
  )

  const parsed = useMemo(() => parseQuery(raw), [raw])
  const { type, text, typingToken } = parsed

  // Type suggestions shown while typing the `t:` token
  const typeSuggestions = useMemo(() => {
    if (typingToken === null) return null
    const q = typingToken.toLowerCase()
    return TYPES.filter((d) => !q || d.aliases.some((a) => a.startsWith(q)))
  }, [typingToken])

  const sections = useMemo<Section[]>(() => {
    if (typeSuggestions) return []

    // Empty query: show prominent entities (by popularity) or top pages.
    if (!text) {
      if (type === 'query') {
        return [{ key: 'query', label: null, items: SEARCH_PAGES.slice(0, SECTION_CAP).map((page) => ({ kind: 'page', page })) }]
      }
      if (type) {
        const top = entities
          .filter((e) => e.t === type)
          .sort((a, b) => (b.w ?? 0) - (a.w ?? 0))
          .slice(0, SECTION_CAP)
        return top.length ? [{ key: type, label: null, items: top.map((entity) => ({ kind: 'entity', entity })) }] : []
      }
      return []
    }

    const cands = gatherCandidates(type, text, entities, entitiesFuse, pagesFuse)
    if (cands.length === 0) return []

    // Single-type modes render one flat, already-ranked list.
    if (type) {
      return [{ key: type, label: null, items: cands.slice(0, ENTITY_LIMIT).map((c) => c.result) }]
    }

    // No filter: pin a strong top match, then group the rest by type with the
    // most relevant group first.
    const out: Section[] = []
    let remaining = cands
    if (cands[0].strong) {
      out.push({ key: 'top', label: 'Top result', items: [cands[0].result] })
      remaining = cands.slice(1)
    }

    const groups = new Map<FilterType, Candidate[]>()
    for (const c of remaining) {
      const arr = groups.get(c.type) ?? []
      arr.push(c)
      groups.set(c.type, arr)
    }
    const ordered = [...groups.entries()].sort((a, b) => a[1][0].score - b[1][0].score)

    let budget = TOTAL_CAP - (out.length ? 1 : 0)
    for (const [t, items] of ordered) {
      if (budget <= 0) break
      const take = items.slice(0, Math.min(SECTION_CAP, budget))
      budget -= take.length
      out.push({ key: t, label: TYPES.find((d) => d.type === t)!.label, items: take.map((c) => c.result) })
    }
    return out
  }, [type, text, typeSuggestions, entities, entitiesFuse, pagesFuse])

  const results = useMemo<Result[]>(() => sections.flatMap((s) => s.items), [sections])

  // Focus input on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  // Lock body scroll while mounted
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  function updateRaw(v: string) {
    setRaw(v)
    setActiveIndex(0)
  }

  function pickType(t: FilterType) {
    updateRaw(`t:${canonicalAlias(t)} `)
    inputRef.current?.focus()
  }

  function selectResult(r: Result) {
    if (r.kind === 'page') {
      navigate(r.page.path)
    } else {
      const { t, id } = r.entity
      navigate(t === 'player' ? `/players/${id}` : t === 'team' ? `/teams/${id}` : `/leagues/${id}`)
    }
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    // Backspace on empty text with an active type prefix clears it
    if (e.key === 'Backspace' && (type !== null) && text === '' && raw.startsWith('t:')) {
      e.preventDefault()
      updateRaw('')
      return
    }

    if (typeSuggestions) {
      const max = typeSuggestions.length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % max)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + max) % max)
      } else if (e.key === 'Enter' && typeSuggestions[activeIndex]) {
        e.preventDefault()
        pickType(typeSuggestions[activeIndex].type)
      }
      return
    }

    const max = results.length
    if (max === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % max)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + max) % max)
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      selectResult(results[activeIndex])
    }
  }

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          {type && (
            <span className={`${styles.chip} ${styles[`chip_${type}`] ?? ''}`}>
              {TYPES.find((d) => d.type === type)!.label}
            </span>
          )}
          <input
            ref={inputRef}
            className={styles.input}
            value={raw}
            placeholder={type ? 'Search…' : 'Search players, teams, leagues…  (try t:team)'}
            onChange={(e) => updateRaw(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        <div className={styles.results}>
          {typeSuggestions ? (
            typeSuggestions.length === 0 ? (
              <div className={styles.empty}>No matching type</div>
            ) : (
              typeSuggestions.map((d, i) => (
                <button
                  key={d.type}
                  className={`${styles.row} ${i === activeIndex ? styles.active : ''}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pickType(d.type)}
                >
                  <span className={`${styles.chip} ${styles[`chip_${d.type}`] ?? ''}`}>{d.label}</span>
                  <span className={styles.rowSub}>t:{canonicalAlias(d.type)}</span>
                </button>
              ))
            )
          ) : results.length === 0 ? (
            <div className={styles.empty}>
              {text || type ? 'No results' : 'Type to search'}
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.key} className={styles.section}>
                {section.label && <div className={styles.sectionHeading}>{section.label}</div>}
                {section.items.map((r) => {
                  const i = results.indexOf(r)
                  return (
                    <button
                      key={r.kind === 'entity' ? `${r.entity.t}-${r.entity.id}` : `page-${r.page.path}`}
                      className={`${styles.row} ${i === activeIndex ? styles.active : ''}`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => selectResult(r)}
                    >
                      <ResultIcon result={r} />
                      <span className={styles.rowLabel}>
                        {r.kind === 'entity' ? r.entity.n : r.page.label}
                      </span>
                      <span className={styles.rowMeta}>
                        {r.kind === 'entity'
                          ? r.entity.t === 'league'
                            ? r.entity.tier ?? 'league'
                            : r.entity.t === 'team'
                              ? r.entity.r ?? 'team'
                              : 'player'
                          : 'page'}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>t:</kbd> filter by type</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ResultIcon({ result }: { result: Result }) {
  const [failed, setFailed] = useState(false)

  if (result.kind === 'page') {
    return <span className={`${styles.icon} ${styles.iconGlyph}`}>#</span>
  }

  const e = result.entity
  if (e.t === 'player') {
    return <span className={`${styles.icon} ${styles.iconGlyph}`}>@</span>
  }

  // team / league: CDN logo with a graceful initial-letter fallback
  if (failed || (e.t === 'team' && !e.logo)) {
    return (
      <span className={`${styles.icon} ${styles.iconGlyph}`}>
        {e.n.trim().charAt(0).toUpperCase() || '?'}
      </span>
    )
  }
  const src = e.t === 'team' ? teamLogoUrl(e.logo ?? null) : leagueLogoUrl(e.id)
  return (
    <img
      className={styles.icon}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
