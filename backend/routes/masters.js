const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles, requirePermission, checkUserHasPermission, isTeamLeader } = require('../middleware/auth');
const { lookupLocationDetails } = require('../utils/geoUtils');

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

    // TL access restriction: TL only sees assigned employees
    if (isTeamLeader(req.user)) {
      whereClauses.push('e.assigned_reviewer_id = ?');
      params.push(req.user.id);
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
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const branchWhere = includeInactive ? '' : 'WHERE is_active = 1';
    const deptWhere = includeInactive ? '' : 'WHERE is_active = 1';
    const desigWhere = includeInactive ? '' : 'WHERE is_active = 1';
    const docWhere = includeInactive ? '' : 'WHERE is_active = 1';
    const failWhere = includeInactive ? '' : 'WHERE is_active = 1';

    const branches = await query.all(`SELECT * FROM branches ${branchWhere} ORDER BY is_active DESC, branch_name ASC`);
    const departments = await query.all(`SELECT * FROM departments ${deptWhere} ORDER BY is_active DESC, department_name ASC`);
    const designations = await query.all(`SELECT * FROM designations ${desigWhere} ORDER BY is_active DESC, designation_name ASC`);
    const docTypes = await query.all(`SELECT * FROM document_types ${docWhere} ORDER BY type_name ASC`);
    const locWhere = includeInactive ? '' : 'WHERE l.is_active = 1';
    const locations = await query.all(
      `SELECT l.*, b.branch_name, b.branch_code
       FROM locations l
       LEFT JOIN branches b ON l.branch_id = b.id
       ${locWhere}
       ORDER BY l.is_active DESC, l.location_name ASC`
    );
    const failureReasons = await query.all(`SELECT * FROM failure_reasons ${failWhere} ORDER BY reason_title ASC`);
    const settings = await query.all('SELECT * FROM app_settings');
    const reviewers = await query.all(
      "SELECT id, full_name, email, branch FROM users WHERE role IN ('BGV Reviewer', 'Super Admin') AND is_active = 1"
    );
    const teamLeaders = await query.all(
      "SELECT id, full_name, email, username FROM users WHERE role = 'Team Leader' AND is_active = 1 ORDER BY full_name ASC"
    );
    const managers = await query.all(
      "SELECT id, full_name, email, username FROM users WHERE (LOWER(role) = 'manager' OR role = 'MANAGER') AND is_active = 1 ORDER BY full_name ASC"
    );

    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    res.json({
      branches,
      departments,
      designations,
      locations,
      docTypes,
      failureReasons,
      settings: settingsMap,
      reviewers,
      teamLeaders,
      managers
    });
  } catch (err) {
    console.error('Load masters error:', err);
    res.status(500).json({ error: 'Failed to load master lookup data.' });
  }
});

