const bcrypt = require('bcryptjs');
const { query, initDatabase } = require('./database');

async function seed() {
  await initDatabase();

  console.log('Seeding initial data for Collman Services Address Verification...');

  // 1. App Settings
  const settings = [
    { key: 'app_name', value: 'COLLMAN SERVICES ADDRESS VERIFICATION', description: 'Application corporate brand name' },
    { key: 'company_name', value: 'Collman Services', description: 'Company name' },
    { key: 'employee_tat_days', value: '3', description: 'Employee completion turnaround time in days' },
    { key: 'bgv_tat_days', value: '1', description: 'BGV review turnaround time in days' },
    { key: 'gps_threshold_close_meters', value: '100', description: 'GPS distance threshold for Very Close' },
    { key: 'gps_threshold_nearby_meters', value: '500', description: 'GPS distance threshold for Nearby' },
    { key: 'require_entrance_photo', value: 'optional', description: 'Entrance photo requirement: mandatory, optional, disabled' },
    { key: 'require_landmark_photo', value: 'optional', description: 'Landmark photo requirement: mandatory, optional, disabled' },
    { key: 'rate_limit_failed_attempts', value: '5', description: 'Allowed failed ID attempts before 15m lockout' },
    { key: 'geocoding_provider', value: 'Google Maps', description: 'Primary HR geocoding provider' },
    { key: 'google_maps_api_key', value: '', description: 'Google Maps Geocoding API Key (Primary Provider)' }
  ];

  for (const s of settings) {
    await query.run(
      `INSERT INTO app_settings (key, value, description) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, description=excluded.description`,
      [s.key, s.value, s.description]
    );
  }

  // 2. Master Branches
  const branches = [
    { code: 'CHN-HQ', name: 'Chennai Headquarters', city: 'Chennai', state: 'Tamil Nadu' },
    { code: 'BLR-TP', name: 'Bangalore Tech Park', city: 'Bangalore', state: 'Karnataka' },
    { code: 'HYD-CC', name: 'Hyderabad CyberCity', city: 'Hyderabad', state: 'Telangana' },
    { code: 'MUM-NP', name: 'Mumbai Nariman Point', city: 'Mumbai', state: 'Maharashtra' },
    { code: 'PUN-HW', name: 'Pune Hinjawadi Hub', city: 'Pune', state: 'Maharashtra' },
    { code: 'DEL-NCR', name: 'Delhi NCR Regional Office', city: 'Gurgaon', state: 'Haryana' }
  ];

  for (const b of branches) {
    await query.run(
      `INSERT OR IGNORE INTO branches (branch_code, branch_name, city, state) VALUES (?, ?, ?, ?)`,
      [b.code, b.name, b.city, b.state]
    );
  }

  // 3. Master Departments
  const depts = [
    { code: 'OPS', name: 'Operations' },
    { code: 'HR', name: 'Human Resources' },
    { code: 'IT', name: 'Information Technology' },
    { code: 'FIN', name: 'Finance & Accounts' },
    { code: 'QC', name: 'Quality & Compliance' },
    { code: 'CS', name: 'Customer Support' }
  ];

  for (const d of depts) {
    await query.run(
      `INSERT OR IGNORE INTO departments (department_code, department_name) VALUES (?, ?)`,
      [d.code, d.name]
    );
  }

  // 4. Master Locations
  const locations = [
    { name: 'Chennai Central', city: 'Chennai', state: 'Tamil Nadu' },
    { name: 'Bangalore Electronic City', city: 'Bangalore', state: 'Karnataka' },
    { name: 'Hyderabad Hitec City', city: 'Hyderabad', state: 'Telangana' },
    { name: 'Mumbai BKC', city: 'Mumbai', state: 'Maharashtra' },
    { name: 'Pune Magarpatta', city: 'Pune', state: 'Maharashtra' },
    { name: 'Noida Sector 62', city: 'Noida', state: 'Uttar Pradesh' }
  ];

  for (const loc of locations) {
    await query.run(
      `INSERT OR IGNORE INTO locations (location_name, city, state) VALUES (?, ?, ?)`,
      [loc.name, loc.city, loc.state]
    );
  }

  // 5. Document Types
  const docTypes = [
    { name: 'Aadhaar Card', desc: 'UIDAI official government address proof' },
    { name: 'Driving Licence', desc: 'Regional Transport Office issued photo licence' },
    { name: 'Voter ID', desc: 'Election Commission of India Identity Card' },
    { name: 'Gas Bill', desc: 'Piped gas or LPG cylinder utility connection bill' },
    { name: 'Registered Rental Agreement', desc: 'Notarized or registered lease deed' },
    { name: 'Passport', desc: 'Official Republic of India Passport' }
  ];

  for (const dt of docTypes) {
    await query.run(
      `INSERT OR IGNORE INTO document_types (type_name, description) VALUES (?, ?)`,
      [dt.name, dt.desc]
    );
  }

  // 6. Failure Reasons
  const failureReasons = [
    { code: 'ADDR_NOT_CONFIRMED', title: 'Address Not Confirmed', desc: 'Employee address mismatch or incomplete premises' },
    { code: 'LOC_MISMATCH', title: 'Location Mismatch', desc: 'Captured GPS location is significantly far from claimed address' },
    { code: 'INVALID_DOC', title: 'Invalid Address Proof', desc: 'Document is illegible, expired, or name does not match' },
    { code: 'INSUFFICIENT_EVIDENCE', title: 'Insufficient Evidence', desc: 'House or selfie photos are blurry, dark, or unclear' },
    { code: 'INCORRECT_INFO', title: 'Incorrect Information', desc: 'Discrepancies found in stay duration or residence type' },
    { code: 'OTHER', title: 'Other', desc: 'Other compliance or policy violation' }
  ];

  for (const fr of failureReasons) {
    await query.run(
      `INSERT OR IGNORE INTO failure_reasons (reason_code, reason_title, description) VALUES (?, ?, ?)`,
      [fr.code, fr.title, fr.desc]
    );
  }

  // 7. Internal System Users
  const passwordAdmin = await bcrypt.hash('admin123', 10);
  const passwordHr = await bcrypt.hash('hr123', 10);
  const passwordReviewer = await bcrypt.hash('reviewer123', 10);
  const passwordViewer = await bcrypt.hash('viewer123', 10);

  const users = [
    {
      username: 'admin',
      email: 'admin@collman.com',
      password_hash: passwordAdmin,
      full_name: 'Collman Super Administrator',
      role: 'Super Admin',
      branch: 'Chennai Headquarters',
      department: 'Operations'
    },
    {
      username: 'hr_admin',
      email: 'hr@collman.com',
      password_hash: passwordHr,
      full_name: 'Anjali Sharma (HR Lead)',
      role: 'HR/Admin',
      branch: 'Chennai Headquarters',
      department: 'Human Resources'
    },
    {
      username: 'reviewer1',
      email: 'reviewer@collman.com',
      password_hash: passwordReviewer,
      full_name: 'Kavita Iyer (BGV Specialist)',
      role: 'BGV Reviewer',
      branch: 'Bangalore Tech Park',
      department: 'Quality & Compliance'
    },
    {
      username: 'reviewer2',
      email: 'reviewer2@collman.com',
      password_hash: passwordReviewer,
      full_name: 'Manoj Pillai (BGV Senior Analyst)',
      role: 'BGV Reviewer',
      branch: 'Chennai Headquarters',
      department: 'Quality & Compliance'
    },
    {
      username: 'viewer',
      email: 'viewer@collman.com',
      password_hash: passwordViewer,
      full_name: 'Audit Viewer',
      role: 'View Only',
      branch: 'Chennai Headquarters',
      department: 'Human Resources'
    }
  ];

  for (const u of users) {
    await query.run(
      `INSERT INTO users (username, email, password_hash, full_name, role, branch, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, full_name=excluded.full_name, role=excluded.role`,
      [u.username, u.email, u.password_hash, u.full_name, u.role, u.branch, u.department]
    );
  }

  // 8. Seed Employees (HR Employee Master)
  const employees = [
    {
      emp_id: 'COL00101',
      name: 'Rahul Sharma',
      mobile: '9876543210',
      alt_mobile: '9876543211',
      email: 'rahul.sharma@collman.com',
      doj: '2026-08-15',
      dept: 'Information Technology',
      designation: 'Senior Software Engineer',
      branch: 'Bangalore Tech Park',
      location: 'Bangalore Electronic City',
      manager: 'Rajesh Nair',
      address: 'Flat 402, Sunshine Apartments, 5th Cross, HSR Layout Sector 2, Bangalore, Karnataka - 560102',
      addr1: 'Flat 402, Sunshine Apartments',
      addr2: '5th Cross, HSR Layout Sector 2',
      area: 'HSR Layout',
      landmark: 'Near BDA Complex',
      city: 'Bangalore',
      district: 'Bangalore Urban',
      state: 'Karnataka',
      pincode: '560102',
      perm_address: 'House No 12, Subhash Nagar, Jaipur, Rajasthan - 302016',
      perm_pincode: '302016',
      lat: 12.9116,
      lng: 77.6389,
      status: 'Not Started'
    },
    {
      emp_id: 'COL00102',
      name: 'Priya Sundaram',
      mobile: '9840123456',
      alt_mobile: '9840123457',
      email: 'priya.sundaram@collman.com',
      doj: '2026-08-18',
      dept: 'Operations',
      designation: 'Operations Executive',
      branch: 'Chennai Headquarters',
      location: 'Chennai Central',
      manager: 'Anjali Sharma',
      address: 'No. 24, 3rd Main Road, Anna Nagar West, Chennai, Tamil Nadu - 600040',
      addr1: 'No. 24, 3rd Main Road',
      addr2: 'Anna Nagar West',
      area: 'Anna Nagar',
      landmark: 'Opposite Tower Park',
      city: 'Chennai',
      district: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600040',
      perm_address: 'No. 24, 3rd Main Road, Anna Nagar West, Chennai, Tamil Nadu - 600040',
      perm_pincode: '600040',
      lat: 13.0850,
      lng: 80.2101,
      status: 'In Progress'
    },
    {
      emp_id: 'COL00103',
      name: 'Ananya Rao',
      mobile: '9701234567',
      alt_mobile: '9701234568',
      email: 'ananya.rao@collman.com',
      doj: '2026-08-20',
      dept: 'Customer Support',
      designation: 'Support Specialist',
      branch: 'Hyderabad CyberCity',
      location: 'Hyderabad Hitec City',
      manager: 'Kavita Iyer',
      address: 'Plot 88, Sri Sai Nagar, Madhapur, Hyderabad, Telangana - 500081',
      addr1: 'Plot 88, Sri Sai Nagar',
      addr2: 'Near Durgam Cheruvu',
      area: 'Madhapur',
      landmark: 'Behind Inorbit Mall',
      city: 'Hyderabad',
      district: 'Rangareddy',
      state: 'Telangana',
      pincode: '500081',
      perm_address: 'D.No 4-12, Main Bazar, Guntur, Andhra Pradesh - 522002',
      perm_pincode: '522002',
      lat: 17.4435,
      lng: 78.3772,
      status: 'Pending BGV Review'
    },
    {
      emp_id: 'COL00104',
      name: 'Karthik Raman',
      mobile: '9962012345',
      alt_mobile: '9962012346',
      email: 'karthik.raman@collman.com',
      doj: '2026-08-22',
      dept: 'Quality & Compliance',
      designation: 'BGV Analyst',
      branch: 'Chennai Headquarters',
      location: 'Chennai Central',
      manager: 'Manoj Pillai',
      address: 'New Door 15, Old 8, 2nd Avenue, Harrington Road, Chetpet, Chennai - 600031',
      addr1: 'New Door 15, Old 8',
      addr2: '2nd Avenue, Harrington Road',
      area: 'Chetpet',
      landmark: 'Near Chetpet Railway Station',
      city: 'Chennai',
      district: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600031',
      perm_address: 'Same as current',
      perm_pincode: '600031',
      lat: 13.0722,
      lng: 80.2378,
      status: 'Pending BGV Review'
    },
    {
      emp_id: 'COL00105',
      name: 'Suresh Verma',
      mobile: '9820098765',
      alt_mobile: '9820098766',
      email: 'suresh.verma@collman.com',
      doj: '2026-08-01',
      dept: 'Finance & Accounts',
      designation: 'Accountant',
      branch: 'Mumbai Nariman Point',
      location: 'Mumbai BKC',
      manager: 'Gopal Krishnan',
      address: 'B-304, Green Heights, SV Road, Andheri West, Mumbai, Maharashtra - 400058',
      addr1: 'B-304, Green Heights',
      addr2: 'SV Road',
      area: 'Andheri West',
      landmark: 'Opposite Railway Station',
      city: 'Mumbai',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      pincode: '400058',
      perm_address: 'Same as current',
      perm_pincode: '400058',
      lat: 19.1197,
      lng: 72.8464,
      status: 'Verified'
    },
    {
      emp_id: 'COL00106',
      name: 'Vikramaditya Singh',
      mobile: '9811223344',
      alt_mobile: '9811223345',
      email: 'vikram.singh@collman.com',
      doj: '2026-08-10',
      dept: 'Operations',
      designation: 'Operations Lead',
      branch: 'Delhi NCR Regional Office',
      location: 'Noida Sector 62',
      manager: 'Rajesh Nair',
      address: 'Tower 4, Flat 1102, Express Zenith, Sector 77, Noida, Uttar Pradesh - 201301',
      addr1: 'Tower 4, Flat 1102, Express Zenith',
      addr2: 'Sector 77',
      area: 'Sector 77',
      landmark: 'Near Sector 76 Metro',
      city: 'Noida',
      district: 'Gautam Buddha Nagar',
      state: 'Uttar Pradesh',
      pincode: '201301',
      perm_address: 'C-22, Model Town, Jalandhar, Punjab - 144003',
      perm_pincode: '144003',
      lat: 28.5726,
      lng: 77.3888,
      status: 'Verification Failed'
    },
    {
      emp_id: 'COL00107',
      name: 'Deepa Mukherjee',
      mobile: '9830112233',
      alt_mobile: '9830112234',
      email: 'deepa.mukherjee@collman.com',
      doj: '2026-08-25',
      dept: 'Human Resources',
      designation: 'HR Executive',
      branch: 'Pune Hinjawadi Hub',
      location: 'Pune Magarpatta',
      manager: 'Anjali Sharma',
      address: 'Flat 12B, Blue Ridge Phase 2, Hinjawadi Phase 1, Pune, Maharashtra - 411057',
      addr1: 'Flat 12B, Blue Ridge Phase 2',
      addr2: 'Hinjawadi Phase 1',
      area: 'Hinjawadi',
      landmark: 'Near Cognizant Campus',
      city: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411057',
      perm_address: 'Block E, Salt Lake Sector 2, Kolkata, West Bengal - 700091',
      perm_pincode: '700091',
      lat: 18.5912,
      lng: 73.7389,
      status: 'Reverification Required'
    }
  ];

  for (const emp of employees) {
    await query.run(
      `INSERT INTO employees (
        employee_id, employee_name, mobile_number, alt_mobile_number, email_id, date_of_joining,
        department, designation, branch, location, reporting_manager,
        hr_current_address, hr_address_line1, hr_address_line2, hr_area, hr_landmark,
        hr_city, hr_district, hr_state, hr_pincode, hr_permanent_address, hr_permanent_pincode,
        hr_latitude, hr_longitude, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id) DO UPDATE SET
        employee_name=excluded.employee_name,
        verification_status=excluded.verification_status,
        hr_current_address=excluded.hr_current_address`,
      [
        emp.emp_id, emp.name, emp.mobile, emp.alt_mobile, emp.email, emp.doj,
        emp.dept, emp.designation, emp.branch, emp.location, emp.manager,
        emp.address, emp.addr1, emp.addr2, emp.area, emp.landmark,
        emp.city, emp.district, emp.state, emp.pincode, emp.perm_address, emp.perm_pincode,
        emp.lat, emp.lng, emp.status
      ]
    );

    // Initial audit log for employee creation
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_name, action, employee_id, details)
       VALUES ('System', 'HR Importer', 'Employee Master Created', ?, ?)`,
      [emp.emp_id, `Employee ${emp.name} (${emp.emp_id}) added to Master database`]
    );
  }

  // 9. Create specific cases and progress records for demo cases
  // A. COL00102 (In Progress)
  await query.run(
    `INSERT OR REPLACE INTO verification_progress (
      employee_id, attempt_number, current_step, details_confirmed, address_confirmed,
      address_is_same, submitted_address, residence_type, staying_since_month, staying_since_year,
      location_captured, latitude, longitude, gps_accuracy, distance_from_hr_meters, distance_category,
      selfie_captured, house_photo_captured, address_proof_uploaded, declaration_accepted
    ) VALUES (
      'COL00102', 1, 6, 1, 1,
      1, 'No. 24, 3rd Main Road, Anna Nagar West, Chennai, Tamil Nadu - 600040', 'Own House', 'March', '2021',
      1, 13.0852, 80.2104, 8.5, 38.2, 'Very Close',
      0, 0, 0, 0
    )`
  );

  // B. COL00103 (Pending BGV Review - Submitted Case)
  const caseRef103 = 'AV-2026-000103';
  await query.run(
    `INSERT INTO verification_cases (
      case_reference, employee_id, current_attempt_number, status, assigned_reviewer_id, tat_deadline, created_at
    ) VALUES (?, 'COL00103', 1, 'Pending BGV Review', 3, datetime('now', '+1 day'), datetime('now', '-4 hours'))
    ON CONFLICT(case_reference) DO UPDATE SET
      status = excluded.status,
      assigned_reviewer_id = excluded.assigned_reviewer_id`,
    [caseRef103]
  );

  await query.run(
    `INSERT INTO verification_attempts (
      case_id, employee_id, attempt_number, status, started_at, submitted_at
    ) VALUES (
      (SELECT id FROM verification_cases WHERE case_reference=?), 'COL00103', 1, 'Submitted',
      datetime('now', '-6 hours'), datetime('now', '-4 hours')
    )`,
    [caseRef103]
  );

  await query.run(
    `INSERT OR REPLACE INTO verification_progress (
      employee_id, attempt_number, current_step, details_confirmed, address_confirmed,
      address_is_same, submitted_address, residence_type, staying_since_month, staying_since_year,
      location_captured, latitude, longitude, gps_accuracy, distance_from_hr_meters, distance_category,
      selfie_captured, house_photo_captured, address_proof_uploaded, document_type, document_original_name,
      declaration_accepted, declaration_timestamp
    ) VALUES (
      'COL00103', 1, 10, 1, 1,
      1, 'Plot 88, Sri Sai Nagar, Madhapur, Hyderabad, Telangana - 500081', 'Rented House', 'June', '2023',
      1, 17.4438, 78.3775, 6.2, 45.1, 'Very Close',
      1, 1, 1, 'Aadhaar Card', 'Aadhaar_Ananya_Rao.pdf',
      1, datetime('now', '-4 hours')
    )`
  );

  await query.run(
    `INSERT INTO verification_timeline (employee_id, case_reference, attempt_number, action, actor_type, actor_name, details)
     VALUES
     ('COL00103', ?, 1, 'Verification Started', 'Employee', 'Ananya Rao', 'Employee logged in via Common Link and validated Employee ID'),
     ('COL00103', ?, 1, 'Details & Address Confirmed', 'Employee', 'Ananya Rao', 'Confirmed HR address match without modifications'),
     ('COL00103', ?, 1, 'GPS Location Captured', 'Employee', 'Ananya Rao', 'GPS Accuracy 6.2m, Distance: 45.1m (Very Close)'),
     ('COL00103', ?, 1, 'Evidence Uploaded', 'Employee', 'Ananya Rao', 'Selfie, House Photo and Aadhaar Card attached'),
     ('COL00103', ?, 1, 'Verification Submitted', 'Employee', 'Ananya Rao', 'Verification submitted for BGV Review with reference AV-2026-000103')`,
    [caseRef103, caseRef103, caseRef103, caseRef103, caseRef103]
  );

  // C. COL00104 (Pending BGV Review - With Address Change)
  const caseRef104 = 'AV-2026-000104';
  await query.run(
    `INSERT INTO verification_cases (
      case_reference, employee_id, current_attempt_number, status, assigned_reviewer_id, tat_deadline, created_at
    ) VALUES (?, 'COL00104', 1, 'Pending BGV Review', 4, datetime('now', '+1 day'), datetime('now', '-2 hours'))
    ON CONFLICT(case_reference) DO UPDATE SET
      status = excluded.status,
      assigned_reviewer_id = excluded.assigned_reviewer_id`,
    [caseRef104]
  );

  await query.run(
    `INSERT OR REPLACE INTO verification_progress (
      employee_id, attempt_number, current_step, details_confirmed, address_confirmed,
      address_is_same, address_difference_reason, submitted_address, residence_type, staying_since_month, staying_since_year,
      location_captured, latitude, longitude, gps_accuracy, distance_from_hr_meters, distance_category,
      selfie_captured, house_photo_captured, address_proof_uploaded, document_type, document_original_name,
      declaration_accepted, declaration_timestamp
    ) VALUES (
      'COL00104', 1, 10, 1, 0,
      0, 'I have shifted to another address', 'Flat 3B, Coral Bay, 1st Seaward Road, Valmiki Nagar, Thiruvanmiyur, Chennai - 600041', 'Rented House', 'January', '2024',
      1, 12.9822, 80.2605, 5.0, 10240.0, 'Review Required',
      1, 1, 1, 'Registered Rental Agreement', 'Rental_Agreement_ValmikiNagar.pdf',
      1, datetime('now', '-2 hours')
    )`
  );

  // D. COL00105 (Verified - Completed with Report)
  const caseRef105 = 'AV-2026-000105';
  await query.run(
    `INSERT INTO verification_cases (
      case_reference, employee_id, current_attempt_number, status, assigned_reviewer_id,
      final_decision, final_remarks, reviewed_by, reviewed_at, created_at
    ) VALUES (
      ?, 'COL00105', 1, 'Verified', 3,
      'VERIFIED', 'All address details, live GPS (22m), utility bill and house photo verified successfully against HR master records.',
      'Kavita Iyer (BGV Specialist)', datetime('now', '-1 day'), datetime('now', '-2 days')
    )
    ON CONFLICT(case_reference) DO UPDATE SET
      status = excluded.status,
      final_decision = excluded.final_decision,
      final_remarks = excluded.final_remarks`,
    [caseRef105]
  );

  await query.run(
    `INSERT OR REPLACE INTO verification_progress (
      employee_id, attempt_number, current_step, details_confirmed, address_confirmed,
      address_is_same, submitted_address, residence_type, staying_since_month, staying_since_year,
      location_captured, latitude, longitude, gps_accuracy, distance_from_hr_meters, distance_category,
      selfie_captured, house_photo_captured, address_proof_uploaded, document_type, document_original_name,
      declaration_accepted, declaration_timestamp
    ) VALUES (
      'COL00105', 1, 10, 1, 1,
      1, 'B-304, Green Heights, SV Road, Andheri West, Mumbai, Maharashtra - 400058', 'Own House', 'January', '2019',
      1, 19.1199, 72.8465, 4.1, 22.4, 'Very Close',
      1, 1, 1, 'Electricity / Water Bill', 'Electricity_Bill_July2026.pdf',
      1, datetime('now', '-2 days')
    )`
  );

  // E. COL00107 (Reverification Required - Attempt 1 preserved, ready for Attempt 2)
  const caseRef107 = 'AV-2026-000107';
  await query.run(
    `INSERT INTO verification_cases (
      case_reference, employee_id, current_attempt_number, status, assigned_reviewer_id,
      final_decision, final_remarks, reviewed_by, reviewed_at, created_at
    ) VALUES (
      ?, 'COL00107', 2, 'Reverification Required', 3,
      'REVERIFICATION REQUIRED', 'The uploaded address proof document is blurred and the building entrance number is not visible. Please re-upload a clear copy and re-capture the house photo in daylight.',
      'Kavita Iyer (BGV Specialist)', datetime('now', '-5 hours'), datetime('now', '-3 days')
    )
    ON CONFLICT(case_reference) DO UPDATE SET
      status = excluded.status,
      final_decision = excluded.final_decision,
      final_remarks = excluded.final_remarks`,
    [caseRef107]
  );

  await query.run(
    `INSERT INTO verification_attempts (
      case_id, employee_id, attempt_number, status, started_at, submitted_at, decision, reviewer_id, reviewer_remarks, failure_reason, reviewed_at
    ) VALUES (
      (SELECT id FROM verification_cases WHERE case_reference=?), 'COL00107', 1, 'Reverification Required',
      datetime('now', '-3 days'), datetime('now', '-2 days'), 'REVERIFICATION REQUIRED', 3,
      'Document unreadable and dark house photo.', 'INSUFFICIENT_EVIDENCE', datetime('now', '-5 hours')
    )`,
    [caseRef107]
  );

  console.log('Collman Services database seeding completed successfully!');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
