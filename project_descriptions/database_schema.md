# SmartLocateSG Database Schema Guide (For AI Agent)

This document explains how the current PostgreSQL/Supabase schema is structured and how to use it to complete the assigned tasks in [assigned_task.md](../assigned_task.md), especially:

1. Business profile storage/fetch/update
2. Score explanation on map via chatbot API (Gemini)

It is intentionally task-first (not just table-by-table) so an implementation agent can move directly to coding.

## 1) Database Overview

The schema has 4 logical domains:

1. Core app domain (users, saved sites, scores, area demographics)
2. Geospatial reference domain (planning areas, map polygons)
3. Raw ingested external datasets (OneMap/Data.gov/Google/URA)
4. Technical/system tables (spatial_ref_sys, temporary or utility tables)

Current app backend code uses mainly these core tables:

1. users
2. candidate_sites
3. site_scores
4. area_demographics
5. planning_areas

## 2) Key Tables For Assigned Tasks

### 2.1 users

- Purpose: account owner of saved candidate sites
- Primary key: id (varchar UUID)
- Important columns:
	- username (unique)
	- password

Relationship:
- users.id -> candidate_sites.user_id (one-to-many)

### 2.2 candidate_sites

- Purpose: saved map locations selected by users (portfolio entries)
- Primary key: id (varchar UUID)
- Important columns:
	- user_id: owner user
	- profile_id: business profile reference (currently plain varchar, no FK)
	- site_name, address_label, postal_code
	- lat, lng
	- planning_area_id: optional FK to planning_areas
	- saved_site_score_id: optional FK to site_scores
	- notes
	- saved_at

Relationships:
- candidate_sites.user_id -> users.id
- candidate_sites.planning_area_id -> planning_areas.id
- candidate_sites.saved_site_score_id -> site_scores.id

Important implementation note:
- profile_id exists but no business_profiles table currently exists in schema.
- This means business profile persistence is not yet fully normalized in DB.

### 2.3 site_scores

- Purpose: score snapshot linked to saved candidate sites
- Primary key: id (varchar UUID)
- Important columns:
	- composite_score
	- demographic_score
	- accessibility_score
	- rental_pressure_score
	- competition_score
	- computed_at
	- breakdown_details_json (jsonb for detailed factors/explanations)

Relationship:
- site_scores.id <- candidate_sites.saved_site_score_id (one-to-one or one-to-many depending on app logic; current flow creates one score row per saved site)

### 2.4 planning_areas

- Purpose: normalized planning area metadata + geometry + centroid
- Primary key: id (varchar UUID)
- Important columns:
	- area_name
	- area_code (unique)
	- region_name
	- geometry_geojson
	- centroid_lat, centroid_lng
	- last_updated_at

Used for:
- mapping a selected site to area-level demographics and other regional stats

### 2.5 area_demographics

- Purpose: structured demographics per planning area and year
- Primary key: id (varchar UUID)
- Foreign key: planning_area_id -> planning_areas.id
- Important columns:
	- effective_year
	- population_total
	- age_distribution_json
	- income_distribution_json
	- household_size_json
	- household_structure_json
	- economic_status_json
	- ingested_at

Used for:
- deriving/justifying demographic score and explanation text

## 3) Other Data Sources In Schema (Secondary For Assigned Tasks)

These tables are useful for score features or richer explanations later, but are not required for initial business profile CRUD:

1. datagov_bus_stops
2. datagov_mrt_exits
3. google_places
4. google_places_fetch_cache
5. ura_retail_transactions
6. onemap_planning_area
7. onemap_age_group
8. onemap_household_income
9. onemap_household_size
10. onemap_household_structure
11. onemap_economic_status
12. onemap_work_income

Practical guidance:
- For v1 score explanation, prioritize site_scores + area_demographics + minimal site metadata.
- Only pull these larger raw tables when a specific metric needs recalculation.

## 4) Current Gaps Relevant To Assigned Task

### Gap A: No business_profiles table yet

Assigned task requires storing/fetching/updating business profile data in DB.

Current state:
- profile_id is present in candidate_sites
- frontend currently has profile structure in local mock state (name, sector, priceBand, ageGroups, incomeBands, operatingModel, updatedAt)
- no DB table exists for these profile fields

Implication:
- To fully satisfy the task, add a business_profiles table (or equivalent) and wire candidate_sites.profile_id as a FK.

### Gap B: No chatbot interaction persistence table

Assigned task includes conversational score explanation.

Current state:
- no table for chat messages, prompts, or generated explanations

Implication:
- v1 can call Gemini statelessly without DB storage.
- optional future table: score_explanations/chat_sessions if history is needed.

## 5) Canonical Relationships (Mental Model)

Use this relationship chain for most map flows:

1. user selects site on map
2. app computes score -> insert into site_scores
3. app saves site -> insert into candidate_sites with saved_site_score_id and profile_id
4. app resolves planning_area_id
5. app reads latest area_demographics for that planning area
6. app builds compact AI payload for score explanation