// GET /api/masters/team-leaders - Fetch Team Leaders strictly filtered by reporting Manager
router.get('/team-leaders', authenticateAdmin, async (req, res) => {
  try {
    const { managerId, manager } = req.query;
    const mgrParam = (managerId || manager || '').trim();

    if (!mgrParam) {
      return res.json({ teamLeaders: [], manager: null });
    }

    // Resolve Manager in users table using ID, employee ID (username), or full_name
    const mgrUser = await query.get(
      `SELECT id, username, full_name, email FROM users
       WHERE (LOWER(role) = 'manager' OR role = 'MANAGER')
         AND (
           CAST(id AS TEXT) = ?
           OR LOWER(username) = LOWER(?)
           OR LOWER(full_name) = LOWER(?)
         )
         AND is_active = 1`,
      [mgrParam, mgrParam, mgrParam]
    );

    if (!mgrUser) {
      return res.json({ teamLeaders: [], manager: null });
    }

    // Fetch ONLY Team Leaders who report to this specific manager
    const teamLeaders = await query.all(
      `SELECT id, username, full_name, email, branch, department, manager
       FROM users
       WHERE role = 'Team Leader'
         AND is_active = 1
         AND (
           LOWER(TRIM(manager)) = LOWER(TRIM(?))
           OR LOWER(TRIM(manager)) = LOWER(TRIM(?))
           OR CAST(manager AS TEXT) = CAST(? AS TEXT)
         )
       ORDER BY full_name ASC`,
      [mgrUser.full_name, mgrUser.username, mgrUser.id]
    );

    // Deduplicate by username / id
    const uniqueTLs = [];
    const seen = new Set();
    for (const tl of teamLeaders) {
      const key = `${tl.id}_${tl.username}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTLs.push(tl);
      }
    }

    res.json({
      manager: {
        id: mgrUser.id,
        username: mgrUser.username,
        full_name: mgrUser.full_name
      },
      teamLeaders: uniqueTLs
    });
  } catch (err) {
    console.error('Fetch team leaders by manager error:', err);
    res.status(500).json({ error: 'Failed to fetch team leaders.' });
  }
});

// ==========================================
// Masters CRUD: Branches
// ==========================================

// GET /api/masters/lookup-location - Auto-lookup City and State from Branch name or location query
router.get('/lookup-location', authenticateAdmin, async (req, res) => {
  try {
    const rawQuery = (req.query.query || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ query: rawQuery, matches: [], isAmbiguous: false, reliableMatch: null });
    }

    // Check if google maps api key is configured
    let googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
      const gSetting = await query.get("SELECT value FROM app_settings WHERE key = 'google_maps_api_key'");
      if (gSetting && gSetting.value) googleApiKey = gSetting.value;
    }

    const result = await lookupLocationDetails(rawQuery, { googleApiKey });
    res.json(result);
  } catch (err) {
    console.error('Location lookup error:', err);
    res.status(500).json({ error: 'Failed to lookup location', matches: [], isAmbiguous: false, reliableMatch: null });
  }
});

// Create Branch
router.post('/branches', authenticateAdmin, requirePermission('create_masters', 'manage_masters'), async (req, res) => {
  try {
    const { branch_code, branch_name, city, state, is_active } = req.body || {};

    if (!branch_code || !branch_name || !city || !state) {
      return res.status(400).json({ error: 'Branch code, branch name, city, and state are required.' });
    }

    const code = branch_code.trim().toUpperCase();
    const name = branch_name.trim();
    const bCity = city.trim();
    const bState = state.trim();
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    // Check code uniqueness
    const existingCode = await query.get('SELECT id FROM branches WHERE UPPER(branch_code) = ?', [code]);
    if (existingCode) {
      return res.status(400).json({ error: `Branch code '${code}' already exists.` });
    }

    // Check name uniqueness
    const existingName = await query.get('SELECT id FROM branches WHERE LOWER(branch_name) = ?', [name.toLowerCase()]);
    if (existingName) {
      return res.status(400).json({ error: `Branch name '${name}' already exists.` });
    }

    const result = await query.run(
      'INSERT INTO branches (branch_code, branch_name, city, state, is_active) VALUES (?, ?, ?, ?, ?)',
      [code, name, bCity, bState, active]
    );

    const newBranchId = result.lastID;

    // Save initial locations if provided
    const { locations } = req.body || {};
    const createdLocations = [];
    if (Array.isArray(locations) && locations.length > 0) {
      for (const loc of locations) {
        const locName = (typeof loc === 'string' ? loc : loc.location_name || '').trim();
        if (locName) {
          const locCity = (typeof loc === 'object' && loc.city ? loc.city.trim() : bCity);
          const locState = (typeof loc === 'object' && loc.state ? loc.state.trim() : bState);
          const locActive = (typeof loc === 'object' && loc.is_active !== undefined) ? (loc.is_active ? 1 : 0) : 1;
          const locRes = await query.run(
            'INSERT INTO locations (branch_id, location_name, city, state, is_active) VALUES (?, ?, ?, ?, ?)',
            [newBranchId, locName, locCity, locState, locActive]
          );
          createdLocations.push({
            id: locRes.lastID,
            branch_id: newBranchId,
            location_name: locName,
            city: locCity,
            state: locState,
            is_active: locActive
          });
        }
      }
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Branch Created', ?)`,
      [req.user.id.toString(), req.user.full_name, `Created branch: ${name} (${code}) in ${bCity}, ${bState}${createdLocations.length ? ` with ${createdLocations.length} locations` : ''}`]
    );

    res.json({
      success: true,
      message: 'Branch added successfully.',
      branch: { id: newBranchId, branch_code: code, branch_name: name, city: bCity, state: bState, is_active: active },
      locations: createdLocations
    });
  } catch (err) {
    console.error('Add branch error:', err);
    res.status(400).json({ error: err.message || 'Failed to add branch.' });
  }
});

