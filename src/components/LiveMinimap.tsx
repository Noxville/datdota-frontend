import { miniHeroImageUrl } from '../config'
import styles from './LiveMinimap.module.css'

/* Dota 2 world coordinates span roughly -8288..8288; the 7.39 minimap image
 * is calibrated against that range. Calibration constants are carried over from
 * the dota-live reference tool (tuned at a 543px render, expressed here as
 * percentages so the map stays responsive). */
const DOTA_MAP_MIN = -8288
const DOTA_MAP_MAX = 8288
const DOTA_MAP_RANGE = DOTA_MAP_MAX - DOTA_MAP_MIN

export interface MinimapHero {
  key: string
  x: number
  y: number
  picture: string | null
  side: 'radiant' | 'dire'
  dead?: boolean
  respawn?: number
  level?: number
  label?: string
}

export interface MinimapBuilding {
  key: string
  x: number
  y: number
  type: 'tower' | 'rax' | 'ancient' | 'outpost'
  side: 'radiant' | 'dire'
  destroyed?: boolean
  hpFrac?: number
  label?: string
}

const BUILDING_ICON: Record<MinimapBuilding['type'], string> = {
  tower: '/minimap_icons/minimap_tower90.png',
  rax: '/minimap_icons/minimap_racks90.png',
  ancient: '/minimap_icons/minimap_ancient.png',
  outpost: '/minimap_icons/minimap_miscbuilding.png',
}

function leftPct(x: number): number {
  return ((x - DOTA_MAP_MIN) / DOTA_MAP_RANGE) * 100
}

function topPct(y: number): number {
  return (1 - (y - DOTA_MAP_MIN) / DOTA_MAP_RANGE) * 100
}

export default function LiveMinimap({
  heroes,
  buildings,
}: {
  heroes: MinimapHero[]
  buildings: MinimapBuilding[]
}) {
  return (
    <div className={styles.wrap}>
      <img className={styles.bg} src="/minimap_7_39.png" alt="" aria-hidden />
      <div className={styles.layer}>
        {buildings
          .filter((b) => !b.destroyed)
          .map((b) => (
            <div
              key={b.key}
              className={`${styles.building} ${b.side === 'radiant' ? styles.tintRadiant : styles.tintDire}`}
              style={{ left: `${leftPct(b.x)}%`, top: `${topPct(b.y)}%`, opacity: b.hpFrac != null ? Math.max(0.5, b.hpFrac) : 1 }}
              title={b.label ?? `${b.side} ${b.type}`}
            >
              <img className={styles.buildingImg} src={BUILDING_ICON[b.type]} alt="" aria-hidden />
              <span className={styles.tint} aria-hidden />
            </div>
          ))}

        {heroes.map((h) => (
          <div
            key={h.key}
            className={`${styles.hero} ${h.side === 'radiant' ? styles.heroRadiant : styles.heroDire} ${h.dead ? styles.dead : ''}`}
            style={{ left: `${leftPct(h.x)}%`, top: `${topPct(h.y)}%` }}
            title={h.label ?? ''}
          >
            {h.picture ? (
              <img className={styles.heroImg} src={miniHeroImageUrl(h.picture)} alt="" />
            ) : (
              <span className={styles.heroLevel}>{h.level ?? '?'}</span>
            )}
            {h.dead && h.respawn != null && h.respawn > 0 && (
              <span className={styles.respawn}>{Math.ceil(h.respawn)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
