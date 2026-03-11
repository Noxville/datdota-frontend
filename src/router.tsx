import { createBrowserRouter } from 'react-router-dom'
import PageShell from './components/PageShell'
import Home from './pages/Home'
import Mockups from './pages/Mockups'
import PlayerPerformances from './pages/PlayerPerformances'
import About from './pages/About'
import Terms from './pages/Terms'
import Ratings from './pages/Ratings'
import RatingsRegions from './pages/RatingsRegions'
import TeamStreaks from './pages/TeamStreaks'
import NotFound from './pages/NotFound'
import { Cf500, CfAttack, CfWidget } from './pages/CloudflareError'

const router = createBrowserRouter([
  {
    element: <PageShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/styleguide', element: <Mockups /> },

      // Phase 3 MVP pages — placeholders for now
      // Heroes
      // { path: '/heroes/performances', element: <HeroPerformances /> },
      // { path: '/heroes/elo', element: <HeroElo /> },
      // { path: '/heroes/head-to-head', element: <HeroHeadToHead /> },
      // { path: '/heroes/elo-by-phase', element: <HeroEloByPhase /> },
      // { path: '/heroes/frequent-players', element: <HeroFrequentPlayers /> },

      // Players
      { path: '/players/performances', element: <PlayerPerformances /> },
      // { path: '/players/single-performances', element: <PlayerSinglePerformances /> },
      // { path: '/players/:id', element: <PlayerProfile /> },

      // Teams
      // { path: '/teams/performances', element: <TeamPerformances /> },
      // { path: '/teams/:id', element: <TeamProfile /> },

      // Matches
      // { path: '/matches', element: <MatchList /> },
      // { path: '/matches/finder', element: <MatchFinder /> },
      // { path: '/matches/:id', element: <MatchDetail /> },

      // Ratings
      { path: '/ratings', element: <Ratings /> },
      { path: '/ratings/regions', element: <RatingsRegions /> },

      // Trivia
      { path: '/trivia/team-streaks/:type', element: <TeamStreaks /> },

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