// Update Branch
router.put('/branches/:id', authenticateAdmin, requirePermission('edit_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const { branch_code, branch_name, city, state, is_active } = req.body || {};

    const branch = await query.get('SELECT * FROM branches WHERE id = ?', [id]);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    if (!branch_code || !branch_name || !city || !state) {
      return res.status(400).json({ error: 'Branch code, branch name, city, and state are required.' });
    }

    const code = branch_code.trim().toUpperCase();
    const name = branch_name.trim();
    const bCity = city.trim();
    const bState = state.trim();
    const active = is_active !== undefined ? (is_active ? 1 : 0) : branch.is_active;

    // Check code uniqueness excluding this record
    const duplicateCode = await query.get(
      'SELECT id FROM branches WHERE UPPER(branch_code) = ? AND id != ?',
      [code, id]
    );
    if (duplicateCode) {
      return res.status(400).json({ error: `Branch code '${code}' is already used by another branch.` });
    }

    // Check name uniqueness excluding this record
    const duplicateName = await query.get(
      'SELECT id FROM branches WHERE LOWER(branch_name) = ? AND id != ?',
      [name.toLowerCase(), id]
    );
    if (duplicateName) {
      return res.status(400).json({ error: `Branch name '${name}' is already used by another branch.` });
    }

    const oldName = branch.branch_name;

    await query.run(
      'UPDATE branches SET branch_code = ?, branch_name = ?, city = ?, state = ?, is_active = ? WHERE id = ?',
      [code, name, bCity, bState, active, id]
    );

    // Cascading update if branch_name changed: keep employees and users synchronized
    if (oldName !== name) {
      const empUpdate = await query.run('UPDATE employees SET branch = ? WHERE branch = ?', [name, oldName]);
      const userUpdate = await query.run('UPDATE users SET branch = ? WHERE branch = ?', [name, oldName]);
      console.log(`Cascaded branch rename '${oldName}' -> '${name}': ${empUpdate.changes} employees, ${userUpdate.changes} users updated.`);
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Branch Updated', ?)`,
      [req.user.id.toString(), req.user.full_name, `Updated branch ID ${id}: ${oldName} -> ${name} (${code})`]
    );

    // If locations array is provided in request body, synchronize locations for this branch
    const { locations } = req.body || {};
    if (Array.isArray(locations)) {
      const submittedIds = new Set(locations.filter((l) => l && l.id).map((l) => Number(l.id)));
      const currentLocs = await query.all('SELECT id, location_name FROM locations WHERE branch_id = ?', [id]);

      for (const curr of currentLocs) {
        if (!submittedIds.has(Number(curr.id))) {
          // Location was removed by the user
          const empCount = await query.get(
            'SELECT COUNT(*) as count FROM employees WHERE LOWER(TRIM(location)) = LOWER(TRIM(?))',
            [curr.location_name]
          );
          if (empCount?.count > 0) {
            await query.run('UPDATE locations SET branch_id = NULL, is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [curr.id]);
          } else {
            await query.run('DELETE FROM locations WHERE id = ?', [curr.id]);
          }
        }
      }

      // Insert any newly added unsaved locations
      for (const loc of locations) {
        if (!loc.id) {
          const locName = (typeof loc === 'string' ? loc : loc.location_name || '').trim();
          if (locName) {
            const locCity = (typeof loc === 'object' && loc.city ? loc.city.trim() : bCity);
            const locState = (typeof loc === 'object' && loc.state ? loc.state.trim() : bState);
            const locActive = (typeof loc === 'object' && loc.is_active !== undefined) ? (loc.is_active ? 1 : 0) : 1;
            await query.run(
              'INSERT INTO locations (branch_id, location_name, city, state, is_active) VALUES (?, ?, ?, ?, ?)',
              [id, locName, locCity, locState, locActive]
            );
          }
        }
      }
    }

    // Fetch updated locations linked to this branch
    const branchLocations = await query.all(
      'SELECT * FROM locations WHERE branch_id = ? ORDER BY is_active DESC, location_name ASC',
      [id]
    );

    res.json({
      success: true,
      message: 'Branch updated successfully.',
      branch: { id: Number(id), branch_code: code, branch_name: name, city: bCity, state: bState, is_active: active },
      locations: branchLocations
    });
  } catch (err) {
    console.error('Update branch error:', err);
    res.status(400).json({ error: err.message || 'Failed to update branch.' });
  }
});

