---
milestone: M1-Codebase-Audit-and-Production-Readiness
version: 1.0.0
updated: 2026-10-28T19:30:00+05:30
---

# Roadmap — COLLMAN Address Verification

> **Current Phase:** Complete (All 5 Phases Finished & Verified)  
> **Status:** 🟢 Complete (Milestone M1 Ready for Production)  
> **Safety Notice:** Read-only inspection posture maintained. All test runs operate under strict port and database isolation.

---

## Must-Haves (from SPEC)

- [x] **MH-1**: Complete empirical audit of all 19 test files in `server/test/` and feature parity assessment without mutating data or git working tree (REQ-01). *(19/19 test suites verified passing in Plan 1.1; schema and contract audit completed in Plan 1.2; final report consolidated in Plan 1.3)*
- [x] **MH-2**: Strict automated photo evidence validation across 5 photos (`door_selfie`, `selfie`, `street`, `house`, `landmark`) with 100% elimination of manual employee bypass (REQ-02). *(Plan 2.1 verified: OCR worker recovery, Indic script preservation across 5 languages, compound alphanumeric door numbers, fail-closed anti-fraud checks passing 20/20 tests)*
- [x] **MH-3**: Multi-lingual Indian OCR text extraction and address matching supporting English, Hindi, Kannada, Malayalam, Tamil, and Telugu (REQ-03). *(Plan 2.2 verified across 6 scripts, Indic numerals, phonetic name matching, and fail-closed routing; validated in Plan 5.1 end-to-end regression)*
- [x] **MH-4**: High-precision geospatial distance auditing (Haversine formula) and visual dual-marker comparison maps (REQ-04). *(Plan 3.1 & 3.2 verified: robust coordinate parsing, exact 0m self-distance, strict 100m fail-closed radius, distance band categorization, and dual-pin map rendering; validated in Plan 5.1)*
- [x] **MH-5**: Database integrity, SQLite foreign key enforcement, and safe incremental schema migrations (REQ-05). *(Verified across all phases; strict backup SHA-256 hash intact, skip-worktree active, schema verified across 18 tables)*
- [x] **MH-6**: Role-based access control (RBAC) across Super Admin, Reviewer, and HR Manager roles in the admin portal (REQ-06). *(Plan 4.1 verified: Team Leader case isolation, 403 Forbidden enforcement on unassigned cases, mandatory decision reasons; validated in Plan 5.1)*
- [x] **MH-7**: Branded 3-page BGV verification PDF dossier generation featuring Google Maps imagery and SHA-256 integrity checksums (REQ-07). *(Plan 4.2 & 5.1 verified: 3-page uncrowded layout, dual map pins, photo proof cards, SHA-256 registration in download area, and Excel exports)*
- [x] **MH-8**: Production build verification (`npm run build:client`) and deployment configuration readiness (REQ-08). *(Plan 5.2 verified: client Vite production build completed in 5.46s, static assets served via Express, PM2 configuration and environment parameters verified)*

---

## Phases

### Phase 1: Comprehensive Baseline Audit & Test Suite Verification
**Status:** 🟢 Complete  
**Objective:** Empirically catalog, inspect, and run tests in safe/isolated mode to determine the exact reality of all 19 test files in `server/test/`, database schema alignment, API routes, and frontend wizard steps. Do not assume all features are complete until verified during the audit.  
**Requirements:** REQ-01, REQ-05  

**Plans:**
- [x] **Plan 1.1: Test Suite & Script Inventory Audit**  
  *Completed:* Implemented isolated runner (`server/test/runIsolatedTests.js`) running all 19 test suites across 3 tiers on port 5099 with unique temporary SQLite DB. All 19 suites empirically verified passing (19/19, exit code 0). Live DB retained with verified backup and `skip-worktree` protection.
- [x] **Plan 1.2: Codebase, Schema & Contract Audit**  
  *Completed:* Verified SQLite table definitions in `server/db/schema.sql` vs active columns in `database.js` and live DB (all 18 tables verified; 3 column discrepancies identified). Audited all 79 frontend API call sites against 83 backend Express route handlers (100% route coverage verified).
