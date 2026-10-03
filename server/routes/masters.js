const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles } = require('../middleware/auth');

// GET /api/masters/dashboard-stats - Dynamic aggregated counts for clickable dashboard cards with filter support
router.get('/dashboard-stats', authenticateAdmin, async (req, res) => {
  try {
    const { branch, department, location, state, reviewerId, startDate, endDate } = req.query;

    let whereClauses = [];
    let params = [];

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
    if (reviewerId && reviewerId !== 'ALL') {
      whereClauses.push('e.assigned_reviewer_id = ?');
      params.push(reviewerId);
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

    const statsRow = await query.get(
      `SELECT
        COUNT(e.id) as totalEmployees,
        SUM(CASE WHEN e.verification_status IN ('Not Started', 'In Progress', 'Reverification Required', 'More Information Required') THEN 1 ELSE 0 END) as verificationPending,
        SUM(CASE WHEN e.verification_status = 'Not Started' THEN 1 ELSE 0 END) as notStarted,
        SUM(CASE WHEN e.verification_status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN e.verification_status IN ('Submitted', 'Pending BGV Review') THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN e.verification_status = 'Pending BGV Review' THEN 1 ELSE 0 END) as pendingBgvReview,
        SUM(CASE WHEN e.verification_status = 'Verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN e.verification_status = 'Verification Failed' THEN 1 ELSE 0 END) as verificationFailed,
        SUM(CASE WHEN e.verification_status = 'Reverification Required' THEN 1 ELSE 0 END) as reverificationRequired,
        SUM(CASE WHEN e.verification_status = 'More Information Required' THEN 1 ELSE 0 END) as moreInfoRequired,
        SUM(CASE WHEN vp.address_proof_uploaded = 0 AND e.verification_status != 'Verified' THEN 1 ELSE 0 END) as documentsPending,
        SUM(CASE WHEN (e.tat_deadline IS NULL OR datetime('now') <= datetime(e.tat_deadline)) AND e.verification_status NOT IN ('Verified', 'Verification Failed') THEN 1 ELSE 0 END) as withinTat,
        SUM(CASE WHEN e.tat_deadline IS NOT NULL AND datetime('now') > datetime(e.tat_deadline) AND e.verification_status NOT IN ('Verified', 'Verification Failed') THEN 1 ELSE 0 END) as tatBreached
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       LEFT JOIN verification_progress vp ON e.employee_id = vp.employee_id
       ${whereSql}`,
      params
    );

    // Recent activity
    const recentActivity = await query.all(
      `SELECT al.* FROM audit_logs al ORDER BY al.created_at DESC LIMIT 8`
    );

    res.json({
      stats: {
        totalEmployees: statsRow.totalEmployees || 0,
        verificationPending: statsRow.verificationPending || 0,
        notStarted: statsRow.notStarted || 0,
        inProgress: statsRow.inProgress || 0,
        submitted: statsRow.submitted || 0,
        pendingBgvReview: statsRow.pendingBgvReview || 0,
        verified: statsRow.verified || 0,
        verificationFailed: statsRow.verificationFailed || 0,
        reverificationRequired: statsRow.reverificationRequired || 0,
        moreInfoRequired: statsRow.moreInfoRequired || 0,
        documentsPending: statsRow.documentsPending || 0,
        withinTat: statsRow.withinTat || 0,
        tatBreached: statsRow.tatBreached || 0
      },
      recentActivity
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to calculate dashboard statistics.' });
  }
});

// GET /api/masters/all - Load all master lookup datasets in a single call for fast UI rendering
router.get('/all', authenticateAdmin, async (req, res) => {
  try {
    const branches = await query.all('SELECT * FROM branches WHERE is_active = 1 ORDER BY branch_name ASC');
    const departments = await query.all('SELECT * FROM departments WHERE is_active = 1 ORDER BY department_name ASC');
    const locations = await query.all('SELECT * FROM locations WHERE is_active = 1 ORDER BY location_name ASC');
    const docTypes = await query.all('SELECT * FROM document_types WHERE is_active = 1 ORDER BY type_name ASC');
    const failureReasons = await query.all('SELECT * FROM failure_reasons WHERE is_active = 1 ORDER BY reason_title ASC');
    const settings = await query.all('SELECT * FROM app_settings');
    const reviewers = await query.all(
      "SELECT id, full_name, email, branch FROM users WHERE role IN ('BGV Reviewer', 'Super Admin') AND is_active = 1"
    );

    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    res.json({
      branches,
      departments,
      locations,
      docTypes,
      failureReasons,
      settings: settingsMap,
      reviewers
    });
  } catch (err) {
    console.error('Load masters error:', err);
    res.status(500).json({ error: 'Failed to load master lookup data.' });
  }
});

// Masters CRUD
// Branches
router.post('/branches', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { branch_code, branch_name, city, state } = req.body;
    await query.run(
      'INSERT INTO branches (branch_code, branch_name, city, state) VALUES (?, ?, ?, ?)',
      [branch_code.trim(), branch_name.trim(), city.trim(), state.trim()]
    );
    res.json({ success: true, message: 'Branch added successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add branch. Code must be unique.' });
  }
});

// Departments
router.post('/departments', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { department_code, department_name } = req.body;
    await query.run(
      'INSERT INTO departments (department_code, department_name) VALUES (?, ?)',
      [department_code.trim(), department_name.trim()]
    );
    res.json({ success: true, message: 'Department added successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add department. Code must be unique.' });
  }
});

// Document Types
router.post('/document-types', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { type_name, description, is_mandatory } = req.body;
    await query.run(
      'INSERT INTO document_types (type_name, description, is_mandatory) VALUES (?, ?, ?)',
      [type_name.trim(), description || '', is_mandatory ? 1 : 0]
    );
    res.json({ success: true, message: 'Document type added.' });
  } catch (err) {
    res.status(400).json({ error: 'Document type already exists.' });
  }
});

// Failure Reasons
router.post('/failure-reasons', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { reason_code, reason_title, description } = req.body;
    await query.run(
      'INSERT INTO failure_reasons (reason_code, reason_title, description) VALUES (?, ?, ?)',
      [reason_code.trim(), reason_title.trim(), description || '']
    );
    res.json({ success: true, message: 'Failure reason added.' });
  } catch (err) {
    res.status(400).json({ error: 'Failure reason code must be unique.' });
  }
});

// Settings Update
router.put('/settings', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { settings } = req.body; // Key-value object
    for (const [key, value] of Object.entries(settings)) {
      await query.run(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value)]
      );
    }

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Settings Updated', 'Updated application parameters')`,
      [req.user.id.toString(), req.user.full_name]
    );

    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

module.exports = router;
