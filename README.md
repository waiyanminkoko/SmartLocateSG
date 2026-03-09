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
- The UI still reads sites and profiles from localStorage; the server persistence layer is now scaffolded separately.
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

If you are using Supabase, you have two options for the server connection in [frontend/server/db.ts](frontend/server/db.ts):

1. Export a full `DATABASE_URL` in your shell.
2. Keep `VITE_SUPABASE_URL` in `.env` and export `SUPABASE_DB_PASSWORD` in your shell. The server will derive the PostgreSQL URL automatically.

PowerShell example:
```powershell
$env:SUPABASE_DB_PASSWORD = "your-database-password"
```

Provision the schema before first run:
```bash
cd frontend
npm install
npm run db:push
```

The SQL reference for the same schema is in [database/tables.sql](database/tables.sql). Keep [shared/schema.ts](shared/schema.ts) as the source of truth and use `tables.sql` only for review or manual setup.

Then run:
```bash
cd frontend
HOST=127.0.0.1 PORT=5173 npm run dev
```
Open `http://127.0.0.1:5173`.

**Planned Work (Next Steps)**
- Implement real backend API (profiles, scoring, sites).
- Connect the current UI flows to the persisted backend APIs instead of localStorage.
- Build map overlays (planning areas, MRT/bus layers).
- Add real scoring pipeline from OneMap, SingStat, LTA, URA datasets.
- Replace prototype AI explanations with rule-based or LLM-backed logic.
- Add authentication, user accounts, and portfolio ownership.

**Update Log**
February 20, 2026
- Replaced Leaflet/OneMap tiles with Google Maps (base map, click-to-drop pin, geocoding search, Places autocomplete).
- Added localStorage persistence for profiles and sites with a shared hook.
- Map scoring is now generated dynamically from seeded location scores and scenario weights.
- Portfolio and compare now read saved sites; portfolio can open a saved pin on the map.
- Admin now includes a reset demo data action.
- Added `.env` handling and documentation for `VITE_GOOGLE_MAPS_API_KEY`.
