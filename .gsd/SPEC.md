# SPEC.md — Project Specification

> **Status**: `FINALIZED`
>
> ⚠️ **Planning Lock**: Specification is finalized. Per user safety directive, execution is locked pending explicit user approval to commence Phase 1.

---

## 1. Vision

**COLLMAN Address Verification** is an enterprise-grade internal Employee Address Verification and Background Verification (BGV) platform for Collman Services. The platform provides an end-to-end, audit-compliant pipeline that validates physical residential addresses through:
1. A 15-step mobile employee self-service verification wizard with high-precision geolocation and automated photo quality/anti-fraud analysis (eliminating all manual client overrides).
2. Multi-lingual OCR address document verification covering English and 5 major Indian regional languages (Hindi, Kannada, Malayalam, Tamil, Telugu).
3. Geospatial distance auditing computing Haversine discrepancies between HR master address coordinates and live captured GPS locations, visualized through dual-marker comparison maps.
4. A secure, role-based administrative review portal featuring live case inspection, verification queues, re-verification lifecycles, full audit trail logging, and branded, multi-page vector BGV PDF dossiers with Excel export capabilities.

---

## 2. Goals

1. **Anti-Fraud Photo Evidence Verification** — Capture 5 mandatory photos (`selfie`, `door_selfie`, `house`, `street`, `landmark`) plus optional manager/TL `joint_selfie`. Enforce strict automated client and server-side validation against blur, bad lighting, partial faces, hair-only framing, missing door numbers, and miscategorized images with zero manual bypass or user confirmation override.
2. **Dual-Coordinate Geospatial Audit** — Calculate precise geodesic distances (Haversine formula) between geocoded HR addresses and verified mobile GPS coordinates, flagging variances above standard corporate tolerance thresholds (e.g. >500m, >2km, >5km).
3. **Multi-Lingual Indian Document OCR** — Normalise and extract address fields from uploaded identity/residence documents across 6 language scripts (English, Hindi, Kannada, Malayalam, Tamil, Telugu) and perform fuzzy matching and PIN code cross-referencing against HR master records.
4. **Comprehensive BGV Operations Workstation** — Provide HR and BGV reviewers with a role-guarded management portal (`/admin`) for queue triaging, side-by-side evidence inspection, decision recording (Approve, Reject, Re-verification, More Info), and audit trail logging.
5. **Standardized Dossier Generation** — Generate branded, vector-quality, 3-page BGV verification PDF dossiers embedding high-resolution Google Maps/comparison routes, verified photo grids, OCR match scorecards, and cryptographic SHA-256 integrity checksums.
6. **Empirical Codebase Quality & Stability** — Systematically audit, verify, and validate all existing test suites, database schemas, and API contracts with strict evidence-first discipline before declaring production readiness.

---

## 3. Non-Goals (Out of Scope)

- **No Premature Modification**: Modifying application code, database files, dependencies, ports, environment files, or deployment configs without explicit phase planning and user approval.
- **No Git Tampering**: Staging, committing, resetting, checking out, or discarding any git working tree changes.
- **No Data Mutation**: Running destructive tests or scripts that modify `server/db/collman_bgv.db` or overwrite existing employee records during audit operations.
- **No Manual Overrides**: Re-introducing client-side confirmation checkboxes, manual photo validation bypasses, or lenient validation thresholds that compromise anti-fraud integrity.
- **No Assumptions on Existing Code**: Treating unverified test files or documentation claims as guaranteed passing until verified with captured empirical evidence.

---

## 4. Constraints

### 4.1 Safety & Execution Directives (User Mandated)
- **Constraint S-1**: Only `.gsd/SPEC.md`, `.gsd/ROADMAP.md`, and `.gsd/STATE.md` may be created during planning.
- **Constraint S-2**: Zero modifications to application code (`client/`, `server/`), database (`server/db/`), dependencies (`package.json`), ports, `.env`, or deployment configs.
- **Constraint S-3**: Zero Git operations (`git add`, `git commit`, `git reset`, `git checkout`, `git stash`).
- **Constraint S-4**: Zero execution of tests or commands that could alter database or system state.
- **Constraint S-5**: No assumption that all 19 test suites exist or that every proposed feature is already implemented; all assertions must be verified during the Phase 1 audit.
- **Constraint S-6**: Mandatory checkpoint: After planning document creation, stop and request explicit user approval before initiating Phase 1.

