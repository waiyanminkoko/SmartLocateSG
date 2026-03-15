# Functional Requirements - SmartLocate SG

> **Document Version:** 1.0  
> **Last Updated:** January 25, 2026  
> **Project:** SmartLocate SG - Data-Driven Business Site Selector

---

## 1. Target Users (Actors)

| Actor ID | Actor Name | Description |
|----------|------------|-------------|
| A01 | Small Business Owner | F&B, retail, tuition, or gym owners planning their first or next outlet location. |
| A02 | Franchise/MNC Expansion Team | Corporate users evaluating multiple candidate sites simultaneously for business expansion. |
| A03 | Commercial Agent | Real estate professionals supporting data-driven location recommendations for clients. |
| A04 | System Administrator | Internal user responsible for managing system configurations, data updates, and user accounts. |
| A05 | External Data Provider | External systems (OneMap API, LTA DataMall, URA API, Google Maps API) that supply data to the system. |

---

## 2. Business Profile Management

### FR-BPM-001: Create Business Profile
- **Actor:** A01, A02, A03
- **Description:** The system shall allow a logged-in user to create a new business profile by completing the business profile wizard.
- **Input:** Business name, business sector, price band, target customer age groups, desired income bands, reliance type.
- **Output:** Business profile saved and confirmation message displayed.
- **Verification Criteria:** Business profile record is created and associated with the user account.

### FR-BPM-002: Select Business Sector
- **Actor:** A01, A02, A03
- **Description:** The system shall provide a selection of predefined business sectors during business profile creation.
- **Available Sectors:**
  - Professional services (consulting, legal, accounting, engineering)
  - Education & training (tuition centres, enrichment, private schools)
  - Health & wellness (clinics, dental, physio, gyms, spas)
  - Beauty & personal care (salons, barbers, nail studios)
  - Entertainment & leisure (arcades, escape rooms, indoor playgrounds, arts studios)
  - Supermarket/Retail or Showrooms (mini marts, car showrooms)
- **Input:** Sector selection from the dropdown menu.
- **Output:** Selected sector stored in the business profile.
- **Verification Criteria:** Only valid predefined sectors can be selected.

### FR-BPM-003: Define Price Band
- **Actor:** A01, A02, A03
- **Description:** The system shall allow the user to specify the price band of different price ranges for their business.
- **Bands:** $1-$20, $21-$50, $51-$100, $100-$500, $500-$1000, $1000+.
- **Input:** Multi-select checkbox for Price band.
- **Output:** Price band stored in the business profile.
- **Verification Criteria:** Price band value is correctly associated with the business profile.

### FR-BPM-004: Specify Target Age Groups
- **Actor:** A01, A02, A03
- **Description:** The system shall allow the user to select one or more target customer age groups (e.g., 18-24, 25-34, 35-44, 45-54, 55-64, 65+).
- **Input:** Multi-select checkbox for age groups.
- **Output:** Selected age groups stored in the business profile.
- **Verification Criteria:** At least one age group must be selected.

### FR-BPM-005: Specify Target Income Bands
- **Actor:** A01, A02, A03
- **Description:** The system shall allow the user to select one or more desired customer income bands based on planning area proxies.
- **Bands:**
  - Low: < S$3,000 per month
  - Lower-Middle: S$3,000 – S$5,000
  - Middle: S$5,000 – S$8,000
  - Upper-Middle: S$8,000 – S$12,000
  - High: Above S$12,000
- **Input:** Multi-select checkbox for monthly income bands.
- **Output:** Selected income bands stored in the business profile.
- **Verification Criteria:** At least one income band must be selected.

### FR-BPM-006: Set Customer Reliance Type
- **Actor:** A01, A02, A03
- **Description:** The system shall allow the user to specify their business's reliance on walk-in customers versus delivery services.
- **Input:** Reliance type selection (Walk-in focused, Delivery focused, Mixed).
- **Output:** Reliance type stored in the business profile.
- **Verification Criteria:** Reliance type influences the scoring algorithm weights.

### FR-BPM-007: View Business Profiles
- **Actor:** A01, A02, A03
- **Description:** The system shall display a list of all business profiles created by the logged-in user.
- **Input:** User authentication token if necessary.
- **Output:** List of business profiles with name, sector, and creation date.
- **Verification Criteria:** Only profiles belonging to the authenticated user are displayed.

