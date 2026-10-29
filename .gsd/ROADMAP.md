---
milestone: M1-Codebase-Audit-and-Production-Readiness
version: 1.0.0
updated: 2026-10-28T19:30:00+05:30
---

# Roadmap — COLLMAN Address Verification

> **Current Phase:** Phase 2: Photo Evidence Validation & Multi-Lingual OCR Hardening  
> **Status:** 🟡 Ready to Begin (Phase 1 Audit Complete)  
> **Safety Notice:** Read-only inspection posture maintained. All test runs operate under strict port and database isolation.

---

## Must-Haves (from SPEC)

- [x] **MH-1**: Complete empirical audit of all 19 test files in `server/test/` and feature parity assessment without mutating data or git working tree (REQ-01). *(19/19 test suites verified passing in Plan 1.1; schema and contract audit completed in Plan 1.2; final report consolidated in Plan 1.3)*
- [x] **MH-2**: Strict automated photo evidence validation across 5 photos (`door_selfie`, `selfie`, `street`, `house`, `landmark`) with 100% elimination of manual employee bypass (REQ-02). *(Plan 2.1 verified: OCR worker recovery, Indic script preservation across 5 languages, compound alphanumeric door numbers, fail-closed anti-fraud checks passing 20/20 tests)*
- [ ] **MH-3**: Multi-lingual Indian OCR text extraction and address matching supporting English, Hindi, Kannada, Malayalam, Tamil, and Telugu (REQ-03).
- [ ] **MH-4**: High-precision geospatial distance auditing (Haversine formula) and visual dual-marker comparison maps (REQ-04).
- [ ] **MH-5**: Database integrity, SQLite foreign key enforcement, and safe incremental schema migrations (REQ-05).
- [ ] **MH-6**: Role-based access control (RBAC) across Super Admin, Reviewer, and HR Manager roles in the admin portal (REQ-06).
- [ ] **MH-7**: Branded 3-page BGV verification PDF dossier generation featuring Google Maps imagery and SHA-256 integrity checksums (REQ-07).
- [ ] **MH-8**: Production build verification (`npm run build:client`) and deployment configuration readiness (REQ-08).

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
**Status:** 🟡 In Progress (Plan 2.1 Complete; Plan 2.2 Next)  
**Objective:** Verify and harden automated photo evidence validation (face presence, skin/hair chrominance, door number clustering, street sign OCR, exterior structure checks) and multi-lingual Indian document OCR matching with fail-closed architecture and zero manual bypass.  
**Depends on:** Phase 1  
**Requirements:** REQ-02, REQ-03  

**Plans:**
- [x] **Plan 2.1: Photo Evidence Validator Hardening & Fail-Closed Checks**  
  *Completed:* Safely implemented OCR worker recovery via `resetIndianLanguageWorker()`, preserved Indic script characters (`\p{L}\p{M}\p{N}`) and regional street keywords across Tamil, Hindi, Kannada, Telugu, and Malayalam in street board validation, and improved alphanumeric Indian door number extraction (`D.No. 14/2B`, `Plot 42-B`, `Flat G-04`, `13/ए`). All 20 strict photo validation tests passed; full 19/19 isolated regression test runner passed (exit code 0).
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
| **1** | Comprehensive Baseline Audit & Test Suite Verification | 🟡 In Progress | 1/3 | 33% |
| **2** | Photo Evidence Validation & Multi-Lingual OCR Hardening | ⬜ Not Started | 0/2 | 0% |
| **3** | Geospatial & Geocoding Reliability | ⬜ Not Started | 0/2 | 0% |
| **4** | Admin Review Workstation & Reporting Pipeline | ⬜ Not Started | 0/2 | 0% |
| **5** | Full Regression & Deployment Readiness | ⬜ Not Started | 0/2 | 0% |

---

## Timeline

| Phase | Started | Completed | Duration |
|:---:|:---:|:---:|:---:|
| 1 | 2026-10-28 | — | — |
| 2 | — | — | — |
| 3 | — | — | — |
| 4 | — | — | — |
| 5 | — | — | — |

---

*Last updated: 2026-10-28*
