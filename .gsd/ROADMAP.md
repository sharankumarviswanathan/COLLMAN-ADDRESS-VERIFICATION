---
milestone: M1-Codebase-Audit-and-Production-Readiness
version: 1.0.0
updated: 2026-10-28T13:10:00+05:30
---

# Roadmap — COLLMAN Address Verification

> **Current Phase:** Phase 1: Comprehensive Baseline Audit & Test Suite Verification  
> **Status:** ⬜ Not Started (Awaiting User Approval to Commence)  
> **Safety Notice:** Per user directive, zero application code, database, dependencies, ports, environment, or git state will be altered during planning. Phase 1 execution will commence only after explicit user approval.

---

## Must-Haves (from SPEC)

- [ ] **MH-1**: Complete empirical audit of all 19 test files in `server/test/` and feature parity assessment without mutating data or git working tree (REQ-01).
- [ ] **MH-2**: Strict automated photo evidence validation across 5 photos (`door_selfie`, `selfie`, `street`, `house`, `landmark`) with 100% elimination of manual employee bypass (REQ-02).
- [ ] **MH-3**: Multi-lingual Indian OCR text extraction and address matching supporting English, Hindi, Kannada, Malayalam, Tamil, and Telugu (REQ-03).
- [ ] **MH-4**: High-precision geospatial distance auditing (Haversine formula) and visual dual-marker comparison maps (REQ-04).
- [ ] **MH-5**: Database integrity, SQLite foreign key enforcement, and safe incremental schema migrations (REQ-05).
- [ ] **MH-6**: Role-based access control (RBAC) across Super Admin, Reviewer, and HR Manager roles in the admin portal (REQ-06).
- [ ] **MH-7**: Branded 3-page BGV verification PDF dossier generation featuring Google Maps imagery and SHA-256 integrity checksums (REQ-07).
- [ ] **MH-8**: Production build verification (`npm run build:client`) and deployment configuration readiness (REQ-08).

---

## Phases

### Phase 1: Comprehensive Baseline Audit & Test Suite Verification
**Status:** ⬜ Not Started *(Awaiting User Approval)*  
**Objective:** Empirically catalog, inspect, and run tests in safe/read-only mode to determine the exact reality of all 19 test files in `server/test/`, database schema alignment, API routes, and frontend wizard steps. Do not assume all 19 test suites exist or that every proposed feature is already implemented. Verify these during the audit without modifying code, database data, or git state.  
**Requirements:** REQ-01, REQ-05  

**Plans:**
- [ ] **Plan 1.1: Test Suite & Script Inventory Audit**  
  Inspect the 19 test files in `server/test/` (e.g., `api.test.js`, `imageValidationAnd5Photos.test.js`, `strictPhotoValidationRules.test.js`, `rolesAndPermissions.test.js`, etc.), catalog their assertions, and determine dependencies and mock databases needed to run them safely without corrupting `server/db/collman_bgv.db`.
- [ ] **Plan 1.2: Codebase, Schema & Contract Audit**  
  Verify SQLite table definitions in `server/db/schema.sql` vs active columns in `database.js` and `collman_bgv.db`; verify frontend component tree (`client/src/components/`) vs backend route handlers (`server/routes/`).
- [ ] **Plan 1.3: Empirical Gap Assessment & Milestone Audit Report**  
  Document exact verified findings (passing tests, failing tests, missing mocks, partially implemented features, uncommitted git modifications) in an audit report to guide subsequent execution.

---

### Phase 2: Photo Evidence Validation & Multi-Lingual OCR Hardening
**Status:** ⬜ Not Started  
**Objective:** Verify and harden automated photo evidence validation (face presence, skin/hair chrominance, door number clustering, street sign OCR, exterior structure checks) and multi-lingual Indian document OCR matching with fail-closed architecture and zero manual bypass.  
**Depends on:** Phase 1  
**Requirements:** REQ-02, REQ-03  

