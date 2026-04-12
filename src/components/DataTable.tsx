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
  maxHeight?: string
  stickyColumns?: number
  highlightColumnId?: string
  /** Render extra content below the column sparkline in cell tooltips */
  renderTooltipExtra?: (row: T, colId: string, value: number) => React.ReactNode
  /** Hide the toolbar (search, copy, CSV) */
  hideToolbar?: boolean
  /** Optional callback to add a class name to specific rows */
  rowClassName?: (row: T) => string | undefined
}

/** Resolve a column's value for a given row, preferring accessorFn over accessorKey/id lookup */
function resolveValue<T>(col: ColumnDef<T, unknown>, row: T): unknown {
  const accessorFn = (col as { accessorFn?: (row: T) => unknown }).accessorFn
  if (accessorFn) return accessorFn(row)
  const accessorKey = (col as { accessorKey?: string }).accessorKey
  if (accessorKey) return (row as Record<string, unknown>)[accessorKey]
  const id = col.id ?? ''
  return id ? (row as Record<string, unknown>)[id] : undefined
}

/** Flatten column groups (hierarchical headers) into leaf columns for export */
function flattenColumns<T>(columns: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  const result: ColumnDef<T, unknown>[] = []
  for (const col of columns) {
    const children = (col as { columns?: ColumnDef<T, unknown>[] }).columns
    if (children && children.length > 0) {
      result.push(...flattenColumns(children))
    } else {
      result.push(col)
    }
  }
  return result
}

