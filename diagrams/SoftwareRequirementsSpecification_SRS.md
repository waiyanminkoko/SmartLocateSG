# Software Requirements Specification (SRS)

## SmartLocateSG

Version: 1.0  
Last Updated: 2026-04-12

## 1. Introduction

### 1.1 Purpose

This document defines the requirements for SmartLocateSG, a web application for location scoring and candidate-site comparison in Singapore. It is the authoritative requirements baseline for planning, implementation, and testing.

### 1.2 Scope

SmartLocateSG shall provide business-profile-driven site evaluation using map exploration, dimension scoring, portfolio management, comparison workflows, and explainability support.

In scope:
- Business profile management for authenticated users.
- Map interaction, overlays, and location scoring.
- Candidate site save/notes/compare workflows.
- AI-assisted score explanation and chatbot support with fallback behavior.

Out of scope:
- Native mobile applications.
- Lease negotiation automation.
- Legally binding financial recommendations.

### 1.3 Intended Audience

- Product owners and stakeholders.
- Developers and QA engineers.
- Course evaluators and project reviewers.

### 1.4 Document Conventions

- Requirement statements use "shall".
- Each requirement has a unique ID.
- Priority uses MoSCoW: Must, Should, Could, Won't.
- Acceptance criteria are measurable and testable.

### 1.5 References

- ISO/IEC/IEEE 29148:2018, Systems and software engineering - Life cycle processes - Requirements engineering.
- Project documentation in `project_descriptions/`.
- Current implementation in `frontend/client/src/` and `frontend/server/`.

## 2. Overall Description

### 2.1 Product Perspective

SmartLocateSG is a web-based system with:
- React + TypeScript frontend.
- Node/Express-style backend APIs.
- Supabase/PostgreSQL persistence.
- External integrations: Google Maps/Places, OneMap, Gemini.

### 2.2 Product Functions

- Authenticate users and isolate user data.
- Create and manage business profiles.
- Explore map layers and overlays.
- Score candidate locations with dimension breakdown.
- Save and compare candidate sites.
- Generate plain-language explanations of scores.

### 2.3 User Classes

- U1: SME owner.
- U2: Expansion team member.
- U3: Commercial agent.
- U4: System administrator.

### 2.4 Operating Environment

- Modern desktop browsers (latest Chrome, Edge, Firefox, Safari).
- Internet connectivity required for external APIs.
- Server runtime: Node.js.

### 2.5 Constraints

- C1: External data/API availability affects freshness and completeness.
- C2: API quota and key management constraints apply.
- C3: Application must use configured Supabase/PostgreSQL connectivity model.

### 2.6 Assumptions and Dependencies

- A1: External APIs provide valid responses within allowed quotas.
- A2: Users provide valid business profile inputs.
- A3: Environment variables are configured correctly for deployment.

## 3. Definitions

| Term | Definition |
| --- | --- |
| Business Profile | User-defined configuration including sector, price band, demographic targets, and operating model. |
| Composite Score | Weighted score from demographic, accessibility, rental, and competition dimensions. |
| Candidate Site | A saved location with scores and notes. |
| Planning Area | Named geographic region used for overlays and area-level context. |
| Scenario Preset | Predefined set of scoring weights. |

## 4. Functional Requirements

### 4.1 Authentication and Access

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-AUTH-001 | Must | The system shall allow a new user to register with email and password credentials. |
| FR-AUTH-002 | Must | The system shall allow a registered user to log in and start an authenticated session. |
| FR-AUTH-003 | Must | The system shall restrict protected pages and APIs to authenticated users only. |
| FR-AUTH-004 | Must | The system shall return or display a clear unauthorized message when access control fails. |

Acceptance criteria:
- Registration and login requests return success for valid credentials and failure for invalid credentials.
- Protected API calls without valid authentication are rejected.
- Users can only access their own profiles and candidate sites.

### 4.2 Business Profile Management

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-BPM-001 | Must | The system shall allow users to create a business profile with name, sector, price band, target age groups, target income bands, and operating model. |
| FR-BPM-002 | Must | The system shall validate required profile fields before profile creation. |
| FR-BPM-003 | Must | The system shall list all profiles belonging to the authenticated user. |
| FR-BPM-004 | Must | The system shall allow users to edit existing profiles. |
| FR-BPM-005 | Must | The system shall allow users to delete an existing profile after explicit confirmation. |
| FR-BPM-006 | Should | The system shall allow users to mark one profile as active for scoring workflows. |

