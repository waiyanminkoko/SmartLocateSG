# Use Case Model — SmartLocate SG

> **Document Version:** 1.0  \
> **Last Updated:** February 18, 2026  \
> **Purpose:** Identify and describe the system’s main use cases derived from the Functional Requirements.

---

## 1. Actors

| Actor ID | Actor | Description |
|---|---|---|
| A01 | Small Business Owner | Uses the system to evaluate potential outlet sites. |
| A02 | Franchise/MNC Expansion Team | Evaluates multiple candidate sites across scenarios. |
| A03 | Commercial Agent | Supports clients with data-driven site recommendations. |
| A04 | System (Backend) | The SmartLocate SG system itself that handles backend processes: data persistence, calculations, API orchestration, ETL jobs, scoring engine, AI processing, session management, and data validation. Acts autonomously to support user interactions. |
| A05 | External Data Provider | Third-party systems providing datasets via APIs (OneMap/SingStat for demographics, LTA for transport, URA for planning/rental, Google Maps for geocoding, data.gov.sg for public datasets). Invoked by A04 when fresh or supplementary data is needed. |

---

## 2. Preliminary Use Cases (Categorised by Webpage)

These are the primary and supporting use cases mapped to the core webpages of the SmartLocate SG application.

### 2.1 Dashboard (Show Data)
- UC-26 View Data Update Status (System Data)
- UC-07 View Business Profiles (Recent/Summary)
- UC-17 View Portfolio (Recent/Summary)

### 2.2 Login/Forgot Password (Authentication)
- UC-01 Register Account
- UC-02 Verify Email
- UC-03 Log In
- UC-04 Log Out
- UC-05 Reset Password

### 2.3 Business Profiles (Create, View)
- UC-06 Create Business Profile (Wizard)
- UC-07 View Business Profiles
- UC-08 Edit Business Profile
- UC-09 Delete Business Profile

### 2.4 Map
- UC-10 View Interactive Map
- UC-11 Toggle Map Layers
- UC-12 Search Location (Address/Postal Code)
- UC-13 Drop POI Pin and Get Site Score
- UC-14 View Planning Area Details
- UC-15 View Score Explanation (Insights)
- UC-22 Select Scenario Preset
- UC-23 Adjust Scoring Weights
- UC-24 Reset Weights to Default

### 2.5 Portfolio (Different Location)
- UC-16 Save Candidate Site
- UC-17 View Portfolio
- UC-18 Edit Candidate Site Notes
- UC-19 Delete Candidate Site

### 2.6 Compare (Location Scores)
- UC-20 Compare Candidate Sites (max 3)
- UC-21 Export Comparison Report (PDF)

### 2.7 Admin & Data Management
- UC-25 Run/Monitor Data Refresh (ETL)
- UC-27 Configure API Keys
- UC-28 Configure Default Weights & Presets
- UC-29 View System Logs
- UC-30 Manage User Accounts

---

## 3. Use Case Relationships (Include/Extend Suggestions)

Use these to refine your UML diagram with `<<include>>` and `<<extend>>`.

### `<<include>>` (Reuse / Functional Decomposition)

- UC-01 Register Account `<<include>>` UC-02 Verify Email
- UC-05 Reset Password `<<include>>` UC-03 Log In (after successful reset)
- UC-06 Create Business Profile `<<include>>` UC-07 View Business Profiles (post-create list refresh)

- UC-13 Drop POI Pin and Get Site Score `<<include>>` UC-10 View Interactive Map
- UC-13 Drop POI Pin and Get Site Score `<<include>>` UC-31 Calculate Site Score (internal service use case)
- UC-20 Compare Candidate Sites `<<include>>` UC-17 View Portfolio
- UC-21 Export Comparison Report `<<include>>` UC-20 Compare Candidate Sites

- UC-25 Run/Monitor Data Refresh (ETL) `<<include>>` UC-32 Fetch External Data (per provider)
- UC-25 Run/Monitor Data Refresh (ETL) `<<include>>` UC-33 Update Area Profiles

### `<<extend>>` (Optional / Exceptional)

- UC-15 View Score Explanation `<<extend>>` UC-13 Drop POI Pin and Get Site Score (optional “Explain Score” action)
- UC-18 Edit Candidate Site Notes `<<extend>>` UC-17 View Portfolio (optional after selecting a site)
- UC-12 Search Location `<<extend>>` UC-10 View Interactive Map (optional way to navigate)

- UC-34 Notify Data Staleness `<<extend>>` UC-13 Drop POI Pin and Get Site Score (when API/cached data is stale)
- UC-35 Handle External API Failure `<<extend>>` UC-32 Fetch External Data (exception path)

---

## 4. Use Case Descriptions

All use cases are documented using the full template format per lab guidance, covering: Use Case ID, Name, History, Actor, Description, Preconditions, Postconditions, Priority, Frequency of Use, Flow of Events, Alternative Flows, Exceptions, Includes, Special Requirements, Assumptions, and Notes and Issues.

