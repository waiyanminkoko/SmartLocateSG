# SmartLocateSG Execution Plan (No Supabase MCP)

This execution plan is tailored to the current constraints:

1. Supabase MCP is unavailable due to Developer-level access.
2. Database setup must be done through manual SQL and optional CSV import in Supabase dashboard.
3. Scope is based on [assigned_task.md](assigned_task.md):
	- Business profile persistence (create/read/update/delete)
	- Map-only score explanation using Gemini API (key can be empty for now)

## 1) Scope Baseline

## Included in this implementation wave

1. `business_profiles` persistence path added to backend and frontend.
2. Manual SQL migration + CSV backup artifacts for Supabase manual operations.
3. Map score explanation endpoint with Gemini integration + fallback explanation when key is missing.
4. Map page integration to request explanation from backend API.

## Not included in this wave

1. Full chat history persistence table.
2. Admin control panel for API key management.
3. Complete migration of every page from local storage to API-backed data.

## 2) Phase Plan

### Phase A: Database foundation (manual)

Goal: Add profile table and relation safely without MCP.

Artifacts:

1. `database/migrations/20260315_add_business_profiles.sql`
2. `database/tables.sql` updated with `business_profiles` and profile relation in `candidate_sites`.
3. CSV backup package:
	- `database/manual_import/business_profiles_csv_backup/business_profiles_template.csv`
	- `database/manual_import/business_profiles_csv_backup/README.md`

Output:

1. `business_profiles` table exists in Supabase.
2. `candidate_sites.profile_id` references `business_profiles.id`.

### Phase B: Backend implementation

Goal: Make profile and explanation APIs usable by frontend.

Files:

1. `shared/schema.ts`
	- Added `business_profiles` Drizzle table and types.
2. `frontend/server/storage.ts`
	- Added profile CRUD storage methods.
	- Added profile activation logic.
	- Added delete profile behavior that removes linked candidate sites and associated score rows.
3. `frontend/server/routes.ts`
	- Added profile endpoints:
	  - `GET /api/profiles?userId=...`
	  - `POST /api/profiles`
	  - `PUT /api/profiles/:id?userId=...`
	  - `PUT /api/profiles/:id/activate`
	  - `DELETE /api/profiles/:id?userId=...`
	- Added explanation endpoint:
	  - `POST /api/explain-score`
	- Gemini integration supports key-empty fallback.

Output:

1. Profile data can be persisted and retrieved from DB.
2. Score explanation API returns Gemini output when key exists, fallback text otherwise.

### Phase C: Frontend integration

Goal: Connect key pages to backend APIs while keeping existing UX stable.

Files:

1. `frontend/client/src/lib/app-user.ts`
	- Added persistent app-level user ID helper for non-auth prototype routing.
2. `frontend/client/src/pages/profiles.tsx`
	- Load profiles from API.
	- Activate/delete profile via API.
3. `frontend/client/src/pages/profiles-wizard.tsx`
	- Save new profiles to API.
4. `frontend/client/src/pages/map.tsx`
	- Load profile list from API.
	- Activate profile via API.
	- Replace static explanation trigger with API call to `POST /api/explain-score`.

Output:

1. Business profile management is DB-backed.
2. Map explanation is API-driven and map-only.

## 3) Verification Checklist

1. Run backend and frontend; ensure no TypeScript errors.
2. Create a profile from wizard and verify it appears in profiles list.
3. Set active profile from profile page and from map page.
4. Delete profile and verify linked candidate sites are removed from DB side.
5. Open map, select a location, click Explain Score, and verify response renders.
6. Confirm fallback explanation appears when Gemini key is missing.

## 4) Manual Tasks Required (Operator Runbook)

You must perform these steps manually in Supabase and environment setup:

1. Open Supabase SQL Editor and run:
	- `database/migrations/20260315_add_business_profiles.sql`
2. If SQL execution is blocked by permissions:
	- Request admin to run the SQL migration.
	- After table exists, import CSV from:
	  - `database/manual_import/business_profiles_csv_backup/business_profiles_template.csv`
3. Ensure referenced user IDs exist in `users` before importing CSV rows.
4. Set environment variables for server runtime:
	- `DATABASE_URL` or (`VITE_SUPABASE_URL` + `SUPABASE_DB_PASSWORD`)
	- Optional Gemini key:
	  - `GEMINI_API_KEY` (or `GOOGLE_GEMINI_API_KEY`)
5. Restart backend server and frontend dev server after env/schema updates.
6. Run smoke tests for profile CRUD and map explanation.

## 5) Risk Notes

1. Current app still uses local storage in some non-scoped pages (dashboard/portfolio summaries). This does not block assigned task scope but should be unified in a later pass.
2. App currently uses an app-generated user ID helper for prototype mode; production should move to Supabase Auth identity + RLS policies.
3. If Gemini returns malformed JSON, fallback explanation is returned by server.
