import { Link, useLocation } from 'react-router-dom'
import styles from './QuickLinks.module.css'

export interface QuickLink {
  label: string
  to: string
}

/**
 * A row of "quick link" chips that jump to a related page while carrying the
 * current URL query string (i.e. the active filters) across. Handy for hopping
 * between sibling views of the same data (e.g. average ↔ single performances).
 */
export default function QuickLinks({ links }: { links: QuickLink[] }) {
  const { search } = useLocation()
  if (links.length === 0) return null
  return (
    <div className={styles.quickLinks}>
      <span className={styles.label}>Quick links</span>
      {links.map((l) => (
        <Link key={l.to} to={`${l.to}${search}`} className={styles.link}>
          {l.label}
          <span className={styles.arrow} aria-hidden>→</span>
        </Link>
      ))}
    </div>
  )
}