### Template & Guidance
#### Guidance for Use Case Template
Document each use case using the template shown in the Appendix. This section provides a description of each section in the use case template.
1.	Use Case Identification
1.1.	Use Case ID
Give each use case a unique numeric identifier, in hierarchical form:  X.Y. Related use cases can be grouped in the hierarchy. Functional requirements can be traced back to a labeled use case.
1.2.	Use Case Name
State a concise, results-oriented name for the use case. These reflect the tasks the user needs to be able to accomplish using the system. Include an action verb and a noun. Some examples:
•	View part number information.
•	Manually mark hypertext source and establish link to target.
•	Place an order for a CD with the updated software version.
1.3.	Use Case History
1.3.1	Created By
Supply the name of the person who initially documented this use case.
1.3.2	Date Created
Enter the date on which the use case was initially documented.
1.3.3	Last Updated By
Supply the name of the person who performed the most recent update to the use case description.
1.3.4	Date Last Updated
Enter the date on which the use case was most recently updated.
2.	Use Case Definition
2.1.	Actor
An actor is a person or other entity external to the software system being specified who interacts with the system and performs use cases to accomplish tasks. Different actors often correspond to different user classes, or roles, identified from the customer community that will use the product. Name the actor(s) that will be performing this use case.
2.2.	Description
Provide a brief description of the reason for and outcome of this use case, or a high-level description of the sequence of actions and the outcome of executing the use case.
2.3.	Preconditions
List any activities that must take place, or any conditions that must be true, before the use case can be started. Number each precondition. Examples:
1.	User’s identity has been authenticated.
2.	User’s computer has sufficient free memory available to launch task.
2.4.	Postconditions
Describe the state of the system at the conclusion of the use case execution. Number each postcondition. Examples:
1.	Document contains only valid SGML tags.
2.	Price of item in database has been updated with new value.
2.5.	Priority
Indicate the relative priority of implementing the functionality required to allow this use case to be executed. The priority scheme used must be the same as that used in the software requirements specification.
2.6.	Frequency of Use
Estimate the number of times this use case will be performed by the actors per some appropriate unit of time.
2.7.	Flow of Events
Provide a detailed description of the user actions and system responses that will take place during execution of the use case under normal, expected conditions. This dialog sequence will ultimately lead to accomplishing the goal stated in the use case name and description. This description may be written as an answer to the hypothetical question, “How do I <accomplish the task stated in the use case name>?” This is best done as a numbered list of actions performed by the actor, alternating with responses provided by the system.
2.8.	Alternative Flows
Document other, legitimate usage scenarios that can take place within this use case separately in this section. State the alternative course, and describe any differences in the sequence of steps that take place. Number each alternative course using the Use Case ID as a prefix, followed by “AC” to indicate “Alternative Course”. Example:  X.Y.AC.1.
2.9.	Exceptions
Describe any anticipated error conditions that could occur during execution of the use case, and define how the system is to respond to those conditions. Also, describe how the system is to respond if the use case execution fails for some unanticipated reason. Number each exception using the Use Case ID as a prefix, followed by “EX” to indicate “Exception”. Example:  X.Y.EX.1.
2.10.	Includes
List any other use cases that are included (“called”) by this use case. Common functionality that appears in multiple use cases can be split out into a separate use case that is included by the ones that need that common functionality.
2.11.	Special Requirements
Identify any additional requirements, such as nonfunctional requirements, for the use case that may need to be addressed during design or implementation. These may include performance requirements or other quality attributes.
2.12.	Assumptions
List any assumptions that were made in the analysis that led to accepting this use case into the product description and writing the use case description.
2.13.	Notes and Issues
List any additional comments about this use case or any remaining open issues or TBDs (To Be Determineds) that must be resolved. Identify who will resolve each issue, the due date, and what the resolution ultimately is.

#### Use Case Description Template
Use Case ID:	
Use Case Name:	
Created By:		Last Updated By:	
Date Created:		Date Last Updated:	

Actor:	
Description:	
Preconditions:	
Postconditions:	
Priority:	
Frequency of Use:	
Flow of Events:	
Alternative Flows:	
Exceptions:	
Includes:	
Special Requirements:	
Assumptions:	
Notes and Issues:	

### 4.1 Dashboard (Show Data)

(Descriptions for Dashboard-specific summaries will be added as the UI matures.)

### 4.2 Login/Forgot Password (Authentication)

#### UC-01 Register Account

| Field | Details |
|---|---|
| **Use Case ID** | UC-01 |
| **Use Case Name** | Register Account |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Allows a new user to create an account in SmartLocate SG by providing their email, password, and user type. Upon submission, the system creates a pending account and dispatches a verification email. |
| **Preconditions** | 1. The user does not already have an active or pending account. 2. The user has access to a valid email address. |
| **Postconditions** | 1. A user account is created with status "pending verification". 2. A verification email containing a unique token link is sent to the registered email address. |
| **Priority** | High |
| **Frequency of Use** | Once per user; occasional re-registration if account is deactivated. |
| **Flow of Events** | 1. User opens the registration page. 2. User enters email, password, confirms password, and selects user type. 3. **A04** validates inputs (email format, password strength, required fields) and checks email uniqueness in database. 4. **A04** creates a pending user account record in the database. 5. **A04** generates a verification token and sends a verification email via email service. 6. **A04** returns success response; UI shows "Check your email" confirmation. |
| **Alternative Flows** | UC-01.AC.1: Email already registered — **A04** returns error; system shows message and suggests logging in. UC-01.AC.2: Password policy not met — **A04** returns validation errors; system highlights unmet rules. |
| **Exceptions** | UC-01.EX.1: Email service unavailable — **A04** logs error; system notifies user that verification email could not be sent and offers retry. |
| **Includes** | UC-02 Verify Email |
| **Special Requirements** | Password must meet minimum strength policy (min 8 characters, mixed case, at least one digit). |
| **Assumptions** | Email service (A05) is available and operational at time of registration. |
| **Notes and Issues** | TBD: Decide whether social/OAuth login will be supported in a future iteration. |

---

#### UC-02 Verify Email

| Field | Details |
|---|---|
| **Use Case ID** | UC-02 |
| **Use Case Name** | Verify Email |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Activates a pending user account by validating the one-time token delivered in the verification email. Upon success, the account status is set to "active" and the user may log in. |
| **Preconditions** | 1. User has a pending account created via UC-01. 2. The verification link/token has not expired (valid for 24 hours). |
| **Postconditions** | 1. User account status is updated to "active". 2. Verification token is consumed/invalidated. |
| **Priority** | High |
| **Frequency of Use** | Once per user registration. |
| **Flow of Events** | 1. User clicks the verification link in the email. 2. **A04** extracts and validates the token from the URL against database records. 3. **A04** checks token expiration (24-hour window). 4. **A04** updates the user account status to "active" in the database. 5. **A04** returns success; system shows a success message and provides a log-in link. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-02.EX.1: Token invalid or expired — **A04** returns error; system shows error message and offers option to resend verification email. |
| **Includes** | None. |
| **Special Requirements** | Verification link must expire after 24 hours for security. |
| **Assumptions** | User has access to the email inbox associated with the registered address. |
| **Notes and Issues** | None. |