// Delete / Deactivate Branch
router.delete('/branches/:id', authenticateAdmin, requirePermission('delete_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await query.get('SELECT * FROM branches WHERE id = ?', [id]);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    // Check employee dependencies
    const empCount = await query.get('SELECT COUNT(*) as count FROM employees WHERE branch = ?', [branch.branch_name]);
    const userCount = await query.get('SELECT COUNT(*) as count FROM users WHERE branch = ?', [branch.branch_name]);

    const totalLinked = (empCount?.count || 0) + (userCount?.count || 0);

    if (totalLinked > 0) {
      // Soft-delete / deactivate to preserve historical integrity
      await query.run('UPDATE branches SET is_active = 0 WHERE id = ?', [id]);
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
         VALUES ('Admin', ?, ?, 'Branch Deactivated', ?)`,
        [req.user.id.toString(), req.user.full_name, `Deactivated branch '${branch.branch_name}' (${branch.branch_code}) with ${totalLinked} linked records.`]
      );
      return res.json({
        success: true,
        message: `Branch '${branch.branch_name}' was deactivated because ${totalLinked} records are currently associated with it.`,
        deactivated: true
      });
    }

    // Hard delete if completely unused
    await query.run('DELETE FROM branches WHERE id = ?', [id]);
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Branch Deleted', ?)`,
      [req.user.id.toString(), req.user.full_name, `Deleted branch '${branch.branch_name}' (${branch.branch_code})`]
    );

    res.json({ success: true, message: `Branch '${branch.branch_name}' deleted successfully.` });
  } catch (err) {
    console.error('Delete branch error:', err);
    res.status(400).json({ error: err.message || 'Failed to delete branch.' });
  }
});

// ==========================================
// Masters CRUD: Locations (under Branches)
// ==========================================

// GET /api/masters/branches/:id/locations - Retrieve all locations for a specific branch
router.get('/branches/:id/locations', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await query.get('SELECT * FROM branches WHERE id = ?', [id]);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const locations = await query.all(
      'SELECT * FROM locations WHERE branch_id = ? ORDER BY is_active DESC, location_name ASC',
      [id]
    );

    res.json({
      branch,
      locations
    });
  } catch (err) {
    console.error('Fetch branch locations error:', err);
    res.status(500).json({ error: 'Failed to fetch branch locations.' });
  }
});

// GET /api/masters/locations - Query locations, optionally filtered by branch_id or branch name
router.get('/locations', authenticateAdmin, async (req, res) => {
  try {
    const { branch_id, branch, includeInactive } = req.query;
    let whereClauses = [];
    let params = [];

    if (branch_id) {
      whereClauses.push('l.branch_id = ?');
      params.push(branch_id);
    } else if (branch && branch !== 'ALL') {
      whereClauses.push('(LOWER(b.branch_name) = LOWER(?) OR UPPER(b.branch_code) = UPPER(?))');
      params.push(branch.trim(), branch.trim());
    }

    if (includeInactive !== 'true' && includeInactive !== '1') {
      whereClauses.push('l.is_active = 1');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const locations = await query.all(
      `SELECT l.*, b.branch_name, b.branch_code
       FROM locations l
       LEFT JOIN branches b ON l.branch_id = b.id
       ${whereSql}
       ORDER BY l.is_active DESC, l.location_name ASC`,
      params
    );

    res.json({ locations });
  } catch (err) {
    console.error('Fetch locations error:', err);
    res.status(500).json({ error: 'Failed to fetch locations.' });
  }
});

// POST /api/masters/locations - Create a new location under a branch
router.post('/locations', authenticateAdmin, requirePermission('create_masters', 'manage_masters'), async (req, res) => {
  try {
    const { branch_id, location_name, city, state, is_active } = req.body || {};

    if (!branch_id) {
      return res.status(400).json({ error: 'Branch ID is required.' });
    }
    if (!location_name || !location_name.trim()) {
      return res.status(400).json({ error: 'Location name is required.' });
    }

    const branch = await query.get('SELECT * FROM branches WHERE id = ?', [branch_id]);
    if (!branch) {
      return res.status(404).json({ error: `Branch with ID ${branch_id} does not exist.` });
    }

    const locName = location_name.trim();
    const locCity = city && city.trim() ? city.trim() : branch.city;
    const locState = state && state.trim() ? state.trim() : branch.state;
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    // Check duplicate location under the SAME branch (case-insensitive)
    const duplicate = await query.get(
      'SELECT id FROM locations WHERE branch_id = ? AND LOWER(TRIM(location_name)) = LOWER(?)',
      [branch_id, locName]
    );

    if (duplicate) {
      return res.status(400).json({
        error: `Location '${locName}' already exists under branch '${branch.branch_name}'.`
      });
    }

    const result = await query.run(
      'INSERT INTO locations (branch_id, location_name, city, state, is_active) VALUES (?, ?, ?, ?, ?)',
      [branch_id, locName, locCity, locState, active]
    );

    const createdLocation = {
      id: result.lastID,
      branch_id: Number(branch_id),
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      location_name: locName,
      city: locCity,
      state: locState,
      is_active: active
    };

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Location Created', ?)`,
      [req.user.id.toString(), req.user.full_name, `Created location '${locName}' under branch '${branch.branch_name}' (ID ${branch_id})`]
    );

    res.json({
      success: true,
      message: `Location '${locName}' added to branch '${branch.branch_name}'.`,
      location: createdLocation
    });
  } catch (err) {
    console.error('Create location error:', err);
    res.status(400).json({ error: err.message || 'Failed to create location.' });
  }
});