function downloadCsv<T>(data: T[], columns: ColumnDef<T, unknown>[], filename: string) {
  const leafCols = flattenColumns(columns)
  const headers = leafCols
    .map((c) => {
      const header = typeof c.header === 'string' ? c.header : String(c.id ?? '')
      return `"${header.replace(/"/g, '""')}"`
    })
    .join(',')

  const rows = data.map((row) =>
    leafCols
      .map((c) => {
        const value = resolveValue(c, row)
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
  const leafCols = flattenColumns(columns)
  const headers = leafCols
    .map((c) => (typeof c.header === 'string' ? c.header : String(c.id ?? '')))
    .join('\t')

  const rows = data.map((row) =>
    leafCols
      .map((c) => {
        const value = resolveValue(c, row)
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
  grow?: boolean
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
  rowIndex?: number
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
  highlightColumnId?: string
  totalSize: number
  stickyOffsets?: Map<string, number>
  lastStickyColId?: string
  onCellEnter: (e: React.MouseEvent, colId: string, value: number, rowIndex: number) => void
  onCellLeave: () => void
  measureRef?: (node: HTMLElement | null) => void
  dataIndex?: number
  extraClassName?: string
}

const VirtualRow = memo(function VirtualRow({
  row,
  style,
  columnStats,
  groupStartIds,
  highlightColumnId,
  totalSize,
  stickyOffsets,
  lastStickyColId,
  onCellEnter,
  onCellLeave,
  measureRef,
  dataIndex,
  extraClassName,
}: VirtualRowProps) {
  return (
    <div className={`${styles.tr}${extraClassName ? ` ${extraClassName}` : ''}`} style={{ ...style, minWidth: totalSize }} role="row" ref={measureRef} data-index={dataIndex}>
      {row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta as ColMeta | undefined
        const isNumeric = meta?.numeric
        const isGrow = meta?.grow
        const colId =
          cell.column.id ??
          (cell.column.columnDef as { accessorKey?: string }).accessorKey ??
          ''
        const cellValue = cell.getValue()
        const heatColor = getCellHeatColor(colId, cellValue, columnStats)
        const hasStats = colId in columnStats
        const isGroupStart = groupStartIds.has(colId)
        const isHighlighted = highlightColumnId === colId
        const size = cell.column.getSize()
        const cellStyle: React.CSSProperties = isGrow
          ? { flex: 1, minWidth: size, color: heatColor }
          : totalSize > 0
            ? { width: `${(size / totalSize) * 100}%`, color: heatColor }
            : { flex: `${size} 0 0px`, color: heatColor }
        if (isHighlighted) {
          cellStyle.background = 'rgba(196, 139, 196, 0.12)'
        }
        const stickyLeft = stickyOffsets?.get(colId)
        if (stickyLeft != null) {
          cellStyle.position = 'sticky'
          cellStyle.left = stickyLeft
          cellStyle.zIndex = 2
          cellStyle.background = cellStyle.background ?? 'var(--color-bg)'
          if (colId === lastStickyColId) {
            cellStyle.paddingRight = 12
            cellStyle.borderRight = '1px solid var(--color-border)'
          }
        }
        return (
          <div
            key={cell.id}
            className={`${styles.td} ${isNumeric ? styles.tdRight : ''} ${isGrow ? styles.tdGrow : ''} ${isGroupStart ? styles.groupDivider : ''}`}
            style={cellStyle}
            role="cell"
            onMouseEnter={
              hasStats && typeof cellValue === 'number'
                ? (e) => onCellEnter(e, colId, cellValue, row.index)
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
  maxHeight,
  stickyColumns = 0,
  highlightColumnId,
  renderTooltipExtra,
  hideToolbar,
  rowClassName,
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

  const hasGrowColumn = useMemo(() => {
    function check(cols: ColumnDef<T, unknown>[]): boolean {
      return cols.some((c) => (c.meta as ColMeta | undefined)?.grow || ('columns' in c && Array.isArray(c.columns) && check(c.columns as ColumnDef<T, unknown>[])))
    }
    return check(columns)
  }, [columns])

  // Compute total column size for percentage-based widths
  const totalSize = useMemo(() => {
    const allLeaves = table.getAllLeafColumns()
    return allLeaves.reduce((s, col) => s + col.getSize(), 0)
  }, [table])

  // Compute sticky column offsets (colId → left px) and track the last one
  const stickyOffsets = useMemo(() => {
    if (stickyColumns <= 0) return undefined
    const map = new Map<string, number>()
    const allLeaves = table.getAllLeafColumns()
    let left = 0
    const count = Math.min(stickyColumns, allLeaves.length)
    for (let i = 0; i < count; i++) {
      const col = allLeaves[i]
      map.set(col.id, left)
      left += col.getSize()
    }
    return map
  }, [stickyColumns, table])

  const lastStickyColId = useMemo(() => {
    if (stickyColumns <= 0) return undefined
    const allLeaves = table.getAllLeafColumns()
    const idx = Math.min(stickyColumns, allLeaves.length) - 1
    return idx >= 0 ? allLeaves[idx].id : undefined
  }, [stickyColumns, table])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 15,
    measureElement: hasGrowColumn ? (el) => el.getBoundingClientRect().height : undefined,
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
    (e: React.MouseEvent, colId: string, value: number, rowIndex: number) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return
      setTooltip({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top,
        colId,
        value,
        rowIndex,
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
  const tooltipRow = tooltip?.rowIndex != null ? rows[tooltip.rowIndex]?.original : undefined

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Toolbar */}
      {!hideToolbar && (
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
      )}

      {/* Table */}
      <div className={styles.tableOuter} ref={parentRef} style={maxHeight ? { maxHeight } : undefined}>
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
                  <div className={styles.headerRow} role="row" style={{ minWidth: totalSize }}>
                    {row0.map((topHeader) => {
                      // Get only the TRUE leaf headers (those in the leaf row)
                      const trueLeaves = topHeader.getLeafHeaders().filter((lh) => leafIdSet.has(lh.id))
                      const width = trueLeaves.reduce((s, lh) => s + lh.column.getSize(), 0)
                      const pct = `${(width / totalSize) * 100}%`

                      if (topHeader.isPlaceholder) {
                        return (
                          <div
                            key={topHeader.id}
                            className={styles.thGroupPlaceholder}
                            style={{ width: pct }}
                          />
                        )
                      }
                      return (
                        <div
                          key={topHeader.id}
                          className={`${styles.thGroup} ${styles.groupDivider}`}
                          style={{ width: pct }}
                          role="columnheader"
                        >
                          {flexRender(topHeader.column.columnDef.header, topHeader.getContext())}
                        </div>
                      )
                    })}
                  </div>
                  {/* Leaf header row */}
                  <div className={styles.headerRow} role="row" style={{ minWidth: totalSize }}>
                    {leafHeaders.map((header) => {
                      const canSort = header.column.getCanSort()
                      const sorted = header.column.getIsSorted()
                      const isNumeric = (header.column.columnDef.meta as ColMeta)?.numeric
                      const width = header.column.getSize()
                      const pct = `${(width / totalSize) * 100}%`
                      const colId =
                        header.column.id ??
                        (header.column.columnDef as { accessorKey?: string }).accessorKey ??
                        ''
                      const tipLabel = headerTooltips[colId]
                      const isGroupStart = groupStartIds.has(colId)

                      const stickyLeft = stickyOffsets?.get(colId)
                      const thStyle: React.CSSProperties = { width: pct }
                      if (stickyLeft != null) {
                        thStyle.position = 'sticky'
                        thStyle.left = stickyLeft
                        thStyle.zIndex = 3
                        thStyle.background = 'var(--color-bg)'
                        if (colId === lastStickyColId) {
                          thStyle.paddingRight = 12
                          thStyle.borderRight = '1px solid var(--color-border)'
                        }
                      }

                      return (
                        <div
                          key={header.id}
                          className={`${styles.th} ${canSort ? styles.sortable : ''} ${sorted ? styles.sorted : ''} ${isNumeric ? styles.thRight : ''} ${isGroupStart ? styles.groupDivider : ''}`}
                          style={thStyle}
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
              <div className={styles.headerRow} role="row" style={{ minWidth: totalSize }}>
                {leafRow.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const hMeta = header.column.columnDef.meta as ColMeta | undefined
                  const isNumeric = hMeta?.numeric
                  const isGrow = hMeta?.grow
                  const width = header.column.getSize()
                  const colId =
                    header.column.id ??
                    (header.column.columnDef as { accessorKey?: string }).accessorKey ??
                    ''
                  const tipLabel = headerTooltips[colId]
                  const thStyle: React.CSSProperties = isGrow
                    ? { flex: 1, minWidth: width }
                    : { width: `${(width / totalSize) * 100}%` }
                  const stickyLeft = stickyOffsets?.get(colId)
                  if (stickyLeft != null) {
                    thStyle.position = 'sticky'
                    thStyle.left = stickyLeft
                    thStyle.zIndex = 3
                    thStyle.background = 'var(--color-bg)'
                    if (colId === lastStickyColId) {
                      thStyle.paddingRight = 12
                      thStyle.borderRight = '1px solid var(--color-border)'
                    }
                  }

                  return (
                    <div
                      key={header.id}
                      className={`${styles.th} ${canSort ? styles.sortable : ''} ${sorted ? styles.sorted : ''} ${isNumeric ? styles.thRight : ''}`}
                      style={thStyle}
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
                stickyOffsets={stickyOffsets}
                lastStickyColId={lastStickyColId}
                highlightColumnId={highlightColumnId}
                totalSize={totalSize}
                onCellEnter={handleCellEnter}
                onCellLeave={handleCellLeave}
                measureRef={hasGrowColumn ? virtualizer.measureElement : undefined}
                dataIndex={virtualRow.index}
                extraClassName={rowClassName ? rowClassName(row.original) : undefined}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                  minHeight: `${rowHeight}px`,
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
              {renderTooltipExtra && tooltipRow && (
                renderTooltipExtra(tooltipRow, tooltip.colId, tooltip.value)
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Cell Renderers ───────────────────────────────────────── */

export function NumericCell({ value, decimals = 0, compact = false }: { value: number | null; decimals?: number; compact?: boolean }) {
  if (value === null || value === undefined) return <span className={styles.muted}>—</span>
  if (compact) {
    const exact = value.toLocaleString(undefined, { maximumFractionDigits: decimals })
    let display: string
    if (Math.abs(value) >= 1_000_000) {
      display = `${(value / 1_000_000).toFixed(1)}M`
    } else if (Math.abs(value) >= 1_000) {
      display = `${(value / 1_000).toFixed(1)}k`
    } else {
      display = value.toFixed(decimals)
    }
    return <span className={styles.numeric} title={exact}>{display}</span>
  }
  return <span className={styles.numeric}>{value.toFixed(decimals)}</span>
}

export function PercentCell({ value, decimals = 2 }: { value: number | null; decimals?: number }) {
  if (value === null || value === undefined) return <span className={styles.muted}>—</span>
  const pct = value * 100
  return (
    <span className={styles.numeric}>
      {pct.toFixed(decimals)}%
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
  nickname: string | null | undefined
}) {
  return (
    <a href={`/players/${steamId}`} className={styles.playerLink}>
      {nickname || 'Unknown'}
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
