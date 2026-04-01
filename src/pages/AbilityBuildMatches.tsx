import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useApiQuery } from '../api/queries'
import DataTable, { PlayerCell } from '../components/DataTable'
import EnigmaLoader from '../components/EnigmaLoader'
import { AbilitySequenceCell, abilityName } from '../components/AbilityIcon'
import styles from './PlayerPerformances.module.css'

/* ── Types ──────────────────────────────────────────────── */

interface BuildMatch {
  matchId: number
  player: { nickname: string; steamId: number; hero: number | null }
  win: boolean
  fullAbilities: number[]
}

/* ── Columns ───────────────────────────────────────────── */

const columns: ColumnDef<BuildMatch, unknown>[] = [
  {
    id: 'matchId',
    accessorKey: 'matchId',
    header: 'Match',
    size: 110,
    cell: ({ getValue }) => (
      <a
        href={`/matches/${getValue()}`}
        style={{ color: 'var(--color-accent-bright)', textDecoration: 'none', fontSize: '0.8rem' }}
      >
        {String(getValue())}
      </a>
    ),
  },
{
    id: 'player',
    accessorFn: (row) => row.player.nickname,
    header: 'Player',
    size: 160,
    cell: ({ row }) => (
      <PlayerCell steamId={row.original.player.steamId} nickname={row.original.player.nickname} />
    ),
  },
  {
    id: 'result',
    accessorFn: (row) => row.win ? 'Win' : 'Loss',
    header: 'Result',
    size: 70,
    cell: ({ getValue }) => {
      const v = getValue() as string
      return (
        <span style={{
          fontSize: '0.78rem',
          fontWeight: 600,
          color: v === 'Win' ? 'var(--color-win)' : 'var(--color-loss)',
        }}>
          {v}
        </span>
      )
    },
  },
  {
    id: 'fullBuild',
    accessorFn: (row) => row.fullAbilities.map((id) => abilityName(id)).join(' > '),
    header: 'Full Build',
    size: 500,
    enableSorting: false,
    cell: ({ row }) => <AbilitySequenceCell ids={row.original.fullAbilities} />,
  },
]

/* ── Page ──────────────────────────────────────────────── */

export default function AbilityBuildMatches() {
  const [searchParams] = useSearchParams()

  const apiParams = useMemo(() => {
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })
    return params
  }, [searchParams])

  const abilitiesParam = searchParams.get('abilities')

  // Build the query ability sequence for the subtitle
  const queryAbilities = useMemo(() => {
    if (!abilitiesParam) return []
    return abilitiesParam.split(',').map(Number).filter((n) => !isNaN(n))
  }, [abilitiesParam])

  const { data, isLoading, error } = useApiQuery<{ data: BuildMatch[] }>(
    abilitiesParam ? '/api/ability/builds/matches' : null,
    apiParams,
  )

  const rows = useMemo(() => data?.data ?? [], [data?.data])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Ability Build Matches</h1>
        {queryAbilities.length > 0 && (
          <div style={{ marginTop: 'var(--space-xs)' }}>
            <AbilitySequenceCell ids={queryAbilities} />
          </div>
        )}
      </div>

      {!abilitiesParam && (
        <div className={styles.empty}>
          <p>No ability build specified. Go to <a href="/abilities/builds?default=true" style={{ color: 'var(--color-accent-bright)' }}>Ability Builds</a> and click "View" on a build.</p>
        </div>
      )}

      {isLoading && <EnigmaLoader text="Loading matches..." />}

      {error && (
        <div className={styles.error}>
          Failed to load matches. {error instanceof Error ? error.message : ''}
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && abilitiesParam && (
        <div className={styles.empty}>
          <p>No matches found for this ability build.</p>
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          data={rows}
          columns={columns}
          defaultSorting={[{ id: 'matchId', desc: true }]}
          searchableColumns={['player']}
        />
      )}
    </div>
  )
}