---

#### UC-03 Log In

| Field | Details |
|---|---|
| **Use Case ID** | UC-03 |
| **Use Case Name** | Log In |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Authenticates a registered user by verifying their email and password credentials, creating a session token, and redirecting them to the dashboard upon success. |
| **Preconditions** | 1. User has an active account (verified email). |
| **Postconditions** | 1. User is authenticated. 2. A session token is created and stored. 3. User is redirected to the main dashboard. |
| **Priority** | High |
| **Frequency of Use** | Multiple times per day per active user. |
| **Flow of Events** | 1. User opens the log-in page. 2. User enters email and password. 3. **A04** retrieves the user record by email from the database. 4. **A04** verifies the submitted password hash against the stored hashed password. 5. **A04** checks that account status is "active". 6. **A04** creates a JWT session token via Supabase Auth and stores it in the Supabase Auth session store. 7. **A04** returns the session token; system redirects user to the dashboard. |
| **Alternative Flows** | UC-03.AC.1: Incorrect credentials — **A04** returns an authentication error; system shows a generic error message. UC-03.AC.2: Account not yet verified — **A04** detects "pending" status; system prompts user to verify email or resend verification. |
| **Exceptions** | UC-03.EX.1: Session store unavailable — **A04** logs error; system displays a service-unavailable message. |
| **Includes** | None. |
| **Special Requirements** | Brute-force protection: lock account or impose delay after 5 failed attempts. Session token must expire after a configurable idle period. |
| **Assumptions** | User's browser supports cookies or local storage for session management. |
| **Notes and Issues** | None. |

---

### 4.3 Business Profiles (Create, View)

#### UC-06 Create Business Profile (Wizard)

| Field | Details |
|---|---|
| **Use Case ID** | UC-06 |
| **Use Case Name** | Create Business Profile |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Guides the authenticated user through a multi-step wizard to define a Business Profile — capturing sector, price band, target age groups, income bands, and customer reliance type — which is then saved and used to drive site scoring. |
| **Preconditions** | 1. User is logged in with an active account. |
| **Postconditions** | 1. A Business Profile record is persisted in the database linked to the user's account. 2. The new profile is immediately available for site scoring and map overlays. |
| **Priority** | High |
| **Frequency of Use** | Each user typically creates 1–5 profiles; occasional creation of additional profiles for new business types. |
| **Flow of Events** | 1. User selects "Create Business Profile". 2. User enters profile name and selects sector (Professional Services, Education & Training, Health & Wellness, Beauty & Personal Care, Entertainment & Leisure, Supermarket/Retail, or Showrooms) and price band ($1–$20, $21–$50, $51–$100, $100–$500, $500–$1,000, $1,000+). 3. User selects one or more target age groups (18–24, 25–34, 35–44, 45–54, 55–64, 65+) — at least one required. 4. User selects one or more income bands (Low <S$3,000; Lower-Middle S$3,000–S$5,000; Middle S$5,000–S$8,000; Upper-Middle S$8,000–S$12,000; High >S$12,000) — at least one required. 5. User selects customer reliance type (walk-in / delivery / mixed). 6. User submits the profile. 7. **A04** validates required fields (at least one age group and one income band selected). 8. **A04** validates business rules (valid sector, price band values). 9. **A04** saves the profile to the database associated with the user account. 10. **A04** returns success; system shows confirmation and refreshes the profile list. |
| **Alternative Flows** | UC-06.AC.1: Missing required selections — **A04** returns validation errors; system highlights missing fields (age groups or income bands). |
| **Exceptions** | UC-06.EX.1: Database write failure — **A04** logs error; system displays a save-failure message and prompts retry. |
| **Includes** | UC-07 View Business Profiles (post-create list refresh). |
| **Special Requirements** | Wizard must be completable in a single session; progress should be preserved if user navigates between steps. |
| **Assumptions** | Sector and price band drop-down values are pre-loaded from a static configuration. |
| **Notes and Issues** | None. |

---

### 4.4 Map

#### UC-10 View Interactive Map

| Field | Details |
|---|---|
| **Use Case ID** | UC-10 |
| **Use Case Name** | View Interactive Map |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Loads and displays the interactive Singapore map with a default composite score heatmap overlay, using the user's selected Business Profile. The map provides controls for layers, search, and profile selection. |
| **Preconditions** | 1. User is logged in with an active account. 2. At least one Business Profile exists, or the system allows a default profile selection flow. |
| **Postconditions** | 1. The interactive map is rendered and responsive. 2. A default overlay (composite score heatmap) is displayed for the selected profile. |
| **Priority** | High |
| **Frequency of Use** | Multiple times per session; primary working screen for most users. |
| **Flow of Events** | 1. User opens the Map screen. 2. **A05** (map provider, e.g., Google Maps/Mapbox) serves base map tiles. 3. **A04** retrieves the user's Business Profiles from the database. 4. **A04** loads cached area profile data (demographics, transport, rental) for the current map viewport. 5. **A04** computes the default overlay (composite score heatmap) for the selected profile using cached data. 6. **A04** returns map data and overlay; system displays the map with controls (layers, search, profile selector). |
| **Alternative Flows** | None. |
| **Exceptions** | UC-10.EX.1: Map provider (A05) unavailable — **A04** detects failure; system displays an error message and retry option. |
| **Includes** | None. |
| **Special Requirements** | Map must render initial view within 3 seconds (NFR-PER-001). Must be responsive on desktop and tablet viewports. |
| **Assumptions** | Cached area profile data is pre-loaded and available; initial map centre defaults to Singapore. |
| **Notes and Issues** | None. |

---

#### UC-11 Toggle Map Layers

