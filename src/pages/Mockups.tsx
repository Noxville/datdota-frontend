import { useState } from 'react'
import EnigmaLoader from '../components/EnigmaLoader'
import styles from './Mockups.module.css'

interface FontPairing {
  name: string
  description: string
  displayFont: string
  bodyFont: string
  displayWeight: number
  bodyWeight: number
  googleImport: string
  personality: string
}

const PAIRINGS: FontPairing[] = [
  {
    name: 'A — Sora + Fira Code',
    description: 'Soft geometric sans with slightly rounded terminals. Japanese-inspired modernism. Excellent readability at all sizes.',
    displayFont: "'Sora', sans-serif",
    bodyFont: "'Fira Code', monospace",
    displayWeight: 800,
    bodyWeight: 300,
    googleImport:
      'https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400&family=Sora:wght@100;800&display=swap',
    personality: 'Thoughtful minimalism',
  },
  {
    name: 'B — Plus Jakarta Sans + Fira Code',
    description: 'Contemporary geometric with generous x-height and open apertures. Designed for screens — extremely legible even at small sizes.',
    displayFont: "'Plus Jakarta Sans', sans-serif",
    bodyFont: "'Fira Code', monospace",
    displayWeight: 800,
    bodyWeight: 300,
    googleImport:
      'https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400&family=Plus+Jakarta+Sans:wght@200;800&display=swap',
    personality: 'Crisp & modern',
  },
  {
    name: 'C — Manrope + Fira Code',
    description: 'Geometric grotesk with optical-size adjustments built in. Slightly wider letterforms for maximum clarity on data-heavy screens.',
    displayFont: "'Manrope', sans-serif",
    bodyFont: "'Fira Code', monospace",
    displayWeight: 800,
    bodyWeight: 300,
    googleImport:
      'https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400&family=Manrope:wght@200;800&display=swap',
    personality: 'Quiet confidence',
  },
  {
    name: 'D — Nunito Sans + Fira Code',
    description: 'Rounded sans-serif with warm, approachable character. Very high readability due to generous curves and well-balanced proportions.',
    displayFont: "'Nunito Sans', sans-serif",
    bodyFont: "'Fira Code', monospace",
    displayWeight: 900,
    bodyWeight: 300,
    googleImport:
      'https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400&family=Nunito+Sans:wght@200;900&display=swap',
    personality: 'Warm & readable',
  },
]

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
  const [activeIndex, setActiveIndex] = useState(0)
  const pairing = PAIRINGS[activeIndex]

  return (
    <>
      <link rel="stylesheet" href={pairing.googleImport} />
      {/* Preload all fonts */}
      {PAIRINGS.map((p, i) =>
        i !== activeIndex ? (
          <link key={i} rel="preload" href={p.googleImport} as="style" />
        ) : null,
      )}

      <div
        className={styles.mockups}
        style={
          {
            '--mock-display': pairing.displayFont,
            '--mock-body': pairing.bodyFont,
            '--mock-display-weight': pairing.displayWeight,
            '--mock-body-weight': pairing.bodyWeight,
          } as React.CSSProperties
        }
      >
        {/* Pairing Selector */}
        <div className={styles.selector}>
          <h2 className={styles.sectionTitle}>Font Pairings</h2>
          <p className={styles.sectionDesc}>
            Click to compare. Each pairing uses extreme weight contrast.
          </p>
          <div className={styles.tabs}>
            {PAIRINGS.map((p, i) => (
              <button
                key={i}
                className={`${styles.tab} ${i === activeIndex ? styles.tabActive : ''}`}
                onClick={() => setActiveIndex(i)}
              >
                <span className={styles.tabLetter}>{String.fromCharCode(65 + i)}</span>
                <span className={styles.tabName}>{p.name.split(' — ')[1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pairing Info */}
        <div className={styles.pairingInfo}>
          <div className={styles.pairingMeta}>
            <span className={styles.pairingPersonality}>{pairing.personality}</span>
            <p className={styles.pairingDesc}>{pairing.description}</p>
          </div>
          <div className={styles.fontSpecs}>
            <div className={styles.fontSpec}>
              <span className={styles.fontSpecLabel}>Display</span>
              <span className={styles.fontSpecValue} style={{ fontFamily: pairing.displayFont, fontWeight: pairing.displayWeight }}>
                {pairing.displayFont.split("'")[1]} {pairing.displayWeight}
              </span>
            </div>
            <div className={styles.fontSpec}>
              <span className={styles.fontSpecLabel}>Body</span>
              <span className={styles.fontSpecValue} style={{ fontFamily: pairing.bodyFont, fontWeight: pairing.bodyWeight }}>
                {pairing.bodyFont.split("'")[1]} {pairing.bodyWeight}
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
            Pixel-art Enigma channelling Black Hole (Interstellar-inspired accretion disk) — site-wide loading indicator.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-xl)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <EnigmaLoader />
            <EnigmaLoader text="Fetching data..." />
            <EnigmaLoader text="" />
          </div>
        </section>
      </div>
    </>
  )
}
