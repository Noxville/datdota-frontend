import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import PageShell from './components/PageShell'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import RouteError from './pages/RouteError'

/* ── Lazy page imports ──────────────────────────────────── */

function lz(factory: () => Promise<{ default: React.ComponentType }>) {
  const Lazy = lazy(factory)
  return (
    <Suspense fallback={null}>
      <Lazy />
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    element: <PageShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/styleguide', element: lz(() => import('./pages/Mockups')) },

      // Heroes
      { path: '/heroes/performances', element: lz(() => import('./pages/HeroPerformances')) },
      { path: '/heroes/elo', element: lz(() => import('./pages/HeroTuplesElo')) },
      { path: '/heroes/elo-by-phase', element: lz(() => import('./pages/HeroEloByPhase')) },
      { path: '/heroes/frequent-players', element: lz(() => import('./pages/HeroFrequentPlayers')) },
      { path: '/heroes/head-to-head', element: lz(() => import('./pages/HeroHeadToHead')) },
      { path: '/facets/summary', element: lz(() => import('./pages/FacetSummary')) },
      { path: '/abilities/builds', element: lz(() => import('./pages/AbilityBuilds')) },
      { path: '/abilities/builds/matches', element: lz(() => import('./pages/AbilityBuildMatches')) },

      // Players
      { path: '/players/performances', element: lz(() => import('./pages/PlayerPerformances')) },
      { path: '/players/single-performances', element: lz(() => import('./pages/PlayerSinglePerformances')) },
      { path: '/players/unique-heroes', element: lz(() => import('./pages/PlayerUniqueHeroes')) },
      { path: '/players/squads', element: lz(() => import('./pages/PlayerSquads')) },
      { path: '/players/hero-combos', element: lz(() => import('./pages/PlayerHeroCombos')) },
      { path: '/players/teams', element: lz(() => import('./pages/PlayerTeamCombos')) },
      { path: '/players/rivalries', element: lz(() => import('./pages/PlayerRivalries')) },
      { path: '/players/records', element: lz(() => import('./pages/PlayerRecords')) },
      { path: '/players/:id', element: lz(() => import('./pages/PlayerShow')) },

      // Teams
      { path: '/teams/performances', element: lz(() => import('./pages/TeamPerformances')) },
      { path: '/teams/head-to-head', element: lz(() => import('./pages/TeamHeadToHead')) },
      { path: '/teams/unique-heroes', element: lz(() => import('./pages/TeamUniqueHeroes')) },
      { path: '/teams/towers', element: lz(() => import('./pages/TeamTowers')) },
      { path: '/teams/throws', element: lz(() => import('./pages/TeamThrows')) },
      { path: '/teams/comebacks', element: lz(() => import('./pages/TeamComebacks')) },
      { path: '/teams/map-control', element: lz(() => import('./pages/TeamMapControl')) },
      { path: '/teams/:id', element: lz(() => import('./pages/TeamShow')) },

      // Matches
      { path: '/matches', element: lz(() => import('./pages/MatchList')) },
      { path: '/matches/finder', element: lz(() => import('./pages/MatchFinder')) },
      { path: '/matches/durations', element: lz(() => import('./pages/MatchDurations')) },
      { path: '/matches/scorigami', element: lz(() => import('./pages/Scorigami')) },
      { path: '/matches/:id', element: lz(() => import('./pages/MatchShow')) },

      // Events — Combat
      { path: '/events/hero-kills', element: lz(() => import('./pages/EventKills')) },
      { path: '/events/hero-deaths', element: lz(() => import('./pages/EventDeaths')) },
      { path: '/events/first-bloods', element: lz(() => import('./pages/EventFirstBloods')) },

      // Events — Vision
      { path: '/events/wards', element: lz(() => import('./pages/EventWards')) },
      { path: '/events/crits', element: lz(() => import('./pages/EventCrits')) },

      // Events — Objectives
      { path: '/events/roshan', element: lz(() => import('./pages/EventRoshan')) },
      { path: '/events/aegis', element: lz(() => import('./pages/EventAegis')) },
      { path: '/events/tormentor', element: lz(() => import('./pages/EventTormentor')) },
      { path: '/events/couriers', element: lz(() => import('./pages/EventCouriers')) },
      { path: '/events/buildings', element: lz(() => import('./pages/EventBuildings')) },
      { path: '/events/runes', element: lz(() => import('./pages/EventRunes')) },

      // Scenarios
      { path: '/scenarios/megacreep-comebacks', element: lz(() => import('./pages/ScenarioMegacreepComebacks')) },
      { path: '/scenarios/first-wisdoms', element: lz(() => import('./pages/ScenarioFirstWisdoms')) },
      { path: '/scenarios/bounty-bazinga', element: lz(() => import('./pages/ScenarioBountyBazinga')) },
      { path: '/scenarios/gameloop', element: lz(() => import('./pages/ScenarioGameloop')) },

      // Items
      { path: '/items/distribution', element: lz(() => import('./pages/ItemDistribution')) },
      { path: '/items/averages', element: lz(() => import('./pages/ItemAverages')) },
      { path: '/items/progression', element: lz(() => import('./pages/ItemProgression')) },
      { path: '/items/neutrals', element: lz(() => import('./pages/ItemNeutrals')) },

      // Drafts
      { path: '/drafts', element: lz(() => import('./pages/Drafts')) },
      { path: '/drafts/positions', element: lz(() => import('./pages/DraftPositions')) },

      // Meta — Laning
      { path: '/lanes/laning/players', element: lz(() => import('./pages/LaningPlayers')) },
      { path: '/lanes/laning/teams', element: lz(() => import('./pages/LaningTeams')) },
      { path: '/lanes/laning/heroes', element: lz(() => import('./pages/LaningHeroes')) },

      // Meta
      { path: '/lanes/compositions', element: lz(() => import('./pages/LaneCompositions')) },
      { path: '/factions/overview', element: lz(() => import('./pages/FactionOverview')) },
      { path: '/win-expectancy', element: lz(() => import('./pages/WinExpectancy')) },
      { path: '/frames', element: lz(() => import('./pages/Frames')) },

      // Casters
      { path: '/casters', element: lz(() => import('./pages/Casters')) },
      { path: '/casters/:id', element: lz(() => import('./pages/CasterShow')) },

      // Ratings
      { path: '/ratings', element: lz(() => import('./pages/Ratings')) },
      { path: '/ratings/regions', element: lz(() => import('./pages/RatingsRegions')) },

      // Trivia
      { path: '/trivia/team-streaks/:type', element: lz(() => import('./pages/TeamStreaks')) },
      { path: '/trivia/player-hero-streaks/:type', element: lz(() => import('./pages/PlayerHeroStreaks')) },
      { path: '/trivia/best-runs', element: lz(() => import('./pages/BestRuns')) },
      { path: '/trivia/akke', element: lz(() => import('./pages/TriviaAward')) },
      { path: '/trivia/maelk', element: lz(() => import('./pages/TriviaAward')) },
      { path: '/trivia/cty', element: lz(() => import('./pages/TriviaAward')) },

      // Leagues
      { path: '/leagues', element: lz(() => import('./pages/Leagues')) },
      { path: '/leagues/pedigrees', element: lz(() => import('./pages/LeaguePedigrees')) },
      { path: '/leagues/:id', element: lz(() => import('./pages/LeagueShow')) },

      // About & Legal
      { path: '/about', element: lz(() => import('./pages/About')) },
      { path: '/glossary', element: lz(() => import('./pages/Glossary')) },
      { path: '/terms', element: lz(() => import('./pages/Terms')) },
      { path: '/privacy', element: lz(() => import('./pages/PrivacyPolicy')) },
      { path: '/data-policy', element: lz(() => import('./pages/DataPolicy')) },

      // Cloudflare error pages
      { path: '/cf500', element: lz(() => import('./pages/CloudflareError').then(m => ({ default: m.Cf500 }))) },
      { path: '/cfattack', element: lz(() => import('./pages/CloudflareError').then(m => ({ default: m.CfAttack }))) },
      { path: '/cfwidget', element: lz(() => import('./pages/CloudflareError').then(m => ({ default: m.CfWidget }))) },

      // Catch-all
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default router
