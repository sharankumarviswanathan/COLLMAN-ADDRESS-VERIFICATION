-- Collman Services Address Verification Database Schema (SQLite)

PRAGMA foreign_keys = ON;

-- Users / Admins / Reviewers
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Super Admin', 'HR/Admin', 'BGV Reviewer', 'View Only')),
  branch TEXT,
  department TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Master: Branches
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_code TEXT UNIQUE NOT NULL,
  branch_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Master: Departments
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_code TEXT UNIQUE NOT NULL,
  department_name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Master: Locations
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Master: Document Types
CREATE TABLE IF NOT EXISTS document_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_mandatory INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1
);

-- Master: Failure Reasons
CREATE TABLE IF NOT EXISTS failure_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reason_code TEXT UNIQUE NOT NULL,
  reason_title TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1
);

-- Application Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Employees Master (Non-destructive source of truth for HR data)
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE NOT NULL,
  employee_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  alt_mobile_number TEXT,
  email_id TEXT NOT NULL,
  date_of_joining TEXT NOT NULL,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  branch TEXT NOT NULL,
  location TEXT NOT NULL,
  reporting_manager TEXT,
  hr_current_address TEXT NOT NULL,
  hr_address_line1 TEXT,
  hr_address_line2 TEXT,
  hr_area TEXT,
  hr_landmark TEXT,
  hr_city TEXT NOT NULL,
  hr_district TEXT,
  hr_state TEXT NOT NULL,
  hr_pincode TEXT NOT NULL,
  hr_permanent_address TEXT,
  hr_permanent_pincode TEXT,
  hr_latitude REAL,
  hr_longitude REAL,
  hr_original_lat REAL,
  hr_original_lng REAL,
  hr_geocoding_provider TEXT,
  hr_geocoding_status TEXT DEFAULT 'Not Processed',
  hr_geocoding_date TEXT,
  hr_geocoded_at TEXT,
  hr_geocoded_address TEXT,
  hr_address_sent TEXT,
  hr_pincode_match TEXT,
  hr_area_match TEXT,
  hr_city_match TEXT,
  hr_geocoding_confidence TEXT,
  hr_geocode_latitude REAL,
  hr_geocode_longitude REAL,
  hr_geocode_provider TEXT,
  hr_geocode_status TEXT,
  hr_geocode_returned_address TEXT,
  hr_geocode_confidence TEXT,
  hr_geocode_pincode_match TEXT,
  hr_geocode_area_match TEXT,
  hr_geocode_city_match TEXT,
  hr_geocode_state_match TEXT,
  hr_normalized_address TEXT,
  hr_reference_type TEXT,
  hr_reference_quality TEXT,
  hr_match_score INTEGER,
  hr_house_match TEXT,
  hr_street_match TEXT,
  hr_landmark_match TEXT,
  hr_geocoding_queue_status TEXT DEFAULT 'QUEUED',
  hr_geocoding_attempts INTEGER DEFAULT 0,
  hr_location_updated_by TEXT,
  hr_location_updated_at TEXT,
  hr_location_update_reason TEXT,
  verification_required INTEGER DEFAULT 1,
  verification_status TEXT DEFAULT 'Not Started'
    CHECK(verification_status IN ('Not Started', 'In Progress', 'Submitted', 'Pending BGV Review', 'Verified', 'Verification Failed', 'Reverification Required', 'More Information Required', 'Inactive')),
  assigned_reviewer_id INTEGER REFERENCES users(id),
  tat_deadline TEXT,
  created_by TEXT DEFAULT 'HR',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Verification Cases
CREATE TABLE IF NOT EXISTS verification_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_reference TEXT UNIQUE NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  current_attempt_number INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'In Progress',
  assigned_reviewer_id INTEGER REFERENCES users(id),
  tat_deadline TEXT,
  final_decision TEXT,
  final_remarks TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Verification Attempts (Retains attempt history for reverifications)
CREATE TABLE IF NOT EXISTS verification_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES verification_cases(id),
  employee_id TEXT NOT NULL REFERENCES employees(employee_id),
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Progress',
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  submitted_at TEXT,
  decision TEXT,
  reviewer_id INTEGER REFERENCES users(id),
  reviewer_remarks TEXT,
  failure_reason TEXT,
  reviewed_at TEXT
);

