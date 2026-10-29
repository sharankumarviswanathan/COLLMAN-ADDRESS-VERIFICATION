const express = require('express');
const router = express.Router();
const fs = require('fs');
const XLSX = require('xlsx');
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles, requirePermission, checkUserHasPermission, isTeamLeader } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { generateExcelReport } = require('../utils/excelGenerator');
const { enqueueEmployees, getQueueStats } = require('../utils/geocodingQueue');

// GET /api/employees - Query Employee Master with filters, search, pagination
router.get('/', authenticateAdmin, requirePermission('view_employees'), async (req, res) => {
  try {
    const {
      search,
      status,
      branch,
      department,
      location,
      state,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereClauses.push('(e.employee_id LIKE ? OR e.employee_name LIKE ? OR e.mobile_number LIKE ? OR e.email_id LIKE ?)');
      params.push(q, q, q, q);
    }

    if (status && status !== 'ALL') {
      whereClauses.push('e.verification_status = ?');
      params.push(status);
    }

    if (branch && branch !== 'ALL') {
      whereClauses.push('e.branch = ?');
      params.push(branch);
    }

    if (department && department !== 'ALL') {
      whereClauses.push('e.department = ?');
      params.push(department);
    }

    if (location && location !== 'ALL') {
      whereClauses.push('e.location = ?');
      params.push(location);
    }

    if (state && state !== 'ALL') {
      whereClauses.push('e.hr_state = ?');
      params.push(state);
    }

    if (startDate) {
      whereClauses.push('e.date_of_joining >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('e.date_of_joining <= ?');
      params.push(endDate);
    }

    // TL access restriction: TLs can only view employees assigned to them
    if (isTeamLeader(req.user)) {
      whereClauses.push('e.assigned_reviewer_id = ?');
      params.push(req.user.id);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Allowed sort columns
    const allowedSortCols = ['employee_id', 'employee_name', 'date_of_joining', 'department', 'branch', 'verification_status', 'created_at'];
    const safeSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countRow = await query.get(
      `SELECT COUNT(*) as total FROM employees e ${whereSql}`,
      params
    );
    const total = countRow ? countRow.total : 0;

    // Query paginated records with case reference & reviewer info
    const employees = await query.all(
      `SELECT e.*,
              vc.case_reference,
              u.full_name as reviewer_name,
              CASE
                WHEN e.verification_status IN ('Verified', 'Verification Failed') THEN 'Completed'
                WHEN e.tat_deadline IS NOT NULL AND datetime('now') > datetime(e.tat_deadline) THEN 'TAT Breached'
                WHEN e.tat_deadline IS NOT NULL AND date('now') = date(e.tat_deadline) THEN 'Due Today'
                ELSE 'Within TAT'
              END as tat_status
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       LEFT JOIN users u ON e.assigned_reviewer_id = u.id
       ${whereSql}
       ORDER BY e.${safeSortBy} ${safeSortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      employees,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Fetch employees error:', err);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

// GET /api/employees/geocoding-queue-stats - Real-time statistics of automatic geocoding queue
router.get('/geocoding-queue-stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch geocoding queue stats.' });
  }
});

// GET /api/employees/sample-template - Download Excel/CSV sample file for employee bulk upload
router.get('/sample-template', authenticateAdmin, async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();

    const sampleData = [
      {
        'Employee ID': 'COL00120',
        'Employee Name': 'Venkatesh Raman',
        'Mobile Number': '9876543210',
        'Manager': 'SARANGAN',
        'Team Leader': 'Surya',
        'Date of Joining': '2026-10-22',
        'Department': 'Operations',
        'Designation': 'Executive',
        'Branch': 'Chennai Headquarters',
        'Location': 'Chennai Central',
        'Full Current Address': 'No. 45, Gandhi Street, T. Nagar',
        'City': 'Chennai',
        'State': 'Tamil Nadu',
        'Pincode': '600017'
      },
      {
        'Employee ID': 'COL00121',
        'Employee Name': 'Divya Krishnan',
        'Mobile Number': '9840123456',
        'Manager': 'Rajesh Sharma',
        'Team Leader': 'Surya',
        'Date of Joining': '2026-10-22',
        'Department': 'Finance & Accounts',
        'Designation': 'Executive',
        'Branch': 'Chennai Headquarters',
        'Location': 'Chennai South',
        'Full Current Address': 'Flat 2B, Lakshmi Apartments, Velachery',
        'City': 'Chennai',
        'State': 'Tamil Nadu',
        'Pincode': '600042'
      },
      {
        'Employee ID': 'COL00122',
        'Employee Name': 'Mohan Raj',
        'Mobile Number': '9123456789',
        'Manager': 'Anjali Sharma',
        'Team Leader': 'Surya',
        'Date of Joining': '2026-10-22',
        'Department': 'Operations',
        'Designation': 'Senior Executive',
        'Branch': 'Chennai Headquarters',
        'Location': 'Chennai West',
        'Full Current Address': '12/3, Anna Nagar 2nd Avenue',
        'City': 'Chennai',
        'State': 'Tamil Nadu',
        'Pincode': '600040'
      }
    ];

    if (format === 'csv') {
      const headers = Object.keys(sampleData[0]);
      const csvRows = [headers.join(',')];
      for (const row of sampleData) {
        csvRows.push(headers.map((h) => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="Collman_Employee_Bulk_Upload_Sample.csv"');
      return res.send(csvRows.join('\n'));
    }

    // Default to Excel (.xlsx)
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);

    ws['!cols'] = [
      { wch: 16 }, // Employee ID
      { wch: 22 }, // Employee Name
      { wch: 16 }, // Mobile Number
      { wch: 18 }, // Manager
      { wch: 18 }, // Team Leader
      { wch: 16 }, // Date of Joining
      { wch: 20 }, // Department
      { wch: 18 }, // Designation
      { wch: 24 }, // Branch
      { wch: 18 }, // Location
      { wch: 38 }, // Full Current Address
      { wch: 16 }, // City
      { wch: 16 }, // State
      { wch: 12 }  // Pincode
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Employee Template');

    // Add Reference / Help Sheet with configured branches, departments, team leaders
    try {
      const activeBranches = await query.all('SELECT branch_name FROM branches WHERE is_active = 1');
      const activeDepts = await query.all('SELECT department_name FROM departments WHERE is_active = 1');
      const teamLeaders = await query.all("SELECT full_name FROM users WHERE role = 'Team Leader' OR role = 'Super Admin'");

      const refRows = [];
      const maxRows = Math.max(activeBranches.length, activeDepts.length, teamLeaders.length, 5);

      for (let i = 0; i < maxRows; i++) {
        refRows.push({
          'Configured Branches': activeBranches[i]?.branch_name || '',
          'Configured Departments': activeDepts[i]?.department_name || '',
          'Active Team Leaders': teamLeaders[i]?.full_name || ''
        });
      }

      const refWs = XLSX.utils.json_to_sheet(refRows);
      refWs['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 26 }];
      XLSX.utils.book_append_sheet(wb, refWs, 'Configured Options Reference');
    } catch (refErr) {
      console.warn('Could not populate employee reference sheet:', refErr.message);
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Collman_Employee_Bulk_Upload_Sample.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Employee sample template error:', err);
    res.status(500).json({ error: 'Failed to generate employee sample template.' });
  }
});

// GET /api/employees/:id - Retrieve single employee detail & verification history
router.get('/:id', authenticateAdmin, requirePermission('view_employees'), async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await query.get(
      `SELECT e.*, vc.case_reference, vc.status as case_status, vc.final_decision, vc.final_remarks,
              vc.reviewed_by, vc.reviewed_at, u.full_name as reviewer_name
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       LEFT JOIN users u ON e.assigned_reviewer_id = u.id
       WHERE e.employee_id = ? OR e.id = ?`,
      [id, id]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // TL access restriction: Team Leaders can only access assigned employees
    if (isTeamLeader(req.user) && employee.assigned_reviewer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access restricted: Team Leaders can only access employee records assigned to them.' });
    }

    // Load verification progress
    const progress = await query.get(
      'SELECT * FROM verification_progress WHERE employee_id = ?',
      [employee.employee_id]
    );

    // Load timeline
    const timeline = await query.all(
      'SELECT * FROM verification_timeline WHERE employee_id = ? ORDER BY created_at ASC',
      [employee.employee_id]
    );

    // Load attempts
    const attempts = await query.all(
      `SELECT va.*, u.full_name as reviewer_name
       FROM verification_attempts va
       LEFT JOIN users u ON va.reviewer_id = u.id
       WHERE va.employee_id = ?
       ORDER BY va.attempt_number ASC`,
      [employee.employee_id]
    );

    // Load evidence (prioritize latest attempt and most recent captures first)
    const evidence = await query.all(
      'SELECT * FROM verification_evidence WHERE employee_id = ? ORDER BY attempt_number DESC, captured_at DESC, id DESC',
      [employee.employee_id]
    );

    res.json({
      employee,
      progress,
      timeline,
      attempts,
      evidence
    });
  } catch (err) {
    console.error('Get employee detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve employee details.' });
  }
});

// POST /api/employees - Manual Single Employee Creation
router.post('/', authenticateAdmin, requirePermission('create_employee'), async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      mobileNumber,
      altMobileNumber,
      emailId,
      dateOfJoining,
      department,
      designation,
      branch,
      location,
      reportingManager,
      manager,
      teamLeader,
      currentAddress,
      addressLine1,
      addressLine2,
      area,
      landmark,
      city,
      district,
      state,
      pincode,
      permanentAddress,
      permanentPincode,
      latitude,
      longitude
    } = req.body;

    if (!employeeId || !employeeName || !mobileNumber || !dateOfJoining || !department || !branch || !currentAddress || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Please provide all mandatory employee and address fields.' });
    }

    const cleanId = employeeId.trim().toUpperCase();

    // Strict duplicate check
    const existing = await query.get(
      'SELECT id, employee_id FROM employees WHERE UPPER(employee_id) = ?',
      [cleanId]
    );

    if (existing) {
      return res.status(400).json({
        error: 'Employee ID already exists.',
        employeeId: cleanId
      });
    }

    const repMgr = reportingManager ? reportingManager.trim() : (manager ? manager.trim() : null);
    const tl = teamLeader ? teamLeader.trim() : null;

    // Strict validation: Verify Manager - Team Leader reporting relationship
    if (repMgr && tl) {
      const mgrUser = await query.get(
        `SELECT id, username, full_name FROM users
         WHERE (LOWER(role) = 'manager' OR role = 'MANAGER')
           AND (CAST(id AS TEXT) = ? OR LOWER(username) = LOWER(?) OR LOWER(full_name) = LOWER(?))
           AND is_active = 1`,
        [repMgr, repMgr, repMgr]
      );

      const tlUser = await query.get(
        `SELECT id, username, full_name, manager FROM users
         WHERE role = 'Team Leader'
           AND (CAST(id AS TEXT) = ? OR LOWER(username) = LOWER(?) OR LOWER(full_name) = LOWER(?))`,
        [tl, tl, tl]
      );

      if (mgrUser && tlUser && tlUser.manager) {
        const matches = (
          tlUser.manager.toLowerCase().trim() === mgrUser.full_name.toLowerCase().trim() ||
          tlUser.manager.toLowerCase().trim() === mgrUser.username.toLowerCase().trim() ||
          tlUser.manager.toString() === mgrUser.id.toString()
        );

        if (!matches) {
          return res.status(400).json({
            error: `Validation error: Selected Team Leader '${tlUser.full_name}' does not report to Manager '${mgrUser.full_name}'.`
          });
        }
      }
    }

    // Strict validation: Verify Branch - Location relationship
    if (branch && location) {
      const branchRecord = await query.get(
        'SELECT id, branch_name FROM branches WHERE LOWER(TRIM(branch_name)) = LOWER(TRIM(?)) OR UPPER(TRIM(branch_code)) = UPPER(TRIM(?))',
        [branch, branch]
      );
      if (branchRecord) {
        const configuredLocs = await query.all(
          'SELECT id, location_name, is_active FROM locations WHERE branch_id = ?',
          [branchRecord.id]
        );
        if (configuredLocs.length > 0) {
          const locMatch = configuredLocs.find(
            (l) => l.location_name.toLowerCase().trim() === location.toLowerCase().trim()
          );
          if (!locMatch) {
            return res.status(400).json({
              error: `Validation error: Location '${location}' does not belong to branch '${branchRecord.branch_name}'.`
            });
          }
        }
      }
    }
    const safeEmail = emailId && emailId.trim() ? emailId.trim() : (cleanId.toLowerCase() + '@collman.local');
    const safeAltMobile = altMobileNumber ? altMobileNumber.trim() : null;

    // Default TAT calculation (3 days for employee)
    const tatSetting = await query.get("SELECT value FROM app_settings WHERE key='employee_tat_days'");
    const employeeTatDays = parseInt(tatSetting ? tatSetting.value : '3', 10);

    // If a matching Team Leader user exists, automatically associate reviewer ID
    let assignedReviewerId = null;
    if (tl) {
      const tlUser = await query.get(
        "SELECT id FROM users WHERE (full_name = ? OR username = ?) AND role = 'Team Leader'",
        [tl, tl]
      );
      if (tlUser) {
        assignedReviewerId = tlUser.id;
      }
    }

    const result = await query.run(
      `INSERT INTO employees (
        employee_id, employee_name, mobile_number, alt_mobile_number, email_id, date_of_joining,
        department, designation, branch, location, reporting_manager, team_leader,
        hr_current_address, hr_address_line1, hr_address_line2, hr_area, hr_landmark,
        hr_city, hr_district, hr_state, hr_pincode, hr_permanent_address, hr_permanent_pincode,
        hr_latitude, hr_longitude, verification_status, assigned_reviewer_id, tat_deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started', ?, datetime('now', '+' || ? || ' days'), ?)`,
      [
        cleanId, employeeName.trim(), mobileNumber.trim(), safeAltMobile, safeEmail, dateOfJoining,
        department, designation || 'Employee', branch, location || city, repMgr, tl,
        currentAddress.trim(), addressLine1 || null, addressLine2 || null, area || null, landmark || null,
        city.trim(), district || null, state.trim(), pincode.trim(), permanentAddress || null, permanentPincode || null,
        latitude || null, longitude || null, assignedReviewerId, employeeTatDays, req.user.full_name
      ]
    );

    // Create verification progress container
    await query.run(
      `INSERT INTO verification_progress (employee_id, attempt_number, current_step, submitted_address)
       VALUES (?, 1, 1, ?)`,
      [cleanId, currentAddress.trim()]
    );

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, employee_id, details)
       VALUES ('HR', ?, ?, 'Employee Created', ?, ?)`,
      [req.user.id.toString(), req.user.full_name, cleanId, `Manually created employee record for ${employeeName} (${cleanId})`]
    );

    // Automatically enqueue address for 100% automatic background geocoding
    enqueueEmployees(cleanId).catch(e => console.warn('[AUTOMATIC GEOCODING] Enqueue error:', e));

    res.status(201).json({
      success: true,
      message: 'Employee created successfully. HR address automatically queued for geolocation.',
      id: result.lastID,
      employeeId: cleanId
    });
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

// POST /api/employees/parse-bulk-file - Upload and parse Excel/CSV to extract headers & sample rows
router.post('/parse-bulk-file', authenticateAdmin, requirePermission('upload_employees', 'bulk_upload'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an Excel (.xlsx, .xls) or CSV file.' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      return res.status(400).json({ error: 'Uploaded file is empty or missing data rows.' });
    }

    const headers = rows[0].map((h) => String(h || '').trim()).filter(Boolean);
    const allDataRows = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? String(row[idx]) : '';
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v !== ''));

    const sampleRows = allDataRows.slice(0, 5);

    res.json({
      filePath: req.file.path,
      fileName: req.file.originalname,
      headers,
      sampleRows,
      allRows: allDataRows,
      previewRows: allDataRows,
      totalRows: allDataRows.length
    });
  } catch (err) {
    console.error('Parse file error:', err);
    res.status(500).json({ error: 'Failed to parse the uploaded file.' });
  }
});

// POST /api/employees/process-bulk-upload - Validate, check duplicates, and import with column mapping
router.post('/process-bulk-upload', authenticateAdmin, requirePermission('upload_employees', 'bulk_upload'), async (req, res) => {
  try {
    const { filePath, columnMapping } = req.body;

    if (!filePath || !columnMapping) {
      return res.status(400).json({ error: 'File path and column mapping configuration are required.' });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in the file.' });
    }

    const existingEmps = await query.all('SELECT employee_id FROM employees');
    const existingIdSet = new Set(existingEmps.map((e) => e.employee_id.toUpperCase()));

    const seenInFileIdSet = new Set();
    const validRecords = [];
    const failedRecords = [];

    const tatSetting = await query.get("SELECT value FROM app_settings WHERE key='employee_tat_days'");
    const employeeTatDays = parseInt(tatSetting ? tatSetting.value : '3', 10);

    for (let index = 0; index < rows.length; index++) {
      const rawRow = rows[index];
      const rowNumber = index + 2; // Excel row index

      // Extract values based on column mapping
      const empId = String(rawRow[columnMapping.employee_id] || '').trim().toUpperCase();
      const empName = String(rawRow[columnMapping.employee_name] || '').trim();
      const mobile = String(rawRow[columnMapping.mobile_number] || '').trim();
      const altMobile = String(rawRow[columnMapping.alt_mobile_number] || '').trim();
      const email = String(rawRow[columnMapping.email_id] || '').trim();
      const doj = String(rawRow[columnMapping.date_of_joining] || '').trim() || new Date().toISOString().split('T')[0];
      const dept = String(rawRow[columnMapping.department] || '').trim() || 'Operations';
      const designation = String(rawRow[columnMapping.designation] || '').trim() || 'Employee';
      const branch = String(rawRow[columnMapping.branch] || '').trim() || 'Chennai Headquarters';
      const location = String(rawRow[columnMapping.location] || '').trim() || 'Chennai';
      const manager = String(rawRow[columnMapping.reporting_manager || columnMapping.manager] || '').trim();
      const teamLeader = String(rawRow[columnMapping.team_leader] || '').trim();
      const address = String(rawRow[columnMapping.hr_current_address] || '').trim();
      const city = String(rawRow[columnMapping.hr_city] || '').trim() || 'Chennai';
      const state = String(rawRow[columnMapping.hr_state] || '').trim() || 'Tamil Nadu';
      const pincode = String(rawRow[columnMapping.hr_pincode] || '').trim() || '600001';
      const permAddress = String(rawRow[columnMapping.hr_permanent_address] || '').trim();

      // Check validation constraints
      if (!empId) {
        failedRecords.push({ rowNumber, employeeId: 'N/A', employeeName: empName, reason: 'Employee ID is missing.' });
        continue;
      }

      if (seenInFileIdSet.has(empId)) {
        failedRecords.push({ rowNumber, employeeId: empId, employeeName: empName, reason: 'Duplicate Employee ID within uploaded file.' });
        continue;
      }
      seenInFileIdSet.add(empId);

      if (existingIdSet.has(empId)) {
        failedRecords.push({ rowNumber, employeeId: empId, employeeName: empName, reason: 'Employee ID already exists in Employee Master.' });
        continue;
      }

      if (!empName) {
        failedRecords.push({ rowNumber, employeeId: empId, employeeName: 'N/A', reason: 'Employee Name is required.' });
        continue;
      }

      if (!mobile) {
        failedRecords.push({ rowNumber, employeeId: empId, employeeName: empName, reason: 'Mobile Number is required.' });
        continue;
      }

      if (!address) {
        failedRecords.push({ rowNumber, employeeId: empId, employeeName: empName, reason: 'Current Address is required.' });
        continue;
      }

      validRecords.push({
        empId,
        empName,
        mobile,
        altMobile,
        email: email || `${empId.toLowerCase()}@collman.com`,
        doj,
        dept,
        designation,
        branch,
        location,
        manager,
        teamLeader,
        address,
        city,
        state,
        pincode,
        permAddress
      });
    }

    // Insert valid records
    for (const rec of validRecords) {
      await query.run(
        `INSERT INTO employees (
          employee_id, employee_name, mobile_number, alt_mobile_number, email_id, date_of_joining,
          department, designation, branch, location, reporting_manager, team_leader,
          hr_current_address, hr_city, hr_state, hr_pincode, hr_permanent_address,
          verification_status, tat_deadline, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started', datetime('now', '+' || ? || ' days'), ?)`,
        [
          rec.empId, rec.empName, rec.mobile, rec.altMobile || null, rec.email, rec.doj,
          rec.dept, rec.designation, rec.branch, rec.location, rec.manager || null, rec.teamLeader || null,
          rec.address, rec.city, rec.state, rec.pincode, rec.permAddress || null,
          employeeTatDays, req.user.full_name
        ]
      );

      await query.run(
        `INSERT INTO verification_progress (employee_id, attempt_number, current_step, submitted_address)
         VALUES (?, 1, 1, ?)`,
        [rec.empId, rec.address]
      );
    }

    // If there are failed records, automatically generate an Excel report into internal Download Area
    let failedExport = null;
    if (failedRecords.length > 0) {
      failedExport = await generateExcelReport({
        fileNamePrefix: 'Bulk_Upload_Failed_Records',
        category: 'Bulk Upload Failures',
        sheetName: 'Failed Upload Records',
        columns: [
          { header: 'Row Number', key: 'rowNumber' },
          { header: 'Employee ID', key: 'employeeId' },
          { header: 'Employee Name', key: 'employeeName' },
          { header: 'Failure Reason', key: 'reason' }
        ],
        data: failedRecords,
        generatedBy: req.user.full_name
      });
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('HR', ?, ?, 'Bulk Upload Employees', ?)`,
      [
        req.user.id.toString(),
        req.user.full_name,
        `Processed bulk upload: ${validRecords.length} added, ${failedRecords.length} failed out of ${rows.length} records`
      ]
    );

    // Automatically enqueue all valid employee addresses for 100% automatic background geocoding
    if (validRecords.length > 0) {
      const importedIds = validRecords.map(r => r.empId);
      enqueueEmployees(importedIds).catch(e => console.warn('[AUTOMATIC GEOCODING] Bulk enqueue error:', e));
    }

    const queueStats = await getQueueStats();

    res.json({
      success: true,
      totalRecords: rows.length,
      validRecords: validRecords.length,
      failedRecords: failedRecords.length,
      failedList: failedRecords,
      failedExportFile: failedExport ? failedExport.fileName : null,
      geocodingQueue: queueStats,
      message: `Bulk upload completed: ${validRecords.length} employees imported and queued for automatic background geolocation.`
    });
  } catch (err) {
    console.error('Process bulk upload error:', err);
    res.status(500).json({ error: 'Bulk upload processing failed.' });
  }
});

// PUT /api/employees/:id - Update Employee Details (Admin Only)
router.put('/:id', authenticateAdmin, requirePermission('edit_employee'), async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await query.get(
      'SELECT * FROM employees WHERE employee_id = ? OR id = ?',
      [id, id]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (isTeamLeader(req.user) && employee.assigned_reviewer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access restricted: You cannot edit employee records not assigned to you.' });
    }

    const empId = employee.employee_id;

    const {
      employeeName,
      mobileNumber,
      altMobileNumber,
      emailId,
      dateOfJoining,
      department,
      designation,
      branch,
      location,
      reportingManager,
      manager,
      teamLeader,
      currentAddress,
      addressLine1,
      addressLine2,
      area,
      landmark,
      city,
      district,
      state,
      pincode,
      permanentAddress,
      permanentPincode
    } = req.body;

    if (!employeeName || !mobileNumber || !dateOfJoining || !department || !branch || !currentAddress || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Please provide all mandatory employee and address fields.' });
    }

    const name = employeeName.trim();
    const phone = mobileNumber.trim();
    const altPhone = altMobileNumber !== undefined ? (altMobileNumber ? altMobileNumber.trim() : null) : employee.alt_mobile_number;
    const email = emailId !== undefined ? (emailId ? emailId.trim() : '') : (employee.email_id || '');
    const doj = dateOfJoining.trim();
    const dept = department.trim();
    const desig = designation ? designation.trim() : 'Employee';
    const br = branch.trim();
    const loc = location ? location.trim() : city.trim();
    const repMgr = reportingManager !== undefined
      ? (reportingManager ? reportingManager.trim() : null)
      : (manager !== undefined ? (manager ? manager.trim() : null) : employee.reporting_manager);
    const tl = teamLeader !== undefined
      ? (teamLeader ? teamLeader.trim() : null)
      : employee.team_leader;

    // Strict validation: Verify Manager - Team Leader reporting relationship
    if (repMgr && tl) {
      const mgrUser = await query.get(
        `SELECT id, username, full_name FROM users
         WHERE (LOWER(role) = 'manager' OR role = 'MANAGER')
           AND (CAST(id AS TEXT) = ? OR LOWER(username) = LOWER(?) OR LOWER(full_name) = LOWER(?))
           AND is_active = 1`,
        [repMgr, repMgr, repMgr]
      );

      const tlUser = await query.get(
        `SELECT id, username, full_name, manager FROM users
         WHERE role = 'Team Leader'
           AND (CAST(id AS TEXT) = ? OR LOWER(username) = LOWER(?) OR LOWER(full_name) = LOWER(?))`,
        [tl, tl, tl]
      );

      if (mgrUser && tlUser && tlUser.manager) {
        const matches = (
          tlUser.manager.toLowerCase().trim() === mgrUser.full_name.toLowerCase().trim() ||
          tlUser.manager.toLowerCase().trim() === mgrUser.username.toLowerCase().trim() ||
          tlUser.manager.toString() === mgrUser.id.toString()
        );

        if (!matches) {
          return res.status(400).json({
            error: `Validation error: Selected Team Leader '${tlUser.full_name}' does not report to Manager '${mgrUser.full_name}'.`
          });
        }
      }
    }

    // Strict validation: Verify Branch - Location relationship
    if (br && loc) {
      const branchRecord = await query.get(
        'SELECT id, branch_name FROM branches WHERE LOWER(TRIM(branch_name)) = LOWER(TRIM(?)) OR UPPER(TRIM(branch_code)) = UPPER(TRIM(?))',
        [br, br]
      );
      if (branchRecord) {
        const configuredLocs = await query.all(
          'SELECT id, location_name, is_active FROM locations WHERE branch_id = ?',
          [branchRecord.id]
        );
        if (configuredLocs.length > 0) {
          const locMatch = configuredLocs.find(
            (l) => l.location_name.toLowerCase().trim() === loc.toLowerCase().trim()
          );
          if (!locMatch) {
            return res.status(400).json({
              error: `Validation error: Location '${loc}' does not belong to branch '${branchRecord.branch_name}'.`
            });
          }
        }
      }
    }

    let assignedReviewerId = employee.assigned_reviewer_id;
    if (tl) {
      const tlUser = await query.get(
        "SELECT id FROM users WHERE (full_name = ? OR username = ?) AND role = 'Team Leader'",
        [tl, tl]
      );
      if (tlUser) {
        assignedReviewerId = tlUser.id;
      }
    }

    const addr = currentAddress.trim();
    const line1 = addressLine1 ? addressLine1.trim() : null;
    const line2 = addressLine2 ? addressLine2.trim() : null;
    const ar = area ? area.trim() : null;
    const lmark = landmark ? landmark.trim() : null;
    const c = city.trim();
    const dist = district ? district.trim() : null;
    const s = state.trim();
    const pin = pincode.trim();
    const permAddr = permanentAddress ? permanentAddress.trim() : null;
    const permPin = permanentPincode ? permanentPincode.trim() : null;

    // Check if address changed
    const addressChanged = (
      addr !== employee.hr_current_address ||
      c !== employee.hr_city ||
      s !== employee.hr_state ||
      pin !== employee.hr_pincode
    );

    await query.run(
      `UPDATE employees SET
        employee_name = ?,
        mobile_number = ?,
        alt_mobile_number = ?,
        email_id = ?,
        date_of_joining = ?,
        department = ?,
        designation = ?,
        branch = ?,
        location = ?,
        reporting_manager = ?,
        team_leader = ?,
        assigned_reviewer_id = ?,
        hr_current_address = ?,
        hr_address_line1 = ?,
        hr_address_line2 = ?,
        hr_area = ?,
        hr_landmark = ?,
        hr_city = ?,
        hr_district = ?,
        hr_state = ?,
        hr_pincode = ?,
        hr_permanent_address = ?,
        hr_permanent_pincode = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = ?`,
      [
        name, phone, altPhone, email, doj,
        dept, desig, br, loc, repMgr, tl, assignedReviewerId,
        addr, line1, line2, ar, lmark,
        c, dist, s, pin, permAddr, permPin,
        req.user.full_name,
        empId
      ]
    );

    // If address changed, update verification_progress submitted_address and re-trigger geocoding
    if (addressChanged) {
      await query.run(
        `UPDATE verification_progress 
         SET submitted_address = ?, last_saved_at = CURRENT_TIMESTAMP
         WHERE employee_id = ? AND current_step <= 2`,
        [addr, empId]
      );

      // Re-enqueue for automatic geocoding
      enqueueEmployees(empId).catch(e => console.warn('[AUTOMATIC GEOCODING] Re-enqueue error on update:', e));
    }

    // Insert audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, employee_id, ip_address, details)
       VALUES ('HR', ?, ?, 'Employee Record Updated', ?, ?, ?)`,
      [
        req.user.id.toString(),
        req.user.full_name,
        empId,
        req.ip,
        `Updated details for employee ${name} (${empId}).${addressChanged ? ' HR address updated and re-queued for geolocation.' : ''}`
      ]
    );

    const updatedEmployee = await query.get(
      'SELECT * FROM employees WHERE employee_id = ?',
      [empId]
    );

    res.json({
      success: true,
      message: `Employee ${name} (${empId}) updated successfully.`,
      employee: updatedEmployee
    });
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ error: 'Failed to update employee details.' });
  }
});