### FR-BPM-008: Edit Business Profile
- **Actor:** A01, A02, A03
- **Description:** The system shall allow a user to modify an existing business profile.
- **Input:** Updated business profile fields.
- **Output:** Updated profile saved and confirmation message displayed.
- **Verification Criteria:** Changes are persisted in the database and reflected in the profile view.

### FR-BPM-009: Delete Business Profile
- **Actor:** A01, A02, A03
- **Description:** The system shall allow a user to delete an existing business profile after confirmation.
- **Input:** Delete request with confirmation.
- **Output:** Business profile removed and confirmation message displayed.
- **Verification Criteria:** Profile record is removed from the database along with associated candidate sites.

## 3. Area & Site Scoring Engine

### FR-SSE-001: Calculate Demographic Match Score
- **Actor:** System (triggered by A01, A02, A03)
- **Description:** The system shall calculate a demographic match score by comparing the user's target demographics (age, income) against the local area distribution.
- **Input:** Business profile target demographics, area demographic data.
- **Output:** Demographic match score (0-100 points).
- **Verification Criteria:** Score accurately reflects the percentage overlap between target and local demographics.

### FR-SSE-002: Calculate Accessibility Score
- **Actor:** System (triggered by A01, A02, A03)
- **Description:** The system shall calculate an accessibility score based on the proximity to MRT stations, MRT exits, and bus stops.
- **Input:** Site coordinates, transport infrastructure data (MRT stations, exits, bus stops).
- **Output:** Accessibility score (0-100 points).
- **Verification Criteria:** Higher scores are assigned to locations closer to transport nodes.

### FR-SSE-003: Calculate Rental Pressure Score
- **Actor:** System (triggered by A01, A02, A03)
- **Description:** The system shall calculate a rental pressure score based on vacancy levels and rental price indicators in the area.
- **Input:** Site coordinates, commercial vacancy data, rental price data.
- **Output:** Rental pressure score (0-100 points).
- **Verification Criteria:** Higher vacancy rates result in lower rental pressure (more favorable) scores.

### FR-SSE-004: Calculate Composite Site Score
- **Actor:** System (triggered by A01, A02, A03)
- **Description:** The system shall calculate an overall composite score by combining the demographic match, accessibility, and rental pressure scores with configurable weights.
- **Input:** Individual dimension scores, weight configuration based on the user’s business profile.
- **Output:** Composite site score (0-100 points).
- **Verification Criteria:** Composite score equals the weighted sum of individual scores.

### FR-SSE-005: Calculate Competition Density Score
- **Actor:** System (triggered by A01, A02, A03)
- **Description:** The system shall calculate a competition density score based on the count of existing similar businesses within a specified radius.
- **Input:** Site coordinates, business sector, radius parameter.
- **Output:** Competition density score (0-100 points).
- **Verification Criteria:** Higher competitor counts result in lower (less favorable) scores.

### FR-SSE-006: Pre-compute Area Profiles
- **Actor:** A04, A05
- **Description:** The system shall pre-compute and store area-level (region and districts) profiles by joining demographics, transport access, and commercial vacancy data.
- **Input:** Raw data from external APIs (demographics, transport, commercial).
- **Output:** Pre-computed area profile records in the database.
- **Verification Criteria:** Area profiles are updated according to the scheduled frequency (manually triggered for demo).

## 4. Interactive Map & Site Exploration

### FR-MAP-001: Display Base Map
- **Actor:** A01, A02, A03
- **Description:** The system shall display an interactive map of Singapore as the primary interface for location exploration.
- **Input:** User navigation to map view (Google Maps API).
- **Output:** Interactive map centered on Singapore with zoom and pan controls.
- **Verification Criteria:** Map loads within the acceptable performance threshold.

### FR-MAP-002: Display Choropleth Overlay
- **Actor:** A01, A02, A03
- **Description:** The system shall display a choropleth overlay on the map visualizing scores or demographic data by planning area.
- **Input:** Selected overlay type (composite score, demographic data, accessibility).
- **Output:** Color-coded planning areas based on selected data dimension.
- **Verification Criteria:** Colors accurately represent the data values according to the legend.

