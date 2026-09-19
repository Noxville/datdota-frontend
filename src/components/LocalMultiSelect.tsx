import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './LocalMultiSelect.module.css'

export interface LocalOption {
  value: number
  label: string
}

interface LocalMultiSelectProps {
  options: LocalOption[]
  selected: number[]
  onChange: (next: number[]) => void
  placeholder?: string
  renderIcon?: (value: number) => ReactNode
  maxVisible?: number
}

/** Searchable multi-select over a fixed in-memory list. Selected values render
 * as removable chips; no API calls. */
export default function LocalMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Search…',
  renderIcon,
  maxVisible = 60,
}: LocalMultiSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const labelFor = useMemo(() => {
    const m = new Map<number, string>()
    for (const o of options) m.set(o.value, o.label)
    return m
  }, [options])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sel = new Set(selected)
    return options
      .filter((o) => !sel.has(o.value) && (q === '' || o.label.toLowerCase().includes(q)))
      .slice(0, maxVisible)
  }, [options, query, selected, maxVisible])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function add(value: number) {
    onChange([...selected, value])
    setQuery('')
  }

  function remove(value: number) {
    onChange(selected.filter((v) => v !== value))
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {selected.length > 0 && (
        <div className={styles.chips}>
          {selected.map((v) => (
            <span key={v} className={styles.chip}>
              {renderIcon?.(v)}
              <span className={styles.chipLabel}>{labelFor.get(v) ?? v}</span>
              <button className={styles.chipX} onClick={() => remove(v)} aria-label="Remove">×</button>
            </span>
          ))}
        </div>
      )}
      <input
        className={styles.input}
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <div className={styles.dropdown}>
          {matches.map((o) => (
            <button key={o.value} className={styles.option} onClick={() => add(o.value)}>
              {renderIcon?.(o.value)}
              <span className={styles.optionLabel}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
