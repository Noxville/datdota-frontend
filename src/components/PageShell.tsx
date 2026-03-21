import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navigation from './Navigation'
import Footer from './Footer'
import ConsentModal, { hasConsent } from './ConsentModal'
import styles from './PageShell.module.css'

export default function PageShell() {
  const [consented, setConsented] = useState(hasConsent)

  return (
    <div className={styles.shell}>
      {!consented && <ConsentModal onAccept={() => setConsented(true)} />}
      <Navigation />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