| Field | Details |
|---|---|
| **Use Case ID** | UC-11 |
| **Use Case Name** | Toggle Map Layers |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Allows the user to show or hide geospatial data layers on the map, including MRT stations, MRT exits, bus stops, and planning area boundaries. |
| **Preconditions** | 1. The Map screen is open (UC-10 completed). |
| **Postconditions** | 1. Selected layers are rendered on or removed from the map canvas. |
| **Priority** | Medium |
| **Frequency of Use** | Multiple times per map session as users explore different data overlays. |
| **Flow of Events** | 1. User opens the layer control panel. 2. User toggles layer checkboxes (MRT stations, MRT exits, bus stops, planning areas). 3. **A04** retrieves relevant geospatial data for enabled layers from the cached database (MRT station locations and names; MRT exit points — zoom-level dependent; bus stop locations; planning area boundaries). 4. **A04** returns layer data in GeoJSON format. 5. System renders or removes layers on the map canvas. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-11.EX.1: Cached layer data unavailable — **A04** returns error; system disables the relevant layer checkbox and shows a tooltip indicating data is unavailable. |
| **Includes** | None. |
| **Special Requirements** | MRT exit points should only render at zoom level 15 or higher to avoid clutter. |
| **Assumptions** | Geospatial layer data is pre-cached and does not require live API calls. |
| **Notes and Issues** | None. |

---

#### UC-12 Search Location (Address/Postal Code)

| Field | Details |
|---|---|
| **Use Case ID** | UC-12 |
| **Use Case Name** | Search Location |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Enables the user to search for a Singapore address or postal code; the map centres on the matched location and drops a temporary marker. |
| **Preconditions** | 1. The Map screen is open. |
| **Postconditions** | 1. The map is centred on the selected location. 2. A temporary marker is placed at the searched location. |
| **Priority** | High |
| **Frequency of Use** | Frequently; used each time a user navigates to a specific address or area. |
| **Flow of Events** | 1. User enters an address or postal code in the search bar. 2. **A04** receives the query and forwards it to **A05** (geocoding provider: OneMap API or Google Geocoding API). 3. **A05** returns geocoding results (coordinates, formatted address). 4. **A04** processes and ranks results by relevance. 5. **A04** returns suggestions to the UI; system displays the list. 6. User selects a result. 7. **A04** returns selected coordinates; system centres the map and drops a temporary marker. |
| **Alternative Flows** | UC-12.AC.1: No results from **A05** — **A04** returns an empty set; system shows "No matches found" message with suggestions to broaden the search. |
| **Exceptions** | UC-12.EX.1: Geocoding provider (A05) unavailable — **A04** logs error; system shows a service-unavailable message. |
| **Includes** | None. |
| **Special Requirements** | Recent geocoding results should be cached by **A04** to minimise API calls to **A05** (NFR-PER). |
| **Assumptions** | OneMap API is the primary geocoding source for Singapore addresses; Google Geocoding is a fallback. |
| **Notes and Issues** | None. |

---

#### UC-13 Drop POI Pin and Get Site Score

| Field | Details |
|---|---|
| **Use Case ID** | UC-13 |
| **Use Case Name** | Drop POI Pin and Get Site Score |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Allows the user to click a point on the map to place a POI pin; the system then computes and displays a composite site suitability score together with a four-dimension breakdown (Demographic Match, Accessibility, Rental Pressure, Competition Density) for the selected Business Profile. |
| **Preconditions** | 1. User is logged in. 2. A Business Profile is selected. 3. The Map screen is open. |
| **Postconditions** | 1. A POI pin is placed on the map at the clicked location. 2. A composite score and four-dimension score breakdown are displayed. |
| **Priority** | High |
| **Frequency of Use** | Core action; performed multiple times per session. |
| **Flow of Events** | 1. User clicks or taps a point on the map. 2. **A04** drops a POI pin at the chosen coordinates. 3. **A04** identifies the planning area/subzone from coordinates using cached boundary data. 4. **A04** retrieves cached area profile data (demographics, transport nodes, rental benchmarks, competitor locations) from the database. 5. **A04** executes the scoring engine to calculate all four dimension scores: Demographic Match (age/income alignment, FR-SSE-001); Accessibility (MRT/bus proximity, walkability, FR-SSE-002); Rental Pressure (vacancy rates, rental index, FR-SSE-003); Competition Density (nearby competitors, FR-SSE-005). 6. **A04** calculates the composite score using current scenario weights (FR-SSE-004). 7. **A04** returns the score object; system displays composite score and score breakdown panel. 8. User may optionally select "Explain Score" to request AI-generated explanations (UC-15). |
| **Alternative Flows** | UC-13.AC.1: Competition data unavailable — **A04** computes score without the competition dimension and includes a notice in the response. UC-13.AC.2: Cached data is stale (>30 days) — **A04** optionally triggers a background refresh from **A05** for the next query. |
| **Exceptions** | UC-13.EX.1: Scoring engine failure — **A04** logs the error; system displays an error message and allows retry. |
| **Includes** | UC-10 View Interactive Map; UC-31 Calculate Site Score (internal). |
| **Special Requirements** | Score must be computed and displayed within 2 seconds of pin placement (NFR-PER-002). |
| **Assumptions** | Cached area profile data is sufficiently recent for scoring. Business Profile is fully configured with at least one age group and one income band. |
| **Notes and Issues** | UC-34 Notify Data Staleness extends this use case when cached data is stale. |

---

#### UC-14 View Planning Area Details

| Field | Details |
|---|---|
| **Use Case ID** | UC-14 |
| **Use Case Name** | View Planning Area Details |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Displays demographic, transport, and commercial metrics for a selected Singapore planning area/subzone when the user clicks on a planning area polygon or info icon on the map. |
| **Preconditions** | 1. The Map screen is open. |
| **Postconditions** | 1. A side panel displays demographics, transport metrics, commercial metrics, and an area-level composite score for the selected planning area. |
| **Priority** | Medium |
| **Frequency of Use** | Frequently; used during exploratory analysis of different zones. |
| **Flow of Events** | 1. User clicks on a planning area polygon or info icon. 2. **A04** identifies the planning area/subzone from the click coordinates. 3. **A04** retrieves area profile data from the database: population demographics (age distribution, income indicators); transport accessibility metrics (MRT station count, bus stop density); commercial metrics (vacancy rates, rental benchmarks); area-level composite score for the selected Business Profile. 4. **A04** returns the area summary; system displays it in the side panel with charts. 5. User may close the panel or click another area. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-14.EX.1: Area profile data not found — **A04** returns a not-found response; system shows "Data unavailable for this area" message. |
| **Includes** | None. |
| **Special Requirements** | Charts must render legibly on both desktop and tablet displays. |
| **Assumptions** | Planning area boundary polygons are pre-cached and cover all Singapore URA planning areas. |
| **Notes and Issues** | None. |

