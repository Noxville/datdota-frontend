import { useMemo, useState, type ReactNode } from 'react'
import styles from './FacetToggleList.module.css'

export interface FacetItem {
  value: number
  label: string
  count: number
}

interface FacetToggleListProps {
  items: FacetItem[]
  selected: number[]
  onChange: (next: number[]) => void
  placeholder?: string
  renderIcon?: (value: number) => ReactNode
}

/** Search + toggle list of facet values sorted by ward count. Selected values
 * pin to the top; the list scrolls to reveal values beyond the visible rows.
 * An empty selection means "do not filter by this property". */
export default function FacetToggleList({
  items,
  selected,
  onChange,
  placeholder = 'Search…',
  renderIcon,
}: FacetToggleListProps) {
  const [query, setQuery] = useState('')
  const selSet = useMemo(() => new Set(selected), [selected])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items
    return [...filtered].sort((a, b) => {
      const sa = selSet.has(a.value) ? 1 : 0
      const sb = selSet.has(b.value) ? 1 : 0
      if (sa !== sb) return sb - sa
      return b.count - a.count
    })
  }, [items, query, selSet])

  function toggle(value: number) {
    onChange(selSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div className={styles.wrap}>
      <input
        className={styles.search}
        value={query}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.list}>
        {shown.length === 0 && <div className={styles.empty}>No matches</div>}
        {shown.map((i) => {
          const on = selSet.has(i.value)
          return (
            <button
              key={i.value}
              className={`${styles.row} ${on ? styles.rowOn : ''}`}
              onClick={() => toggle(i.value)}
            >
              <span className={styles.check}>{on ? '✓' : ''}</span>
              {renderIcon?.(i.value)}
              <span className={styles.label}>{i.label}</span>
              <span className={styles.count}>{i.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
