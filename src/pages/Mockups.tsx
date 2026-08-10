import { useState } from 'react'
import EnigmaLoader from '../components/EnigmaLoader'
import ErrorState from '../components/ErrorState'
import PageMeta from '../components/PageMeta'
import styles from './Mockups.module.css'

/* ── Font pairings to explore ────────────────────────────────
   Each keeps a monospace "data" face (the site is data-heavy) but swaps in a
   display face with more character. All load from Google Fonts except the
   current pairing, which is self-hosted. To ship one, copy its --display /
   --body into --font-display / --font-body in styles/global.css. */

interface FontOption {
  key: string
  name: string
  personality: string
  desc: string
  display: string
  body: string
  displayName: string
  bodyName: string
  displayWeight: number
  bodyWeight: number
}

const FONT_OPTIONS: FontOption[] = [
  {
    key: 'current',
    name: 'Plus Jakarta Sans',
    personality: 'Crisp & modern',
    desc: 'Current pairing. Plus Jakarta Sans 800 + Fira Code 300 — contemporary geometric with generous x-height and open apertures.',
    display: "'Plus Jakarta Sans', sans-serif",
    body: "'Fira Code', monospace",
    displayName: 'Plus Jakarta Sans 800',
    bodyName: 'Fira Code 300',
    displayWeight: 800,
    bodyWeight: 300,
  },
  {
    key: 'grotesk',
    name: 'Space Grotesk',
    personality: 'Technical & quirky',
    desc: 'Space Grotesk 700 + IBM Plex Mono 400 — a proportional grotesk with odd, engineered details paired with IBM’s technical mono.',
    display: "'Space Grotesk', sans-serif",
    body: "'IBM Plex Mono', monospace",
    displayName: 'Space Grotesk 700',
    bodyName: 'IBM Plex Mono 400',
    displayWeight: 700,
    bodyWeight: 400,
  },
  {
    key: 'archivo',
    name: 'Archivo',
    personality: 'Bold & engineered',
    desc: 'Archivo 800 + JetBrains Mono 400 — a sturdy American grotesque with real weight, over a coder’s mono built for dense numerals.',
    display: "'Archivo', sans-serif",
    body: "'JetBrains Mono', monospace",
    displayName: 'Archivo 800',
    bodyName: 'JetBrains Mono 400',
    displayWeight: 800,
    bodyWeight: 400,
  },
  {
    key: 'bricolage',
    name: 'Bricolage Grotesque',
    personality: 'Editorial & characterful',
    desc: 'Bricolage Grotesque 800 + Red Hat Mono 400 — a warm, slightly irregular display face with editorial personality over a clean mono.',
    display: "'Bricolage Grotesque', sans-serif",
    body: "'Red Hat Mono', monospace",
    displayName: 'Bricolage Grotesque 800',
    bodyName: 'Red Hat Mono 400',
    displayWeight: 800,
    bodyWeight: 400,
  },
  {
    key: 'sora',
    name: 'Sora',
    personality: 'Geometric & fresh',
    desc: 'Sora 800 + Spline Sans Mono 400 — a low-contrast geometric sans with quiet quirks, paired with a modern, rounded data mono.',
    display: "'Sora', sans-serif",
    body: "'Spline Sans Mono', monospace",
    displayName: 'Sora 800',
    bodyName: 'Spline Sans Mono 400',
    displayWeight: 800,
    bodyWeight: 400,
  },
  {
    key: 'chivo',
    name: 'Chivo',
    personality: 'Unified superfamily',
    desc: 'Chivo 900 + Chivo Mono 300 — one type family in two flavours: a hard-edged grotesque display over its matching monospace, for total cohesion.',
    display: "'Chivo', sans-serif",
    body: "'Chivo Mono', monospace",
    displayName: 'Chivo 900',
    bodyName: 'Chivo Mono 300',
    displayWeight: 900,
    bodyWeight: 300,
  },
]

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Space+Grotesk:wght@300..700',
    'family=IBM+Plex+Mono:wght@300;400;500;600;700',
    'family=Archivo:wght@300..900',
    'family=JetBrains+Mono:wght@300..800',
    'family=Bricolage+Grotesque:opsz,wght@12..96,200..800',
    'family=Red+Hat+Mono:wght@300..700',
    'family=Sora:wght@100..800',
    'family=Spline+Sans+Mono:wght@300..700',
    'family=Chivo:wght@100..900',
    'family=Chivo+Mono:wght@100..900',
  ].join('&') +
  '&display=swap'