---

#### UC-15 View Score Explanation (Insights)

| Field | Details |
|---|---|
| **Use Case ID** | UC-15 |
| **Use Case Name** | View Score Explanation |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Provides AI-generated natural language explanations for each scoring dimension of a pinned or saved site, helping the user understand why a location received a particular score. |
| **Preconditions** | 1. A site score is available for a POI pin or saved candidate site (UC-13 has been executed). |
| **Postconditions** | 1. Dimension-specific narrative insight bullets are displayed in the explanation panel in user-friendly language. |
| **Priority** | Medium |
| **Frequency of Use** | Used occasionally per scored site; primarily for unfamiliar or borderline locations. |
| **Flow of Events** | 1. User clicks "Explain Score". 2. **A04** retrieves the score breakdown and underlying data (demographics, transport metrics, rental data, competition count). 3. **A04** invokes the AI Agent (internal or external LLM service) to generate natural language explanations for each dimension: Demographic Match (FR-SEI-002); Accessibility (FR-SEI-003); Rental Pressure (FR-SEI-004); Competition Density (FR-SEI-005). 4. **A04** returns formatted insights; system displays dimension-specific explanations in the insight panel. 5. User may provide feedback on each explanation per NFR-USA-004. |
| **Alternative Flows** | UC-15.AC.1: Explanations partially unavailable (e.g., competition data missing) — **A04** generates insights only for available dimensions; system shows a warning about missing dimensions. |
| **Exceptions** | UC-15.EX.1: AI service unavailable — **A04** logs error; system shows "Explanations temporarily unavailable" and suggests retry. |
| **Includes** | None. |
| **Special Requirements** | AI explanations must be generated and displayed within 5 seconds (NFR-PER-005). Language must be accessible to non-technical business users. |
| **Assumptions** | LLM service is accessible and returns responses in structured JSON. |
| **Notes and Issues** | UC-15 extends UC-13 as an optional action. |

---

#### UC-22 Select Scenario Preset

| Field | Details |
|---|---|
| **Use Case ID** | UC-22 |
| **Use Case Name** | Select Scenario Preset |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Allows the user to select a predefined scoring weight scenario (Normal/Holiday Peak, Pandemic/Delivery Focus, or Cost-Saving Mode) to instantly reconfigure how each scoring dimension is weighted, updating all visible scores and overlays. |
| **Preconditions** | 1. User is on the Map or scoring view. 2. A Business Profile is selected. |
| **Postconditions** | 1. Scoring weights are updated to the selected scenario's preset values. 2. Map overlay, POI scores, and candidate site scores are recalculated and refreshed. |
| **Priority** | Medium |
| **Frequency of Use** | Occasional; used when the user wants to evaluate sites under different market conditions. |
| **Flow of Events** | 1. User opens the scenario selector. 2. User chooses a preset: Normal/Holiday Peak (higher MRT/bus weights, FR-SCP-002a); Pandemic/Delivery Focus (higher residential/lower MRT weights, FR-SCP-002b); or Cost-Saving Mode (higher vacancy/rental weights, FR-SCP-002c). 3. **A04** retrieves predefined weights for the selected scenario from configuration. 4. **A04** applies preset weights to all four dimensions for the current session. 5. **A04** recalculates scores for the current view (map overlay, active POI, candidate sites). 6. **A04** returns updated scores; system updates overlay and breakdown display. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-22.EX.1: Scenario configuration missing — **A04** logs error; system falls back to default weights and notifies the user. |
| **Includes** | None. |
| **Special Requirements** | Score recalculation and overlay refresh must complete within 2 seconds of scenario selection. |
| **Assumptions** | Scenario preset weight configurations are stored in a system configuration file, not user-editable. |
| **Notes and Issues** | None. |

---

#### UC-23 Adjust Scoring Weights

| Field | Details |
|---|---|
| **Use Case ID** | UC-23 |
| **Use Case Name** | Adjust Scoring Weights |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Enables the user to manually set custom percentage weights for each of the four scoring dimensions using sliders; the system validates that weights total 100% and recalculates all scores accordingly. |
| **Preconditions** | 1. User is on the scenario/weights control panel. |
| **Postconditions** | 1. Custom weights are applied to the current session. 2. All scores (map overlay, POI, portfolio sites) are recalculated using the new weights. |
| **Priority** | Medium |
| **Frequency of Use** | Occasional; used by power users who want fine-grained control over scoring. |
| **Flow of Events** | 1. User opens the weight sliders panel. 2. User adjusts weights for all four dimensions (Demographic Match, Accessibility, Rental Pressure, Competition Density). 3. User confirms the custom weights. 4. **A04** validates that the total equals 100% (FR-SCP-002d). 5. **A04** validates each weight is within the acceptable range (0–100%). 6. **A04** applies custom weights to the current session. 7. **A04** recalculates all scores (map overlay, POI, portfolio sites). 8. **A04** returns updated scores; system updates the map overlay and score displays. |
| **Alternative Flows** | UC-23.AC.1: Total not 100% — **A04** returns a validation error; system prompts user to correct or offers auto-normalise. |
| **Exceptions** | UC-23.EX.1: Recalculation failure — **A04** logs error; system displays error and retains previous weights. |
| **Includes** | None. |
| **Special Requirements** | Sliders must provide real-time feedback; running total displayed to user as weights are adjusted. |
| **Assumptions** | User understands the meaning of each scoring dimension. |
| **Notes and Issues** | None. |

---

#### UC-24 Reset Weights to Default

