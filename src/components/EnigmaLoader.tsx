import React from 'react'
import styles from './EnigmaLoader.module.css'

/* ── Pixel-art sprite data ──────────────────────────────────
   15 columns × 15 rows. Each char maps to a colour.
   '.' = transparent
   Arms are separate so they can be animated independently.
   Bottom is ethereal wisps instead of legs/feet.              */

// Main body (no arms, no legs)
const BODY = [
  '......ttt......', // 0  turban tip
  '.....ttttt.....', // 1  turban upper
  '....tttjttt....', // 2  turban + jewel
  '....ttttttt....', // 3  turban base
  '.....ddddd.....', // 4  head
  '.....dedded....', // 5  eyes
  '.....ddmdd.....', // 6  mouth
  '......ddd......', // 7  neck
  '......ddd......', // 8  upper torso (no hands here)
  '......ddd......', // 9  mid torso
  '.....ddddd.....', // 10 shoulders
  '.....ddddd.....', // 11 upper torso
  '.....dcdcd.....', // 12 chest cosmic
  '.....ddddd.....', // 13 lower torso
  '.....bbbbb.....', // 14 belt
]

// Left arm segments (each row is an arm segment, animated with wave delay)
// Segments go from shoulder outward: shoulder, upper, mid, lower, hand
const LEFT_ARM = [
  { col: 4, row: 10, ch: 'a' },  // shoulder joint
  { col: 3, row: 9, ch: 'a' },   // upper arm
  { col: 2, row: 8, ch: 'a' },   // mid arm
  { col: 1, row: 8, ch: 'a' },   // lower arm
  { col: 0, row: 8, ch: 'a' },   // hand
]

const RIGHT_ARM = [
  { col: 10, row: 10, ch: 'a' },
  { col: 11, row: 9, ch: 'a' },
  { col: 12, row: 8, ch: 'a' },
  { col: 13, row: 8, ch: 'a' },
  { col: 14, row: 8, ch: 'a' },
]

// Ethereal bottom wisps — multiple rows that fade out
const WISPS = [
  { row: 0, pixels: '.....ddddd.....', opacity: 0.9 },
  { row: 1, pixels: '......ddd......', opacity: 0.7 },
  { row: 2, pixels: '.....dd.dd.....', opacity: 0.5 },
  { row: 3, pixels: '......d.d......', opacity: 0.35 },
  { row: 4, pixels: '.....d...d.....', opacity: 0.2 },
  { row: 5, pixels: '......d.d......', opacity: 0.12 },
  { row: 6, pixels: '.......d.......', opacity: 0.06 },
]

const PALETTE: Record<string, string> = {
  t: '#c9a84c', // turban gold
  j: '#ff4466', // jewel
  d: '#3d1a5c', // body purple
  e: '#c48bc4', // eye glow
  m: '#1a0a30', // mouth
  a: '#5c2d82', // arm highlight
  c: '#7b3f9e', // cosmic chest
  b: '#2a1040', // belt
}

const PX = 4

function BodySprite({ x, y }: { x: number; y: number }) {
  const rects: React.ReactElement[] = []
  for (let row = 0; row < BODY.length; row++) {
    for (let col = 0; col < BODY[row].length; col++) {
      const ch = BODY[row][col]
      if (ch === '.') continue
      rects.push(
        <rect
          key={`b-${row}-${col}`}
          x={x + col * PX}
          y={y + row * PX}
          width={PX}
          height={PX}
          fill={PALETTE[ch]}
        />,
      )
    }
  }
  return <g>{rects}</g>
}

function ArmSegments({ x, y, segments, side }: {
  x: number; y: number
  segments: typeof LEFT_ARM
  side: 'left' | 'right'
}) {
  return (
    <g>
      {segments.map((seg, i) => (
        <rect
          key={`${side}-${i}`}
          className={styles[`arm${side === 'left' ? 'L' : 'R'}${i}`]}
          x={x + seg.col * PX}
          y={y + seg.row * PX}
          width={PX}
          height={PX}
          fill={PALETTE[seg.ch]}
        />
      ))}
    </g>
  )
}

function WispLayer({ x, y, wispData }: {
  x: number; y: number
  wispData: typeof WISPS
}) {
  const rects: React.ReactElement[] = []
  for (const wisp of wispData) {
    for (let col = 0; col < wisp.pixels.length; col++) {
      const ch = wisp.pixels[col]
      if (ch === '.') continue
      rects.push(
        <rect
          key={`w-${wisp.row}-${col}`}
          className={styles[`wisp${wisp.row}`]}
          x={x + col * PX}
          y={y + wisp.row * PX}
          width={PX}
          height={PX}
          fill={PALETTE[ch]}
          opacity={wisp.opacity}
        />,
      )
    }
  }
  return <g className={styles.wisps}>{rects}</g>
}

/**
 * Pixel-art Enigma channelling Black Hole (Interstellar-inspired).
 * Waving arms + ethereal ghostly bottom.
 */