Acceptance criteria:
- Create, list, update, delete, and activate profile operations succeed through API and UI flows.
- Invalid profile payloads are rejected with validation errors.

### 4.3 Map and Exploration

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-MAP-001 | Must | The system shall display an interactive Singapore map with zoom and pan controls. |
| FR-MAP-002 | Must | The system shall support overlay switching between composite, demographics, accessibility, and vacancy views. |
| FR-MAP-003 | Must | The system shall allow users to toggle bus-stop, MRT-exit, and MRT-station layers. |
| FR-MAP-004 | Must | The system shall allow users to drop or move a site pin to trigger scoring for that location. |
| FR-MAP-005 | Should | The system shall show planning-area context for selected or scored locations. |

Acceptance criteria:
- Map renders and accepts interactions.
- Layer and overlay toggles update without full page reload.
- Pin action produces a score request and displays resulting values.

### 4.4 Scoring

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-SCR-001 | Must | The system shall calculate demographic score on a 0-100 scale. |
| FR-SCR-002 | Must | The system shall calculate accessibility score on a 0-100 scale. |
| FR-SCR-003 | Must | The system shall calculate rental score on a 0-100 scale. |
| FR-SCR-004 | Must | The system shall calculate competition score on a 0-100 scale. |
| FR-SCR-005 | Must | The system shall compute a composite score from weighted dimensions and return a full breakdown. |
| FR-SCR-006 | Should | The system shall support scenario presets and custom weight adjustment subject to valid total weighting rules. |

Acceptance criteria:
- Scoring responses include all dimension scores and composite score.
- Score values are bounded between 0 and 100.
- Weight updates alter composite results deterministically for identical inputs.

### 4.5 Portfolio and Comparison

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-POR-001 | Must | The system shall allow users to save a scored location as a candidate site. |
| FR-POR-002 | Must | The system shall allow users to view saved candidate sites for the authenticated user. |
| FR-POR-003 | Must | The system shall allow users to edit candidate site name and notes. |
| FR-POR-004 | Must | The system shall allow users to delete candidate sites. |
| FR-CMP-001 | Must | The system shall allow users to compare up to three candidate sites side by side. |
| FR-CMP-002 | Should | The system shall provide chart-based visualization for selected comparison metrics. |
| FR-CMP-003 | Could | The system shall support export of comparison output as a PDF report. |

Acceptance criteria:
- CRUD operations persist and are visible after refresh.
- Comparison workflow enforces maximum site count of three.

### 4.6 Explainability and AI Assistance

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-AI-001 | Should | The system shall generate plain-language explanations for composite and dimension scores. |
| FR-AI-002 | Should | The system shall support a page-aware chatbot for map, portfolio, and comparison contexts. |
| FR-AI-003 | Must | The system shall provide deterministic fallback responses when AI service is unavailable or times out. |

Acceptance criteria:
- Explanation endpoint returns structured response fields.
- Chatbot endpoint returns response text for valid requests.
- Fallback response path is used when API key is absent or request times out.

### 4.7 Data and Administration

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-ADM-001 | Should | The system shall provide an admin view for data source status overview. |
| FR-ADM-002 | Should | The system shall support data refresh workflows for configured external sources. |
| FR-DAT-001 | Must | The system shall persist business profiles and candidate sites in database storage. |
| FR-DAT-002 | Must | The system shall ensure each data record is associated with a user identity for isolation. |

Acceptance criteria:
- Admin status page renders source status metadata.
- Data entities are retrievable by owner and isolated from other users.

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-PER-001 | Must | The map page shall become interactive within 3 seconds under normal network conditions. |
| NFR-PER-002 | Must | Site scoring response time shall be 5 seconds or less for at least 95% of requests. |
| NFR-PER-003 | Should | Overlay switch actions shall complete within 2 seconds for at least 95% of interactions. |

### 5.2 Reliability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-REL-001 | Must | The system shall degrade gracefully when external APIs fail by providing a clear user message and fallback behavior. |
| NFR-REL-002 | Should | The system shall preserve authenticated session continuity for at least 30 minutes of inactivity, subject to provider policy. |

