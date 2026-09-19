import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import { fmtTime } from '../utils/format'
import { worldToNorm, fitAffine, type MapVersion, type CalibrationPoint } from '../data/wardMaps'
import styles from './WardMap.module.css'

export interface WardEvent {
  placer: { nickname: string; steamId: number; hero: number }
  placerTeam: { name: string; valveId: number } | null
  counterer: { nickname: string; steamId: number; hero: number } | null
  matchId: number
  timePlaced: number
  timeDestroyed: number
  type: string
  x: number
  y: number
  campBlocked: boolean
  faction: string
}

export interface MapView {
  k: number
  cu: number
  cv: number
}

interface WardMapProps {
  map: MapVersion
  wards: WardEvent[]
  calibrate: boolean
  initialView?: MapView | null
  onViewChange?: (v: MapView) => void
  selectedKey?: string | null
  onSelectKey?: (key: string | null) => void
}

/** Stable, URL-safe identity for a ward (match + rounded position + time + type). */
function wardKey(w: WardEvent): string {
  const t = w.type.toLowerCase().includes('sentry') ? 's' : 'o'
  return `${w.matchId}.${Math.round(w.x)}.${Math.round(w.y)}.${Math.round(w.timePlaced)}.${t}`
}

const RADIANT = '#6ee7b7'
const DIRE = '#fca5a5'
const OBS_RED = '#ef4444'
const SENTRY_BLUE = '#3b82f6'

interface Geom {
  baseX: number
  baseY: number
  dispW: number
  dispH: number
}

interface PlotPoint {
  w: WardEvent
  u: number
  v: number
  isDire: boolean
  isSentry: boolean
  countered: boolean
}

