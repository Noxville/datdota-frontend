import { createBrowserRouter } from 'react-router-dom'
import PageShell from './components/PageShell'
import Home from './pages/Home'
import Mockups from './pages/Mockups'
import HeroPerformances from './pages/HeroPerformances'
import HeroTuplesElo from './pages/HeroTuplesElo'
import HeroEloByPhase from './pages/HeroEloByPhase'
import HeroFrequentPlayers from './pages/HeroFrequentPlayers'
import FacetSummary from './pages/FacetSummary'
import PlayerPerformances from './pages/PlayerPerformances'
import PlayerHeroCombos from './pages/PlayerHeroCombos'
import PlayerSinglePerformances from './pages/PlayerSinglePerformances'
import PlayerUniqueHeroes from './pages/PlayerUniqueHeroes'
import PlayerSquads from './pages/PlayerSquads'
import PlayerTeamCombos from './pages/PlayerTeamCombos'
import PlayerRivalries from './pages/PlayerRivalries'
import PlayerRecords from './pages/PlayerRecords'
import TeamPerformances from './pages/TeamPerformances'
import TeamUniqueHeroes from './pages/TeamUniqueHeroes'
import TeamTowers from './pages/TeamTowers'
import TeamThrows from './pages/TeamThrows'
import TeamComebacks from './pages/TeamComebacks'
import TeamMapControl from './pages/TeamMapControl'
import MatchList from './pages/MatchList'
import MatchFinder from './pages/MatchFinder'
import MatchDurations from './pages/MatchDurations'
import About from './pages/About'
import Terms from './pages/Terms'
import Ratings from './pages/Ratings'
import RatingsRegions from './pages/RatingsRegions'
import TeamStreaks from './pages/TeamStreaks'
import PlayerHeroStreaks from './pages/PlayerHeroStreaks'
import BestRuns from './pages/BestRuns'
import Scorigami from './pages/Scorigami'
import EventKills from './pages/EventKills'
import EventDeaths from './pages/EventDeaths'
import EventFirstBloods from './pages/EventFirstBloods'
import EventWards from './pages/EventWards'
import EventRoshan from './pages/EventRoshan'
import EventAegis from './pages/EventAegis'
import EventTormentor from './pages/EventTormentor'
import EventCouriers from './pages/EventCouriers'
import EventBuildings from './pages/EventBuildings'
import EventRunes from './pages/EventRunes'
import ScenarioMegacreepComebacks from './pages/ScenarioMegacreepComebacks'
import ScenarioFirstWisdoms from './pages/ScenarioFirstWisdoms'
import ScenarioBountyBazinga from './pages/ScenarioBountyBazinga'
import ItemDistribution from './pages/ItemDistribution'
import ItemAverages from './pages/ItemAverages'
import ItemProgression from './pages/ItemProgression'
import ItemNeutrals from './pages/ItemNeutrals'
import TriviaAward from './pages/TriviaAward'
import NotFound from './pages/NotFound'
import { Cf500, CfAttack, CfWidget } from './pages/CloudflareError'

const router = createBrowserRouter([
  {
    element: <PageShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/styleguide', element: <Mockups /> },

      // Heroes
      { path: '/heroes/performances', element: <HeroPerformances /> },
      { path: '/heroes/elo', element: <HeroTuplesElo /> },
      // { path: '/heroes/head-to-head', element: <HeroHeadToHead /> },
      { path: '/heroes/elo-by-phase', element: <HeroEloByPhase /> },
      { path: '/heroes/frequent-players', element: <HeroFrequentPlayers /> },
      { path: '/facets/summary', element: <FacetSummary /> },

      // Players
      { path: '/players/performances', element: <PlayerPerformances /> },
      { path: '/players/single-performances', element: <PlayerSinglePerformances /> },
      { path: '/players/unique-heroes', element: <PlayerUniqueHeroes /> },
      { path: '/players/squads', element: <PlayerSquads /> },
      { path: '/players/hero-combos', element: <PlayerHeroCombos /> },
      { path: '/players/teams', element: <PlayerTeamCombos /> },
      { path: '/players/rivalries', element: <PlayerRivalries /> },
      { path: '/players/records', element: <PlayerRecords /> },
      // { path: '/players/:id', element: <PlayerProfile /> },

      // Teams
      { path: '/teams/performances', element: <TeamPerformances /> },
      { path: '/teams/unique-heroes', element: <TeamUniqueHeroes /> },
      { path: '/teams/towers', element: <TeamTowers /> },
      { path: '/teams/throws', element: <TeamThrows /> },
      { path: '/teams/comebacks', element: <TeamComebacks /> },
      { path: '/teams/map-control', element: <TeamMapControl /> },
      // { path: '/teams/head-to-head', element: <TeamHeadToHead /> },
      // { path: '/teams/:id', element: <TeamProfile /> },

      // Matches
      { path: '/matches', element: <MatchList /> },
      { path: '/matches/finder', element: <MatchFinder /> },
      { path: '/matches/durations', element: <MatchDurations /> },
      { path: '/matches/scorigami', element: <Scorigami /> },
      // { path: '/matches/:id', element: <MatchDetail /> },

      // Events — Combat
      { path: '/events/hero-kills', element: <EventKills /> },
      { path: '/events/hero-deaths', element: <EventDeaths /> },
      { path: '/events/first-bloods', element: <EventFirstBloods /> },

      // Events — Vision
      { path: '/events/wards', element: <EventWards /> },

      // Events — Objectives
      { path: '/events/roshan', element: <EventRoshan /> },
      { path: '/events/aegis', element: <EventAegis /> },
      { path: '/events/tormentor', element: <EventTormentor /> },
      { path: '/events/couriers', element: <EventCouriers /> },
      { path: '/events/buildings', element: <EventBuildings /> },
      { path: '/events/runes', element: <EventRunes /> },

      // Scenarios
      { path: '/scenarios/megacreep-comebacks', element: <ScenarioMegacreepComebacks /> },
      { path: '/scenarios/first-wisdoms', element: <ScenarioFirstWisdoms /> },
      { path: '/scenarios/bounty-bazinga', element: <ScenarioBountyBazinga /> },

      // Items
      { path: '/items/distribution', element: <ItemDistribution /> },
      { path: '/items/averages', element: <ItemAverages /> },
      { path: '/items/progression', element: <ItemProgression /> },
      { path: '/items/neutrals', element: <ItemNeutrals /> },

      // Ratings
      { path: '/ratings', element: <Ratings /> },
      { path: '/ratings/regions', element: <RatingsRegions /> },

      // Trivia
      { path: '/trivia/team-streaks/:type', element: <TeamStreaks /> },
      { path: '/trivia/player-hero-streaks/:type', element: <PlayerHeroStreaks /> },
      { path: '/trivia/best-runs', element: <BestRuns /> },
      { path: '/trivia/akke', element: <TriviaAward /> },
      { path: '/trivia/maelk', element: <TriviaAward /> },
      { path: '/trivia/cty', element: <TriviaAward /> },

      // Leagues
      // { path: '/leagues/:id', element: <LeagueDetail /> },

      // About
      { path: '/about', element: <About /> },
      { path: '/terms', element: <Terms /> },

      // Cloudflare error pages
      { path: '/cf500', element: <Cf500 /> },
      { path: '/cfattack', element: <CfAttack /> },
      { path: '/cfwidget', element: <CfWidget /> },

      // Catch-all
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default router