### 4.2 Technical & Architectural Constraints
- **Backend**: Node.js 18+ (CommonJS), Express 4.x, SQLite 3 (`server/db/collman_bgv.db`), Multer, PDFKit, bcryptjs, jsonwebtoken.
- **Frontend**: React 18, Vite, React Router 6, Vanilla CSS design system, Leaflet / MapLibre GL, Lucide Icons, Tesseract.js 7.
- **Database Engine**: SQLite 3 with enforced `PRAGMA foreign_keys = ON`, indexed queries, and column migration safety.
- **Language Models & OCR**: Local traineddata files (`eng`, `hin`, `kan`, `mal`, `tam`, `tel`) with server and client failover.
- **Deployment**: PM2 process manager (`ecosystem.config.cjs`) and Nginx reverse proxy template (`nginx.conf.template`) targeting Ubuntu 22.04 LTS and Windows local environments.

---

## 5. Success Criteria

- [ ] **Phase 1 Audit Completion**: All 19 test files in `server/test/`, database schemas, and API endpoints inventoried and empirically assessed for pass/fail status and feature parity.
- [ ] **Zero Data Regression**: Existing database records, uploads, and Git working tree state preserved intact.
- [ ] **Strict Photo Evidence Validation**: 100% of photo capture steps (`door_selfie`, `selfie`, `street`, `house`, `landmark`) enforced by automated quality/content algorithms with zero client bypass.
- [ ] **Geospatial & Geocoding Reliability**: Geocoding queue and GPS distance calculations operate with validated Haversine math, proper error fallbacks, and high-resolution comparison map output.
- [ ] **Multi-Lingual OCR Robustness**: Address proof uploads correctly extract PIN codes and address tokens across supported Indian language traineddata assets.
- [ ] **Role-Based Review Portal**: Admin portal securely isolates RBAC roles (Super Admin, Reviewer, HR Manager, Ops), manages queue assignments, and records immutable audit logs.
- [ ] **BGV PDF Dossier Formatting**: Branded BGV PDF report compiles within clean 3-page layout featuring Google Maps route imagery, document metadata, and tamper-evident SHA-256 hashes.
- [ ] **Build & Deployment Stability**: `npm run build:client` completes cleanly and server initializes across development and target production configurations without unhandled exceptions.

---

## 6. Functional Requirements Matrix

| ID | Requirement Area | Priority | Description | Verification Method |
|---|---|---|---|---|
| **REQ-01** | Baseline Audit & Verification | Must-have | Safely inventory and run tests in isolated/read-only mode to determine true status of all 19 test files and feature implementations. | Execution logs & audit report |
| **REQ-02** | Anti-Fraud Photo Validation | Must-have | Reject blurry, dark, washed-out, hair-only, or partial-face photos; mandate both face and door number for door selfie; no manual bypass. | Unit test suite & canvas validation |
| **REQ-03** | Multi-Lingual Indian OCR | Must-have | Extract address text and PIN codes from documents in English, Hindi, Kannada, Malayalam, Tamil, and Telugu; score against HR address. | OCR test cases & sample evaluation |
| **REQ-04** | Geocoding & Distance Auditing | Must-have | Geocode HR address (Nominatim / Google Maps), calculate distance to mobile GPS coordinates, flag distance brackets (0-500m, 500m-2km, 2km+). | Distance calculation tests & map inspect |
| **REQ-05** | Database Schema & Data Integrity | Must-have | Validate table constraints, foreign key enforcement, migration scripts, and indexing on `collman_bgv.db` without data loss. | SQLite PRAGMA checks & schema audit |
| **REQ-06** | Admin Portal & RBAC Operations | Must-have | Enforce permission boundaries across Super Admin, Reviewer, and HR roles; support case decisioning and re-verification queue. | API route tests & UI route guard check |
| **REQ-07** | BGV PDF & Excel Reporting | Must-have | Generate 3-page vector PDF report containing Google Maps imagery, evidence photos, OCR score, and SHA-256 checksums; Excel bulk export. | PDF render inspect & export audit |
| **REQ-08** | Production Build & Deployment | Must-have | Ensure Vite client builds without errors; verify PM2 ecosystem config, Nginx templates, and cross-platform start scripts. | Vite build & config syntax check |

---

## 7. User Stories

### As an Employee:
- I want a guided, responsive mobile verification wizard that remembers my progress so I can complete address verification smoothly even on low-bandwidth mobile connections.
- I want clear, real-time feedback when my photo capture doesn't meet quality or framing standards so I know exactly how to retake a compliant photo.

### As a BGV Reviewer / HR Specialist:
- I want an intuitive review queue and workstation displaying side-by-side evidence (HR master address vs. verified GPS location, photo evidence, and OCR match scores) so I can make swift and accurate verification decisions.
- I want an automated re-verification workflow that records clear reviewer remarks and tracks turnaround time (TAT).

### As a Compliance Officer / Super Admin:
- I want all verification submissions, decisions, and master modifications permanently recorded in immutable audit logs.
- I want tamper-evident BGV PDF dossiers generated with SHA-256 checksums and authentic Google Maps vicinity context for legal and corporate compliance audits.

---

*Last updated: 2026-10-28*
