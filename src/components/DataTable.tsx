import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useState, useRef, useCallback, useMemo, memo } from 'react'
import styles from './DataTable.module.css'

/* ── Column statistics (heatmap + sorted distribution) ───── */

/** Max points rendered in the sparkline (subsampled if more) */
const SPARK_POINTS = 48

interface ColumnStats {
  min: number
  max: number
  direction: 'high-good' | 'high-bad'
  tooltip: string
  sorted: number[] // all values sorted ascending
  spark: number[] // subsampled sorted values for sparkline
}

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  defaultSorting?: SortingState
  searchableColumns?: string[]
  rowHeight?: number
  stickyColumns?: number
}

function downloadCsv<T>(data: T[], columns: ColumnDef<T, unknown>[], filename: string) {
  const headers = columns
    .map((c) => {
      const header = typeof c.header === 'string' ? c.header : String(c.id ?? '')
      return `"${header.replace(/"/g, '""')}"`
    })
    .join(',')

  const rows = data.map((row) =>
    columns
      .map((c) => {
        const id = c.id ?? (c as { accessorKey?: string }).accessorKey ?? ''
        const value = (row as Record<string, unknown>)[id]
        if (value === null || value === undefined) return ''
        const str = String(value)
        return `"${str.replace(/"/g, '""')}"`
      })
      .join(','),
  )

  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function copyToClipboard<T>(data: T[], columns: ColumnDef<T, unknown>[]) {
  const headers = columns
    .map((c) => (typeof c.header === 'string' ? c.header : String(c.id ?? '')))
    .join('\t')

  const rows = data.map((row) =>
    columns
      .map((c) => {
        const id = c.id ?? (c as { accessorKey?: string }).accessorKey ?? ''
        const value = (row as Record<string, unknown>)[id]
        return value === null || value === undefined ? '' : String(value)
      })
      .join('\t'),
  )

  const text = [headers, ...rows].join('\n')
  await navigator.clipboard.writeText(text)
}

/* ── Heatmap color ───────────────────────────────────────── */

function heatmapColor(t: number): string {
  const v = Math.max(0, Math.min(1, t))
  if (v <= 0.5) {
    const s = v / 0.5
    const r = Math.round(248 + (169 - 248) * s)
    const g = Math.round(113 + (166 - 113) * s)
    const b = Math.round(113 + (184 - 113) * s)
    return `rgb(${r},${g},${b})`
  } else {
    const s = (v - 0.5) / 0.5
    const r = Math.round(169 + (74 - 169) * s)
    const g = Math.round(166 + (222 - 166) * s)
    const b = Math.round(184 + (128 - 184) * s)
    return `rgb(${r},${g},${b})`
  }
}

/* ── Column stats computation ────────────────────────────── */

type ColMeta = {
  numeric?: boolean
  heatmap?: 'high-good' | 'high-bad'
  tooltip?: string
}

function subsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (arr.length - 1))
    out.push(arr[idx])
  }
  return out
}

function computeColumnStats<T>(
  data: T[],
  columns: ColumnDef<T, unknown>[],
): Record<string, ColumnStats> {
  const stats: Record<string, ColumnStats> = {}

  function walk(cols: ColumnDef<T, unknown>[]) {
    for (const col of cols) {
      // Recurse into column groups
      if ('columns' in col && Array.isArray(col.columns)) {
        walk(col.columns as ColumnDef<T, unknown>[])
        continue
      }

      const meta = col.meta as ColMeta | undefined
      if (!meta?.heatmap) continue
      const key = col.id ?? (col as { accessorKey?: string }).accessorKey ?? ''
      if (!key) continue

      // Extract values — support both accessorKey and accessorFn
      const accessorFn = (col as { accessorFn?: (row: T) => unknown }).accessorFn
      const accessorKey = (col as { accessorKey?: string }).accessorKey

      const values: number[] = []
      for (const row of data) {
        let val: unknown
        if (accessorFn) {
          val = accessorFn(row)
        } else if (accessorKey) {
          val = (row as Record<string, unknown>)[accessorKey]
        } else {
          val = (row as Record<string, unknown>)[key]
        }
        if (typeof val === 'number' && isFinite(val)) values.push(val)
      }
      if (values.length < 2) continue

      values.sort((a, b) => a - b)
      const min = values[0]
      const max = values[values.length - 1]
      if (min === max) continue

      const tooltip =
        meta.tooltip ?? (typeof col.header === 'string' ? col.header : key)

      stats[key] = {
        min,
        max,
        direction: meta.heatmap,
        tooltip,
        sorted: values,
        spark: subsample(values, SPARK_POINTS),
      }
    }
  }

  walk(columns)
  return stats
}