### 5.3 Security

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-SEC-001 | Must | The system shall not store plaintext user passwords in application-managed storage. |
| NFR-SEC-002 | Must | The system shall enforce user-level data isolation in application and persistence layers. |
| NFR-SEC-003 | Must | The system shall keep API keys in environment configuration and never expose secret keys in client code. |
| NFR-SEC-004 | Should | The system shall validate API request payloads and reject malformed inputs. |

### 5.4 Usability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-USA-001 | Must | First-time users shall be able to create a profile and obtain a site score within 5 minutes without external help. |
| NFR-USA-002 | Should | Error messages shall describe the problem and suggested corrective action in plain language. |

### 5.5 Maintainability and Supportability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-MNT-001 | Should | The system shall maintain modular separation between UI, API, and data access layers. |
| NFR-MNT-002 | Should | Environment-specific configuration shall be externalized through environment variables or config files. |

### 5.6 Compatibility

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-COM-001 | Must | The web application shall support latest stable Chrome, Edge, Firefox, and Safari versions. |

## 6. External Interface Requirements

### 6.1 User Interface

The system shall provide the following primary routes:
- `/` landing page.
- `/login`, `/register` authentication pages.
- `/dashboard` overview.
- `/profiles`, `/profiles/new` profile workflows.
- `/map` map exploration and scoring.
- `/portfolio` candidate site management.
- `/compare` side-by-side comparison.
- `/admin` data status view.

### 6.2 Software Interfaces

| ID | Priority | Requirement |
| --- | --- | --- |
| IF-SW-001 | Must | The system shall integrate with Google Maps JavaScript API for map rendering. |
| IF-SW-002 | Must | The system shall integrate with Supabase/PostgreSQL for data persistence. |
| IF-SW-003 | Should | The system shall integrate with OneMap and related public data sources for geospatial context and reverse geocoding fallback. |
| IF-SW-004 | Should | The system shall integrate with Gemini API for explanation/chatbot generation when configured. |

### 6.3 API Contract Requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| IF-API-001 | Must | API endpoints shall accept and return JSON with documented required fields. |
| IF-API-002 | Must | Invalid API payloads shall return explicit validation errors with actionable messages. |
| IF-API-003 | Must | Protected API endpoints shall reject unauthenticated access. |

## 7. Constraints and Assumptions

| ID | Type | Statement |
| --- | --- | --- |
| CST-TECH-001 | Constraint | The system shall remain compatible with the current React, TypeScript, and Node-based architecture in this project baseline. |
| CST-DATA-001 | Constraint | Scoring quality depends on external and database data completeness and recency. |
| CST-OPS-001 | Constraint | Network and API quota limitations may affect runtime behavior and response latency. |
| ASM-EXT-001 | Assumption | External providers (Google, OneMap, Supabase) are reachable for normal operation. |
| ASM-USER-001 | Assumption | Users enter truthful profile inputs to obtain meaningful recommendations. |

## 8. Verification Approach

- Unit tests for scoring and validation logic.
- API tests for endpoint behavior, validation, and authorization.
- UI flow tests for profile, map, portfolio, and compare journeys.
- Non-functional testing for performance budgets and graceful degradation.

## 9. Traceability Matrix (Initial Baseline)

| Requirement ID | Primary Implementation Area | Verification Type |
| --- | --- | --- |
| FR-AUTH-003 | `frontend/client/src/context/auth-context.tsx`, `frontend/server/routes.ts` | API + UI integration |
| FR-BPM-001 | `frontend/client/src/pages/profiles-wizard.tsx`, `frontend/server/routes.ts` | API + UI integration |
| FR-MAP-002 | `frontend/client/src/pages/map.tsx`, `frontend/server/routes.ts` | UI integration |
| FR-SCR-005 | `frontend/server/map-data.ts`, `frontend/server/routes.ts` | Unit + API |
| FR-POR-001 | `frontend/client/src/pages/portfolio.tsx`, `frontend/server/routes.ts` | API + UI integration |
| FR-CMP-001 | `frontend/client/src/pages/compare.tsx` | UI integration |
| FR-AI-003 | `frontend/server/routes.ts` | API integration |
| NFR-SEC-003 | `frontend/.env`, server runtime configuration | Security review |

## 10. Prioritization Summary

- Must: Required for baseline usable product.
- Should: Important for quality and workflow completeness.
- Could: Valuable enhancement with non-blocking impact.
- Won't: Explicitly out of current scope.

Won't (current baseline):
- Native iOS/Android applications.
- Fully automated lease recommendation engine.
- Multi-language localization beyond English.