const SAMPLE_HEROES = [
  { name: 'Anti-Mage', games: 1247, wins: 612, winrate: 49.08, picks: 892, bans: 1583 },
  { name: 'Invoker', games: 2341, wins: 1198, winrate: 51.18, picks: 1876, bans: 2104 },
  { name: 'Marci', games: 876, wins: 471, winrate: 53.77, picks: 654, bans: 1921 },
  { name: 'Io', games: 1563, wins: 834, winrate: 53.36, picks: 987, bans: 2876 },
  { name: 'Pangolier', games: 1102, wins: 540, winrate: 49.00, picks: 788, bans: 1245 },
  { name: 'Rubick', games: 2187, wins: 1071, winrate: 48.97, picks: 1654, bans: 1432 },
]

const COLORS = [
  { name: 'bg-deep', var: '--color-bg-deep', hex: '#0a0a12' },
  { name: 'bg', var: '--color-bg', hex: '#0f0f1a' },
  { name: 'bg-raised', var: '--color-bg-raised', hex: '#16162a' },
  { name: 'bg-elevated', var: '--color-bg-elevated', hex: '#1e1e38' },
  { name: 'primary', var: '--color-primary', hex: '#c48bc4' },
  { name: 'primary-dim', var: '--color-primary-dim', hex: '#9a6a9a' },
  { name: 'accent', var: '--color-accent', hex: '#19aa8d' },
  { name: 'accent-bright', var: '--color-accent-bright', hex: '#2dd4bf' },
  { name: 'win', var: '--color-win', hex: '#2dd4bf' },
  { name: 'loss', var: '--color-loss', hex: '#f87171' },
  { name: 'radiant', var: '--color-radiant', hex: '#6ee7b7' },
  { name: 'dire', var: '--color-dire', hex: '#fca5a5' },
]

function WinrateBar({ value }: { value: number }) {
  const isWin = value >= 50
  return (
    <div className={styles.winrateBar}>
      <div
        className={styles.winrateFill}
        style={{
          width: `${value}%`,
          background: isWin ? 'var(--color-win)' : 'var(--color-loss)',
          opacity: 0.25 + (Math.abs(value - 50) / 50) * 0.75,
        }}
      />
      <span className={styles.winrateText} style={{ color: isWin ? 'var(--color-win)' : 'var(--color-loss)' }}>
        {value.toFixed(1)}%
      </span>
    </div>
  )
}