### FR-MAP-003: Toggle Overlay Data Type
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to switch between different choropleth overlay types (composite score, demographics, accessibility, vacancy).
- **Input:** Overlay type selection from control panel.
- **Output:** Map overlay updated to reflect selected data type.
- **Verification Criteria:** Overlay updates without requiring page reload.

### FR-MAP-004: Display MRT Station Markers
- **Actor:** A01, A02, A03
- **Description:** The system shall display markers indicating the locations of all MRT stations on the map.
- **Input:** User enables MRT stations layer.
- **Output:** MRT station icons displayed at correct geographical positions.
- **Verification Criteria:** All MRT stations from the LTA dataset are displayed.

### FR-MAP-005: Display MRT Exit Markers
- **Actor:** A01, A02, A03
- **Description:** The system shall display markers indicating MRT exit locations when zoomed to sufficient detail.
- **Input:** Map zoom level exceeds threshold; MRT exits layer enabled.
- **Output:** MRT exit icons displayed at correct positions.
- **Verification Criteria:** Exit markers appear only at appropriate zoom levels.

### FR-MAP-006: Display Bus Stop Markers
- **Actor:** A01, A02, A03
- **Description:** The system shall display markers indicating bus stop locations on the map.
- **Input:** User enables bus stops layer.
- **Output:** Bus stop icons displayed at correct geographical positions.
- **Verification Criteria:** Bus stops from the LTA dataset are accurately positioned.

### FR-MAP-007: Toggle Map Layers
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to toggle visibility of individual map layers (MRT stations, MRT exits, bus stops, choropleth).
- **Input:** Layer toggle controls.
- **Output:** Selected layers shown or hidden on the map.
- **Verification Criteria:** Layer visibility changes immediately upon toggling.

### FR-MAP-008: Drop Point-of-Interest (POI) Pin
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to drop a point-of-interest (POI) pin at any location on the map to evaluate a potential site.
- **Input:** Click/tap on map location.
- **Output:** Pin placed at selected coordinates. Site evaluation panel triggered upon confirmation.
- **Verification Criteria:** Pin coordinates match the clicked location accurately.

### FR-MAP-009: Display Site Score Breakdown
- **Actor:** A01, A02, A03
- **Description:** The system shall display a detailed score breakdown for a pinned location, showing individual dimension scores.
- **Input:** POI pin placement or selection.
- **Output:** Panel displaying composite score and breakdown (demographic, accessibility, rental, competition).
- **Verification Criteria:** Scores match the calculation based on active business profile and scenario weights.

### FR-MAP-010: View Planning Area Details
- **Actor:** A01, A02, A03
- **Description:** The system shall display detailed demographic and scoring information when a user clicks on a specific district or region.
- **Input:** Click on the district or region’s Info (ℹ) icon.
- **Output:** Information panel with area name, population demographics, and area-level scores.
- **Verification Criteria:** Displayed data matches the pre-computed area profile.

## 5. Candidate Site Portfolio Management

### FR-CSP-001: Save Candidate Site
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to save a pinned location as a candidate site to their portfolio.
- **Input:** POI pin location, site name (optional), associated business profile.
- **Output:** Candidate site saved to portfolio; confirmation message displayed.
- **Verification Criteria:** Site record created in database with coordinates, scores, and association to business profile.

### FR-CSP-002a: View Candidate Site Portfolio
- **Actor:** A01, A02, A03
- **Description:** The system shall display a list of all candidate sites saved for a selected business profile.
- **Input:** Business profile selection.
- **Output:** List of candidate sites with name, address, composite score, and save date.
- **Verification Criteria:** Only sites associated with the selected business profile are displayed.

### FR-CSP-002b: Delete Candidate Site
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to remove a candidate site from their portfolio.
- **Input:** Delete request for specific candidate site.
- **Output:** Site removed from portfolio; confirmation message displayed.
- **Verification Criteria:** Site record is deleted from the database.

