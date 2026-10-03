const express = require('express');
const router = express.Router();
const fs = require('fs');
const XLSX = require('xlsx');
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { generateExcelReport } = require('../utils/excelGenerator');
const { enqueueEmployees, getQueueStats } = require('../utils/geocodingQueue');

// GET /api/employees - Query Employee Master with filters, search, pagination
router.get('/', authenticateAdmin, async (req, res) => {
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

// GET /api/employees/:id - Retrieve single employee detail & verification history
router.get('/:id', authenticateAdmin, async (req, res) => {
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
router.post('/', authenticateAdmin, requireRoles('Super Admin', 'HR/Admin'), async (req, res) => {
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

    if (!employeeId || !employeeName || !mobileNumber || !emailId || !dateOfJoining || !department || !branch || !currentAddress || !city || !state || !pincode) {
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

    // Default TAT calculation (3 days for employee)
    const tatSetting = await query.get("SELECT value FROM app_settings WHERE key='employee_tat_days'");
    const employeeTatDays = parseInt(tatSetting ? tatSetting.value : '3', 10);

    const result = await query.run(
      `INSERT INTO employees (
        employee_id, employee_name, mobile_number, alt_mobile_number, email_id, date_of_joining,
        department, designation, branch, location, reporting_manager,
        hr_current_address, hr_address_line1, hr_address_line2, hr_area, hr_landmark,
        hr_city, hr_district, hr_state, hr_pincode, hr_permanent_address, hr_permanent_pincode,
        hr_latitude, hr_longitude, verification_status, tat_deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started', datetime('now', '+' || ? || ' days'), ?)`,
      [
        cleanId, employeeName.trim(), mobileNumber.trim(), altMobileNumber || null, emailId.trim(), dateOfJoining,
        department, designation || 'Employee', branch, location || city, reportingManager || null,
        currentAddress.trim(), addressLine1 || null, addressLine2 || null, area || null, landmark || null,
        city.trim(), district || null, state.trim(), pincode.trim(), permanentAddress || null, permanentPincode || null,
        latitude || null, longitude || null, employeeTatDays, req.user.full_name
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
router.post('/parse-bulk-file', authenticateAdmin, requireRoles('Super Admin', 'HR/Admin'), upload.single('file'), async (req, res) => {
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
    const sampleRows = rows.slice(1, 6).map((row) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? String(row[idx]) : '';
      });
      return obj;
    });

    const totalDataRows = rows.length - 1;

    res.json({
      filePath: req.file.path,
      fileName: req.file.originalname,
      headers,
      sampleRows,
      totalRows: totalDataRows
    });
  } catch (err) {
    console.error('Parse file error:', err);
    res.status(500).json({ error: 'Failed to parse the uploaded file.' });
  }
});

// POST /api/employees/process-bulk-upload - Validate, check duplicates, and import with column mapping
router.post('/process-bulk-upload', authenticateAdmin, requireRoles('Super Admin', 'HR/Admin'), async (req, res) => {
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
      const manager = String(rawRow[columnMapping.reporting_manager] || '').trim();
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
          department, designation, branch, location, reporting_manager,
          hr_current_address, hr_city, hr_state, hr_pincode, hr_permanent_address,
          verification_status, tat_deadline, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Started', datetime('now', '+' || ? || ' days'), ?)`,
        [
          rec.empId, rec.empName, rec.mobile, rec.altMobile || null, rec.email, rec.doj,
          rec.dept, rec.designation, rec.branch, rec.location, rec.manager || null,
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

// DELETE /api/employees/:id - Permanently Delete Employee & Associated Cases (Admin Only)
router.delete('/:id', authenticateAdmin, requireRoles('Super Admin', 'HR/Admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await query.get(
      'SELECT id, employee_id, employee_name FROM employees WHERE employee_id = ? OR id = ?',
      [id, id]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
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
