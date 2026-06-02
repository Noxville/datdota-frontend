import { useEffect, useState } from 'react'
import styles from './MatchIdsModal.module.css'

interface Props {
  title?: string
  matchIds: number[]
  onClose: () => void
}

export default function MatchIdsModal({ title = 'Match IDs', matchIds, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const csv = matchIds.join(', ')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(csv)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore; user can still select the textarea manually
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{title}</h3>
            <div className={styles.meta}>{matchIds.length.toLocaleString()} matches</div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${copied ? styles.copied : ''}`}
              onClick={copy}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className={styles.btn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <textarea className={styles.textarea} value={csv} readOnly onFocus={(e) => e.target.select()} />
      </div>
    </div>
  )
}