function getCellHeatColor(
  colId: string,
  value: unknown,
  stats: Record<string, ColumnStats>,
): string | undefined {
  const s = stats[colId]
  if (!s) return undefined
  if (typeof value !== 'number' || !isFinite(value)) return undefined

  let t = (value - s.min) / (s.max - s.min)
  if (s.direction === 'high-bad') t = 1 - t
  return heatmapColor(t)
}

/* ── Tooltip state ───────────────────────────────────────── */

interface TooltipState {
  x: number
  y: number
  colId: string
  value: number
  headerOnly?: boolean
}

function SparklineSorted({
  stats,
  value,
}: {
  stats: ColumnStats
  value: number
}) {
  const w = 140
  const h = 36
  const pts = stats.spark
  const range = stats.max - stats.min
  const n = pts.length

  // Build polyline points
  const polyPoints = pts
    .map((v, i) => {
      const x = (i / (n - 1)) * w
      const y = h - 2 - ((v - stats.min) / range) * (h - 4)
      return `${x},${y}`
    })
    .join(' ')

  // Fill area (polyline + bottom edge)
  const areaPoints = `0,${h} ${polyPoints} ${w},${h}`

  // Find where the current value sits in the sorted array (binary search)
  let rank = 0
  for (let lo = 0, hi = stats.sorted.length - 1; lo <= hi; ) {
    const mid = (lo + hi) >> 1
    if (stats.sorted[mid] <= value) {
      rank = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  const markerX = (rank / (stats.sorted.length - 1)) * w

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.sparkline}>
      {/* Filled area under curve */}
      <polygon points={areaPoints} fill="rgba(169,166,184,0.12)" />
      {/* The curve */}
      <polyline
        points={polyPoints}
        fill="none"
        stroke="rgba(169,166,184,0.4)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Current value marker */}
      <line
        x1={markerX}
        y1={0}
        x2={markerX}
        y2={h}
        stroke="#c48bc4"
        strokeWidth="1.5"
        opacity="0.8"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={markerX}
        cy={h - 2 - ((value - stats.min) / range) * (h - 4)}
        r="3"
        fill="#c48bc4"
        stroke="var(--color-bg-elevated)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ── VirtualRow ──────────────────────────────────────────── */

interface VirtualRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: ReturnType<ReturnType<typeof useReactTable<any>>['getRowModel']>['rows'][0]
  style: React.CSSProperties
  columnStats: Record<string, ColumnStats>
  groupStartIds: Set<string>
  onCellEnter: (e: React.MouseEvent, colId: string, value: number) => void
  onCellLeave: () => void
}

const VirtualRow = memo(function VirtualRow({
  row,
  style,
  columnStats,
  groupStartIds,
  onCellEnter,
  onCellLeave,
}: VirtualRowProps) {
  return (
    <div className={styles.tr} style={style} role="row">
      {row.getVisibleCells().map((cell) => {
        const isNumeric = (cell.column.columnDef.meta as ColMeta)?.numeric
        const colId =
          cell.column.id ??
          (cell.column.columnDef as { accessorKey?: string }).accessorKey ??
          ''
        const cellValue = cell.getValue()
        const heatColor = getCellHeatColor(colId, cellValue, columnStats)
        const hasStats = colId in columnStats
        const isGroupStart = groupStartIds.has(colId)
        return (
          <div
            key={cell.id}
            className={`${styles.td} ${isNumeric ? styles.tdRight : ''} ${isGroupStart ? styles.groupDivider : ''}`}
            style={{ width: cell.column.getSize(), color: heatColor }}
            role="cell"
            onMouseEnter={
              hasStats && typeof cellValue === 'number'
                ? (e) => onCellEnter(e, colId, cellValue)
                : undefined
            }
            onMouseLeave={hasStats ? onCellLeave : undefined}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        )
      })}
    </div>
  )
})

/* ── DataTable ───────────────────────────────────────────── */

export default function DataTable<T>({
  data,
  columns,
  defaultSorting = [],
  searchableColumns,
  rowHeight = 36,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSorting)
  const [globalFilter, setGlobalFilter] = useState('')
  const [copied, setCopied] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const columnFilterFn = useMemo(() => {
    if (!searchableColumns || searchableColumns.length === 0) return undefined
    return (
      row: { getValue: (id: string) => unknown },
      _columnId: string,
      filterValue: string,
    ) => {
      const lower = filterValue.toLowerCase()
      return searchableColumns.some((col) => {
        const val = row.getValue(col)
        return val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      })
    }
  }, [searchableColumns])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: columnFilterFn ?? 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const { rows } = table.getRowModel()

  const columnStats = useMemo(() => computeColumnStats(data, columns), [data, columns])

  // Build a map of colId → tooltip label for headers (recurse into groups)
  const headerTooltips = useMemo(() => {
    const map: Record<string, string> = {}
    function walk(cols: ColumnDef<T, unknown>[]) {
      for (const col of cols) {
        const meta = col.meta as ColMeta | undefined
        const key = col.id ?? (col as { accessorKey?: string }).accessorKey ?? ''
        if (meta?.tooltip) map[key] = meta.tooltip
        if ('columns' in col && Array.isArray(col.columns)) {
          walk(col.columns as ColumnDef<T, unknown>[])
        }
      }
    }
    walk(columns)
    return map
  }, [columns])

  // Identify the first leaf column of each column group (for divider borders)
  const groupStartIds = useMemo(() => {
    const ids = new Set<string>()
    const headerGroups = table.getHeaderGroups()
    if (headerGroups.length > 1) {
      const leafIdSet = new Set(headerGroups[headerGroups.length - 1].headers.map((h) => h.id))
      for (const header of headerGroups[0].headers) {
        if (!header.isPlaceholder) {
          const trueLeaves = header.getLeafHeaders().filter((lh) => leafIdSet.has(lh.id))
          if (trueLeaves.length > 0) ids.add(trueLeaves[0].column.id)
        }
      }
    }
    return ids
  }, [table])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 15,
  })

  const handleCopy = useCallback(async () => {
    await copyToClipboard(
      rows.map((r) => r.original),
      columns,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [rows, columns])

  const handleCsv = useCallback(() => {
    downloadCsv(
      rows.map((r) => r.original),
      columns,
      'datdota-export.csv',
    )
  }, [rows, columns])

  const handleCellEnter = useCallback(
    (e: React.MouseEvent, colId: string, value: number) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return
      setTooltip({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top,
        colId,
        value,
      })
    },
    [],
  )

  const handleHeaderEnter = useCallback(
    (e: React.MouseEvent, colId: string) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return
      setTooltip({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.bottom - containerRect.top + 8,
        colId,
        value: 0,
        headerOnly: true,
      })
    },
    [],
  )

  const handleCellLeave = useCallback(() => setTooltip(null), [])

  const tooltipStats = tooltip ? columnStats[tooltip.colId] : null
  const tooltipLabel = tooltip ? headerTooltips[tooltip.colId] ?? tooltipStats?.tooltip : null

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <div className={styles.toolbarRight}>
          <span className={styles.rowCount}>
            {rows.length.toLocaleString()} row{rows.length !== 1 ? 's' : ''}
          </span>
          <button className={styles.actionBtn} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button className={styles.actionBtn} onClick={handleCsv}>
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableOuter} ref={parentRef}>
        {/* Header */}
        <div className={styles.thead} role="rowgroup">
          {(() => {
            const headerGroups = table.getHeaderGroups()
            const hasGroupRow = headerGroups.length > 1

            // Build group label row from leaf columns if groups exist
            if (hasGroupRow) {
              const leafHeaders = headerGroups[headerGroups.length - 1].headers
              const leafIdSet = new Set(leafHeaders.map((h) => h.id))

              // Build spans for the group label row directly from row 0 headers
              // Each row-0 header is either a placeholder (standalone col) or a group header
              const row0 = headerGroups[0].headers

              return (
                <>
                  {/* Group label row */}
                  <div className={styles.headerRow} role="row">
                    {row0.map((topHeader) => {
                      // Get only the TRUE leaf headers (those in the leaf row)
                      const trueLeaves = topHeader.getLeafHeaders().filter((lh) => leafIdSet.has(lh.id))
                      const width = trueLeaves.reduce((s, lh) => s + lh.column.getSize(), 0)

                      if (topHeader.isPlaceholder) {
                        return (
                          <div
                            key={topHeader.id}
                            className={styles.thGroupPlaceholder}
                            style={{ width }}
                          />
                        )
                      }
                      return (
                        <div
                          key={topHeader.id}
                          className={`${styles.thGroup} ${styles.groupDivider}`}
                          style={{ width }}
                          role="columnheader"
                        >
                          {flexRender(topHeader.column.columnDef.header, topHeader.getContext())}
                        </div>
                      )
                    })}
                  </div>
                  {/* Leaf header row */}
                  <div className={styles.headerRow} role="row">
                    {leafHeaders.map((header) => {
                      const canSort = header.column.getCanSort()
                      const sorted = header.column.getIsSorted()
                      const isNumeric = (header.column.columnDef.meta as ColMeta)?.numeric
                      const width = header.column.getSize()
                      const colId =
                        header.column.id ??
                        (header.column.columnDef as { accessorKey?: string }).accessorKey ??
                        ''
                      const tipLabel = headerTooltips[colId]
                      const isGroupStart = groupStartIds.has(colId)

                      return (
                        <div
                          key={header.id}
                          className={`${styles.th} ${canSort ? styles.sortable : ''} ${sorted ? styles.sorted : ''} ${isNumeric ? styles.thRight : ''} ${isGroupStart ? styles.groupDivider : ''}`}
                          style={{ width }}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          role="columnheader"
                          onMouseEnter={tipLabel ? (e) => handleHeaderEnter(e, colId) : undefined}
                          onMouseLeave={tipLabel ? handleCellLeave : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' && <span className={styles.sortIcon}> &#9650;</span>}
                          {sorted === 'desc' && <span className={styles.sortIcon}> &#9660;</span>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            }

            // No groups — single header row
            const leafRow = headerGroups[0]
            return (
              <div className={styles.headerRow} role="row">
                {leafRow.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const isNumeric = (header.column.columnDef.meta as ColMeta)?.numeric
                  const width = header.column.getSize()
                  const colId =
                    header.column.id ??
                    (header.column.columnDef as { accessorKey?: string }).accessorKey ??
                    ''
                  const tipLabel = headerTooltips[colId]

                  return (
                    <div
                      key={header.id}
                      className={`${styles.th} ${canSort ? styles.sortable : ''} ${sorted ? styles.sorted : ''} ${isNumeric ? styles.thRight : ''}`}
                      style={{ width }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      role="columnheader"
                      onMouseEnter={tipLabel ? (e) => handleHeaderEnter(e, colId) : undefined}
                      onMouseLeave={tipLabel ? handleCellLeave : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === 'asc' && <span className={styles.sortIcon}> &#9650;</span>}
                      {sorted === 'desc' && <span className={styles.sortIcon}> &#9660;</span>}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Body */}
        <div
          className={styles.tbody}
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          role="rowgroup"
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <VirtualRow
                key={row.id}
                row={row}
                columnStats={columnStats}
                groupStartIds={groupStartIds}
                onCellEnter={handleCellEnter}
                onCellLeave={handleCellLeave}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                  height: `${rowHeight}px`,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Tooltip — single shared instance */}
      {tooltip && tooltipLabel && (
        <div
          className={tooltip.headerOnly ? styles.headerTooltip : styles.cellTooltip}
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className={styles.tooltipHeader}>{tooltipLabel}</div>
          {!tooltip.headerOnly && tooltipStats && (
            <>
              <SparklineSorted stats={tooltipStats} value={tooltip.value} />
              <div className={styles.tooltipStats}>
                <span>
                  min <strong>{tooltipStats.min.toFixed(2)}</strong>
                </span>
                <span>
                  val{' '}
                  <strong style={{ color: '#c48bc4' }}>{tooltip.value.toFixed(2)}</strong>
                </span>
                <span>
                  max <strong>{tooltipStats.max.toFixed(2)}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Cell Renderers ───────────────────────────────────────── */

export function NumericCell({ value, decimals = 0 }: { value: number | null; decimals?: number }) {
  if (value === null || value === undefined) return <span className={styles.muted}>—</span>
  return <span className={styles.numeric}>{value.toFixed(decimals)}</span>
}

export function PercentCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className={styles.muted}>—</span>
  const pct = value * 100
  return (
    <span className={styles.numeric}>
      {pct.toFixed(2)}%
    </span>
  )
}

export function DeltaCell({ value, decimals = 1 }: { value: number | null; decimals?: number }) {
  if (value === null || value === undefined) return <span className={styles.muted}>—</span>
  const positive = value >= 0
  return (
    <span style={{ color: positive ? 'var(--color-win)' : 'var(--color-loss)' }}>
      {positive ? '+' : ''}
      {value.toFixed(decimals)}
    </span>
  )
}

export function PlayerCell({
  steamId,
  nickname,
}: {
  steamId: number
  nickname: string
}) {
  return (
    <a href={`/players/${steamId}`} className={styles.playerLink}>
      {nickname}
    </a>
  )
}

export function TeamLogo({
  logoUrl,
  name,
  className,
}: {
  logoUrl?: string
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!logoUrl || failed) {
    return (
      <span className={`${styles.teamLogoPlaceholder} ${className ?? styles.teamLogo}`}>
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={logoUrl}
      alt=""
      className={className ?? styles.teamLogo}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function TeamCell({
  valveId,
  name,
  logoUrl,
}: {
  valveId: number
  name: string
  logoUrl?: string
}) {
  return (
    <a href={`/teams/${valveId}`} className={`${styles.playerLink} ${styles.teamCell}`}>
      <TeamLogo logoUrl={logoUrl} name={name} />
      <span className={styles.teamName}>{name}</span>
    </a>
  )
}