**Plans:**
- [ ] **Plan 2.1: Photo Evidence Validator Hardening & Fail-Closed Checks**  
  Verify client canvas validator (`client/src/lib/imageValidator.js`) and server validator (`server/utils/imageValidator.js`) ensure strict rejection of hair-only shots, partial faces, blurry/dark frames, and missing door numbers.
- [ ] **Plan 2.2: Multi-Language OCR Verification & Match Scoring**  
  Empirically test OCR extraction across `eng`, `hin`, `kan`, `mal`, `tam`, and `tel` traineddata files and verify address proof fuzzy matching algorithms (`server/utils/indianLanguageOcr.js`, `addressProofValidator.js`).

---

### Phase 3: Geospatial & Geocoding Reliability
**Status:** ⬜ Not Started  
**Objective:** Audit and harden geocoding queue processor (Nominatim / Google Maps), verify Haversine distance math and coordinate precision, and ensure dual-marker comparison maps render reliably across desktop and mobile.  
**Depends on:** Phase 2  
**Requirements:** REQ-04  

**Plans:**
- [ ] **Plan 3.1: GPS Distance Computation & Tolerance Thresholds**  
  Verify geocoding queue fallbacks, coordinate parsing, Haversine formula accuracy, and distance band classifications (0-500m, 500m-2km, 2km+).
- [ ] **Plan 3.2: Map Tile Integration & Visual Comparison Renderers**  
  Validate Leaflet map rendering in `GeoComparisonMap.jsx` and static Google Maps tile generation (`googleMapGenerator.js`) for PDF dossier output.

---

### Phase 4: Admin Review Workstation & Reporting Pipeline
**Status:** ⬜ Not Started  
**Objective:** Verify queue transitions, reviewer RBAC permissions, case decisioning (Approve, Reject, Re-verification, More Info), audit logging, and branded 3-page PDF generation.  
**Depends on:** Phase 3  
**Requirements:** REQ-06, REQ-07  

**Plans:**
- [ ] **Plan 4.1: Queue Lifecycle, Re-verification & Decision Flow**  
  Validate case status lifecycles, reviewer assignments, reviewer remark validations, and immutable audit logs in `verification_cases` and `audit_logs`.
- [ ] **Plan 4.2: Branded BGV PDF Dossier & Excel Export Validation**  
  Validate PDFKit dossier generation ensuring uncrowded 3-page layout, authentic Google Maps imagery, document SHA-256 hashes, and Excel export consistency.

---

### Phase 5: Full Regression & Deployment Readiness
**Status:** ⬜ Not Started  
**Objective:** Run end-to-end regression validation, compile production client build, and verify PM2, Nginx, and system deployment scripts.  
**Depends on:** Phase 4  
**Requirements:** REQ-08  

**Plans:**
- [ ] **Plan 5.1: End-to-End Flow & Regression Testing**  
  Validate complete employee wizard journey from Step 1 to Step 15 through admin review and final report download.
- [ ] **Plan 5.2: Production Build & Deployment Pipeline Certification**  
  Run client Vite production build, verify static asset serving in Express, test PM2 ecosystem configuration, and check Ubuntu/Windows deployment script integrity.

---

## Progress Summary

| Phase | Description | Status | Plans | Complete |
|:---:|---|:---:|:---:|:---:|
| **1** | Comprehensive Baseline Audit & Test Suite Verification | ⬜ Not Started | 0/3 | 0% |
| **2** | Photo Evidence Validation & Multi-Lingual OCR Hardening | ⬜ Not Started | 0/2 | 0% |
| **3** | Geospatial & Geocoding Reliability | ⬜ Not Started | 0/2 | 0% |
| **4** | Admin Review Workstation & Reporting Pipeline | ⬜ Not Started | 0/2 | 0% |
| **5** | Full Regression & Deployment Readiness | ⬜ Not Started | 0/2 | 0% |

---

## Timeline

| Phase | Started | Completed | Duration |
|:---:|:---:|:---:|:---:|
| 1 | — | — | — |
| 2 | — | — | — |
| 3 | — | — | — |
| 4 | — | — | — |
| 5 | — | — | — |

---

*Last updated: 2026-10-28*
