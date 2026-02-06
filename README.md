# SmartLocate SG

SmartLocate SG is a UI-first prototype for a data-driven business site selection tool. It lets users build business profiles, explore a Singapore map, score candidate locations, save them to a portfolio, and compare up to three sites.

**What’s Working (UI Prototype)**
- Landing, login, and register flows (UI-only).
- Dashboard with quick actions, recent profiles, and recent sites.
- Business profile list with active profile selection and delete.
- Multi-step business profile wizard with validation and review step.
- Interactive map (OneMap tiles via Leaflet), pan/zoom, click-to-drop pin.
- Scenario presets and custom weight sliders (auto-normalized).
- Overlay legend, planning area details panel, and data freshness banner.
- Score breakdown with AI-style explanation dialog and feedback buttons.
- Portfolio with profile filter, notes editor, and compare selection.
- Compare dashboard with side-by-side stats and a bar chart.
- Admin data status screen with source freshness and manual refresh.

**Current Limitations**
- All data is mocked in `client/src/lib/mock-data.ts`.
- Scores are static and not computed from real datasets.
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
- Leaflet map with OneMap tiles
- Express server scaffold (dev middleware + production static hosting)

**Run Locally**
```bash
npm install
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

