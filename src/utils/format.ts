/** Format seconds as m:ss, handling negatives correctly (e.g. -52.5 → "-0:53") */
export function fmtTime(secs: number | null | undefined): string {
  if (secs === null || secs === undefined || (secs === 0 && secs !== 0)) return '—'
  const sign = secs < 0 ? '-' : ''
  const abs = Math.abs(secs)
  const m = Math.floor(abs / 60)
  const s = Math.round(abs % 60)
  return `${sign}${m}:${s.toString().padStart(2, '0')}`
}