// PUT /api/masters/locations/:id - Update an existing location
router.put('/locations/:id', authenticateAdmin, requirePermission('edit_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const { location_name, city, state, is_active, branch_id } = req.body || {};

    const loc = await query.get('SELECT * FROM locations WHERE id = ?', [id]);
    if (!loc) {
      return res.status(404).json({ error: 'Location not found.' });
    }

    const targetBranchId = branch_id !== undefined ? Number(branch_id) : loc.branch_id;
    const branch = await query.get('SELECT * FROM branches WHERE id = ?', [targetBranchId]);
    if (!branch) {
      return res.status(404).json({ error: 'Associated branch not found.' });
    }

    const locName = location_name !== undefined ? location_name.trim() : loc.location_name;
    if (!locName) {
      return res.status(400).json({ error: 'Location name cannot be empty.' });
    }

    const locCity = city !== undefined ? city.trim() : (loc.city || branch.city);
    const locState = state !== undefined ? state.trim() : (loc.state || branch.state);
    const active = is_active !== undefined ? (is_active ? 1 : 0) : loc.is_active;

    // Check duplicate under same branch excluding this record
    const duplicate = await query.get(
      'SELECT id FROM locations WHERE branch_id = ? AND LOWER(TRIM(location_name)) = LOWER(?) AND id != ?',
      [targetBranchId, locName, id]
    );

    if (duplicate) {
      return res.status(400).json({
        error: `Location '${locName}' already exists under branch '${branch.branch_name}'.`
      });
    }

    const oldName = loc.location_name;

    await query.run(
      'UPDATE locations SET branch_id = ?, location_name = ?, city = ?, state = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [targetBranchId, locName, locCity, locState, active, id]
    );

    // Cascading update to employee records if location name changed
    if (oldName !== locName) {
      const empUpdate = await query.run('UPDATE employees SET location = ? WHERE location = ?', [locName, oldName]);
      console.log(`Cascaded location rename '${oldName}' -> '${locName}': ${empUpdate.changes} employees updated.`);
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Location Updated', ?)`,
      [req.user.id.toString(), req.user.full_name, `Updated location ID ${id}: '${oldName}' -> '${locName}' under branch '${branch.branch_name}'`]
    );

    res.json({
      success: true,
      message: `Location '${locName}' updated successfully.`,
      location: {
        id: Number(id),
        branch_id: targetBranchId,
        branch_name: branch.branch_name,
        branch_code: branch.branch_code,
        location_name: locName,
        city: locCity,
        state: locState,
        is_active: active
      }
    });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(400).json({ error: err.message || 'Failed to update location.' });
  }
});