export default function Mockups() {
  const [fontIdx, setFontIdx] = useState(0)
  const font = FONT_OPTIONS[fontIdx]

  return (
    <>
      <PageMeta title="datdota Styleguide" description="datdota design system styleguide and mockup playground." noindex />
      {/* Load the candidate fonts (Google Fonts) — scoped to this page's use.
          React 19 hoists these link/style tags into <head>. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      <div
        className={styles.mockups}
        style={
          {
            '--mock-display': font.display,
            '--mock-body': font.body,
            '--mock-display-weight': font.displayWeight,
            '--mock-body-weight': font.bodyWeight,
          } as React.CSSProperties
        }
      >
        {/* Font Explorer */}
        <section className={styles.fontExplorer}>
          <h3 className={styles.sectionTitle}>Font Explorer</h3>
          <p className={styles.explorerHint}>
            Pick a pairing — every sample below updates live. To ship one, copy its display / body
            into <code>--font-display</code> / <code>--font-body</code> in <code>styles/global.css</code>.
          </p>
          <div className={styles.fontOptions}>
            {FONT_OPTIONS.map((o, i) => (
              <button
                key={o.key}
                type="button"
                className={`${styles.fontOption} ${i === fontIdx ? styles.fontOptionActive : ''}`}
                onClick={() => setFontIdx(i)}
              >
                <span className={styles.fontOptionName} style={{ fontFamily: o.display, fontWeight: o.displayWeight }}>
                  {o.name}
                </span>
                <span className={styles.fontOptionMeta} style={{ fontFamily: o.body, fontWeight: o.bodyWeight }}>
                  {o.personality}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Font Pairing */}
        <div className={styles.pairingInfo}>
          <div className={styles.pairingMeta}>
            <span className={styles.pairingPersonality}>{font.personality}</span>
            <p className={styles.pairingDesc}>{font.desc}</p>
          </div>
          <div className={styles.fontSpecs}>
            <div className={styles.fontSpec}>
              <span className={styles.fontSpecLabel}>Display</span>
              <span className={styles.fontSpecValue} style={{ fontFamily: font.display, fontWeight: font.displayWeight }}>
                {font.displayName}
              </span>
            </div>
            <div className={styles.fontSpec}>
              <span className={styles.fontSpecLabel}>Body / Data</span>
              <span className={styles.fontSpecValue} style={{ fontFamily: font.body, fontWeight: font.bodyWeight }}>
                {font.bodyName}
              </span>
            </div>
          </div>
        </div>

        {/* Typography Scale */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Typography Scale</h3>
          <div className={styles.typeScale}>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>H1 — 3rem</span>
              <span className={styles.typeH1}>Hero Performances</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>H2 — 2rem</span>
              <span className={styles.typeH2}>Team Liquid</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>H3 — 1.25rem</span>
              <span className={styles.typeH3}>Match Statistics</span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>Body — 0.875rem</span>
              <span className={styles.typeBody}>
                Displaying 1,247 matches from patch 7.37e across Premium and Professional tier events.
              </span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>Data — 0.8rem</span>
              <span className={styles.typeData}>
                53.77% &nbsp; 1,247 &nbsp; +12.4 &nbsp; -3.2
              </span>
            </div>
            <div className={styles.typeRow}>
              <span className={styles.typeLabel}>Caption — 0.65rem</span>
              <span className={styles.typeCaption}>PREMIUM &middot; PROFESSIONAL &middot; PATCH 7.37E</span>
            </div>
          </div>
        </section>

        {/* Sample Navigation */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Navigation</h3>
          <div className={styles.mockNav}>
            <span className={styles.mockLogo}>datdota</span>
            <div className={styles.mockNavItems}>
              {['Heroes', 'Players', 'Teams', 'Matches', 'Events', 'Economy', 'Meta', 'Ratings', 'Trivia'].map(
                (item) => (
                  <span key={item} className={styles.mockNavItem}>
                    {item}
                    {!['Ratings'].includes(item) && <span className={styles.mockCaret}>&#9662;</span>}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Color Palette</h3>
          <div className={styles.colorGrid}>
            {COLORS.map((c) => (
              <div key={c.name} className={styles.colorCard}>
                <div className={styles.colorSwatch} style={{ background: c.hex }} />
                <span className={styles.colorName}>{c.name}</span>
                <span className={styles.colorHex}>{c.hex}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Sample Table */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Data Table</h3>
          <div className={styles.tableToolbar}>
            <input className={styles.searchInput} placeholder="Search heroes..." readOnly />
            <div className={styles.tableActions}>
              <button className={styles.actionBtn}>Copy</button>
              <button className={styles.actionBtn}>CSV</button>
            </div>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thLeft}>Hero</th>
                  <th>Games</th>
                  <th>Wins</th>
                  <th>Win Rate</th>
                  <th>Picks</th>
                  <th>Bans</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_HEROES.map((hero, i) => (
                  <tr key={hero.name} className={styles.tr} style={{ animationDelay: `${i * 40}ms` }}>
                    <td className={styles.tdHero}>
                      <div className={styles.heroImgPlaceholder} />
                      <span>{hero.name}</span>
                    </td>
                    <td className={styles.tdNum}>{hero.games.toLocaleString()}</td>
                    <td className={styles.tdNum}>{hero.wins.toLocaleString()}</td>
                    <td className={styles.tdNum}>
                      <WinrateBar value={hero.winrate} />
                    </td>
                    <td className={styles.tdNum}>{hero.picks.toLocaleString()}</td>
                    <td className={styles.tdNum}>{hero.bans.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sample Filters */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Filter Panel</h3>
          <div className={styles.filterPanel}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Patch</label>
              <div className={styles.filterSelect}>
                <span>7.37e, 7.37d</span>
                <span className={styles.filterCaret}>&#9662;</span>
              </div>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Player</label>
              <div className={styles.filterSelect}>
                <span className={styles.filterPlaceholder}>Search players...</span>
                <span className={styles.filterCaret}>&#9662;</span>
              </div>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Tier</label>
              <div className={styles.tierCheckboxes}>
                <label className={styles.checkbox}>
                  <input type="checkbox" defaultChecked readOnly /> <span>Premium</span>
                </label>
                <label className={styles.checkbox}>
                  <input type="checkbox" defaultChecked readOnly /> <span>Pro</span>
                </label>
                <label className={styles.checkbox}>
                  <input type="checkbox" readOnly /> <span>Semi-pro</span>
                </label>
              </div>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Date Range</label>
              <div className={styles.dateRange}>
                <div className={styles.filterSelect}>
                  <span>2024-01-01</span>
                </div>
                <span className={styles.dateSep}>to</span>
                <div className={styles.filterSelect}>
                  <span>2024-12-31</span>
                </div>
              </div>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Min. Games</label>
              <div className={styles.sliderTrack}>
                <div className={styles.sliderFill} style={{ width: '10%' }} />
                <div className={styles.sliderThumb} style={{ left: '10%' }} />
              </div>
              <span className={styles.sliderValue}>10</span>
            </div>
            <button className={styles.filterSubmit}>Apply Filters</button>
          </div>
        </section>

        {/* Entity Cards */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Entity Cards</h3>
          <div className={styles.cardGrid}>
            <div className={styles.entityCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardAvatarPlaceholder} />
                <div>
                  <div className={styles.cardTitle}>Team Liquid</div>
                  <div className={styles.cardSubtitle}>Western Europe</div>
                </div>
              </div>
              <div className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue}>1,847</span>
                  <span className={styles.cardStatLabel}>Games</span>
                </div>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue} style={{ color: 'var(--color-win)' }}>54.2%</span>
                  <span className={styles.cardStatLabel}>Win Rate</span>
                </div>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue}>#3</span>
                  <span className={styles.cardStatLabel}>Rating</span>
                </div>
              </div>
            </div>
            <div className={styles.entityCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardAvatarPlaceholder} />
                <div>
                  <div className={styles.cardTitle}>Nisha</div>
                  <div className={styles.cardSubtitle}>Team Falcons &middot; Core</div>
                </div>
              </div>
              <div className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue}>2,341</span>
                  <span className={styles.cardStatLabel}>Games</span>
                </div>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue} style={{ color: 'var(--color-win)' }}>56.8%</span>
                  <span className={styles.cardStatLabel}>Win Rate</span>
                </div>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue}>97</span>
                  <span className={styles.cardStatLabel}>Heroes</span>
                </div>
              </div>
            </div>
            <div className={styles.entityCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardAvatarPlaceholder} style={{ background: 'var(--color-accent)' }} />
                <div>
                  <div className={styles.cardTitle}>The International 2024</div>
                  <div className={styles.cardSubtitle}>Premium &middot; Valve Event</div>
                </div>
              </div>
              <div className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue}>197</span>
                  <span className={styles.cardStatLabel}>Matches</span>
                </div>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue}>20</span>
                  <span className={styles.cardStatLabel}>Teams</span>
                </div>
                <div className={styles.cardStat}>
                  <span className={styles.cardStatValue}>108</span>
                  <span className={styles.cardStatLabel}>Heroes</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons & Interactive Elements */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Buttons & Elements</h3>
          <div className={styles.buttonRow}>
            <button className={styles.btnPrimary}>Apply Filters</button>
            <button className={styles.btnSecondary}>Reset</button>
            <button className={styles.btnGhost}>View All</button>
            <span className={styles.badge}>Premium</span>
            <span className={styles.badgeAccent}>LAN</span>
            <span className={styles.deltaPos}>+12.4</span>
            <span className={styles.deltaNeg}>-3.2</span>
          </div>
        </section>

        {/* Loading Animation */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Loading Animation</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
            Pixel-art Enigma channelling Black Hole (Interstellar-inspired accretion disk) — waving arms + ethereal ghostly bottom.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-xl)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <EnigmaLoader />
            <EnigmaLoader text="Fetching data..." />
            <EnigmaLoader text="" />
          </div>
        </section>

        {/* Error States */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Error States</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
            Used when API calls fail or return errors (503, timeouts, etc).
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-xl)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <ErrorState />
            <ErrorState
              message="API Unavailable"
              detail="The server returned a 503 error. This usually means maintenance is in progress."
              onRetry={() => alert('Retry clicked')}
            />
          </div>
        </section>

        {/* Favicon */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Favicon</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
            Lowercase Greek delta (δ) — primary filled on dark.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" style={{ background: '#0f0f1a', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <path d="M32 14 C24 14, 17 24, 17 34 C17 44, 23 52, 32 52 C41 52, 47 44, 47 34 C47 24, 40 14, 32 14 Z M32 22 C37 22, 40 28, 40 34 C40 40, 37 44, 32 44 C27 44, 24 40, 24 34 C24 28, 27 22, 32 22 Z" fill="#c48bc4" fillRule="evenodd" />
              <path d="M36 16 C33 12, 30 10, 34 7 C38 4, 44 6, 46 10" fill="none" stroke="#c48bc4" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
            <svg width="32" height="32" viewBox="0 0 64 64" style={{ background: '#0f0f1a', borderRadius: 4, border: '1px solid var(--color-border)' }}>
              <path d="M32 14 C24 14, 17 24, 17 34 C17 44, 23 52, 32 52 C41 52, 47 44, 47 34 C47 24, 40 14, 32 14 Z M32 22 C37 22, 40 28, 40 34 C40 40, 37 44, 32 44 C27 44, 24 40, 24 34 C24 28, 27 22, 32 22 Z" fill="#c48bc4" fillRule="evenodd" />
              <path d="M36 16 C33 12, 30 10, 34 7 C38 4, 44 6, 46 10" fill="none" stroke="#c48bc4" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 64 64" style={{ background: '#0f0f1a', borderRadius: 2, border: '1px solid var(--color-border)' }}>
              <path d="M32 14 C24 14, 17 24, 17 34 C17 44, 23 52, 32 52 C41 52, 47 44, 47 34 C47 24, 40 14, 32 14 Z M32 22 C37 22, 40 28, 40 34 C40 40, 37 44, 32 44 C27 44, 24 40, 24 34 C24 28, 27 22, 32 22 Z" fill="#c48bc4" fillRule="evenodd" />
              <path d="M36 16 C33 12, 30 10, 34 7 C38 4, 44 6, 46 10" fill="none" stroke="#c48bc4" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </div>
        </section>

        {/* Open Graph card */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Open Graph Image</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
            1200×630 default share card for Slack, Discord, Twitter, iMessage. Right-click the element and choose <strong>"Capture node screenshot"</strong> in DevTools (Chrome / Edge — Inspect → ⋮ menu → Capture node screenshot). Save the result to <code style={{ background: 'var(--color-bg-elevated)', padding: '2px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>public/og-default.png</code>.
          </p>
          <div style={{ overflow: 'hidden', borderRadius: 12, border: '1px solid var(--color-border)', display: 'inline-block', maxWidth: '100%' }}>
            <div style={{ width: 600, height: 315, transform: 'scale(0.5)', transformOrigin: 'top left' }}>
              <OgCard />
            </div>
          </div>
          <details style={{ marginTop: 'var(--space-md)' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Show at full 1200×630 (for capture)</summary>
            <div id="og-card-full" style={{ marginTop: 'var(--space-md)', border: '1px solid var(--color-border)', display: 'inline-block' }}>
              <OgCard />
            </div>
          </details>
        </section>
      </div>
    </>
  )
}

function OgCard() {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        background: 'radial-gradient(ellipse at top left, #1a1030 0%, #0a0a12 55%, #07070f 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: '#e8e6f0',
      }}
    >
      {/* Subtle grid lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(196,139,196,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(196,139,196,0.05) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Glowing primary blob */}
      <div
        style={{
          position: 'absolute',
          right: -120,
          top: -120,
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,139,196,0.28) 0%, rgba(196,139,196,0) 70%)',
          filter: 'blur(20px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -80,
          bottom: -160,
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,212,191,0.18) 0%, rgba(45,212,191,0) 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* δ glyph (large, decorative) */}
      <svg
        width="180"
        height="180"
        viewBox="0 0 64 64"
        style={{ position: 'absolute', top: 60, right: 80, opacity: 0.85 }}
      >
        <path
          d="M32 14 C24 14, 17 24, 17 34 C17 44, 23 52, 32 52 C41 52, 47 44, 47 34 C47 24, 40 14, 32 14 Z M32 22 C37 22, 40 28, 40 34 C40 40, 37 44, 32 44 C27 44, 24 40, 24 34 C24 28, 27 22, 32 22 Z"
          fill="#c48bc4"
          fillRule="evenodd"
        />
        <path
          d="M36 16 C33 12, 30 10, 34 7 C38 4, 44 6, 46 10"
          fill="none"
          stroke="#c48bc4"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Wordmark */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 200,
          fontSize: 168,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: '#f3f0fa',
        }}
      >
        datdota
      </div>

      {/* Accent underline */}
      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 384,
          width: 110,
          height: 6,
          borderRadius: 3,
          background: 'linear-gradient(to right, #c48bc4, #2dd4bf)',
        }}
      />

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 412,
          fontFamily: "'Fira Code', monospace",
          fontWeight: 300,
          fontSize: 32,
          letterSpacing: '0.02em',
          color: '#c8c4d8',
        }}
      >
        Professional Dota 2 Statistics
      </div>

      {/* Bottom stat strip */}
      <div
        style={{
          position: 'absolute',
          left: 84,
          right: 84,
          bottom: 70,
          display: 'flex',
          gap: 60,
          fontFamily: "'Fira Code', monospace",
          fontWeight: 300,
        }}
      >
        {[
          { value: '12K+', label: 'pro matches' },
          { value: '800+', label: 'teams' },
          { value: '5K+', label: 'leagues' },
          { value: '13yrs', label: 'tracking' },
        ].map((s) => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#c48bc4', fontSize: 36, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
              {s.value}
            </span>
            <span style={{ color: '#8a849c', fontSize: 16, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* URL footer */}
      <div
        style={{
          position: 'absolute',
          right: 84,
          bottom: 70,
          fontFamily: "'Fira Code', monospace",
          fontWeight: 400,
          fontSize: 18,
          color: '#6e6b80',
          letterSpacing: '0.04em',
        }}
      >
        datdota.com
      </div>
    </div>
  )
}