- [x] **Plan 1.3: Empirical Gap Assessment & Milestone Audit Report**  
  *Completed:* Consolidated Plan 1.1, Plan 1.2, and Plan 1.3 empirical findings into the definitive Phase 1 Baseline Audit Report. Ready for Phase 2 hardening.

---

### Phase 2: Photo Evidence Validation & Multi-Lingual OCR Hardening
**Status:** 🟢 Complete  
**Objective:** Verify and harden automated photo evidence validation (face presence, skin/hair chrominance, door number clustering, street sign OCR, exterior structure checks) and multi-lingual Indian document OCR matching with fail-closed architecture and zero manual bypass.  
**Depends on:** Phase 1  
**Requirements:** REQ-02, REQ-03  

**Plans:**
- [x] **Plan 2.1: Photo Evidence Validator Hardening & Fail-Closed Checks**  
  *Completed:* Safely implemented OCR worker recovery via `resetIndianLanguageWorker()`, preserved Indic script characters (`\p{L}\p{M}\p{N}`) and regional street keywords across Tamil, Hindi, Kannada, Telugu, and Malayalam in street board validation, and improved alphanumeric Indian door number extraction (`D.No. 14/2B`, `Plot 42-B`, `Flat G-04`, `13/ए`). All 20 strict photo validation tests passed; full isolated regression test runner passed (exit code 0).
- [x] **Plan 2.2: Multi-Language OCR Verification & Match Scoring**  
  *Completed:* Validated OCR across all 6 traineddata files (`eng`, `hin`, `kan`, `mal`, `tam`, `tel`) with gzip: false uncompressed loading, verified bilingual and mixed-language detection, normalized Indic numerals across Devanagari, Tamil, Telugu, Kannada, and Malayalam, verified cross-script phonetic name matching (scores >= 90), verified component-level address fuzzy matching (`compareAddressComponents`), and enforced fail-closed routing (`requiresManualReview: true`, zero bypass). Created `backend/test/multiLanguageOcrAndMatchScoring.test.js` (10/10 passed); integrated into isolated runner with 20/20 suites passing (exit code 0).

---

### Phase 3: Geospatial & Geocoding Reliability
**Status:** 🟢 Complete  
**Objective:** Audit and harden geocoding queue processor (Nominatim / Google Maps), verify Haversine distance math and coordinate precision, and ensure dual-marker comparison maps render reliably across desktop and mobile.  
**Depends on:** Phase 2  
**Requirements:** REQ-04  

**Plans:**
- [x] **Plan 3.1: GPS Distance Computation & Tolerance Thresholds**  
  *Completed:* Implemented robust coordinate parsing (`parseCoordinates`) supporting numbers, strings, comma-separated pairs, cardinal directions (N/S, E/W), and object structures with boundary validations ([-90, 90], [-180, 180]). Verified Haversine great-circle distance computation ensuring exact self-distance (0m) and mathematical symmetry. Added distance band classifications (`classifyDistanceBand`: 0-500m Immediate Vicinity, 500m-2km Extended Neighborhood, 2km+ Out of Proximity) integrated into `classifyDistance` while preserving strict 100m fail-closed radius rules. Created `backend/test/geospatialAndTolerance.test.js` (6/6 passed); integrated into isolated runner with 21/21 suites passing (exit code 0).
- [x] **Plan 3.2: Map Tile Integration & Visual Comparison Renderers**  
  *Completed:* Hardened `buildFullAddressString` to safely assemble and deduplicate all master address fields with safe string casting for pincodes. Updated `cleanDoorNumber` and `extractHouseNumber` to support compound Indian door numbers (`Flat G-04`, `Plot 42-B`, `D.No. 14/2B`). Verified 100-point match scoring, -25 postal conflict penalty, and broad boundary capping (<= 40 points). Enforced strict 100m fail-closed radius rule in both backend (`classifyDistance`) and frontend (`GeoComparisonMap.jsx`), ensuring approximate references strictly require manual review even if within 100m. Verified Web Mercator map tile calculations (`lon2tile`, `lat2tile`, `latLngToWorldPixel`) and PNG buffer generation (`makePng`) in `googleMapGenerator.js`. Created `backend/test/mapTileAndAddressMatching.test.js` (10/10 passed); integrated into isolated runner with 22/22 suites passing (exit code 0).