### FR-CSP-003: View Candidate Site on Map
- **Actor:** A01, A02, A03
- **Description:** The system shall center the map on a selected candidate site and display its pin and score breakdown.
- **Input:** Selection of candidate site from portfolio list.
- **Output:** Map centered on site; POI pin and score panel displayed.
- **Verification Criteria:** Map navigates to the correct coordinates.

### FR-CSP-004: Add Notes to Candidate Site
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to add or edit notes for a saved candidate site.
- **Input:** Text notes for candidate site.
- **Output:** Notes saved and associated with the candidate site.
- **Verification Criteria:** Notes are persisted and displayed when viewing the site.

## 6. Scenario Planning

### FR-SCP-001: Select Predefined Scenario
- **Actor:** A01, A02, A03
- **Description:** The system shall provide predefined scenario options (Normal/Holiday Peak, Pandemic/Delivery Focus, Cost-Saving Mode) that adjust scoring weights.
- **Input:** Scenario selection from dropdown or button group.
- **Output:** Scoring weights updated according to selected scenario; map and scores recalculated.
- **Verification Criteria:** Weight values match the predefined scenario configuration.

### FR-SCP-002a: Apply Normal/Holiday Peak Scenario
- **Actor:** A01, A02, A03
- **Description:** The system shall apply higher weights to MRT proximity and mall-proximate areas.
- **Input:** Selection of Normal/Holiday Peak scenario.
- **Output:** Accessibility weight increased; scores recalculated and displayed.
- **Verification Criteria:** Sites near MRT stations and bus stops show improved scores.

### FR-SCP-002b: Apply Pandemic/Delivery Focus Scenario
- **Actor:** A01, A02, A03
- **Description:** The system shall apply higher weights to residential density and lower weights to MRT proximity.
- **Input:** Selection of Pandemic/Delivery Focus scenario.
- **Output:** Demographic (residential) weight increased; MRT weight decreased; scores recalculated.
- **Verification Criteria:** High-density residential areas show improved scores.

### FR-SCP-002c: Apply Cost-Saving Mode Scenario
- **Actor:** A01, A02, A03
- **Description:** The system shall apply higher weights to vacancy/rental factors.
- **Input:** Selection of Cost-Saving Mode scenario.
- **Output:** Rental pressure weight increased; accessibility weight slightly decreased; scores recalculated.
- **Verification Criteria:** Areas with high vacancy rates show improved scores.

### FR-SCP-002d: Custom Weight Adjustment
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to manually adjust individual scoring weights using sliders or input fields (total must equal 100%).
- **Input:** Weight values for each scoring dimension.
- **Output:** Custom weights applied; scores recalculated and displayed.
- **Verification Criteria:** Composite scores reflect the custom weight configuration.

### FR-SCP-002e: Reset to Default Weights
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to reset scoring weights to the system default values.
- **Input:** Reset to default button click.
- **Output:** Weights restored to default; scores recalculated.
- **Verification Criteria:** Weight values match system defaults after reset.

## 7. Site Comparison Dashboard

### FR-SCD-001: Select Sites for Comparison
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to select up to three candidate sites for side-by-side comparison.
- **Input:** Selection of 2-3 candidate sites from portfolio.
- **Output:** Comparison dashboard populated with selected sites.
- **Verification Criteria:** System enforces a maximum of three sites for comparison.

### FR-SCD-002: Display Comparison Table
- **Actor:** A01, A02, A03
- **Description:** The system shall display a comparison table showing key metrics for selected candidate sites.
- **Input:** Selected candidate sites.
- **Output:** Table with rows for each metric (composite score, demographic match, accessibility, rental pressure, competition) and columns for each site.
- **Verification Criteria:** All relevant metrics are displayed accurately for each site.

### FR-SCD-003: Display Comparison Charts
- **Actor:** A01, A02, A03
- **Description:** The system shall display visual charts (bar or radar) comparing the score dimensions of selected sites.
- **Input:** Selected candidate sites.
- **Output:** Chart visualization of scores across sites.
- **Verification Criteria:** Chart accurately represents the numerical scores.

### FR-SCD-004: Export Comparison Report
- **Actor:** A01, A02, A03
- **Description:** The system shall allow users to export the comparison data as a PDF report.
- **Input:** Export request from comparison dashboard.
- **Output:** PDF file generated and downloaded containing comparison table and charts.
- **Verification Criteria:** PDF contains all displayed comparison data in readable format.

