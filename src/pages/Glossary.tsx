import { useEffect } from 'react'
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Glossary</h1>
        <p className={styles.subtitle}>
          Terms, metrics, and concepts used across datdota
        </p>
      </div>

      <div className={styles.entries}>
        {glossary.map((entry) => (
          <div key={entry.id} id={entry.id} className={styles.entry}>
            <h2 className={styles.term}>
              <a href={`#${entry.id}`} className={styles.anchor}>#</a>
              {entry.term}
            </h2>
            <p className={styles.summary}>{entry.summary}</p>
            {entry.detail && (
              <p className={styles.detail}>{entry.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