// DELETE /api/masters/locations/:id - Delete or remove location from branch
router.delete('/locations/:id', authenticateAdmin, requirePermission('delete_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const loc = await query.get(
      'SELECT l.*, b.branch_name FROM locations l LEFT JOIN branches b ON l.branch_id = b.id WHERE l.id = ?',
      [id]
    );
    if (!loc) {
      return res.status(404).json({ error: 'Location not found.' });
    }

    // Check if location is assigned to any employee
    const empCount = await query.get(
      'SELECT COUNT(*) as count FROM employees WHERE LOWER(TRIM(location)) = LOWER(TRIM(?))',
      [loc.location_name]
    );

    const linkedCount = empCount?.count || 0;

    if (linkedCount > 0) {
      // Historical employee records exist: unlink from branch (branch_id = NULL) to remove it from branch
      // while preserving historical employee records.
      await query.run('UPDATE locations SET branch_id = NULL, is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
         VALUES ('Admin', ?, ?, 'Location Removed', ?)`,
        [req.user.id.toString(), req.user.full_name, `Removed location '${loc.location_name}' from branch '${loc.branch_name || 'N/A'}' (ID ${id}) with ${linkedCount} assigned employee(s). Historical records preserved.`]
      );

      return res.json({
        success: true,
        message: `Location '${loc.location_name}' was removed from the branch. ${linkedCount} historical employee record(s) were preserved.`,
        removed: true,
        unlinked: true
      });
    }

    // Hard delete if completely unassigned
    await query.run('DELETE FROM locations WHERE id = ?', [id]);
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Location Deleted', ?)`,
      [req.user.id.toString(), req.user.full_name, `Deleted unassigned location '${loc.location_name}' (ID ${id})`]
    );

    res.json({
      success: true,
      message: `Location '${loc.location_name}' deleted successfully.`,
      removed: true
    });
  } catch (err) {
    console.error('Delete location error:', err);
    res.status(400).json({ error: err.message || 'Failed to delete location.' });
  }
});

// ==========================================
// Masters CRUD: Departments
// ==========================================

// Create Department
router.post('/departments', authenticateAdmin, requirePermission('create_masters', 'manage_masters'), async (req, res) => {
  try {
    const { department_code, department_name, is_active } = req.body || {};

    if (!department_code || !department_name) {
      return res.status(400).json({ error: 'Department code and department name are required.' });
    }

    const code = department_code.trim().toUpperCase();
    const name = department_name.trim();
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    // Check code uniqueness
    const existingCode = await query.get('SELECT id FROM departments WHERE UPPER(department_code) = ?', [code]);
    if (existingCode) {
      return res.status(400).json({ error: `Department code '${code}' already exists.` });
    }

    // Check name uniqueness
    const existingName = await query.get('SELECT id FROM departments WHERE LOWER(department_name) = ?', [name.toLowerCase()]);
    if (existingName) {
      return res.status(400).json({ error: `Department name '${name}' already exists.` });
    }

    const result = await query.run(
      'INSERT INTO departments (department_code, department_name, is_active) VALUES (?, ?, ?)',
      [code, name, active]
    );

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Department Created', ?)`,
      [req.user.id.toString(), req.user.full_name, `Created department: ${name} (${code})`]
    );

    res.json({
      success: true,
      message: 'Department added successfully.',
      department: { id: result.lastID, department_code: code, department_name: name, is_active: active }
    });
  } catch (err) {
    console.error('Add department error:', err);
    res.status(400).json({ error: err.message || 'Failed to add department.' });
  }
});

// Update Department
router.put('/departments/:id', authenticateAdmin, requirePermission('edit_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const { department_code, department_name, is_active } = req.body || {};

    const dept = await query.get('SELECT * FROM departments WHERE id = ?', [id]);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    if (!department_code || !department_name) {
      return res.status(400).json({ error: 'Department code and department name are required.' });
    }

    const code = department_code.trim().toUpperCase();
    const name = department_name.trim();
    const active = is_active !== undefined ? (is_active ? 1 : 0) : dept.is_active;

    // Check code uniqueness excluding this record
    const duplicateCode = await query.get(
      'SELECT id FROM departments WHERE UPPER(department_code) = ? AND id != ?',
      [code, id]
    );
    if (duplicateCode) {
      return res.status(400).json({ error: `Department code '${code}' is already used by another department.` });
    }

    // Check name uniqueness excluding this record
    const duplicateName = await query.get(
      'SELECT id FROM departments WHERE LOWER(department_name) = ? AND id != ?',
      [name.toLowerCase(), id]
    );
    if (duplicateName) {
      return res.status(400).json({ error: `Department name '${name}' is already used by another department.` });
    }

    const oldName = dept.department_name;

    await query.run(
      'UPDATE departments SET department_code = ?, department_name = ?, is_active = ? WHERE id = ?',
      [code, name, active, id]
    );

    // Cascading update if department_name changed
    if (oldName !== name) {
      const empUpdate = await query.run('UPDATE employees SET department = ? WHERE department = ?', [name, oldName]);
      const userUpdate = await query.run('UPDATE users SET department = ? WHERE department = ?', [name, oldName]);
      console.log(`Cascaded department rename '${oldName}' -> '${name}': ${empUpdate.changes} employees, ${userUpdate.changes} users updated.`);
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Department Updated', ?)`,
      [req.user.id.toString(), req.user.full_name, `Updated department ID ${id}: ${oldName} -> ${name} (${code})`]
    );

    res.json({
      success: true,
      message: 'Department updated successfully.',
      department: { id: Number(id), department_code: code, department_name: name, is_active: active }
    });
  } catch (err) {
    console.error('Update department error:', err);
    res.status(400).json({ error: err.message || 'Failed to update department.' });
  }
});

