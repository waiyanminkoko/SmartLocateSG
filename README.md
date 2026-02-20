# SmartLocate SG

SmartLocate SG is a UI-first prototype for a data-driven business site selection tool. It lets users build business profiles, explore a Singapore map, score candidate locations, save them to a portfolio, and compare up to three sites.

**What’s Working (UI Prototype)**
- Landing, login, and register flows (UI-only).
- Dashboard with quick actions, recent profiles, and recent sites.
- Business profile list with active profile selection and delete.
- Multi-step business profile wizard with validation and review step.
- Interactive Google Maps base map, pan/zoom, click-to-drop pin.
- Postal code / address search (Google Geocoding API) + Places autocomplete.
- Scenario presets and custom weight sliders (auto-normalized).
- Overlay legend, planning area details panel, and data freshness banner.
- Score breakdown with AI-style explanation dialog and feedback buttons.
- Portfolio with profile filter, notes editor, and compare selection.
- LocalStorage persistence for profiles and sites (temporary demo storage).
- Compare dashboard with side-by-side stats and a bar chart.
- Admin data status screen with source freshness and manual refresh.
- Admin reset button for clearing demo data.

**Current Limitations**
- All data is mocked in `client/src/lib/mock-data.ts`.
- Scores are simulated (not computed from real datasets).
- Postal search requires Google Geocoding API to be enabled.
- Backend API routes and persistence are not implemented.
- Map overlays (choropleths, MRT/bus layers) are UI placeholders only.

**Routes**
- `/` landing
- `/login` login
- `/register` register
- `/dashboard` overview
- `/profiles` profiles list
- `/profiles/new` profile wizard
- `/map` map + scoring
- `/portfolio` candidate sites
- `/compare` comparison
- `/admin` data status

**Tech Stack**
- React 19 + TypeScript + Vite
- Wouter routing
- Tailwind v4 + shadcn/ui components
- Google Maps JavaScript API
- Express server scaffold (dev middleware + production static hosting)

**Run Locally**
```bash
npm install
```

Create a `.env` file with:
```bash
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

Then run:
```bash
HOST=127.0.0.1 PORT=5173 npm run dev
```
Open `http://127.0.0.1:5173`.

**Planned Work (Next Steps)**
- Implement real backend API (profiles, scoring, sites).
- Add database schema + persistence (PostgreSQL / MySQL).
- Build map overlays (planning areas, MRT/bus layers).
- Add real scoring pipeline from OneMap, SingStat, LTA, URA datasets.
- Replace prototype AI explanations with rule-based or LLM-backed logic.
- Add authentication, user accounts, and portfolio ownership.
