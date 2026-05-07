import { type ColumnDef } from '@tanstack/react-table'
import EnigmaLoader from './EnigmaLoader'
import styles from './TableSkeleton.module.css'

interface Props<T> {
  columns: ColumnDef<T, unknown>[]
  rows?: number
  rowHeight?: number
  hideToolbar?: boolean
  /** Centered loader overlay. Pass a string for the default Enigma + text, or false to suppress. */
  loaderText?: string | false
}

function flattenLeaves<T>(cols: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  const out: ColumnDef<T, unknown>[] = []
  for (const c of cols) {
    const children = (c as { columns?: ColumnDef<T, unknown>[] }).columns
    if (children && children.length > 0) out.push(...flattenLeaves(children))
    else out.push(c)
  }
  return out
}

/**
 * Visual shell matching DataTable's dimensions while data loads.
 * Reserves toolbar + header + N rows of space — prevents CLS.
 * Renders the EnigmaLoader centered on top by default.
 */
export default function TableSkeleton<T>({
  columns,
  rows = 8,
  rowHeight = 36,
  hideToolbar,
  loaderText = '',
}: Props<T>) {
  const leaves = flattenLeaves(columns)
  const totalSize = leaves.reduce((s, c) => s + (c.size ?? 100), 0)

  return (
    <div className={styles.container} aria-busy="true" aria-live="polite">
      {!hideToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.searchPlaceholder} />
          <div className={styles.toolbarRight}>
            <div className={styles.btnPlaceholder} />
            <div className={styles.btnPlaceholder} />
          </div>
        </div>
      )}

      <div className={styles.tableOuter}>
        <div className={styles.headerRow} style={{ minWidth: totalSize }}>
          {leaves.map((c, i) => {
            const width = c.size ?? 100
            const pct = `${(width / totalSize) * 100}%`
            const label =
              typeof c.header === 'string'
                ? c.header
                : (c.id ?? (c as { accessorKey?: string }).accessorKey ?? '')
            return (
              <div key={c.id ?? i} className={styles.th} style={{ width: pct }}>
                {label}
              </div>
            )
          })}
        </div>

        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className={styles.bodyRow}
            style={{ height: rowHeight, minWidth: totalSize }}
          >
            {leaves.map((c, i) => {
              const width = c.size ?? 100
              const pct = `${(width / totalSize) * 100}%`
              return (
                <div key={c.id ?? i} className={styles.cell} style={{ width: pct }}>
                  <div
                    className={styles.bar}
                    style={{ width: `${30 + ((i * 17 + r * 11) % 50)}%` }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {loaderText !== false && (
        <div className={styles.overlay}>
          <EnigmaLoader text={loaderText} />
        </div>
      )}
    </div>
  )
}