export default function WardMap({ map, wards, calibrate, initialView, onViewChange, selectedKey, onSelectKey }: WardMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const transformRef = useRef(d3.zoomIdentity)
  const geomRef = useRef<Geom>({ baseX: 0, baseY: 0, dispW: 1, dispH: 1 })
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const drawRef = useRef<() => void>(() => {})
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialApplied = useRef(false)
  const pointerDown = useRef<{ x: number; y: number } | null>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const [grabbing, setGrabbing] = useState(false)
  const [internalSel, setInternalSel] = useState<string | null>(null)
  const selKey = selectedKey !== undefined ? selectedKey : internalSel

  const [landmarks, setLandmarks] = useState(map.landmarks)
  const [calPoints, setCalPoints] = useState<Record<string, [number, number]>>({})
  const [activeIdx, setActiveIdx] = useState(0)
  const [copied, setCopied] = useState(false)

  const activeMap = useMemo<MapVersion>(() => {
    if (!calibrate) return map
    const pts: CalibrationPoint[] = landmarks
      .filter((l) => calPoints[l.id])
      .map((l) => ({ world: l.world, norm: calPoints[l.id] }))
    const fit = fitAffine(pts)
    return fit ? { ...map, affine: fit.affine } : map
  }, [map, calibrate, landmarks, calPoints])

  const fit = useMemo(() => {
    if (!calibrate) return null
    const pts: CalibrationPoint[] = landmarks
      .filter((l) => calPoints[l.id])
      .map((l) => ({ world: l.world, norm: calPoints[l.id] }))
    return fitAffine(pts)
  }, [calibrate, landmarks, calPoints])

  const points = useMemo<PlotPoint[]>(() => {
    return wards.map((w) => {
      const [u, v] = worldToNorm(activeMap, w.x, w.y)
      return {
        w,
        u,
        v,
        isDire: w.faction.toLowerCase().includes('dire'),
        isSentry: w.type.toLowerCase().includes('sentry'),
        countered: w.counterer != null,
      }
    })
  }, [wards, activeMap])

  const selected = useMemo(() => {
    if (!selKey) return null
    for (let i = 0; i < points.length; i++) {
      if (wardKey(points[i].w) === selKey) return i
    }
    return null
  }, [points, selKey])

  const selectWard = useCallback(
    (idx: number | null) => {
      const key = idx != null && points[idx] ? wardKey(points[idx].w) : null
      onSelectKey?.(key)
      if (selectedKey === undefined) setInternalSel(key)
    },
    [points, onSelectKey, selectedKey],
  )

  useEffect(() => {
    setLandmarks(map.landmarks)
    setCalPoints({})
    setActiveIdx(0)
  }, [map])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
    img.src = map.image
    return () => {
      img.onload = null
    }
  }, [map.image])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w: cw, h: ch } = size
    if (cw === 0 || ch === 0) return
    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)

    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const baseScale = Math.min(cw / iw, ch / ih)
    const dispW = iw * baseScale
    const dispH = ih * baseScale
    const baseX = (cw - dispW) / 2
    const baseY = (ch - dispH) / 2
    geomRef.current = { baseX, baseY, dispW, dispH }

    const t = transformRef.current
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, t.x + t.k * baseX, t.y + t.k * baseY, t.k * dispW, t.k * dispH)

    const toScreen = (u: number, v: number): [number, number] => [
      t.x + t.k * (baseX + u * dispW),
      t.y + t.k * (baseY + v * dispH),
    ]

    for (let i = 0; i < points.length; i++) {
      if (i === selected) continue
      const p = points[i]
      const [sx, sy] = toScreen(p.u, p.v)
      if (sx < -20 || sy < -20 || sx > cw + 20 || sy > ch + 20) continue
      const color = p.isSentry ? SENTRY_BLUE : OBS_RED
      const r = p.isSentry ? 6.5 : 7.5
      if (p.countered) {
        ctx.beginPath()
        ctx.arc(sx, sy, r + 3, 0, Math.PI * 2)
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 1.6
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.92
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.lineWidth = 1.6
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.stroke()
    }

    if (selected != null && points[selected]) {
      const p = points[selected]
      const [sx, sy] = toScreen(p.u, p.v)
      ctx.beginPath()
      ctx.arc(sx, sy, 10.5, 0, Math.PI * 2)
      ctx.fillStyle = p.isSentry ? SENTRY_BLUE : OBS_RED
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#fff'
      ctx.stroke()
      if (popupRef.current) {
        popupRef.current.style.left = `${sx}px`
        popupRef.current.style.top = `${sy}px`
      }
    }

    if (calibrate) {
      for (const l of landmarks) {
        const c = calPoints[l.id]
        if (!c) continue
        const [sx, sy] = toScreen(c[0], c[1])
        ctx.beginPath()
        ctx.arc(sx, sy, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#c48bc4'
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#fff'
        ctx.stroke()
      }
    }
  }, [size, points, selected, calibrate, landmarks, calPoints])

  drawRef.current = draw

  const syncView = useCallback(() => {
    if (!onViewChange) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      const { w: cw, h: ch } = size
      const g = geomRef.current
      const t = transformRef.current
      const cu = ((cw / 2 - t.x) / t.k - g.baseX) / g.dispW
      const cv = ((ch / 2 - t.y) / t.k - g.baseY) / g.dispH
      onViewChange({ k: t.k, cu, cv })
    }, 220)
  }, [onViewChange, size])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgLoaded || size.w === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr

    const baseScale = Math.min(size.w / img.naturalWidth, size.h / img.naturalHeight)
    const dispW = img.naturalWidth * baseScale
    const dispH = img.naturalHeight * baseScale
    const g = {
      baseX: (size.w - dispW) / 2,
      baseY: (size.h - dispH) / 2,
      dispW,
      dispH,
    }
    geomRef.current = g

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 20])
      .on('start', () => setGrabbing(true))
      .on('zoom', (e) => {
        transformRef.current = e.transform
        drawRef.current()
        syncView()
      })
      .on('end', () => setGrabbing(false))

    zoomRef.current = zoom
    const sel = d3.select(canvas)
    sel.call(zoom)

    if (!initialApplied.current) {
      initialApplied.current = true
      if (initialView) {
        const ix = g.baseX + initialView.cu * g.dispW
        const iy = g.baseY + initialView.cv * g.dispH
        const t = d3.zoomIdentity
          .translate(size.w / 2 - initialView.k * ix, size.h / 2 - initialView.k * iy)
          .scale(initialView.k)
        sel.call(zoom.transform, t)
        transformRef.current = t
      }
    }
    draw()

    return () => {
      sel.on('.zoom', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded, size.w, size.h])

  useEffect(() => {
    draw()
  }, [draw])

  const findNearest = useCallback((sx: number, sy: number): number | null => {
    const g = geomRef.current
    const t = transformRef.current
    let best = -1
    let bestD = 16
    for (let i = 0; i < points.length; i++) {
      const px = t.x + t.k * (g.baseX + points[i].u * g.dispW)
      const py = t.y + t.k * (g.baseY + points[i].v * g.dispH)
      const d = Math.hypot(px - sx, py - sy)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best >= 0 ? best : null
  }, [points])

  function onPointerDownCanvas(e: React.PointerEvent) {
    pointerDown.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerUpCanvas(e: React.PointerEvent) {
    const down = pointerDown.current
    pointerDown.current = null
    if (!down) return
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return

    const rect = canvasRef.current!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    if (calibrate) {
      const g = geomRef.current
      const t = transformRef.current
      const u = ((sx - t.x) / t.k - g.baseX) / g.dispW
      const v = ((sy - t.y) / t.k - g.baseY) / g.dispH
      const l = landmarks[activeIdx]
      if (l) {
        setCalPoints((prev) => ({ ...prev, [l.id]: [u, v] }))
        setActiveIdx((i) => Math.min(i + 1, landmarks.length - 1))
      }
      return
    }

    selectWard(findNearest(sx, sy))
  }

  function resetView() {
    const canvas = canvasRef.current
    const zoom = zoomRef.current
    if (!canvas || !zoom) return
    d3.select(canvas).transition().duration(300).call(zoom.transform, d3.zoomIdentity)
  }

  function zoomBy(factor: number) {
    const canvas = canvasRef.current
    const zoom = zoomRef.current
    if (!canvas || !zoom) return
    d3.select(canvas).transition().duration(200).call(zoom.scaleBy, factor)
  }

  function updateLandmarkCoord(id: string, axis: 0 | 1, value: string) {
    const num = Number(value)
    setLandmarks((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const world: [number, number] = [...l.world]
        world[axis] = Number.isFinite(num) ? num : l.world[axis]
        return { ...l, world }
      }),
    )
  }

  function copyConfig() {
    if (!fit) return
    const payload = {
      affine: fit.affine.map((n) => Number(n.toFixed(8))),
      rms: Number(fit.rms.toFixed(5)),
      landmarks: landmarks.map((l) => ({ id: l.id, label: l.label, world: l.world })),
      points: calPoints,
    }
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const sel = selected != null ? points[selected] : null
  const placedCount = Object.keys(calPoints).length

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${grabbing ? styles.grabbing : ''} ${calibrate ? styles.calibrating : ''}`}
        onPointerDown={onPointerDownCanvas}
        onPointerUp={onPointerUpCanvas}
      />

      {sel && (
        <div className={styles.popup} ref={popupRef}>
          <button className={styles.popupClose} onClick={() => selectWard(null)} aria-label="Close">
            ×
          </button>
          <div className={styles.popupHeader}>
            <HeroImg heroId={sel.w.placer.hero} />
            <div>
              <div style={{ color: 'var(--color-text)' }}>{sel.w.placer.nickname}</div>
              <div style={{ color: sel.isDire ? DIRE : RADIANT, fontSize: '0.68rem' }}>
                {sel.isDire ? 'Dire' : 'Radiant'} · {sel.isSentry ? 'Sentry' : 'Observer'}
              </div>
            </div>
          </div>
          {sel.w.placerTeam && (
            <div className={styles.popupRow}>
              <span className={styles.popupLabel}>Team</span>
              <span style={{ color: 'var(--color-text)' }}>{sel.w.placerTeam.name}</span>
            </div>
          )}
          <div className={styles.popupRow}>
            <span className={styles.popupLabel}>Placed</span>
            <span>{fmtTime(sel.w.timePlaced)}</span>
          </div>
          <div className={styles.popupRow}>
            <span className={styles.popupLabel}>Destroyed</span>
            <span>{sel.w.timeDestroyed ? fmtTime(sel.w.timeDestroyed) : '—'}</span>
          </div>
          {sel.w.counterer && (
            <div className={styles.popupRow}>
              <span className={styles.popupLabel}>Dewarded by</span>
              <span style={{ color: 'var(--color-text)' }}>{sel.w.counterer.nickname}</span>
            </div>
          )}
          <div className={styles.popupRow}>
            <span className={styles.popupLabel}>Match</span>
            <a href={`/matches/${sel.w.matchId}`} target="_blank" rel="noreferrer">
              {sel.w.matchId}
            </a>
          </div>
        </div>
      )}

      {calibrate && (
        <div className={styles.calibratePanel}>
          <div className={styles.calibrateTitle}>Calibrate — {map.label}</div>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Select a landmark, then click its exact spot on the map. Edit world coords if needed.
          </div>
          {landmarks.map((l, i) => (
            <div
              key={l.id}
              className={`${styles.landmarkRow} ${i === activeIdx ? styles.landmarkActive : ''}`}
              onClick={() => setActiveIdx(i)}
            >
              <span
                className={styles.landmarkDot}
                style={{ background: calPoints[l.id] ? '#c48bc4' : 'var(--color-border)' }}
              />
              <span className={styles.landmarkName}>{l.label}</span>
              <input
                className={styles.coordInput}
                value={l.world[0]}
                onChange={(e) => updateLandmarkCoord(l.id, 0, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <input
                className={styles.coordInput}
                value={l.world[1]}
                onChange={(e) => updateLandmarkCoord(l.id, 1, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ))}
          <div className={styles.calibrateStat} style={{ marginTop: 8 }}>
            <span>Points placed</span>
            <span>{placedCount} / {landmarks.length}</span>
          </div>
          <div className={styles.calibrateStat}>
            <span>RMS error</span>
            <span style={{ color: fit && fit.rms < 0.01 ? RADIANT : 'var(--color-text)' }}>
              {fit ? `${(fit.rms * 100).toFixed(3)}%` : '—'}
            </span>
          </div>
          <div className={styles.calibrateActions}>
            <button className={styles.calBtn} onClick={() => { setCalPoints({}); setActiveIdx(0) }}>
              Clear
            </button>
            <button
              className={`${styles.calBtn} ${styles.calBtnPrimary}`}
              onClick={copyConfig}
              disabled={!fit}
            >
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.zoomControls}>
        <button className={styles.zoomBtn} onClick={() => zoomBy(1.6)} aria-label="Zoom in">
          +
        </button>
        <button className={styles.zoomBtn} onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">
          −
        </button>
        <button className={styles.zoomBtn} onClick={resetView} aria-label="Reset view" style={{ fontSize: '0.8rem' }}>
          ⤢
        </button>
      </div>

      {!calibrate && (
        <div className={styles.hint}>Scroll to zoom · drag to pan · click a ward for detail</div>
      )}
    </div>
  )
}

function HeroImg({ heroId }: { heroId: number }) {
  const hero = heroesById[String(heroId)]
  const pic = hero?.picture
  if (!pic) return null
  return <img className={styles.popupHero} src={heroImageUrl(pic)} alt={hero?.name ?? ''} />
}
