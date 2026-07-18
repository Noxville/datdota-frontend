import { Fragment } from 'react'
import { heroesById } from '../data/heroes'
import { heroImageUrl } from '../config'
import { type DraftStep, PHASE_BOUNDARIES } from '../lib/live'
import styles from './LiveDraft.module.css'

function heroName(id: number): string {
  return heroesById[String(id)]?.name ?? `Hero ${id}`
}

function heroPic(id: number): string | null {
  return heroesById[String(id)]?.picture ?? null
}

/** Two-row draft strip: bans/picks grouped by CM phase, columns aligned across sides. */
export default function LiveDraftView({ steps }: { steps: DraftStep[] }) {
  const phaseCount = PHASE_BOUNDARIES.length
  const radiantByPhase: DraftStep[][] = Array.from({ length: phaseCount }, () => [])
  const direByPhase: DraftStep[][] = Array.from({ length: phaseCount }, () => [])
  for (const s of steps) {
    if (s.side === 'radiant') radiantByPhase[s.phase].push(s)
    else direByPhase[s.phase].push(s)
  }
  const phaseWidths = radiantByPhase.map((r, i) => Math.max(r.length, direByPhase[i].length))

  return (
    <div className={styles.draftScroll}>
      <DraftSideRow label="Radiant" side="radiant" phases={radiantByPhase} widths={phaseWidths} />
      <DraftSideRow label="Dire" side="dire" phases={direByPhase} widths={phaseWidths} />
    </div>
  )
}

function DraftSideRow({
  label,
  side,
  phases,
  widths,
}: {
  label: string
  side: 'radiant' | 'dire'
  phases: DraftStep[][]
  widths: number[]
}) {
  const sideClass = side === 'radiant' ? styles.draftSideRadiant : styles.draftSideDire
  return (
    <div className={styles.draftSideRow}>
      <div className={`${styles.draftSideLabel} ${sideClass}`}>{label}</div>
      <div className={styles.draftSideCells}>
        {phases.map((phaseSteps, phaseIdx) => {
          const pad = widths[phaseIdx] - phaseSteps.length
          return (
            <Fragment key={`${side}-phase-${phaseIdx}`}>
              {phaseIdx > 0 && <span className={styles.draftPhaseGap} aria-hidden />}
              {phaseSteps.map((s) => (
                <DraftCell key={`${side}-${s.order}`} step={s} />
              ))}
              {Array.from({ length: pad }).map((_, j) => (
                <span key={`${side}-pad-${phaseIdx}-${j}`} className={styles.draftPadCell} aria-hidden />
              ))}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function DraftCell({ step }: { step: DraftStep }) {
  const banned = step.action === 'ban'
  const pic = step.heroId ? heroPic(step.heroId) : null
  const className = `${styles.draftCell} ${banned ? styles.draftCellBan : ''}`
  return (
    <div className={styles.draftCellWrap}>
      <div
        className={className}
        title={
          step.heroId
            ? `${banned ? 'Ban' : 'Pick'} #${step.order}: ${heroName(step.heroId)}`
            : `${banned ? 'Ban' : 'Pick'} #${step.order} (pending)`
        }
      >
        {pic ? (
          <img src={heroImageUrl(pic)} alt={heroName(step.heroId ?? 0)} className={styles.draftCellImg} />
        ) : (
          <div className={styles.draftCellPending} />
        )}
        {banned && <span className={styles.draftBanX}>×</span>}
      </div>
      <span className={styles.draftOrderCell}>{step.order}</span>
    </div>
  )
}