-- Step-by-step Verification Progress (Auto-save support for common link)
CREATE TABLE IF NOT EXISTS verification_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL UNIQUE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  current_step INTEGER NOT NULL DEFAULT 1,
  details_confirmed INTEGER DEFAULT 0,
  details_correction_remark TEXT,
  address_confirmed INTEGER DEFAULT 0,
  address_is_same INTEGER DEFAULT 1,
  address_difference_reason TEXT,
  submitted_address TEXT,
  submitted_address_line1 TEXT,
  submitted_address_line2 TEXT,
  submitted_city TEXT,
  submitted_state TEXT,
  submitted_pincode TEXT,
  residence_type TEXT,
  staying_since_month TEXT,
  staying_since_year TEXT,
  location_captured INTEGER DEFAULT 0,
  latitude REAL,
  longitude REAL,
  gps_accuracy REAL,
  distance_from_hr_meters REAL,
  distance_category TEXT,
  selfie_captured INTEGER DEFAULT 0,
  selfie_path TEXT,
  selfie_latitude REAL,
  selfie_longitude REAL,
  selfie_accuracy REAL,
  selfie_captured_at TEXT,
  house_photo_captured INTEGER DEFAULT 0,
  house_photo_path TEXT,
  house_photo_latitude REAL,
  house_photo_longitude REAL,
  house_photo_accuracy REAL,
  house_photo_captured_at TEXT,
  entrance_photo_path TEXT,
  street_photo_captured INTEGER DEFAULT 0,
  street_photo_path TEXT,
  street_photo_latitude REAL,
  street_photo_longitude REAL,
  street_photo_accuracy REAL,
  street_photo_captured_at TEXT,
  landmark_photo_captured INTEGER DEFAULT 0,
  landmark_photo_path TEXT,
  landmark_photo_latitude REAL,
  landmark_photo_longitude REAL,
  landmark_photo_accuracy REAL,
  landmark_photo_captured_at TEXT,
  door_photo_captured INTEGER DEFAULT 0,
  door_photo_path TEXT,
  door_photo_latitude REAL,
  door_photo_longitude REAL,
  door_photo_accuracy REAL,
  door_photo_captured_at TEXT,
  address_proof_uploaded INTEGER DEFAULT 0,
  document_type TEXT,
  document_path TEXT,
  document_original_name TEXT,
  document_back_path TEXT,
  document_back_original_name TEXT,
  declaration_accepted INTEGER DEFAULT 0,
  declaration_timestamp TEXT,
  last_saved_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Verification Evidence Store (Photos & Documents)
CREATE TABLE IF NOT EXISTS verification_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  employee_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK(evidence_type IN ('selfie', 'house_photo', 'building_photo', 'entrance_photo', 'street_photo', 'landmark_photo', 'door_photo', 'address_proof')),
  document_type TEXT,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  file_size INTEGER,
  latitude REAL,
  longitude REAL,
  gps_accuracy REAL,
  captured_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Verification Timeline / Audit Trail per Case
CREATE TABLE IF NOT EXISTS verification_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL,
  case_reference TEXT,
  attempt_number INTEGER DEFAULT 1,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Internal Download Area (All generated PDFs, Excels, exports land here first)
CREATE TABLE IF NOT EXISTS download_area_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('PDF', 'Excel', 'CSV', 'ZIP', 'Other')),
  category TEXT NOT NULL CHECK(category IN ('Verification Report', 'Bulk Upload Failures', 'Employee Master Export', 'Queue Export', 'Analytics Report', 'Audit Export')),
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  generated_by TEXT NOT NULL,
  reference_no TEXT,
  employee_id TEXT,
  download_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- System Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  employee_id TEXT,
  case_reference TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(verification_status);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);
CREATE INDEX IF NOT EXISTS idx_cases_reference ON verification_cases(case_reference);
CREATE INDEX IF NOT EXISTS idx_cases_emp_id ON verification_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON verification_cases(status);
CREATE INDEX IF NOT EXISTS idx_progress_emp_id ON verification_progress(employee_id);
CREATE INDEX IF NOT EXISTS idx_evidence_emp_id ON verification_evidence(employee_id);
CREATE INDEX IF NOT EXISTS idx_timeline_emp_id ON verification_timeline(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON download_area_files(created_at);
