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
      { path: '/metrics', element: lz(() => import('./pages/Metrics')) },

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
      { path: '/teams/h2h-cross-section', element: lz(() => import('./pages/TeamH2HCrossSection')) },
      { path: '/teams/highground-scenarios', element: lz(() => import('./pages/HighgroundScenarios')) },
      { path: '/teams/unique-heroes', element: lz(() => import('./pages/TeamUniqueHeroes')) },
      { path: '/teams/towers', element: lz(() => import('./pages/TeamTowers')) },
      { path: '/teams/throws', element: lz(() => import('./pages/TeamThrows')) },
      { path: '/teams/comebacks', element: lz(() => import('./pages/TeamComebacks')) },
      { path: '/teams/map-control', element: lz(() => import('./pages/TeamMapControl')) },
      { path: '/teams/identity', element: lz(() => import('./pages/TeamIdentity')) },
      { path: '/teams/records', element: lz(() => import('./pages/TeamRecords')) },
      { path: '/teams/series-outcomes', element: lz(() => import('./pages/TeamSeriesOutcomes')) },
      { path: '/teams/:id', element: lz(() => import('./pages/TeamShow')) },

      // Matches
      { path: '/matches', element: lz(() => import('./pages/MatchList')) },
      { path: '/matches/finder', element: lz(() => import('./pages/MatchFinder')) },
      { path: '/matches/durations', element: lz(() => import('./pages/MatchDurations')) },
      { path: '/matches/scorigami', element: lz(() => import('./pages/Scorigami')) },
      { path: '/matches/comebacks', element: lz(() => import('./pages/MatchComebacks')) },
      { path: '/matches/all-players-buyback', element: lz(() => import('./pages/MatchAllBuybacks')) },
      { path: '/matches/never-led', element: lz(() => import('./pages/MatchNeverLed')) },
      { path: '/matches/:id', element: lz(() => import('./pages/MatchShow')) },
      { path: '/livematches/ext/:uuid', element: lz(() => import('./pages/ExtLiveMatch')) },
      { path: '/livematches/gc/:matchId', element: lz(() => import('./pages/GcLiveMatch')) },
      { path: '/livematches/webapi/:id', element: lz(() => import('./pages/LiveMatch')) },

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

      // Events — Notable
      { path: '/events/divine-rapiers', element: lz(() => import('./pages/EventOddity')) },
      { path: '/events/rampages', element: lz(() => import('./pages/EventOddity')) },

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

      // Meta — Teamfights
      { path: '/teamfights/players', element: lz(() => import('./pages/TeamfightPlayers')) },
      { path: '/teamfights/teams', element: lz(() => import('./pages/TeamfightTeams')) },

      // Meta — Laning
      { path: '/lanes/laning/players', element: lz(() => import('./pages/LaningPlayers')) },
      { path: '/lanes/laning/teams', element: lz(() => import('./pages/LaningTeams')) },
      { path: '/lanes/laning/heroes', element: lz(() => import('./pages/LaningHeroes')) },
      { path: '/lanes/laning/midlane-matchup', element: lz(() => import('./pages/MidlaneMatchup')) },

      // Meta
      { path: '/lanes/compositions', element: lz(() => import('./pages/LaneCompositions')) },
      { path: '/factions/overview', element: lz(() => import('./pages/FactionOverview')) },
      { path: '/win-expectancy', element: lz(() => import('./pages/WinExpectancy')) },
      { path: '/win-expectancy/:patch', element: lz(() => import('./pages/WinExpectancy')) },
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
      { path: '/trivia/hero-streaks/:type', element: lz(() => import('./pages/HeroStreaks')) },
      { path: '/trivia/best-runs', element: lz(() => import('./pages/BestRuns')) },
      { path: '/trivia/player-hero-runs', element: lz(() => import('./pages/PlayerHeroRuns')) },
      { path: '/trivia/caps', element: lz(() => import('./pages/TriviaCaps')) },
      { path: '/trivia/akke', element: lz(() => import('./pages/TriviaAward')) },
      { path: '/trivia/maelk', element: lz(() => import('./pages/TriviaAward')) },
      { path: '/trivia/cty', element: lz(() => import('./pages/TriviaAward')) },

      // Leagues
      { path: '/leagues', element: lz(() => import('./pages/Leagues')) },
      { path: '/leagues/pedigrees', element: lz(() => import('./pages/LeaguePedigrees')) },
      { path: '/leagues/contested-heroes', element: lz(() => import('./pages/LeagueContestedHeroes')) },
      { path: '/leagues/preview/:slug', element: lz(() => import('./pages/TournamentPreview')) },
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
      { path: '/cfwafblock', element: lz(() => import('./pages/CloudflareError').then(m => ({ default: m.CfWafBlock }))) },
      { path: '/cfinteractivechallenge', element: lz(() => import('./pages/CloudflareError').then(m => ({ default: m.CfInteractiveChallenge }))) },
      { path: '/cfipblock', element: lz(() => import('./pages/CloudflareError').then(m => ({ default: m.CfIpBlock }))) },

      // Catch-all
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default router
