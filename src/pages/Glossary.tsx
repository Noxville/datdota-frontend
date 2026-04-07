import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import glossary from '../data/glossary'
import styles from './Glossary.module.css'

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Glossary</h1>
        <p className={styles.subtitle}>
          Terms, metrics, and concepts used across datdota
        </p>
      </div>

      {sections.map((group) => (
        <div key={group.section} className={styles.sectionGroup}>
          <h2 className={styles.sectionHeading}>{group.section}</h2>
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
