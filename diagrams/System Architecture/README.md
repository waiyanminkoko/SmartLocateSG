# SmartLocateSG System Architecture

## Purpose
This folder contains the **master system architecture deliverable** for Lab 3.

## Files
- `SmartLocateSG_SystemArchitecture.puml`: canonical architecture diagram.

## Architecture Summary
SmartLocateSG follows a layered modular-monolith style:

1. **Client Layer (React SPA)**
- UI pages: Dashboard, Profiles, Map, Portfolio, Compare, Admin.
- Uses auth context and calls backend REST APIs.

2. **Application Layer (Express server)**
- API routes orchestrate business flows.
- Storage abstraction centralizes persistence access.
- Map data service composes overlays, layers, and scoring input data.
- Explanation feedback service records user feedback for AI explanations.

3. **Domain Services**
- Scoring engine computes composite and dimension scores.
- Explanation generator returns AI/fallback score explanations.
- Chatbot service serves contextual Q&A for map/portfolio/compare pages.
- ETL coordinator updates external data snapshots.

4. **Data Layer (PostgreSQL/Supabase)**
- Core entities include: `users`, `business_profiles`, `candidate_sites`, `site_scores`, `planning_areas`, `area_demographics`.
- User-scoped resources are constrained by `user_id` ownership checks.

5. **External Integrations**
- OneMap/SingStat, LTA, URA, Google Places/Geocoding for map and scoring signals.
- Gemini for AI explanation/chatbot responses with fallback behavior.

## Design Decisions
- **Encapsulation**: API routes call internal services; UI does not access persistence directly.
- **Loose coupling**: External providers are consumed through map/AI service boundaries.
- **High cohesion**: Each module owns one concern (profiles, map scoring, portfolio, compare, admin).
- **Traceability**: Use cases map directly to page modules and route handlers.

## Access Control
- Authenticated context is required for profile/site CRUD operations.
- Server validates `userId` ownership before mutating profile/site records.

## Persistence Notes
- `business_profiles` stores strategy inputs for scoring.
- `candidate_sites` stores saved options and references `site_scores` snapshots.
- `planning_areas` and `area_demographics` provide area-level scoring context.

## Suggested Rendering
Use PlantUML to render:

```powershell
plantuml "diagrams/System Architecture/SmartLocateSG_SystemArchitecture.puml"
```