| Field | Details |
|---|---|
| **Use Case ID** | UC-24 |
| **Use Case Name** | Reset Weights to Default |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Resets all four scoring dimension weights back to the system default values (typically 25% each) and recalculates scores, clearing any custom or preset weights applied in the current session. |
| **Preconditions** | 1. User is on the scenario/weights control panel. 2. Custom or preset weights may currently be applied. |
| **Postconditions** | 1. Scoring weights are reset to system defaults (25% per dimension). 2. All scores and overlays are recalculated and refreshed. |
| **Priority** | Low |
| **Frequency of Use** | Occasional; used after experimenting with custom or scenario weights. |
| **Flow of Events** | 1. User clicks "Reset to Default". 2. **A04** retrieves the default weight configuration (25% per dimension). 3. **A04** applies default weights to the current session. 4. **A04** recalculates all scores (map overlay, POI, portfolio sites). 5. **A04** returns updated scores; system updates displays and resets weight sliders to default positions. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-24.EX.1: Default configuration not found — **A04** logs error; system shows error message and retains current weights. |
| **Includes** | None. |
| **Special Requirements** | None. |
| **Assumptions** | Default weights are defined in system configuration and equal 25% per dimension. |
| **Notes and Issues** | None. |

---

### 4.5 Portfolio (Different Location)

#### UC-16 Save Candidate Site

| Field | Details |
|---|---|
| **Use Case ID** | UC-16 |
| **Use Case Name** | Save Candidate Site |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Saves a scored POI pin as a named candidate site into the user's portfolio, storing all score data, scenario weights, and optional notes for later review and comparison. |
| **Preconditions** | 1. A POI pin and its site score are currently displayed on the map (UC-13 completed). 2. User is logged in. |
| **Postconditions** | 1. A candidate site record is persisted in the database, linked to the active Business Profile and user account. 2. A toast notification confirms the save. |
| **Priority** | High |
| **Frequency of Use** | Used whenever a user wishes to shortlist a location; several times per session. |
| **Flow of Events** | 1. User clicks "Save to Portfolio". 2. System prompts for an optional site name and notes. 3. User enters a site name (optional) or confirms with an auto-generated label. 4. **A04** validates input (name and notes length). 5. **A04** saves the candidate site record to the database with: coordinates (lat/lng); all four dimension scores and composite score; current scenario weights; association to the active Business Profile (FR-CSP-001); user-provided site name and notes; timestamp. 6. **A04** returns success; system confirms with a toast notification. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-16.EX.1: Database write failure — **A04** logs error; system shows a save-failure message and prompts retry. |
| **Includes** | None. |
| **Special Requirements** | Site name must not exceed 100 characters; notes must not exceed 500 characters. |
| **Assumptions** | Scores are already computed and available before the save action is triggered. |
| **Notes and Issues** | None. |

---

#### UC-17 View Portfolio

| Field | Details |
|---|---|
| **Use Case ID** | UC-17 |
| **Use Case Name** | View Portfolio |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Displays all candidate sites saved by the authenticated user, optionally filtered by Business Profile, presented as a sortable table or card list with scores and available actions. |
| **Preconditions** | 1. User is logged in with an active account. |
| **Postconditions** | 1. All candidate sites belonging to the user (optionally filtered by profile) are displayed with their names, scores, addresses, and saved dates. |
| **Priority** | High |
| **Frequency of Use** | Multiple times per session; primary review and management screen for shortlisted sites. |
| **Flow of Events** | 1. User navigates to the Portfolio page. 2. **A04** retrieves all candidate sites for the user, optionally filtered by selected Business Profile. 3. **A04** returns site list with details (site name, address, coordinates, composite score, all dimension scores, saved date). 4. System displays sites in table/card format. 5. User may select actions: View on map, Edit notes, Delete, or Compare (multi-select). |
| **Alternative Flows** | None. |
| **Exceptions** | UC-17.EX.1: No candidate sites found — **A04** returns empty list; system displays "No saved sites yet" with a call-to-action to explore the map. |
| **Includes** | None. |
| **Special Requirements** | Portfolio list must load within 2 seconds. |
| **Assumptions** | Portfolio is scoped to the authenticated user; users cannot view each other's portfolios. |
| **Notes and Issues** | None. |

---

#### UC-18 Edit Candidate Site Notes

| Field | Details |
|---|---|
| **Use Case ID** | UC-18 |
| **Use Case Name** | Edit Candidate Site Notes |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Allows the user to update the name and/or notes text for an existing candidate site in their portfolio without altering the stored score data. |
| **Preconditions** | 1. User is viewing the Portfolio page with at least one saved site. |
| **Postconditions** | 1. Updated notes and/or name are persisted for the candidate site. 2. The portfolio display reflects the changes. |
| **Priority** | Medium |
| **Frequency of Use** | Occasionally; used when users wish to annotate sites after further analysis. |
| **Flow of Events** | 1. User clicks "Edit Notes" on a candidate site. 2. **A04** retrieves current site data including notes from database. 3. **A04** returns site data; system displays the notes editor (modal or inline). 4. User modifies the site name and/or notes text. 5. User saves changes. 6. **A04** validates input (length limits). 7. **A04** updates the candidate site record with new notes and a timestamp. 8. **A04** returns success; system shows confirmation and updates the display. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-18.EX.1: Database update failure — **A04** logs error; system shows error and retains original notes. |
| **Includes** | None. |
| **Special Requirements** | Notes field must not exceed 500 characters. |
| **Assumptions** | Only the site name and notes are editable; score data is immutable after saving. |
| **Notes and Issues** | UC-18 is an optional extension of UC-17 View Portfolio. |

---

#### UC-19 Delete Candidate Site

