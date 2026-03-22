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

If you are using Supabase, you have three options for the server connection in [frontend/server/db.ts](frontend/server/db.ts):

1. Export a full `SUPABASE_DATABASE_URL` (recommended, from Supabase dashboard).
2. Export a full `DATABASE_URL` in your shell.
3. Keep `VITE_SUPABASE_URL` in `.env` and export `SUPABASE_DB_PASSWORD` in your shell. The server will derive the PostgreSQL URL automatically.

Optional overrides (when deriving URL):
- `SUPABASE_DB_HOST` (for example, a pooler host such as `aws-0-ap-southeast-1.pooler.supabase.com`)
- `SUPABASE_POOLER_HOST` (alternative to `SUPABASE_DB_HOST`)
- `SUPABASE_USE_POOLER=true` + `SUPABASE_POOLER_REGION` (for example `ap-southeast-1`)
- `SUPABASE_DB_USER` (pooler commonly uses `postgres.<project_ref>`)
- `SUPABASE_DB_PORT` (pooler commonly uses `6543`, direct often `5432`)
- `SUPABASE_DB_NAME` (default `postgres`)
- `SUPABASE_DB_SSLMODE` (default `require`)
- `SUPABASE_DB_ALLOW_SELF_SIGNED=true` (only for networks/proxies that inject self-signed certs)

PowerShell example:
```powershell
$env:SUPABASE_DB_PASSWORD = "your-database-password"
```

If you get `ENOTFOUND` for `db.<project-ref>.supabase.co`, your project may require the pooler host. Use the connection string from Supabase Dashboard > Connect > Connection string, or set `SUPABASE_DB_HOST` explicitly.

If you get `ETIMEDOUT` to an IPv6 address on port `5432`, your network likely cannot reach the direct DB host over IPv6. Use the pooler (IPv4) path:

```powershell
cd frontend
$env:SUPABASE_DB_PASSWORD = "your-db-password"
$env:SUPABASE_USE_POOLER = "true"
$env:SUPABASE_POOLER_REGION = "ap-southeast-1"
$env:SUPABASE_DB_USER = "postgres.<your-project-ref>"
$env:SUPABASE_DB_PORT = "6543"
$env:SUPABASE_DB_SSLMODE = "require"
npm run db:push
```

Or set the host directly:

```powershell
cd frontend
$env:SUPABASE_DB_PASSWORD = "your-db-password"
$env:SUPABASE_DB_HOST = "aws-0-ap-southeast-1.pooler.supabase.com"
$env:SUPABASE_DB_USER = "postgres.<your-project-ref>"
$env:SUPABASE_DB_PORT = "6543"
$env:SUPABASE_DB_SSLMODE = "require"
npm run db:push
```

If you see `SELF_SIGNED_CERT_IN_CHAIN`, your network is intercepting TLS. Temporarily enable compatibility mode:

```powershell
$env:SUPABASE_DB_ALLOW_SELF_SIGNED = "true"
npm run db:push
```

Keep `SUPABASE_DB_ALLOW_SELF_SIGNED` disabled on trusted direct networks.

If you see `Tenant or user not found`, your pooler host/region or DB user is incorrect. Do not guess these values:

1. Open Supabase Dashboard > Project > Connect > Connection string.
2. Choose the **Transaction pooler** string.
3. Copy its host, port, user, and database exactly.
4. Set `SUPABASE_DATABASE_URL` to that full string (recommended), or map each field into `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_USER`, `SUPABASE_DB_NAME`.

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

## Gemini AI Chatbot Setup (Step-by-Step)

Use this if you want the Explain Score chatbot to call Gemini instead of fallback responses.

1. Create a Gemini API key.
	 - Go to Google AI Studio: https://aistudio.google.com/
	 - Sign in and create an API key.
	 - Copy the key value.

2. Add the key to your environment file.
	 - Open `frontend/.env` (create it if it does not exist).
	 - Add:

```bash
# Required for Gemini chatbot/explanations
GEMINI_API_KEY=your_gemini_api_key_here

# Optional fallback variable name (supported by this app)
# GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here

# Optional chatbot tuning
GEMINI_CHATBOT_MODEL=gemini-2.0-flash
GEMINI_CHATBOT_TIMEOUT_MS=30000
```

3. Make sure the key is server-side only.
	 - Do not use a `VITE_` prefix for Gemini keys.
	 - `VITE_` variables are exposed to browser code.

4. Restart the dev server.
	 - Stop the current process and run:

```bash
cd frontend
npm run dev
```

5. Verify the chatbot endpoint.
	 - Send a quick test request to `/api/chatbot`:

```bash
curl -X POST http://127.0.0.1:5000/api/chatbot \
	-H "Content-Type: application/json" \
	-d '{
		"message": "Explain this score in simple terms.",
		"pageContext": {
			"page": "map",
			"scores": {
				"composite": 72,
				"demographic": 68,
				"accessibility": 81,
				"rental": 57,
				"competition": 62
			}
		}
	}'
```

6. Verify in UI.
	 - Go to Map, Portfolio, or Compare.
	 - Click Explain score or the sparkle chatbot button.
	 - You should get Gemini-generated replies instead of fallback text.

### Gemini Troubleshooting

- If you see fallback responses:
	- Check `GEMINI_API_KEY` in `frontend/.env`.
	- Restart `npm run dev` after changing `.env`.
	- Confirm no typo in variable names.

- If requests fail or are slow:
	- Try a simpler prompt.
	- Increase timeout with `GEMINI_CHATBOT_TIMEOUT_MS=45000`.
	- Verify internet access to `generativelanguage.googleapis.com`.

- If you want to switch models:
	- Update `GEMINI_CHATBOT_MODEL` (for example: `gemini-2.0-flash`).
	- Restart the dev server.

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
