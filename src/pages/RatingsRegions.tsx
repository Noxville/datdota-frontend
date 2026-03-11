import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '../api/queries'
import { teamLogoUrl } from '../config'
import { TeamLogo } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import type { RatingEntry } from '../types'
import styles from './RatingsRegions.module.css'

/** Glicko-2 lower bound: μ − 2.5φ */
function glickoLB(mu: number | null, phi: number | null): number | null {
  if (mu === null || phi === null) return null
  return mu - 2.5 * phi
}

/** Format date as dd-MM-yyyy for the API */
function formatDateParam(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}-${m}-${y}`
}

interface RankedTeam {
  teamName: string
  valveId: number
  logoId: string | null
  rating: number | null
  globalRank: number
  regionalRank: number
}

const REGIONS: { key: string; label: string; apiRegions: string[] }[] = [
  { key: 'weu', label: 'Western Europe', apiRegions: ['eu'] },
  { key: 'eeu', label: 'Eastern Europe', apiRegions: ['cis'] },
  { key: 'cn', label: 'China', apiRegions: ['cn'] },
  { key: 'sea', label: 'South-East Asia', apiRegions: ['sea'] },
  { key: 'sa', label: 'South America', apiRegions: ['sa'] },
  { key: 'na', label: 'North America', apiRegions: ['na'] },
]

interface UnregionedTeam {
  teamName: string
  valveId: number
  logoId: string | null
}

function prepareRegionalData(data: RatingEntry[]) {
  // First, compute global rankings (same logic as /ratings)
  const globalRanked = data
    .map((entry) => ({
      ...entry,
      lb: glickoLB(entry.glicko2.mu, entry.glicko2.phi),
    }))
    .filter((r) => r.glicko2.phi !== null && r.glicko2.phi < 100)
    .sort((a, b) => (b.lb ?? 0) - (a.lb ?? 0))
    .map((r, i) => ({ ...r, globalRank: i + 1 }))

  const globalRankMap = new Map(globalRanked.map((r) => [r.valveId, r.globalRank]))
  const allApiRegions = REGIONS.flatMap((r) => r.apiRegions)

  // Group by region
  const regionData: Record<string, RankedTeam[]> = {}

  for (const region of REGIONS) {
    const teams = globalRanked
      .filter((r) => r.region !== null && region.apiRegions.includes(r.region))
      .sort((a, b) => (b.lb ?? 0) - (a.lb ?? 0))
      .map((r, i) => ({
        teamName: r.teamName,
        valveId: r.valveId,
        logoId: r.logoId,
        rating: r.lb,
        globalRank: globalRankMap.get(r.valveId) ?? 0,
        regionalRank: i + 1,
      }))

    regionData[region.key] = teams
  }

  // Teams without a known region
  const unregioned: UnregionedTeam[] = globalRanked
    .filter((r) => !r.region || !allApiRegions.includes(r.region))
    .map((r) => ({ teamName: r.teamName, valveId: r.valveId, logoId: r.logoId }))

  return { regionData, unregioned }
}

function FormatNum({ value, decimals = 0 }: { value: number | null; decimals?: number }) {
  if (value === null || value === undefined) return <span className={styles.muted}>—</span>
  return <>{value.toFixed(decimals)}</>
}


export default function RatingsRegions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const date = searchParams.get('date') ?? ''

  const setDate = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set('date', value)
        } else {
          next.delete('date')
        }
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const params = useMemo(() => {
    if (!date) return {}
    return { date: formatDateParam(date) }
  }, [date])

  const { data: raw, isLoading, error, refetch } = useApiQuery<{ data: RatingEntry[] }>(
    '/api/ratings',
    params,
  )

  const { regionData, unregioned } = useMemo(() => prepareRegionalData(raw?.data ?? []), [raw])

  const ratingDate = raw?.data?.[0]?.glickoRatingDate
    ? new Date(raw.data[0].glickoRatingDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Regional Ratings</h1>
          <p className={styles.subtitle}>
            Glicko-2 ratings grouped by region
            {ratingDate && <span className={styles.date}> — as of {ratingDate}</span>}
          </p>
        </div>
        <div className={styles.datePicker}>
          <label className={styles.dateLabel}>Historical date</label>
          <input
            type="date"
            className={styles.dateInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {date && (
            <button className={styles.clearDate} onClick={() => setDate('')}>
              Current
            </button>
          )}
        </div>
      </div>

      {isLoading && <EnigmaLoader text="Loading ratings..." />}

      {error && (
        <ErrorState
          message="Failed to load ratings"
          detail={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => refetch()}
        />
      )}

      {raw && (
        <div className={styles.regions}>
          {REGIONS.map((region) => {
            const teams = regionData[region.key] ?? []
            return (
              <div key={region.key} className={styles.regionCard}>
                <div className={styles.regionHeader}>
                  <span className={styles.regionName}>{region.label}</span>
                  <span className={styles.regionCount}>
                    {teams.length} team{teams.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <table className={styles.regionTable}>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th className={styles.numeric}>Rating</th>
                      <th className={styles.numeric}>Regional</th>
                      <th className={styles.numeric}>Global</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '16px 10px' }}>
                          <span className={styles.muted}>No teams</span>
                        </td>
                      </tr>
                    )}
                    {teams.map((team) => (
                      <tr key={team.valveId}>
                        <td>
                          <a href={`/teams/${team.valveId}`} className={styles.teamLink}>
                            <TeamLogo
                              logoUrl={team.logoId ? teamLogoUrl(team.logoId) : undefined}
                              name={team.teamName}
                              className={styles.teamLogo}
                            />
                            {team.teamName}
                          </a>
                        </td>
                        <td className={styles.numeric}><FormatNum value={team.rating} /></td>
                        <td className={styles.numeric}>{team.regionalRank}</td>
                        <td className={styles.numeric}>{team.globalRank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {unregioned.length > 0 && (
        <div className={styles.unregioned}>
          <span className={styles.unregionedLabel}>Teams without region:</span>
          {unregioned.map((team) => (
            <a key={team.valveId} href={`/teams/${team.valveId}`} title={team.teamName}>
              <TeamLogo
                logoUrl={team.logoId ? teamLogoUrl(team.logoId) : undefined}
                name={team.teamName}
                className={styles.unregionedLogo}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
