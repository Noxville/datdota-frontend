import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navigation from './Navigation'
import Footer from './Footer'
import ConsentModal, { hasConsent } from './ConsentModal'
import GlobalSearch from './GlobalSearch'
import { useCanonical } from '../hooks/useCanonical'
import styles from './PageShell.module.css'

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export default function PageShell() {
  const [consented, setConsented] = useState(hasConsent)
  const [searchOpen, setSearchOpen] = useState(false)
  useCanonical()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return
      }
      // "/" opens search when not already typing somewhere
      if (e.key === '/' && !searchOpen && !isEditableTarget(e.target)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  return (
    <div className={styles.shell}>
      {!consented && <ConsentModal onAccept={() => setConsented(true)} />}
      <Navigation onOpenSearch={() => setSearchOpen(true)} />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