| Field | Details |
|---|---|
| **Use Case ID** | UC-19 |
| **Use Case Name** | Delete Candidate Site |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Permanently removes a candidate site record from the user's portfolio after confirmation, freeing it from comparison and portfolio views. |
| **Preconditions** | 1. User is viewing the Portfolio page with at least one saved site. |
| **Postconditions** | 1. The candidate site record is permanently deleted from the database. 2. The portfolio list is refreshed and no longer shows the deleted site. |
| **Priority** | Medium |
| **Frequency of Use** | Occasional; used for housekeeping of the portfolio. |
| **Flow of Events** | 1. User clicks "Delete" on a candidate site. 2. System shows a confirmation dialog. 3. User confirms deletion. 4. **A04** deletes the candidate site record from the database. 5. **A04** returns success; system shows confirmation and refreshes the portfolio list. |
| **Alternative Flows** | UC-19.AC.1: User cancels — no changes are made; dialog is dismissed. |
| **Exceptions** | UC-19.EX.1: Database deletion failure — **A04** logs error; system shows error message and retains the site. |
| **Includes** | None. |
| **Special Requirements** | Deletion is permanent and irreversible; confirmation dialog must clearly state this. |
| **Assumptions** | Hard delete is used (not soft delete); deleted sites are not recoverable. |
| **Notes and Issues** | None. |

---

### 4.6 Compare (Location Scores)

#### UC-20 Compare Candidate Sites (max 3)

| Field | Details |
|---|---|
| **Use Case ID** | UC-20 |
| **Use Case Name** | Compare Candidate Sites |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Enables the user to select 2–3 saved candidate sites and view a side-by-side comparison of their composite scores and all four scoring dimensions, with supporting bar or radar chart visualisations. |
| **Preconditions** | 1. User is logged in. 2. At least 2 candidate sites are saved under the selected Business Profile. |
| **Postconditions** | 1. Comparison dashboard displays side-by-side metrics for all four scoring dimensions for the selected sites. 2. A comparison chart (bar or radar) is rendered. |
| **Priority** | High |
| **Frequency of Use** | Used when the user is ready to shortlist or make a final recommendation; once or twice per engagement. |
| **Flow of Events** | 1. User opens the Comparison dashboard. 2. **A04** retrieves the user's candidate sites for the selected Business Profile from the database. 3. User selects 2–3 candidate sites from the list. 4. **A04** validates selection count (max 3). 5. **A04** retrieves detailed scores for selected sites (composite + all four dimensions). 6. **A04** formats comparison data; returns comparison table with composite score and each dimension (Demographic Match, Accessibility, Rental Pressure, Competition Density) per FR-SCD-002. 7. **A04** generates comparison chart data (bar or radar); system displays visualisation per FR-SCD-003. |
| **Alternative Flows** | UC-20.AC.1: User selects more than 3 sites — **A04** returns validation error; system blocks the selection and shows "Maximum 3 sites for comparison". |
| **Exceptions** | UC-20.EX.1: Score data unavailable for a site — **A04** returns partial data; system flags the affected site with a data-unavailable warning. |
| **Includes** | UC-17 View Portfolio. |
| **Special Requirements** | Comparison table and charts must load within 2 seconds. Charts must be accessible (colour-blind-friendly palette). |
| **Assumptions** | All selected sites have scores computed under the same Business Profile. |
| **Notes and Issues** | None. |

---

#### UC-21 Export Comparison Report (PDF)

| Field | Details |
|---|---|
| **Use Case ID** | UC-21 |
| **Use Case Name** | Export Comparison Report |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Generates and downloads a formatted PDF report containing the full comparison of 2–3 candidate sites, including the Business Profile summary, score tables, charts, and site details. |
| **Preconditions** | 1. The Comparison dashboard is populated with 2–3 sites (UC-20 completed). |
| **Postconditions** | 1. A PDF report file is generated and downloaded to the user's device. |
| **Priority** | Medium |
| **Frequency of Use** | Occasional; used when users need to share or archive comparison results. |
| **Flow of Events** | 1. User clicks "Export PDF". 2. **A04** retrieves comparison data (sites, scores, charts, Business Profile details). 3. **A04** generates a PDF report using a templating engine with: Business Profile summary; comparison table (all four dimensions, FR-SCD-004); comparison charts (bar/radar); site details (coordinates, notes, timestamps). 4. **A04** returns the PDF file; system triggers the browser download. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-21.EX.1: PDF generation fails — **A04** logs error; system shows error message and offers retry (generation must complete within 5 seconds, NFR-PER-006). |
| **Includes** | UC-20 Compare Candidate Sites. |
| **Special Requirements** | PDF must be generated within 5 seconds (NFR-PER-006). Report must be human-readable and print-ready. |
| **Assumptions** | PDF generation library (e.g., PDFKit or WeasyPrint) is integrated into the backend. |
| **Notes and Issues** | None. |

---

### 4.7 Admin & Data Management

#### UC-25 Run/Monitor Data Refresh (ETL)

| Field | Details |
|---|---|
| **Use Case ID** | UC-25 |
| **Use Case Name** | Run/Monitor Data Refresh (ETL) |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A04 (System — scheduled job or admin trigger) |
| **Description** | Orchestrates the Extract-Transform-Load (ETL) pipeline that fetches fresh datasets from multiple external providers (demographics, transport, rental, boundaries), validates and transforms the data, recomputes area profiles, and records execution status. |
| **Preconditions** | 1. The system holds valid API credentials for all external providers (A05). 2. A scheduled time has been reached or an authorised admin has manually triggered the job. |
| **Postconditions** | 1. Latest datasets are stored in the database. 2. Area profiles are recomputed and updated. 3. ETL job execution status (success/partial/failure) and timestamps are recorded. |
| **Priority** | High |
| **Frequency of Use** | Scheduled periodically (e.g., monthly); can also be triggered manually by an administrator. |
| **Flow of Events** | 1. **A04** initiates the ETL job (scheduled cron or manual trigger). 2. **A04** orchestrates parallel data fetches from multiple **A05** providers: OneMap/SingStat API (demographic data: age groups, income bands, population); LTA DataMall API (transport data: MRT stations, bus stops, routes); URA Space API (rental data: vacancy rates, rental indexes); data.gov.sg (supplementary datasets). 3. **A05** providers return datasets (JSON/CSV format). 4. **A04** validates data integrity (schema, completeness, date ranges). 5. **A04** transforms data (normalise, aggregate by planning area/subzone). 6. **A04** loads data into the database, replacing/updating previous datasets. 7. **A04** recomputes area profiles (demographic summaries, transport accessibility scores, rental benchmarks). 8. **A04** logs success/failure status, timestamps, and record counts for each provider. 9. **A04** updates data freshness indicators visible to users per UC-26. |
| **Alternative Flows** | UC-25.AC.1: One provider (A05) fails — **A04** continues with remaining providers; logs partial failure; schedules retry for the failed provider. |
| **Exceptions** | UC-25.EX.1: All providers fail — **A04** logs critical error; sends admin notification; retains previous datasets. UC-25.EX.2: Data validation fails — **A04** rejects invalid datasets; logs error; retains previous valid data. |
| **Includes** | UC-32 Fetch External Data (per provider); UC-33 Update Area Profiles. |
| **Special Requirements** | ETL pipeline must complete a full refresh within a configurable time window to avoid disruption during peak hours. Failed provider retries should occur with exponential back-off. |
| **Assumptions** | At least one external provider will succeed in each ETL run. API rate limits are respected via throttling logic in **A04**. |
| **Notes and Issues** | UC-35 Handle External API Failure extends UC-32 for exception handling. |

