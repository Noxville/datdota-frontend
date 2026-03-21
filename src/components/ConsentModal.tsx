import { lazy, Suspense, useState } from 'react'
import styles from './ConsentModal.module.css'

const CONSENT_KEY = 'datdota-consent-accepted'

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

function setConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, '1')
  } catch {
    // localStorage unavailable — allow the user through anyway
  }
}

const Terms = lazy(() => import('../pages/Terms'))
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy'))
const DataPolicy = lazy(() => import('../pages/DataPolicy'))

type ViewingDoc = 'terms' | 'privacy' | 'data-policy' | null

export default function ConsentModal({ onAccept }: { onAccept: () => void }) {
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [viewing, setViewing] = useState<ViewingDoc>(null)

  const canAccept = termsChecked && privacyChecked

  function handleAccept() {
    if (!canAccept) return
    setConsent()
    onAccept()
  }

  function openDoc(e: React.MouseEvent, doc: ViewingDoc) {
    e.preventDefault()
    e.stopPropagation()
    setViewing(doc)
  }

  if (viewing) {
    return (
      <div className={styles.overlay}>
        <div className={`${styles.modal} ${styles.modalExpanded}`}>
          <button className={styles.backBtn} onClick={() => setViewing(null)}>
            &larr; Back
          </button>
          <div className={styles.docScroll}>
            <Suspense fallback={<p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Loading...</p>}>
              {viewing === 'terms' && <Terms />}
              {viewing === 'privacy' && <PrivacyPolicy />}
              {viewing === 'data-policy' && <DataPolicy />}
            </Suspense>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Welcome to datdota</h2>
        <p className={styles.intro}>
          Before continuing, please review and accept the following:
        </p>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={termsChecked}
            onChange={(e) => setTermsChecked(e.target.checked)}
            className={styles.checkbox}
          />
          <span>
            I agree to the{' '}
            <a href="/terms" className={styles.link} onClick={(e) => openDoc(e, 'terms')}>
              Terms of Service
            </a>
          </span>
        </label>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={privacyChecked}
            onChange={(e) => setPrivacyChecked(e.target.checked)}
            className={styles.checkbox}
          />
          <span>
            I have read the{' '}
            <a href="/privacy" className={styles.link} onClick={(e) => openDoc(e, 'privacy')}>
              Privacy Policy
            </a>
            {' '}and{' '}
            <a href="/data-policy" className={styles.link} onClick={(e) => openDoc(e, 'data-policy')}>
              Data Processing Policy
            </a>
          </span>
        </label>

        <button
          className={styles.acceptBtn}
          disabled={!canAccept}
          onClick={handleAccept}
        >
          Accept and Continue
        </button>

        <p className={styles.note}>
          datdota does not use tracking cookies. Your consent preference is stored locally in
          your browser only.
        </p>
      </div>
    </div>
  )
}
