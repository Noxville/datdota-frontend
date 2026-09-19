import { useState } from 'react'
import WardMap from '../components/WardMap'
import PageMeta from '../components/PageMeta'
import { MAP_VERSIONS, defaultMapVersion } from '../data/wardMaps'
import styles from './PlayerPerformances.module.css'

export default function MapCalibration() {
  const [mapId, setMapId] = useState(defaultMapVersion().id)
  const map = MAP_VERSIONS.find((m) => m.id === mapId) ?? defaultMapVersion()

  return (
    <div className={styles.page}>
      <PageMeta title="Map Calibration — datdota" description="Calibrate the pixel-to-world affine transform for a Dota 2 map render." />
      <div className={styles.header}>
        <h1>Map Calibration</h1>
        <p className={styles.subtitle}>
          Click each landmark on the map to fit the world-to-image transform. Copy the JSON into the map config.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Map version</label>
        <select
          value={mapId}
          onChange={(e) => setMapId(e.target.value)}
          style={{
            background: 'var(--color-bg-deep)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.78rem',
            padding: '4px 8px',
          }}
        >
          {MAP_VERSIONS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>
        <WardMap key={map.id} map={map} wards={[]} calibrate />
      </div>
    </div>
  )
}
