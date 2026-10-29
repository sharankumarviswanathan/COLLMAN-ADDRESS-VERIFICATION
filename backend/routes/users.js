const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles, requirePermission, checkUserHasPermission } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Forward /roles to roles router
router.use('/roles', require('./roles'));

// GET /api/users - List internal users
router.get('/', authenticateAdmin, requirePermission('view_users', 'manage_users'), async (req, res) => {
  try {
    const { search, role, branch, status } = req.query;
    let whereClauses = [];
    let params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(username LIKE ? OR full_name LIKE ? OR manager LIKE ? OR email LIKE ? OR branch LIKE ? OR department LIKE ?)');
      params.push(term, term, term, term, term, term);
    }

    if (role && role !== 'ALL') {
      whereClauses.push('role = ?');
      params.push(role);
    }

    if (branch && branch !== 'ALL') {
      whereClauses.push('branch = ?');
      params.push(branch);
    }

    if (status && status !== 'ALL') {
      whereClauses.push('is_active = ?');
      params.push(status.toUpperCase() === 'ACTIVE' || status === '1' ? 1 : 0);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const users = await query.all(
      `SELECT id, username, email, full_name, role, branch, department, manager, is_active, created_at
       FROM users
       ${whereSql}
       ORDER BY created_at DESC`,
      params
    );
    res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// POST /api/users - Create new internal user
router.post('/', authenticateAdmin, requirePermission('create_user', 'manage_users'), async (req, res) => {
  try {
    const { username, employee_id, employeeId, email, password, full_name, role, branch, department, manager } = req.body;
    const rawId = (employee_id || employeeId || username || '').trim();

    if (!rawId || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Employee ID, full name, role, and password are required.' });
    }

    const cleanRole = role.trim();
    const roleExists = await query.get('SELECT id FROM roles WHERE role_name = ? AND is_active = 1', [cleanRole]);
    if (!roleExists && !['Super Admin', 'HR/Admin', 'BGV Reviewer', 'View Only'].includes(cleanRole)) {
      return res.status(400).json({ error: `Role '${cleanRole}' does not exist or is inactive.` });
    }

    const cleanUsername = rawId.toLowerCase();
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const cleanManager = manager ? manager.trim() : null;

    // Check duplicate employee ID
    const existing = await query.get(
      'SELECT id FROM users WHERE LOWER(username) = ?',
      [cleanUsername]
    );

    if (existing) {
      return res.status(400).json({ error: 'Employee ID already exists.' });
    }

    // Check duplicate email if provided
    if (cleanEmail) {
      const existingEmail = await query.get(
        'SELECT id FROM users WHERE LOWER(email) = ?',
        [cleanEmail]
      );
      if (existingEmail) {
        return res.status(400).json({ error: 'Email address already exists.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query.run(
      `INSERT INTO users (username, email, password_hash, full_name, role, branch, department, manager)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanUsername, cleanEmail, passwordHash, full_name.trim(), role, branch || null, department || null, cleanManager]
    );

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES (?, ?, ?, 'User Created', ?)`,
      [req.user.role, req.user.id.toString(), req.user.full_name, `Created user ${cleanUsername} with role ${role}`]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      userId: result.lastID
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PUT /api/users/:id - Edit user or toggle active status
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, role, branch, department, manager, is_active, newPassword } = req.body;

    const user = await query.get('SELECT id, username, email, full_name, role, branch, department, manager, is_active FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check status toggle permissions
    if (is_active !== undefined && is_active !== user.is_active) {
      if (is_active) {
        if (!checkUserHasPermission(req.user, 'activate_user', 'manage_users')) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to Activate user accounts.' });
        }
      } else {
        if (!checkUserHasPermission(req.user, 'deactivate_user', 'manage_users')) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to Deactivate user accounts.' });
        }
      }
    }

    // Check profile edit permissions if fields other than is_active are being updated
    const isProfileModified = (
      (full_name && full_name.trim() !== user.full_name) ||
      (email !== undefined && email !== user.email) ||
      (role && role !== user.role) ||
      (branch !== undefined && branch !== user.branch) ||
      (department !== undefined && department !== user.department) ||
      (manager !== undefined && manager !== user.manager) ||
      (newPassword && newPassword.trim())
    );

    if (isProfileModified) {
      if (!checkUserHasPermission(req.user, 'edit_user', 'manage_users')) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to Edit user account details.' });
      }
    }

    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : (email === '' ? null : user.email);
    const cleanName = full_name ? full_name.trim() : user.full_name;
    const cleanRole = role ? role.trim() : user.role;
    const cleanManager = manager !== undefined ? (manager ? manager.trim() : null) : user.manager;

    // Check email collision with other users if email provided
    if (cleanEmail) {
      const duplicateEmail = await query.get(
        'SELECT id FROM users WHERE LOWER(email) = ? AND id != ?',
        [cleanEmail, id]
      );
      if (duplicateEmail) {
        return res.status(400).json({ error: 'Email address is already in use by another user account.' });
      }
    }

    let passwordSql = '';
    let params = [
      cleanEmail,
      cleanName,
      cleanRole,
      branch !== undefined ? branch : user.branch,
      department !== undefined ? department : user.department,
      cleanManager,
      is_active !== undefined ? (is_active ? 1 : 0) : user.is_active
    ];

    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }
      const hash = await bcrypt.hash(newPassword.trim(), 10);
      passwordSql = ', password_hash = ?';
      params.push(hash);
    }

    params.push(id);

    await query.run(
      `UPDATE users SET
        email = ?, full_name = ?, role = ?, branch = ?, department = ?, manager = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        ${passwordSql}
       WHERE id = ?`,
      params
    );

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES (?, ?, ?, 'User Modified', ?)`,
      [req.user.role, req.user.id.toString(), req.user.full_name, `Updated user details for ${user.username} (${cleanName})`]
    );

    const updatedUser = await query.get(
      'SELECT id, username, email, full_name, role, branch, department, manager, is_active, created_at FROM users WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: `User ${user.username} updated successfully.`,
      user: updatedUser
    });
  } catch (err) {
    console.error('Edit user error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// DELETE /api/users/:id - Delete user account
router.delete('/:id', authenticateAdmin, requirePermission('delete_user', 'manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await query.get('SELECT id, username, full_name, role FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (Number(id) === 1 || user.username.toLowerCase() === 'admin') {
      return res.status(400).json({ error: 'System Super Administrator cannot be deleted.' });
    }

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({ error: 'You cannot delete your own user account.' });
    }

    await query.run('DELETE FROM users WHERE id = ?', [id]);

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES (?, ?, ?, 'User Deleted', ?)`,
      [req.user.role, req.user.id.toString(), req.user.full_name, `Deleted user account ${user.username} (${user.full_name})`]
    );

    res.json({
      success: true,
      message: `User ${user.username} (${user.full_name}) deleted successfully.`
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// GET /api/users/export - Export full system user directory as Excel (.xlsx) or CSV
router.get('/export', authenticateAdmin, requirePermission('view_users', 'manage_users'), async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const { search, role, branch, status } = req.query;
    let whereClauses = [];
    let params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(username LIKE ? OR full_name LIKE ? OR manager LIKE ? OR email LIKE ? OR branch LIKE ? OR department LIKE ?)');
      params.push(term, term, term, term, term, term);
    }
    if (role && role !== 'ALL') {
      whereClauses.push('role = ?');
      params.push(role);
    }
    if (branch && branch !== 'ALL') {
      whereClauses.push('branch = ?');
      params.push(branch);
    }
    if (status && status !== 'ALL') {
      whereClauses.push('is_active = ?');
      params.push(status.toUpperCase() === 'ACTIVE' || status === '1' ? 1 : 0);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const users = await query.all(
      `SELECT id, username, email, full_name, role, branch, department, manager, is_active, created_at
       FROM users
       ${whereSql}
       ORDER BY full_name ASC`,
      params
    );

    const exportRows = users.map((u, idx) => ({
      '#': idx + 1,
      'Full Name': u.full_name || '',
      'Employee ID': u.username || '',
      'Email': u.email || '',
      'Manager': u.manager || '',
      'Portal Role': u.role || '',
      'Assigned Branch': u.branch || '',
      'Department': u.department || '',
      'Account Status': u.is_active ? 'Active' : 'Inactive',
      'Member Since': u.created_at ? u.created_at.split(' ')[0] : ''
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Collman_Users_Directory_${dateStr}.${format === 'csv' ? 'csv' : 'xlsx'}`;

    if (format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send('\uFEFF' + csv);
    }

    // Default Excel (.xlsx)
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 6 },  // #
      { wch: 28 }, // Full Name
      { wch: 16 }, // Employee ID
      { wch: 28 }, // Email
      { wch: 24 }, // Manager
      { wch: 20 }, // Portal Role
      { wch: 24 }, // Assigned Branch
      { wch: 24 }, // Department
      { wch: 16 }, // Account Status
      { wch: 16 }  // Member Since
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'User Accounts Directory');

    // Register in internal Download Area as well
    try {
      const downloadsDir = path.join(__dirname, '..', 'downloads');
      if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
      const filePath = path.join(downloadsDir, fileName);
      XLSX.writeFile(wb, filePath);
      const stats = fs.statSync(filePath);
      await query.run(
        `INSERT INTO download_area_files (file_name, file_type, category, file_path, file_size, generated_by)
         VALUES (?, 'Excel', 'Analytics Report', ?, ?, ?)`,
        [fileName, filePath, stats.size, req.user?.full_name || 'Admin']
      );
    } catch (saveErr) {
      console.warn('Could not register user export into download area:', saveErr.message);
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Export users error:', err);
    res.status(500).json({ error: 'Failed to export user list.' });
  }
});

// GET /api/users/sample-template - Download Excel/CSV sample file for bulk user creation
router.get('/sample-template', authenticateAdmin, async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();

    const sampleData = [
      {
        'Full Name': 'Anand Sharma',
        'Employee ID': 'COL00101',
        'Portal Role': 'HR/Admin',
        'Initial Password': 'ChangeMe@123',
        'Manager': 'Reporting Manager',
        'Branch': 'Chennai Headquarters',
        'Department': 'Human Resources'
      },
      {
        'Full Name': 'Priya Raman',
        'Employee ID': 'COL00102',
        'Portal Role': 'BGV Reviewer',
        'Initial Password': 'ChangeMe@123',
        'Manager': 'Anjali Sharma',
        'Branch': 'Chennai Headquarters',
        'Department': 'Quality & Operations'
      },
      {
        'Full Name': 'Rajesh Kumar',
        'Employee ID': 'COL00103',
        'Portal Role': 'Team Leader',
        'Initial Password': 'ChangeMe@123',
        'Manager': 'SARANGAN',
        'Branch': 'Chennai Headquarters',
        'Department': 'Operations'
      },
      {
        'Full Name': 'Karthik N',
        'Employee ID': 'COL00104',
        'Portal Role': 'View Only',
        'Initial Password': 'ChangeMe@123',
        'Manager': 'Anjali Sharma',
        'Branch': 'Chennai Headquarters',
        'Department': 'Audit & Compliance'
      }
    ];

    if (format === 'csv') {
      const headers = Object.keys(sampleData[0]);
      const csvRows = [headers.join(',')];
      for (const row of sampleData) {
        csvRows.push(headers.map((h) => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="Collman_User_Bulk_Upload_Sample.csv"');
      return res.send(csvRows.join('\n'));
    }

    // Default to Excel (.xlsx)
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);

    ws['!cols'] = [
      { wch: 22 }, // Full Name
      { wch: 16 }, // Employee ID
      { wch: 18 }, // Portal Role
      { wch: 18 }, // Initial Password
      { wch: 22 }, // Manager
      { wch: 24 }, // Branch
      { wch: 22 }  // Department
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Users Template');

    // Add Reference / Help Sheet with active roles, branches, departments
    try {
      const activeRoles = await query.all('SELECT role_name FROM roles WHERE is_active = 1');
      const activeBranches = await query.all('SELECT branch_name FROM branches WHERE is_active = 1');
      const activeDepts = await query.all('SELECT department_name FROM departments WHERE is_active = 1');

      const refRows = [];
      const maxRows = Math.max(activeRoles.length, activeBranches.length, activeDepts.length, 5);

      const standardRoles = ['Super Admin', 'HR/Admin', 'BGV Reviewer', 'Team Leader', 'View Only'];
      const combinedRoles = Array.from(new Set([...standardRoles, ...activeRoles.map(r => r.role_name)]));

      for (let i = 0; i < maxRows; i++) {
        refRows.push({
          'Available Roles': combinedRoles[i] || '',
          'Configured Branches': activeBranches[i]?.branch_name || '',
          'Configured Departments': activeDepts[i]?.department_name || ''
        });
      }

      const refWs = XLSX.utils.json_to_sheet(refRows);
      refWs['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 26 }];
      XLSX.utils.book_append_sheet(wb, refWs, 'Valid Options Reference');
    } catch (refErr) {
      console.warn('Could not populate reference sheet:', refErr.message);
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Collman_User_Bulk_Upload_Sample.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Sample template error:', err);
    res.status(500).json({ error: 'Failed to generate sample template.' });
  }
});

// POST /api/users/parse-bulk-file - Upload and parse Excel/CSV to extract headers & preview
router.post('/parse-bulk-file', authenticateAdmin, requirePermission('create_user', 'manage_users'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an Excel (.xlsx, .xls) or CSV file.' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ error: 'Uploaded file is empty or missing data rows.' });
    }

    const headers = rows[0].map((h) => String(h || '').trim()).filter(Boolean);
    const allDataRows = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? String(row[idx]).trim() : '';
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
    console.error('Parse user bulk file error:', err);
    res.status(500).json({ error: 'Failed to parse uploaded user spreadsheet.' });
  }
});

// POST /api/users/process-bulk-upload - Validate, check duplicates, hash passwords, and insert
router.post('/process-bulk-upload', authenticateAdmin, requirePermission('create_user', 'manage_users'), async (req, res) => {
  try {
    const { filePath, columnMapping } = req.body;

    if (!filePath || !columnMapping) {
      return res.status(400).json({ error: 'File path and column mapping configuration are required.' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Uploaded file session has expired. Please re-upload your file.' });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (rows.length === 0) {
      try { fs.unlinkSync(filePath); } catch (e) {}
      return res.status(400).json({ error: 'No data rows found in the uploaded file.' });
    }

    // Fetch existing users and active roles for validation
    const existingUsers = await query.all('SELECT LOWER(username) as username FROM users');
    const existingUsernames = new Set(existingUsers.map((u) => u.username));

    const dbRoles = await query.all('SELECT role_name FROM roles WHERE is_active = 1');
    const validRolesSet = new Set([
      'super admin', 'hr/admin', 'hr admin', 'hr', 'bgv reviewer', 'reviewer', 'team leader', 'tl', 'view only', 'viewer',
      ...dbRoles.map((r) => r.role_name.toLowerCase())
    ]);

    const seenInBatch = new Set();
    const validRecords = [];
    const failedRecords = [];

    // Map and validate rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Row number in Excel (header is row 1)

      const full_name = String(row[columnMapping.full_name] || '').trim();
      const rawId = String(row[columnMapping.username || columnMapping.employee_id] || '').trim();
      const role = String(row[columnMapping.role] || '').trim();
      const password = String(row[columnMapping.password] || '').trim() || 'Collman@123';
      const manager = columnMapping.manager && row[columnMapping.manager] ? String(row[columnMapping.manager]).trim() : null;
      const branch = columnMapping.branch && row[columnMapping.branch] ? String(row[columnMapping.branch]).trim() : null;
      const department = columnMapping.department && row[columnMapping.department] ? String(row[columnMapping.department]).trim() : null;

      if (!full_name) {
        failedRecords.push({ row: rowNum, id: rawId || '—', name: '—', reason: 'Full Name is required' });
        continue;
      }
      if (!rawId) {
        failedRecords.push({ row: rowNum, id: '—', name: full_name, reason: 'Employee ID is required' });
        continue;
      }
      if (!role) {
        failedRecords.push({ row: rowNum, id: rawId, name: full_name, reason: 'Portal Role is required' });
        continue;
      }

      const cleanUsername = rawId.toLowerCase();

      if (existingUsernames.has(cleanUsername)) {
        failedRecords.push({ row: rowNum, id: rawId, name: full_name, reason: `Employee ID '${rawId}' already exists in system` });
        continue;
      }

      if (seenInBatch.has(cleanUsername)) {
        failedRecords.push({ row: rowNum, id: rawId, name: full_name, reason: `Duplicate Employee ID '${rawId}' repeated in this file` });
        continue;
      }

      // Check role validity (case-insensitive fallback)
      let resolvedRole = role;
      if (!validRolesSet.has(role.toLowerCase())) {
        failedRecords.push({ row: rowNum, id: rawId, name: full_name, reason: `Invalid role '${role}'. Role does not exist or is inactive.` });
        continue;
      } else {
        if (role.toLowerCase() === 'super admin') resolvedRole = 'Super Admin';
        else if (role.toLowerCase() === 'hr/admin' || role.toLowerCase() === 'hr admin' || role.toLowerCase() === 'hr') resolvedRole = 'HR/Admin';
        else if (role.toLowerCase() === 'bgv reviewer' || role.toLowerCase() === 'reviewer') resolvedRole = 'BGV Reviewer';
        else if (role.toLowerCase() === 'team leader' || role.toLowerCase() === 'tl') resolvedRole = 'Team Leader';
        else if (role.toLowerCase() === 'view only' || role.toLowerCase() === 'viewer') resolvedRole = 'View Only';
        else {
          const matched = dbRoles.find((r) => r.role_name.toLowerCase() === role.toLowerCase());
          if (matched) resolvedRole = matched.role_name;
        }
      }

      if (password.length < 6) {
        failedRecords.push({ row: rowNum, id: rawId, name: full_name, reason: 'Password must be at least 6 characters' });
        continue;
      }

      seenInBatch.add(cleanUsername);
      validRecords.push({
        cleanUsername,
        full_name,
        role: resolvedRole,
        password,
        manager,
        branch,
        department
      });
    }

    // Insert valid records
    let insertedCount = 0;
    for (const rec of validRecords) {
      const passwordHash = await bcrypt.hash(rec.password, 10);
      await query.run(
        `INSERT INTO users (username, full_name, password_hash, role, manager, branch, department, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [rec.cleanUsername, rec.full_name, passwordHash, rec.role, rec.manager, rec.branch, rec.department]
      );
      insertedCount++;
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES (?, ?, ?, 'Bulk User Upload', ?)`,
      [req.user.role, req.user.id.toString(), req.user.full_name, `Bulk created ${insertedCount} user accounts, ${failedRecords.length} skipped out of ${rows.length} rows`]
    );

    // Clean up temporary file
    try { fs.unlinkSync(filePath); } catch (e) {}

    res.json({
      success: true,
      totalRecords: rows.length,
      validRecords: insertedCount,
      failedRecords: failedRecords.length,
      errors: failedRecords,
      message: `Bulk user import completed: ${insertedCount} accounts created successfully.${failedRecords.length > 0 ? ` ${failedRecords.length} records were skipped.` : ''}`
    });
  } catch (err) {
    console.error('Process bulk user upload error:', err);
    res.status(500).json({ error: 'Bulk user upload processing failed: ' + (err.message || 'Server error') });
  }
});

module.exports = router;
