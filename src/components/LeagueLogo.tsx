import { useState } from 'react'
import { leagueLogoUrl } from '../config'

interface LeagueLogoProps {
  leagueId: number
  size?: number
  className?: string
}

export default function LeagueLogo({ leagueId, size = 24, className }: LeagueLogoProps) {
  const [failed, setFailed] = useState(false)

  if (failed || !leagueId) return null

  return (
    <img
      src={leagueLogoUrl(leagueId)}
      alt=""
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: 2 }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
