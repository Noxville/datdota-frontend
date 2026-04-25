import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import glossary from '../data/glossary'
import styles from './Glossary.module.css'

function sectionSlug(name: string): string {
  return `section-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
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
