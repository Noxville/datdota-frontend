import { createBrowserRouter } from 'react-router-dom'
import PageShell from './components/PageShell'
import Home from './pages/Home'
import Mockups from './pages/Mockups'
import PlayerPerformances from './pages/PlayerPerformances'
import NotFound from './pages/NotFound'

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
      // { path: '/ratings', element: <Ratings /> },

      // Leagues
      // { path: '/leagues/:id', element: <LeagueDetail /> },

      // Catch-all
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default router
