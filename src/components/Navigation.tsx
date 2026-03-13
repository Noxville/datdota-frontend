import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import styles from './Navigation.module.css'

interface NavItem {
  label: string
  to?: string
  accent?: boolean
  children?: NavGroup[]
}

interface NavGroupItem {
  label: string
  to: string
  external?: string
}

interface NavGroup {
  heading?: string
  items: NavGroupItem[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Heroes',
    children: [
      {
        items: [
          { label: 'Performances', to: '/heroes/performances?default=true' },
          { label: 'Elo Ratings', to: '/heroes/elo?default=true' },
          { label: 'Head-to-Head', to: '/heroes/head-to-head?default=true' },
          { label: 'Elo by Phase', to: '/heroes/elo-by-phase?default=true' },
          { label: 'Frequent Players', to: '/heroes/frequent-players?default=true' },
          { label: 'Facets', to: '/facets/summary?default=true' },
          { label: 'Talents', to: '/talents/distribution?default=true' },
        ],
      },
    ],
  },
  {
    label: 'Players',
    children: [
      {
        items: [
          { label: 'Performances', to: '/players/performances?default=true' },
          { label: 'Single Performances', to: '/players/single-performances?default=true' },
          { label: 'Unique Heroes', to: '/players/unique-heroes?default=true' },
          { label: 'Squads', to: '/players/squads?default=true' },
          { label: 'Hero Combos', to: '/players/hero-combos?default=true' },
          { label: 'Team Combos', to: '/players/teams?default=true' },
          { label: 'Rivalries', to: '/players/rivalries?default=true' },
          { label: 'Records', to: '/players/records?default=true' },
        ],
      },
    ],
  },
  {
    label: 'Teams',
    children: [
      {
        items: [
          { label: 'Performances', to: '/teams/performances?default=true' },
          { label: 'Head-to-Head', to: '/teams/head-to-head?default=true' },
          { label: 'Unique Heroes', to: '/teams/unique-heroes?default=true' },
          { label: 'Towers', to: '/teams/towers?default=true' },
          { label: 'Map Control', to: '/teams/map-control?default=true' },
          { label: 'Throws', to: '/teams/throws?default=true' },
          { label: 'Comebacks', to: '/teams/comebacks?default=true' },
        ],
      },
    ],
  },
  {
    label: 'Matches',
    children: [
      {
        items: [
          { label: 'Recent', to: '/matches' },
          { label: 'Finder', to: '/matches/finder?default=true' },
          { label: 'Durations', to: '/matches/durations?default=true' },
          { label: 'Scorigami', to: '/matches/scorigami?default=true' },
        ],
      },
    ],
  },
  {
    label: 'Events',
    children: [
      {
        heading: 'Combat',
        items: [
          { label: 'Kills', to: '/events/kills?default=true' },
          { label: 'Deaths', to: '/events/deaths?default=true' },
          { label: 'First Bloods', to: '/events/first-bloods?default=true' },
        ],
      },
      {
        heading: 'Vision',
        items: [
          { label: 'Wards Placed', to: '/events/wards?default=true' },
          { label: 'Ward Map', to: '/events/ward-map?default=true' },
        ],
      },
      {
        heading: 'Objectives',
        items: [
          { label: 'Roshan', to: '/events/roshan?default=true' },
          { label: 'Aegis', to: '/events/aegis?default=true' },
          { label: 'Tormentor', to: '/events/tormentor?default=true' },
          { label: 'Couriers', to: '/events/couriers?default=true' },
          { label: 'Buildings', to: '/events/buildings?default=true' },
          { label: 'Runes', to: '/events/runes?default=true' },
        ],
      },
      {
        heading: 'Scenarios',
        items: [
          { label: 'Megacreep Comebacks', to: '/scenarios/megacreep-comebacks?default=true' },
          { label: 'First Wisdoms', to: '/scenarios/first-wisdoms?default=true' },
          { label: 'Bounty Bazinga', to: '/scenarios/bounty-bazinga?default=true' },
        ],
      },
    ],
  },
  {
    label: 'Items',
    children: [
      {
        items: [
          { label: 'Fastest / Slowest', to: '/items/distribution?default=true' },
          { label: 'Builds / Progression', to: '/items/progression?default=true' },
          { label: 'Neutral Items', to: '/items/neutrals?default=true' },
          { label: 'Averages', to: '/items/averages?default=true' },
        ],
      },
    ],
  },
  {
    label: 'Meta',
    children: [
      {
        items: [
          { label: 'Drafts', to: '/drafts?default=true' },
          { label: 'Draft Positions', to: '/drafts/positions?default=true' },
          { label: 'Lanes', to: '/lanes/compositions?default=true' },
          { label: 'Factions', to: '/factions/overview?default=true' },
          { label: 'Abilities', to: '/abilities/builds?default=true' },
          { label: 'Win Expectancy', to: '/win-expectancy' },
          { label: 'Frames', to: '/frames?default=true' },
          { label: 'Regions', to: '/regions/performances?default=true' },
        ],
      },
    ],
  },
  {
    label: 'Ratings',
    children: [
      {
        items: [
          { label: 'Overall', to: '/ratings' },
          { label: 'Regional', to: '/ratings/regions' },
        ],
      },
    ],
  },
  {
    label: 'Trivia',
    children: [
      {
        heading: 'Team Records',
        items: [
          { label: 'Best Runs', to: '/trivia/best-runs' },
          { label: 'Best Streaks', to: '/trivia/team-streaks/best' },
          { label: 'Worst Streaks', to: '/trivia/team-streaks/worst' },
        ],
      },
      {
        heading: 'Player-Hero Records',
        items: [
          { label: 'Best Streaks', to: '/trivia/player-hero-streaks/best' },
          { label: 'Worst Streaks', to: '/trivia/player-hero-streaks/worst' },
        ],
      },
      {
        heading: 'Awards',
        items: [
          { label: 'Akke Award', to: '/trivia/akke' },
          { label: 'Maelk Award', to: '/trivia/maelk' },
          { label: 'Cty Award', to: '/trivia/cty' },
        ],
      },
    ],
  },
  {
    label: 'About',
    accent: true,
    children: [
      {
        items: [
          { label: 'About Us', to: '/about' },
          { label: 'Support datdota', to: '/support', external: 'https://ko-fi.com/datdota' },
          { label: 'Terms of Service', to: '/terms' },
          { label: 'API Swagger', to: '/api', external: 'https://api.datdota.com/swagger' },
        ],
      },
    ],
  },
]