---

#### UC-26 View Data Update Status

| Field | Details |
|---|---|
| **Use Case ID** | UC-26 |
| **Use Case Name** | View Data Update Status |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent), A04 (System) |
| **Description** | Displays a data freshness summary to any user, showing the last successful refresh timestamp for each external data provider, staleness warnings, and overall ETL job status. |
| **Preconditions** | 1. User accesses the Dashboard or the Data Status page. |
| **Postconditions** | 1. Data freshness status is displayed in the dashboard widget or status panel. |
| **Priority** | Low |
| **Frequency of Use** | Viewed occasionally; primarily by administrators or users who are concerned about data recency. |
| **Flow of Events** | 1. User navigates to the Dashboard or Data Management page. 2. **A04** retrieves the latest ETL job execution logs and timestamps from the database. 3. **A04** computes data freshness indicators: last successful refresh timestamp per provider (OneMap, LTA, URA, etc.); data staleness warnings (if >30 days old); last ETL job status (success/partial/failure). 4. **A04** returns the status summary; system displays it in a dashboard widget or status panel. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-26.EX.1: ETL log table unavailable — **A04** logs error; system shows "Status data unavailable". |
| **Includes** | None. |
| **Special Requirements** | Staleness warning must be visually prominent (e.g., yellow/red indicator) when data is >30 days old. |
| **Assumptions** | ETL execution logs are maintained in a dedicated database table with per-provider entries. |
| **Notes and Issues** | None. |

---

#### UC-04 Log Out

| Field | Details |
|---|---|
| **Use Case ID** | UC-04 |
| **Use Case Name** | Log Out |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Terminates the authenticated user's session, invalidates the session token, clears user-specific cache, and redirects the user to the public login page. |
| **Preconditions** | 1. User is currently logged in with an active session. |
| **Postconditions** | 1. The session token is invalidated in the session store. 2. User-specific cache is cleared. 3. User is redirected to the login page and can no longer access protected pages. |
| **Priority** | High |
| **Frequency of Use** | At least once per session. |
| **Flow of Events** | 1. User clicks "Log Out" from the user menu. 2. **A04** invalidates the JWT session token via Supabase Auth (server-side sign-out). 3. **A04** clears any user-specific cache. 4. **A04** returns confirmation; system redirects the user to the login page. |
| **Alternative Flows** | None. |
| **Exceptions** | UC-04.EX.1: Session store unavailable — **A04** logs error; system clears the client-side session cookie and redirects to login regardless. |
| **Includes** | None. |
| **Special Requirements** | Log out must complete within 1 second. All protected routes must become inaccessible immediately after session invalidation. |
| **Assumptions** | Session tokens are stored server-side and can be centrally invalidated. |
| **Notes and Issues** | None. |

---

#### UC-05 Reset Password

| Field | Details |
|---|---|
| **Use Case ID** | UC-05 |
| **Use Case Name** | Reset Password |
| **Created By** | Wai Yan | **Last Updated By** | Wai Yan |
| **Date Created** | 2026-01-25 | **Date Last Updated** | 2026-02-18 |

| Field | Details |
|---|---|
| **Actor** | A01 (Small Business Owner), A02 (Franchise/MNC Expansion Team), A03 (Commercial Agent) |
| **Description** | Allows a user who has forgotten their password to request a time-limited reset link via email, enter a new password, and regain access to their account. |
| **Preconditions** | 1. User has a registered account (active or pending). 2. User has access to the registered email inbox. |
| **Postconditions** | 1. The user's password is updated to the new value. 2. The reset token is invalidated. 3. User is redirected to the login page. |
| **Priority** | High |
| **Frequency of Use** | Infrequent; on demand when users forget their password. |
| **Flow of Events** | 1. User clicks "Forgot Password". 2. User enters their registered email address. 3. **A04** validates that the email exists in the database. 4. **A04** generates a password reset token with a 1-hour expiration. 5. **A04** sends a reset email with the link via **A05** (email service). 6. **A04** returns confirmation; system shows "Check your email" message. 7. User clicks the reset link. 8. **A04** validates the reset token. 9. System displays the new password entry form. 10. User enters and confirms the new password. 11. **A04** validates the new password meets policy requirements. 12. **A04** hashes the new password and updates the user record. 13. **A04** invalidates the reset token. 14. **A04** returns success; system redirects to the login page. |
| **Alternative Flows** | UC-05.AC.1: Email not registered — **A04** returns a generic "if that email exists, a link has been sent" message (security: do not reveal whether the email is registered). UC-05.AC.2: Token expired or invalid — **A04** returns error; system offers to resend the reset email. |
| **Exceptions** | UC-05.EX.1: Email service (A05) unavailable — **A04** logs error; system notifies user that the reset email could not be sent and to try again later. |
| **Includes** | UC-03 Log In (after successful password reset, user is directed to log in). |
| **Special Requirements** | Reset token must expire after 1 hour. New password must meet the same strength policy as registration. |
| **Assumptions** | Email service (A05) is operational. Reset tokens are single-use and stored securely server-side. |
| **Notes and Issues** | None. |

---

