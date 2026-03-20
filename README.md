# datdota-frontend

New frontend for [datdota.com](https://datdota.com) — a professional Dota 2 match statistics site.

This is a React + TypeScript SPA that talks to the existing production API at `api.datdota.com`.

## Quick Start

```bash
npm install
npm run dev        # starts dev server on http://localhost:3111
npm run build      # produces dist/ for production
npm run preview    # preview production build locally
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Routing | React Router DOM v7 |
| Data Fetching | TanStack Query (React Query) |
| Tables | TanStack Table + TanStack Virtual |
| Styling | CSS Modules + CSS Custom Properties |
| Animations | Motion + CSS keyframes |
| Charts | D3.js |

## Architecture

```
src/
├── api/            # API client, TanStack Query hooks, autocomplete
├── components/     # Reusable UI components (DataTable, Navigation, FilterPanel, etc.)
├── pages/          # One component per route
├── hooks/          # Custom React hooks (useFilters, etc.)
├── types/          # TypeScript interfaces
├── styles/         # Global CSS, variables, animations
├── data/           # Static data cache (heroes, items, abilities)
└── utils/          # Utility functions
```

## API & Dev Proxy

In development, Vite proxies `/api/*` requests to `https://api.datdota.com` to avoid CORS issues. In production, the SPA is served by nginx alongside the API.

CDN for images: `https://cdn.datdota.com`

| Asset | URL Pattern |
|-------|------------|
| Heroes | `/images/heroes/{heroKey}_full.png` |
| Abilities | `/images/ability/{shortName}.png` |
| Items | `/images/items/{shortName}.png` |
| League logos | `/images/leagues/{leagueId}_big.png` |
| Team logos | `/images/{logoId}.png` |
| Facet icons | `/images/facets/{facetIcon}.png` |

## Deployment

```bash
npm run build
scp -r dist/* your-server:/path/to/nginx/root/
```

The `dist/` folder contains all static files ready to be served by nginx.

## Pages

### Navigation 
* Top bar with dropdowns
* Hamburger menu on mobile

### Page Types

- **Query pages**: Server-side filtered projections with tabular results. Tables support sorting, search, CSV export, and clipboard copy (via DataTable). Most pages use `?default=true` to apply sensible defaults (latest patch, tier 1-2, threshold=1).
- **Entity pages**: Single object views with stats, tables, and charts.
- **Visualization pages**: D3-based interactive widgets (Hero Head-to-Head cross-table heatmap, Scorigami grid, Win Expectancy chart, Ratings chart).
- **General pages**: Home (dashboard with recent matches), About, Terms, 404, Cloudflare error pages.

### Entity Pages

| Entity | Route | Content |
|--------|-------|---------|
| Player | `/players/:id` | Career stats, team history, recent matches |
| Team | `/teams/:id` | Roster, stats, match history, rating chart |
| Match | `/matches/:id` | Draft, scoreboard, events, timeline |
| League | `/leagues/:id` | Tournament stats, team records, head-to-head matchups, all matches |
| Caster | `/casters/:id` | Games cast, co-casters, recent matches |

### Filters (available on query pages via FilterPanel)

Each query page declares which subset of filters to show via `showFilters`. All active filter values sync bidirectionally with URL query parameters.

| Filter | Type | URL Param | API |
|--------|------|-----------|-----|
| Player | Autocomplete | `players` | `/api/autocomplete/players?q=` |
| Team | Autocomplete | `teams` | `/api/autocomplete/teams?q=` |
| League | Autocomplete | `leagues` | `/api/autocomplete/leagues?q=` |
| Item | Autocomplete | `items` | `/api/autocomplete/items?q=` |
| Split | Autocomplete | `splits` | `/api/autocomplete/splits?q=` |
| Hero | Multi-select | `heroes` | Static hero list |
| Patch | Multi-select | `patch` | Static patch list |
| Date Range | Date pickers | `after` / `before` | — |
| Duration | Range slider | `durationGTE` / `durationLTE` | Minutes |
| Threshold | Number input | `threshold` | Min game count |
| Tier | Checkboxes | `tier` | 1=Premium, 2=Pro, 3=Semi-pro |
| Role | Select | `role` | core / support |
| Split Type | Select | `splittype` | online / lan / post-event |

Some pages extend FilterPanel with page-specific controls via `renderExtra` / `extraChips` (e.g. Ability Builds has level-from/level-to, Match Finder has heroes-a/heroes-b/team-a/team-b, Hero Head-to-Head has min games/min matchups/metric/view mode in `#` hash fragment).