function Dropdown({
  groups,
  onClose,
}: {
  groups: NavGroup[]
  onClose: () => void
}) {
  return (
    <div className={styles.dropdown}>
      {groups.map((group, gi) => (
        <div key={gi} className={styles.dropdownGroup}>
          {group.heading && (
            <div className={styles.dropdownHeading}>{group.heading}</div>
          )}
          {group.items.map((item) =>
            item.external ? (
              <a
                key={item.to}
                href={item.external}
                target="_blank"
                rel="noreferrer"
                className={styles.dropdownItem}
                onClick={onClose}
              >
                {item.label}
                <span className={styles.externalIcon}>&#8599;</span>
              </a>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className={styles.dropdownItem}
                onClick={onClose}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      ))}
    </div>
  )
}

export default function Navigation() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const location = useLocation()

  useEffect(() => {
    setOpenIndex(null)
  }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className={styles.nav} ref={navRef}>
      <Link to="/" className={styles.logo}>
        datdota
      </Link>

      <div className={styles.items}>
        {NAV_ITEMS.map((item, i) => (
          <div key={item.label} className={styles.itemWrapper}>
            {item.to && !item.children ? (
              <Link to={item.to} className={`${styles.navLink} ${item.accent ? styles.navLinkAccent : ''}`}>
                {item.label}
              </Link>
            ) : (
              <button
                className={`${styles.navLink} ${item.accent ? styles.navLinkAccent : ''} ${openIndex === i ? styles.active : ''}`}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                {item.label}
                <span className={styles.caret}>&#9662;</span>
              </button>
            )}
            {item.children && openIndex === i && (
              <Dropdown
                groups={item.children}
                onClose={() => setOpenIndex(null)}
              />
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
