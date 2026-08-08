import { Fragment, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import glossary from '../data/glossary'
import { TEAMFIGHT_TYPES, TEAMFIGHT_TYPE_COLORS, TEAMFIGHT_TYPE_LABELS, classifyTeamfight } from '../data/teamfightTypes'
import styles from './Glossary.module.css'
import PageMeta from '../components/PageMeta'

function sectionSlug(name: string): string {
  return `section-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

/** 5×5 matrix showing the teamfight type for each (side A count × side B count). */
function TeamfightMatrix() {
  const counts = [1, 2, 3, 4, 5]
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
        {TEAMFIGHT_TYPES.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: TEAMFIGHT_TYPE_COLORS[t] }} />
            {TEAMFIGHT_TYPE_LABELS[t]}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', alignSelf: 'center', color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
          # radiant players
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto repeat(5, 62px)', gap: 4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            <div />
            {counts.map((c) => (
              <div key={`h${c}`} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{c}</div>
            ))}
            {counts.map((r) => (
              <Fragment key={`r${r}`}>
                <div style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', paddingRight: 6 }}>{r}</div>
                {counts.map((c) => {
                  const t = classifyTeamfight(r, c)
                  return (
                    <div
                      key={`${r}-${c}`}
                      title={`${r} radiant vs ${c} dire → ${TEAMFIGHT_TYPE_LABELS[t]}`}
                      style={{ height: 56, borderRadius: 4, background: TEAMFIGHT_TYPE_COLORS[t], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d0d1a', fontWeight: 700, fontSize: '0.68rem' }}
                    >
                      {TEAMFIGHT_TYPE_LABELS[t]}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 6, color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
            # dire players
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Glossary() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash])

  const sections = useMemo(() => {
    const grouped: { section: string; entries: typeof glossary }[] = []
    const seen = new Map<string, typeof glossary>()
    for (const entry of glossary) {
      const sec = entry.section ?? 'General'
      if (!seen.has(sec)) {
        const entries: typeof glossary = []
        seen.set(sec, entries)
        grouped.push({ section: sec, entries })
      }
      seen.get(sec)!.push(entry)
    }
    return grouped
  }, [])

  const [activeSection, setActiveSection] = useState<string | null>(
    sections[0]?.section ?? null,
  )

  useEffect(() => {
    const headings = sections
      .map((g) => document.getElementById(sectionSlug(g.section)))
      .filter((el): el is HTMLElement => el != null)
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          const id = visible[0].target.id
          const match = sections.find((g) => sectionSlug(g.section) === id)
          if (match) setActiveSection(match.section)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )

    headings.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  return (
    <div className={styles.page}>
      <PageMeta title="Dota 2 Stats Glossary" description="Definitions for KDA, GPM, XPM, networth, Glicko-2, Elo and other Dota 2 esports metrics." />
      <div className={styles.header}>
        <h1>Glossary</h1>
        <p className={styles.subtitle}>
          Terms, metrics, and concepts used across datdota
        </p>
      </div>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Glossary sections">
          {sections.map((group) => (
            <a
              key={group.section}
              href={`#${sectionSlug(group.section)}`}
              className={`${styles.tocLink} ${activeSection === group.section ? styles.tocLinkActive : ''}`}
            >
              {group.section}
            </a>
          ))}
        </nav>

        <div className={styles.content}>
          {sections.map((group) => (
            <div key={group.section} className={styles.sectionGroup}>
              <h2 id={sectionSlug(group.section)} className={styles.sectionHeading}>
                {group.section}
              </h2>
              <div className={styles.entries}>
                {group.entries.map((entry) => (
                  <div key={entry.id} id={entry.id} className={styles.entry}>
                    <h3 className={styles.term}>
                      <a href={`#${entry.id}`} className={styles.anchor}>#</a>
                      {entry.term}
                    </h3>
                    <p className={styles.summary}>{entry.summary}</p>
                    {entry.detail && (
                      <p className={styles.detail}>{entry.detail}</p>
                    )}
                    {entry.bullets && entry.bullets.length > 0 && (
                      <ul className={styles.bullets}>
                        {entry.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {entry.id === 'teamfight-types' && <TeamfightMatrix />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