Core FK graph:

- users (1) -> (many) candidate_sites
- planning_areas (1) -> (many) candidate_sites
- planning_areas (1) -> (many) area_demographics
- site_scores (1) -> (many/1) candidate_sites

Soft reference (not enforced yet):

- business_profiles (future) (1) -> (many) candidate_sites via profile_id

## 6) Query Patterns Needed By Assigned Task

### 6.1 Fetch saved sites with score breakdown (existing flow)

```sql
select
	cs.id,
	cs.user_id,
	cs.profile_id,
	cs.site_name,
	cs.address_label,
	cs.postal_code,
	cs.lat,
	cs.lng,
	cs.planning_area_id,
	cs.notes,
	cs.saved_at,
	ss.composite_score,
	ss.demographic_score,
	ss.accessibility_score,
	ss.rental_pressure_score,
	ss.competition_score,
	ss.breakdown_details_json,
	ss.computed_at
from candidate_sites cs
left join site_scores ss on ss.id = cs.saved_site_score_id
where cs.user_id = :user_id
order by cs.saved_at desc;
```

### 6.2 Fetch latest demographics for site planning area (existing flow)

```sql
select *
from area_demographics
where planning_area_id = :planning_area_id
order by effective_year desc
limit 1;
```

### 6.3 Resolve planning area by area code or name

```sql
select id, area_name, area_code, region_name, centroid_lat, centroid_lng
from planning_areas
where area_code = :area_code;
```

### 6.4 Proposed business profile CRUD (needed for task completion)

Assuming a new business_profiles table:

```sql
-- create
insert into business_profiles (
	user_id,
	name,
	sector,
	price_band,
	age_groups_json,
	income_bands_json,
	operating_model,
	updated_at
) values (
	:user_id,
	:name,
	:sector,
	:price_band,
	:age_groups_json,
	:income_bands_json,
	:operating_model,
	now()
) returning *;

-- read list by user
select *
from business_profiles
where user_id = :user_id
order by updated_at desc;

-- update
update business_profiles
set
	name = :name,
	sector = :sector,
	price_band = :price_band,
	age_groups_json = :age_groups_json,
	income_bands_json = :income_bands_json,
	operating_model = :operating_model,
	updated_at = now()
where id = :profile_id
	and user_id = :user_id
returning *;
```

## 7) AI Payload Strategy For Gemini (Token-Efficient)

The assigned task asks for explanation while minimizing data sent to API.

Recommended payload priority order:

1. Always send:
	 - composite score
	 - 4 sub-scores (demographic/accessibility/rental/competition)
	 - active business profile summary (name/sector/price band/target age+income bands)
	 - site context (address or lat/lng, planning area name)
2. Send compact optional context only if available:
	 - top 3 demographic highlights from area_demographics JSON (not full JSON)
	 - top 2 strengths + top 2 risks derived by backend
3. Avoid sending:
	 - full area_demographics JSON blobs
	 - raw rows from google_places, URA, or OneMap tables unless needed

Suggested backend transformation:

1. Read DB rows
2. Derive concise summary object
3. Send summary object to Gemini
4. Return generated explanation text to map UI dialog/section

## 8) Data Types And Mapping Caveats

1. Many numeric fields are numeric/decimal in DB and may arrive as strings in JS/TS clients.
2. JSONB columns (distribution fields, breakdown_details_json) should be type-guarded before use.
3. profile_id in candidate_sites is nullable and not FK-enforced yet; validate existence in application layer.
4. Multiple planning area tables exist:
	 - planning_areas: app-normalized reference table (currently preferred)
	 - onemap_planning_area: raw/ingested geojson table
	 Keep usage consistent to avoid mismatched IDs/names.

## 9) Implementation Checklist For AI Agent

Use this checklist when implementing assigned tasks:

1. Create and migrate business_profiles table (if not already created in Supabase).
2. Add FK from candidate_sites.profile_id -> business_profiles.id (optional if backward compatibility required).
3. Implement backend CRUD endpoints for business profiles.
4. Replace frontend local mock profile storage with API-backed storage.
5. Keep existing candidate site save flow (candidate_sites + site_scores) and ensure profile_id is persisted.
6. Build score explanation endpoint:
	 - input: site/profile context
	 - fetch: relevant score + compact demographics
	 - call: Gemini (API key empty placeholder supported)
	 - output: user-friendly explanation + improvement suggestions
7. Ensure map page shows explanation only in map context as requested.
8. Add guardrails for null profile_id, missing planning_area_id, and missing score rows.

## 10) Recommended Future Schema Additions (Optional But Useful)

1. business_profiles table (required to fully satisfy business profile DB task)
2. profile_preferences_json or normalized profile dimension tables if profile complexity grows
3. score_explanations table for caching/generated-text history
4. ai_audit_log table for prompt/response metadata and debugging

---

If there is uncertainty when coding, treat users + candidate_sites + site_scores + planning_areas + area_demographics as the authoritative v1 path for map scoring and explanation.
