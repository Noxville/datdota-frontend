import type { ReactNode } from 'react'
import styles from './Outcome.module.css'

/**
 * Wraps content (hero icons, a team name, a logo…) and marks it as the winning
 * or losing side of a match — a teal glow for the winner, a receded/desaturated
 * treatment for the loser. Replaces directional win/loss arrows.
 */
export default function Outcome({
  won,
  subtle = false,
  children,
  className = '',
}: {
  won: boolean
  /** Lighter glow + thinner ring, for sparse content (e.g. a logo + name). */
  subtle?: boolean
  children: ReactNode
  className?: string
}) {
  const winClass = subtle ? styles.winSubtle : styles.win
  return (
    <span className={`${styles.outcome} ${won ? winClass : styles.loss} ${className}`}>
      {children}
    </span>
  )
}