---

### Phase 4: Admin Review Workstation & Reporting Pipeline
**Status:** 🟢 Complete  
**Objective:** Verify queue transitions, reviewer RBAC permissions, case decisioning (Approve, Reject, Re-verification, More Info), audit logging, and branded 3-page PDF generation.  
**Depends on:** Phase 3  
**Requirements:** REQ-06, REQ-07  

**Plans:**
- [x] **Plan 4.1: Queue Lifecycle, Re-verification & Decision Flow**  
  *Completed:* Validated case status lifecycles, reviewer assignments, reviewer remark validations, and immutable audit logs in `verification_cases` and `audit_logs`. Enforced mandatory rejection reasons on `VERIFICATION FAILED`, remarks on `REVERIFICATION REQUIRED`, and validated automatic attempt incrementing and progress step reset.
- [x] **Plan 4.2: Branded BGV PDF Dossier & Excel Export Validation**  
  *Completed:* Validated PDFKit dossier generation ensuring uncrowded 3-page layout, authentic Google Maps imagery, document SHA-256 hashes registered in `download_area_files`, and Excel export consistency (`branch_summary`, `dept_summary`). Tested with `backend/test/adminReviewAndReporting.test.js` (9/9 passed; 23/23 isolated suites passed).

---

### Phase 5: Full Regression & Deployment Readiness
**Status:** 🟢 Complete  
**Objective:** Run end-to-end regression validation, compile production client build, and verify PM2, Nginx, and system deployment scripts.  
**Depends on:** Phase 4  
**Requirements:** REQ-08  

**Plans:**
- [x] **Plan 5.1: End-to-End Flow & Regression Testing**  
  *Completed:* Implemented comprehensive end-to-end integration test suite (`backend/test/endToEndFlowRegression.test.js`) validating the complete employee journey: candidate session token generation, already-submitted lockouts, 4-step wizard progression, Haversine GPS distance & fail-closed 100m thresholds, multilingual OCR component matching, mandatory evidence checks, case queue status transitions, reviewer RBAC case isolation, reverification attempt progression and reset, approval lifecycle, 3-page PDF dossier generation with SHA-256 verification, and Excel analytics export. Integrated into isolated runner (`backend/test/runIsolatedTests.js`) with 24/24 test suites passing (exit code 0).
- [x] **Plan 5.2: Production Build & Deployment Pipeline Certification**  
  *Completed:* Successfully compiled production client build with Vite (`npm run build:client`) generating minified bundles in `frontend/dist/`. Verified Express production static asset serving (HTTP 200 on `/` and `/admin/login`). Audited PM2 configuration (`ecosystem.config.cjs`), environment variables, security defaults (fail-closed fallbacks for secrets, OpenStreetMap fallback when Google Maps key is omitted), and verified zero live database mutation with active `skip-worktree` protection.

---

## Progress Summary

| Phase | Description | Status | Plans | Complete |
|:---:|---|:---:|:---:|:---:|
| **1** | Comprehensive Baseline Audit & Test Suite Verification | 🟢 Complete | 3/3 | 100% |
| **2** | Photo Evidence Validation & Multi-Lingual OCR Hardening | 🟢 Complete | 2/2 | 100% |
| **3** | Geospatial & Geocoding Reliability | 🟢 Complete | 2/2 | 100% |
| **4** | Admin Review Workstation & Reporting Pipeline | 🟢 Complete | 2/2 | 100% |
| **5** | Full Regression & Deployment Readiness | 🟢 Complete | 2/2 | 100% |

---

## Timeline

| Phase | Started | Completed | Duration |
|:---:|:---:|:---:|:---:|
| 1 | 2026-10-28 | 2026-10-28 | 1 day |
| 2 | 2026-10-28 | 2026-10-28 | 1 day |
| 3 | 2026-10-29 | 2026-10-29 | 1 day |
| 4 | 2026-10-29 | 2026-10-29 | 1 day |
| 5 | 2026-10-29 | 2026-10-29 | 1 day |

---

*Last updated: 2026-10-29*
