import React from 'react'
import styles from './EnigmaLoader.module.css'

/* ── Pixel-art sprite data ──────────────────────────────────
   15 columns × 18 rows. Each char maps to a colour.
   '.' = transparent                                         */
const SPRITE = [
  '......ttt......', // 0  turban tip
  '.....ttttt.....', // 1  turban upper
  '....tttjttt....', // 2  turban + jewel
  '....ttttttt....', // 3  turban base
  '.....ddddd.....', // 4  head
  '.....dedded....', // 5  eyes  (note: asymmetric to look right at 1px)
  '.....ddmdd.....', // 6  mouth
  '......ddd......', // 7  neck
  '.aa...ddd...aa.', // 8  hands raised
  '..aa..ddd..aa..', // 9  upper arms
  '...a.ddddd.a...', // 10 shoulders
  '.....ddddd.....', // 11 upper torso
  '.....dcdcd.....', // 12 chest cosmic
  '.....ddddd.....', // 13 lower torso
  '.....bbbbb.....', // 14 belt
  '.....dd.dd.....', // 15 upper legs
  '.....dd.dd.....', // 16 lower legs
  '.....ff.ff.....', // 17 feet
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
  f: '#1a0a30', // feet
}

const PX = 4 // pixel scale

function PixelSprite({ x, y }: { x: number; y: number }) {
  const rects: React.ReactElement[] = []
  for (let row = 0; row < SPRITE.length; row++) {
    for (let col = 0; col < SPRITE[row].length; col++) {
      const ch = SPRITE[row][col]
      if (ch === '.') continue
      rects.push(
        <rect
          key={`${row}-${col}`}
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

/**
 * Pixel-art Enigma channelling Black Hole (Interstellar-inspired).
 */
export default function EnigmaLoader({ text = 'Loading...' }: { text?: string }) {
  // Sprite is 15 cols × 18 rows at PX=4 → 60 × 72
  // We'll place it bottom-center of a 200×200 viewBox
  const spriteW = 15 * PX
  const spriteX = (200 - spriteW) / 2

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
            <ellipse
              cx="100" cy="58" rx="48" ry="14"
              fill="none"
              stroke="url(#diskWarm)"
              strokeWidth="4"
              clipPath="url(#diskClipBack)"
              opacity="0.7"
            />
            <ellipse
              cx="100" cy="58" rx="44" ry="12"
              fill="none"
              stroke="#ffc040"
              strokeWidth="1.5"
              clipPath="url(#diskClipBack)"
              opacity="0.4"
            />
          </g>

          {/* Gravitational lensing ring (Einstein ring) — vertical halo */}
          <ellipse
            className={styles.lensRing}
            cx="100" cy="58" rx="26" ry="30"
            fill="url(#bhLens)"
          />

          {/* Photon sphere — bright ring right at event horizon */}
          <circle cx="100" cy="58" r="22" fill="url(#bhPhoton)" />

          {/* The void */}
          <circle cx="100" cy="58" r="14" fill="url(#bhVoid)" />

          {/* Accretion disk — FRONT half (in front of the void) */}
          <g className={styles.diskSpin}>
            <ellipse
              cx="100" cy="58" rx="48" ry="14"
              fill="none"
              stroke="url(#diskWarm)"
              strokeWidth="5"
              clipPath="url(#diskClipFront)"
            />
            <ellipse
              cx="100" cy="58" rx="44" ry="12"
              fill="none"
              stroke="#ffe8a0"
              strokeWidth="1.5"
              clipPath="url(#diskClipFront)"
              opacity="0.6"
            />
            {/* Hot inner edge */}
            <ellipse
              cx="100" cy="58" rx="38" ry="10"
              fill="none"
              stroke="#fff4d0"
              strokeWidth="1"
              clipPath="url(#diskClipFront)"
              opacity="0.3"
            />
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
          <PixelSprite x={spriteX} y={122} />
        </g>

        {/* Channelling energy lines from hands to black hole */}
        <line className={styles.beam1} x1={spriteX + 1 * PX} y1={122 + 8 * PX} x2="72" y2="70" stroke="#c48bc4" strokeWidth="0.8" opacity="0.5" />
        <line className={styles.beam2} x1={spriteX + 13 * PX} y1={122 + 8 * PX} x2="128" y2="70" stroke="#c48bc4" strokeWidth="0.8" opacity="0.5" />
      </svg>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  )
}