## 8. Score Explanation & Insights

### FR-SEI-001: Display Score Explanation Panel
- **Actor:** A01, A02, A03
- **Description:** The system shall display an explanation panel providing rule-based narrative explanations for a site's score generated by the AI Agent.
- **Input:** Request to the AI Agent to explain the score for a candidate site or POI pin.
- **Output:** Panel with bullet-point explanations.
- **Verification Criteria:** Explanations accurately reflect the scoring logic and data values.

### FR-SEI-002: Generate Demographic Insight
- **Actor:** System
- **Description:** The system shall generate a narrative explanation for the demographic match component of a score.
- **Input:** Site demographic score, target demographics, local demographics.
- **Output:** Text explanation describing demographic alignment or gaps.
- **Verification Criteria:** Explanation references specific age groups or income bands.

### FR-SEI-003: Generate Accessibility Insight
- **Actor:** System
- **Description:** The system shall generate a narrative explanation for the accessibility component of a score.
- **Input:** Site accessibility score, nearby transport nodes.
- **Output:** Text explanation describing transport access.
- **Verification Criteria:** Explanation references specific transport infrastructure.

### FR-SEI-004: Generate Rental Insight
- **Actor:** System
- **Description:** The system shall generate a narrative explanation for the rental pressure component of a score.
- **Input:** Site rental score, area vacancy data.
- **Output:** Text explanation describing rental market conditions.
- **Verification Criteria:** Explanation references vacancy rates or rental price indicators.

### FR-SEI-005: Generate Competition Insight
- **Actor:** System
- **Description:** The system shall generate a narrative explanation for the competition density component of a score.
- **Input:** Site competition score, competitor count.
- **Output:** Text explanation describing competitive landscape.
- **Verification Criteria:** Explanation includes competitor count and impact on score.

## 9. Data Management & Integration

### FR-DMI-001: Ingest Demographic Data
- **Actor:** A04, A05
- **Description:** The system shall periodically retrieve and store demographic data from OneMap API and SingStat.
- **Input:** API calls to OneMap/SingStat endpoints.
- **Output:** Demographic data stored in AREA_DEMOGRAPHICS table.
- **Verification Criteria:** Data is updated according to configured ETL schedule.

### FR-DMI-002: Ingest Transport Data
- **Actor:** A04, A05
- **Description:** The system shall periodically retrieve and store transport infrastructure data from LTA DataMall.
- **Input:** API calls to LTA DataMall endpoints.
- **Output:** Transport data stored in AREA_TRANSPORT_ACCESS table; GeoJSON files updated.
- **Verification Criteria:** All MRT stations and bus stops from LTA dataset are captured.

### FR-DMI-003: Ingest Commercial Vacancy Data
- **Actor:** A04, A05
- **Description:** The system shall periodically retrieve and store commercial vacancy and rental data from URA APIs.
- **Input:** API calls to URA API endpoints.
- **Output:** Vacancy and rental data stored in AREA_VACANCY table.
- **Verification Criteria:** Data reflects current URA published statistics.

### FR-DMI-004: Ingest Competition Data
- **Actor:** A04, A05
- **Description:** The system shall retrieve business license and POI data for competition analysis from data.gov.sg and Google Maps API.
- **Input:** API calls to data.gov.sg and Google Maps Places API.
- **Output:** Competition data stored for scoring calculations.
- **Verification Criteria:** F&B and retail license data is current and geocoded.

### FR-DMI-005: Execute Score Calculation
- **Actor:** A04
- **Description:** The system shall calculate the scores based on the current data from the APIs.
- **Input:** Cron job trigger.
- **Output:** Data tables updated; Log entry created.
- **Verification Criteria:** Complete within an acceptable time window and log results.

### FR-DMI-006: View Data Update Status
- **Actor:** A04
- **Description:** The system shall allow administrators to view the status and timestamp of the last successful data update for each data source.
- **Input:** Navigation to admin data status page.
- **Output:** Table showing data source, last update timestamp, and status.
- **Verification Criteria:** Timestamps accurately reflect the most recent Cron job completion.