export default function EnigmaLoader({ text = 'Loading...' }: { text?: string }) {
  const spriteW = 15 * PX
  const spriteX = (200 - spriteW) / 2
  const bodyY = 122
  const wispY = bodyY + BODY.length * PX // wisps start right after belt

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.enigma}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Black hole centre gradient */}
          <radialGradient id="bhVoid">
            <stop offset="0%" stopColor="#000" />
            <stop offset="70%" stopColor="#000" />
            <stop offset="100%" stopColor="#0a0515" />
          </radialGradient>

          {/* Photon ring glow */}
          <radialGradient id="bhPhoton">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="72%" stopColor="#e8a030" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#fff4d0" stopOpacity="0.9" />
            <stop offset="88%" stopColor="#e8a030" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>

          {/* Accretion disk gradient — warm side */}
          <linearGradient id="diskWarm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff6a00" stopOpacity="0.0" />
            <stop offset="20%" stopColor="#ff8c00" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#ffc040" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#ff8c00" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ff6a00" stopOpacity="0.0" />
          </linearGradient>

          {/* Outer haze */}
          <radialGradient id="bhHaze">
            <stop offset="0%" stopColor="#ff8c00" stopOpacity="0" />
            <stop offset="40%" stopColor="#ff8c00" stopOpacity="0" />
            <stop offset="70%" stopColor="#c45800" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ff6a00" stopOpacity="0" />
          </radialGradient>

          {/* Lensing ring — the light bent over the top */}
          <radialGradient id="bhLens">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="78%" stopColor="#ffa030" stopOpacity="0.3" />
            <stop offset="84%" stopColor="#ffe0a0" stopOpacity="0.5" />
            <stop offset="90%" stopColor="#ffa030" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>

          {/* Clip for accretion disk behind the hole */}
          <clipPath id="diskClipBack">
            <rect x="50" y="68" width="100" height="40" />
          </clipPath>
          <clipPath id="diskClipFront">
            <rect x="50" y="40" width="100" height="28" />
          </clipPath>
        </defs>

        {/* ═══ BLACK HOLE ═══ centred at 100, 58 */}
        <g className={styles.blackhole}>
          {/* Outer haze glow */}
          <circle className={styles.haze} cx="100" cy="58" r="52" fill="url(#bhHaze)" />

          {/* Accretion disk — BACK half (behind the void) */}
          <g className={styles.diskSpin}>
            <ellipse cx="100" cy="58" rx="48" ry="14" fill="none" stroke="url(#diskWarm)" strokeWidth="4" clipPath="url(#diskClipBack)" opacity="0.7" />
            <ellipse cx="100" cy="58" rx="44" ry="12" fill="none" stroke="#ffc040" strokeWidth="1.5" clipPath="url(#diskClipBack)" opacity="0.4" />
          </g>

          {/* Gravitational lensing ring (Einstein ring) — vertical halo */}
          <ellipse className={styles.lensRing} cx="100" cy="58" rx="26" ry="30" fill="url(#bhLens)" />

          {/* Photon sphere — bright ring right at event horizon */}
          <circle cx="100" cy="58" r="22" fill="url(#bhPhoton)" />

          {/* The void */}
          <circle cx="100" cy="58" r="14" fill="url(#bhVoid)" />

          {/* Accretion disk — FRONT half (in front of the void) */}
          <g className={styles.diskSpin}>
            <ellipse cx="100" cy="58" rx="48" ry="14" fill="none" stroke="url(#diskWarm)" strokeWidth="5" clipPath="url(#diskClipFront)" />
            <ellipse cx="100" cy="58" rx="44" ry="12" fill="none" stroke="#ffe8a0" strokeWidth="1.5" clipPath="url(#diskClipFront)" opacity="0.6" />
            <ellipse cx="100" cy="58" rx="38" ry="10" fill="none" stroke="#fff4d0" strokeWidth="1" clipPath="url(#diskClipFront)" opacity="0.3" />
          </g>

          {/* Orbiting particles being sucked in */}
          <circle className={styles.particle1} cx="100" cy="58" r="1.5" fill="#ffc040" />
          <circle className={styles.particle2} cx="100" cy="58" r="1" fill="#ff8c00" />
          <circle className={styles.particle3} cx="100" cy="58" r="1.2" fill="#ffe0a0" />
          <circle className={styles.particle4} cx="100" cy="58" r="0.8" fill="#ffa050" />
          <circle className={styles.particle5} cx="100" cy="58" r="1.4" fill="#ffcc60" />
        </g>

        {/* ═══ ENIGMA (pixel art) ═══ */}
        <g className={styles.sprite}>
          <BodySprite x={spriteX} y={bodyY} />
          <ArmSegments x={spriteX} y={bodyY} segments={LEFT_ARM} side="left" />
          <ArmSegments x={spriteX} y={bodyY} segments={RIGHT_ARM} side="right" />
          <WispLayer x={spriteX} y={wispY} wispData={WISPS} />
        </g>

        {/* Channelling energy lines from hands to black hole */}
        <line className={styles.beam1} x1={spriteX + 0 * PX} y1={bodyY + 8 * PX} x2="72" y2="70" stroke="#c48bc4" strokeWidth="0.8" opacity="0.5" />
        <line className={styles.beam2} x1={spriteX + 14 * PX} y1={bodyY + 8 * PX} x2="128" y2="70" stroke="#c48bc4" strokeWidth="0.8" opacity="0.5" />
      </svg>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  )
}
