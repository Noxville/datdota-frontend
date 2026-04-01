import { useState } from 'react'
import { abilityImageUrl } from '../config'
import { abilities } from '../data/abilities'

export function abilityName(id: number): string {
  const a = abilities[String(id)]
  return a?.longName || a?.shortName || `Ability ${id}`
}

function abilityIconUrl(id: number): string | null {
  const a = abilities[String(id)]
  return a?.shortName ? abilityImageUrl(a.shortName) : null
}

const placeholderStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  fontSize: '0.6rem',
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 2,
  color: 'var(--color-text-muted)',
  verticalAlign: 'middle',
}

export default function AbilityIcon({ id }: { id: number }) {
  const src = abilityIconUrl(id)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return <span style={placeholderStyle}>?</span>
  }

  return (
    <img
      src={src}
      alt=""
      style={{ height: 22, width: 22, borderRadius: 2, verticalAlign: 'middle', display: 'block' }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function AbilitySequenceCell({ ids }: { ids: number[] }) {
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {ids.map((id, i) => (
        <span key={i} title={`Lv ${i + 1}: ${abilityName(id)}`}>
          <AbilityIcon id={id} />
        </span>
      ))}
    </span>
  )
}