// DELETE /api/employees/:id - Permanently Delete Employee & Associated Cases (Admin Only)
router.delete('/:id', authenticateAdmin, requirePermission('delete_employee'), async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await query.get(
      'SELECT id, employee_id, employee_name FROM employees WHERE employee_id = ? OR id = ?',
      [id, id]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (isTeamLeader(req.user) && employee.assigned_reviewer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access restricted: You cannot delete employee records not assigned to you.' });
    }

    const empId = employee.employee_id;

    // Remove evidence files from uploads folder
    const evidenceFiles = await query.all(
      'SELECT file_path FROM verification_evidence WHERE employee_id = ?',
      [empId]
    );
    for (const ev of evidenceFiles) {
      try {
        if (ev.file_path && fs.existsSync(ev.file_path)) {
          fs.unlinkSync(ev.file_path);
        }
      } catch (fErr) {
        console.warn('Could not delete evidence file:', ev.file_path, fErr);
      }
    }

    // Cascade delete in correct foreign key order
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM verification_attempts WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM verification_timeline WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM download_area_files WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM employees WHERE employee_id = ?', [empId]);

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, employee_id, ip_address, details)
       VALUES ('User', ?, ?, 'Employee Record Deleted', ?, ?, ?)`,
      [
        req.user.id.toString(),
        req.user.full_name,
        empId,
        req.ip,
        `Permanently deleted employee ${employee.employee_name} (${empId}) and all associated verification records.`
      ]
    );

    res.json({
      success: true,
      message: `Employee ${employee.employee_name} (${empId}) and all associated verification records were deleted.`
    });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ error: 'Failed to delete employee record.' });
  }
});

module.exports = router;