// Delete / Deactivate Department
router.delete('/departments/:id', authenticateAdmin, requirePermission('delete_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await query.get('SELECT * FROM departments WHERE id = ?', [id]);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    // Check employee and user dependencies
    const empCount = await query.get('SELECT COUNT(*) as count FROM employees WHERE department = ?', [dept.department_name]);
    const userCount = await query.get('SELECT COUNT(*) as count FROM users WHERE department = ?', [dept.department_name]);

    const totalLinked = (empCount?.count || 0) + (userCount?.count || 0);

    if (totalLinked > 0) {
      // Soft-delete / deactivate
      await query.run('UPDATE departments SET is_active = 0 WHERE id = ?', [id]);
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
         VALUES ('Admin', ?, ?, 'Department Deactivated', ?)`,
        [req.user.id.toString(), req.user.full_name, `Deactivated department '${dept.department_name}' (${dept.department_code}) with ${totalLinked} linked records.`]
      );
      return res.json({
        success: true,
        message: `Department '${dept.department_name}' was deactivated because ${totalLinked} records are currently associated with it.`,
        deactivated: true
      });
    }

    // Hard delete if completely unused
    await query.run('DELETE FROM departments WHERE id = ?', [id]);
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Department Deleted', ?)`,
      [req.user.id.toString(), req.user.full_name, `Deleted department '${dept.department_name}' (${dept.department_code})`]
    );

    res.json({ success: true, message: `Department '${dept.department_name}' deleted successfully.` });
  } catch (err) {
    console.error('Delete department error:', err);
    res.status(400).json({ error: err.message || 'Failed to delete department.' });
  }
});

// ==========================================
// Masters CRUD: Designations
// ==========================================

// GET /api/masters/designations
router.get('/designations', authenticateAdmin, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const desigWhere = includeInactive ? '' : 'WHERE is_active = 1';
    const designations = await query.all(
      `SELECT * FROM designations ${desigWhere} ORDER BY is_active DESC, designation_name ASC`
    );
    res.json({ designations });
  } catch (err) {
    console.error('Fetch designations error:', err);
    res.status(500).json({ error: 'Failed to fetch designations.' });
  }
});

// Create Designation
router.post('/designations', authenticateAdmin, requirePermission('create_masters', 'manage_masters'), async (req, res) => {
  try {
    const { designation_code, designation_name, description, is_active } = req.body || {};

    if (!designation_code || !designation_name) {
      return res.status(400).json({ error: 'Designation code and designation name are required.' });
    }

    const code = designation_code.trim().toUpperCase();
    const name = designation_name.trim();
    const desc = (description || '').trim();
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    // Check code uniqueness (case-insensitive)
    const existingCode = await query.get('SELECT id FROM designations WHERE UPPER(designation_code) = ?', [code]);
    if (existingCode) {
      return res.status(400).json({ error: `Designation code '${code}' already exists.` });
    }

    // Check name uniqueness (case-insensitive)
    const existingName = await query.get('SELECT id FROM designations WHERE LOWER(designation_name) = ?', [name.toLowerCase()]);
    if (existingName) {
      return res.status(400).json({ error: `Designation name '${name}' already exists.` });
    }

    const result = await query.run(
      'INSERT INTO designations (designation_code, designation_name, description, is_active) VALUES (?, ?, ?, ?)',
      [code, name, desc, active]
    );

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Designation Created', ?)`,
      [req.user.id.toString(), req.user.full_name, `Created designation: ${name} (${code})`]
    );

    res.json({
      success: true,
      message: 'Designation added successfully.',
      designation: { id: result.lastID, designation_code: code, designation_name: name, description: desc, is_active: active }
    });
  } catch (err) {
    console.error('Add designation error:', err);
    res.status(400).json({ error: err.message || 'Failed to add designation.' });
  }
});

