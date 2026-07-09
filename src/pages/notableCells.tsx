import { heroImageUrl } from '../config'
import { heroesById } from '../data/heroes'
import styles from './Notable.module.css'

export function MatchLink({ matchId }: { matchId: number }) {
  return <a href={`/matches/${matchId}`} className={styles.link}>{matchId}</a>
}

export function LeagueCell({
  leagueId,
  leagueName,
  isLan,
}: {
  leagueId?: number
  leagueName: string
  isLan: boolean
}) {
  return (
    <span className={styles.leagueCell}>
      {leagueId ? (
        <a href={`/leagues/${leagueId}`} className={styles.leagueLink} title={leagueName}>{leagueName}</a>
      ) : (
        <span className={styles.leagueText} title={leagueName}>{leagueName}</span>
      )}
      {isLan && <span className={styles.lanBadge}>LAN</span>}
    </span>
  )
}

export function HeroIcons({ heroIds }: { heroIds: number[] }) {
  if (!heroIds || heroIds.length === 0) return <span className={styles.muted}>—</span>
  return (
    <span className={styles.heroRow}>
      {heroIds.map((id) => {
        const hero = heroesById[String(id)]
        const name = hero?.name ?? `Hero ${id}`
        return hero?.picture ? (
          <img
            key={id}
            src={heroImageUrl(hero.picture)}
            alt={name}
            title={name}
            className={styles.heroIcon}
            loading="lazy"
          />
        ) : (
          <span key={id} className={styles.muted} title={name}>{name}</span>
        )
      })}
    </span>
  )
}
