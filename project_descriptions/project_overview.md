> **Note:** This document is a living record of the project's conceptual and technical framework. The contents within this file will be updated iteratively throughout the **planning** and **building** phases of the project to reflect design changes, technical pivots, and feature refinements.

---

# SmartLocate SG: Data-Driven Business Site Selector (Web App)

## 1. Concept Overview

**Goal:** Provide SMEs and MNCs a browser-based tool to score and compare potential outlet locations in Singapore using demographics, transport access, and commercial supply/vacancy data from public datasets.

### Target Users

* **Small Business Owners:** (F&B, retail, tuition, gyms) planning their first or next outlet.
* **Franchise/MNC Expansion Teams:** Evaluating multiple candidate sites simultaneously.
* **Commercial Agents:** Supporting data-driven recommendations for clients.

---

## 2. Core Features (Web App Version)

### A. Business Profile & Customer Wizard

* **Web Form/Wizard:** Captures:
  - **Business Sector:** Professional services, Education & training, Health & wellness, Beauty & personal care, Entertainment & leisure, Supermarket/Retail or Showrooms
  - **Price Band:** $1-$20, $21-$50, $51-$100, $100-$500, $500-$1000, $1000+
  - **Target Age Groups:** 18-24, 25-34, 35-44, 45-54, 55-64, 65+
  - **Target Income Bands:** Low (<S$3,000), Lower-Middle (S$3,000-S$5,000), Middle (S$5,000-S$8,000), Upper-Middle (S$8,000-S$12,000), High (>S$12,000)
  - **Reliance Type:** Walk-in focused, Delivery focused, Mixed
* **Storage:** Store profiles server-side (SQL) for recurring scoring runs.

### B. Area & Site Scoring Engine (Backend)

Pre-computes area-level profiles by joining:

* **Demographics:** Age, household size, and economic status by planning area/subzone.
* **Transport:** MRT station density and exit proximity as footfall proxies.
* **Commercial Data:** Vacant space by type/region to proxy rental cost and supply.

**Composite Scoring logic:**

1. **Demographic Match:** Target age groups and income bands vs. local area distribution.
2. **Accessibility Score:** Proximity to MRT stations, MRT exits, and bus stops.
3. **Rental Pressure:** Vacancy levels and rental price indicators in the area.
4. **Competition Density:** Count of existing similar businesses within a specified radius.

### C. Interactive Map & Site Experimentation

* **Base Map:** Interactive map of Singapore with zoom and pan controls (Google Maps API).
* **Choropleth Overlay:** Visualizes composite score, demographics, accessibility, or vacancy by planning area/district/region.
* **Toggleable Layers:** MRT stations, MRT exits (zoom-dependent), bus stops.
* **Point-of-Interest (POI) Pin:** Users can drop a pin at any location to receive a detailed site score breakdown with all dimension scores.
* **Planning Area Details:** Click on districts/regions to view demographic and scoring information.
* **Portfolio:** Save candidate sites with optional names and notes for side-by-side comparison.

### D. Scenario Planning

Dynamic controls (sliders/toggles) to adjust weights:

* **Normal / Holiday Peak:** Higher weights to MRT/bus stop proximity and accessibility.
* **Pandemic / Delivery Focus:** Higher weights to residential density; lower weights to MRT proximity.
* **Cost-Saving Mode:** Higher weights to vacancy/rental factors; slightly decreased accessibility weight.
* **Custom Weights:** Manual adjustment of individual scoring dimension weights (must total 100%).
* **Reset to Default:** Restore system default weight configuration.

### E. Portfolio & Comparison Dashboard

* **Portfolio Management:** View, edit notes, and delete saved candidate sites for each business profile.
* **Comparison Dashboard:** Select up to **three sites** for side-by-side comparison with tables and charts (bar or radar).
* **Export:** Generate and download PDF comparison reports.

### F. Score Explanation & Insights (AI Agent)

* **AI-Generated Explanations:** Custom AI Agent generates rule-based narrative explanations for site scores.
* **Dimension-Specific Insights:** Separate explanations for demographic match, accessibility, rental pressure, and competition density.
* **User-Friendly Language:** Explanations reference specific data points (age groups, income bands, nearby transport, vacancy rates, competitor counts).
* **Feedback Mechanism:** Users can provide feedback on each criterion/insight.

---

## 3. Datasets & Integration

| Category | Data Source | Usage |
| --- | --- | --- |
| **Demographics** | OneMap API / SingStat | Age, income, and household size by subzone. |
| **Transport** | LTA DataMall | GEOJSON of MRT stations, exits, and bus stops. |
| **Commercial** | URA APIs / Corporate Loc. | Vacancy rates and rental price proxies. |
| **Competition** | Google Maps API / data.gov.sg | Counts of existing F&B/Retail licenses in a radius. |

---

## 4. Web Tech Stack & Architecture

### Frontend

* **Framework:** React.js
* **Routing:** React Router
* **UI Components:** Material UI (MUI)
* **Maps:** Google Maps JS API with GeoJSON overlays.

### Backend

* **Framework:** Python (Flask or Django)
* **Endpoints:** RESTful API for profile management and scoring.
* **ETL:** Periodic cron jobs to ingest/update data from OneMap and LTA.

### Database (Supabase / PostgreSQL)

* **Platform:** [Supabase](https://supabase.com) — managed PostgreSQL with a built-in REST API (PostgREST), Supabase Auth, and Row-Level Security (RLS).
* **Schema:** `AREA`, `AREA_DEMOGRAPHICS`, `AREA_TRANSPORT_ACCESS`, `AREA_VACANCY`, `USER`, `CANDIDATE_SITE`, `WEIGHT_CONFIG`, `SITE_SCORE`, `EXPLANATION`.
* **Optimization:** PostgreSQL functions (replacing stored procedures) for real-time scoring calculations; RLS policies enforce per-user data isolation.
* **Authentication:** Supabase Auth manages user registration, email verification, JWT session tokens, and password hashing (bcrypt) natively.

### Deployment

* Hosted on a local server or cloud environment for demonstration.
* Strict separation of concerns (Presentation, Application, and Data layers).