// Update Designation
router.put('/designations/:id', authenticateAdmin, requirePermission('edit_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const { designation_code, designation_name, description, is_active } = req.body || {};

    const desig = await query.get('SELECT * FROM designations WHERE id = ?', [id]);
    if (!desig) {
      return res.status(404).json({ error: 'Designation not found.' });
    }

    if (!designation_code || !designation_name) {
      return res.status(400).json({ error: 'Designation code and designation name are required.' });
    }

    const code = designation_code.trim().toUpperCase();
    const name = designation_name.trim();
    const desc = description !== undefined ? (description || '').trim() : (desig.description || '');
    const active = is_active !== undefined ? (is_active ? 1 : 0) : desig.is_active;

    // Check code uniqueness excluding this record
    const duplicateCode = await query.get(
      'SELECT id FROM designations WHERE UPPER(designation_code) = ? AND id != ?',
      [code, id]
    );
    if (duplicateCode) {
      return res.status(400).json({ error: `Designation code '${code}' is already used by another designation.` });
    }

    // Check name uniqueness excluding this record
    const duplicateName = await query.get(
      'SELECT id FROM designations WHERE LOWER(designation_name) = ? AND id != ?',
      [name.toLowerCase(), id]
    );
    if (duplicateName) {
      return res.status(400).json({ error: `Designation name '${name}' is already used by another designation.` });
    }

    const oldName = desig.designation_name;

    await query.run(
      'UPDATE designations SET designation_code = ?, designation_name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [code, name, desc, active, id]
    );

    // Cascading update if designation_name changed: keep employees synchronized
    if (oldName !== name) {
      const empUpdate = await query.run('UPDATE employees SET designation = ? WHERE designation = ?', [name, oldName]);
      console.log(`Cascaded designation rename '${oldName}' -> '${name}': ${empUpdate.changes} employees updated.`);
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Designation Updated', ?)`,
      [req.user.id.toString(), req.user.full_name, `Updated designation ID ${id}: ${oldName} -> ${name} (${code})`]
    );

    res.json({
      success: true,
      message: 'Designation updated successfully.',
      designation: { id: Number(id), designation_code: code, designation_name: name, description: desc, is_active: active }
    });
  } catch (err) {
    console.error('Update designation error:', err);
    res.status(400).json({ error: err.message || 'Failed to update designation.' });
  }
});

// Delete / Deactivate Designation
router.delete('/designations/:id', authenticateAdmin, requirePermission('delete_masters', 'manage_masters'), async (req, res) => {
  try {
    const { id } = req.params;
    const desig = await query.get('SELECT * FROM designations WHERE id = ?', [id]);
    if (!desig) {
      return res.status(404).json({ error: 'Designation not found.' });
    }

    // Check employee dependencies
    const empCount = await query.get('SELECT COUNT(*) as count FROM employees WHERE designation = ?', [desig.designation_name]);
    const totalLinked = empCount?.count || 0;

    if (totalLinked > 0) {
      // Soft-delete / deactivate to preserve historical integrity
      await query.run('UPDATE designations SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
         VALUES ('Admin', ?, ?, 'Designation Deactivated', ?)`,
        [req.user.id.toString(), req.user.full_name, `Deactivated designation '${desig.designation_name}' (${desig.designation_code}) with ${totalLinked} linked employee record(s).`]
      );
      return res.json({
        success: true,
        message: `Designation '${desig.designation_name}' was deactivated because ${totalLinked} employee record(s) are currently assigned to it.`,
        deactivated: true
      });
    }

    // Hard delete if completely unused
    await query.run('DELETE FROM designations WHERE id = ?', [id]);
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Designation Deleted', ?)`,
      [req.user.id.toString(), req.user.full_name, `Deleted designation '${desig.designation_name}' (${desig.designation_code})`]
    );

    res.json({ success: true, message: `Designation '${desig.designation_name}' deleted successfully.` });
  } catch (err) {
    console.error('Delete designation error:', err);
    res.status(400).json({ error: err.message || 'Failed to delete designation.' });
  }
});

// Document Types
router.post('/document-types', authenticateAdmin, requirePermission('create_masters', 'manage_masters'), async (req, res) => {
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
router.post('/failure-reasons', authenticateAdmin, requirePermission('create_masters', 'manage_masters'), async (req, res) => {
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
router.put('/settings', authenticateAdmin, requirePermission('manage_settings', 'manage_masters'), async (req, res) => {
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
