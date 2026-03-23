import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getGlossaryEntry } from '../data/glossary'
import styles from './GlossaryTooltip.module.css'

interface Props {
  /** Glossary entry id (e.g. 'control-value') */
  id: string
  children: ReactNode
}

export default function GlossaryTooltip({ id, children }: Props) {
  const entry = getGlossaryEntry(id)
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)

  function open() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShow(true)
  }

  function close() {
    hideTimer.current = setTimeout(() => setShow(false), 150)
  }

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [])

  useEffect(() => {
    if (!show || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tipWidth = 280
    let left = rect.left + rect.width / 2 - tipWidth / 2
    if (left < 8) left = 8
    if (left + tipWidth > window.innerWidth - 8) left = window.innerWidth - tipWidth - 8
    setPos({
      top: rect.bottom + 6 + window.scrollY,
      left: left + window.scrollX,
    })
  }, [show])

  if (!entry) return <>{children}</>

  return (
    <>
      <span
        ref={triggerRef}
        className={styles.trigger}
        onMouseEnter={open}
        onMouseLeave={close}
      >
        {children}
        <span className={styles.indicator}>?</span>
      </span>
      {show && createPortal(
        <div
          ref={tipRef}
          className={styles.tooltip}
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={open}
          onMouseLeave={close}
        >
          <div className={styles.term}>{entry.term}</div>
          <div className={styles.summary}>{entry.summary}</div>
          <Link to={`/glossary#${entry.id}`} className={styles.link}>
            View in glossary &rarr;
          </Link>
        </div>,
        document.body,
      )}
    </>
  )
}
