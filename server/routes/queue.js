const express = require('express');
const router = express.Router();
const fs = require('fs');
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles } = require('../middleware/auth');

// GET /api/queue - Query BGV Verification Queue
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      status,
      search,
      branch,
      department,
      location,
      reviewerId,
      tatStatus,
      page = 1,
      limit = 25
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    // Filter by specific verification status
    if (status && status !== 'ALL') {
      whereClauses.push('e.verification_status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereClauses.push('(e.employee_id LIKE ? OR e.employee_name LIKE ? OR vc.case_reference LIKE ?)');
      params.push(q, q, q);
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

    if (reviewerId && reviewerId !== 'ALL') {
      whereClauses.push('vc.assigned_reviewer_id = ?');
      params.push(reviewerId);
    }

    // Role-specific view filter: If BGV Reviewer, show their assigned cases by default if specified
    if (req.user.role === 'BGV Reviewer' && req.query.myQueue === 'true') {
      whereClauses.push('(vc.assigned_reviewer_id = ? OR vc.assigned_reviewer_id IS NULL)');
      params.push(req.user.id);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count
    const countRow = await query.get(
      `SELECT COUNT(*) as total
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       ${whereSql}`,
      params
    );
    const total = countRow ? countRow.total : 0;

    // Fetch queue list with rich verification indicators
    const items = await query.all(
      `SELECT e.id as employee_row_id,
              e.employee_id,
              e.employee_name,
              e.date_of_joining,
              e.department,
              e.designation,
              e.branch,
              e.location,
              e.hr_state,
              e.verification_status,
              vc.id as case_id,
              vc.case_reference,
              vc.current_attempt_number,
              vc.tat_deadline,
              vc.assigned_reviewer_id,
              u.full_name as assigned_reviewer_name,
              vp.current_step,
              vp.location_captured,
              vp.gps_accuracy,
              vp.distance_from_hr_meters,
              vp.distance_category,
              vp.selfie_captured,
              vp.house_photo_captured,
              vp.door_photo_captured,
              vp.street_photo_captured,
              vp.landmark_photo_captured,
              vp.address_proof_uploaded,
              vp.document_type,
              vp.declaration_accepted,
              vp.declaration_timestamp as submission_date,
              CASE
                WHEN e.verification_status IN ('Verified', 'Verification Failed') THEN 'Completed'
                WHEN vc.tat_deadline IS NOT NULL AND datetime('now') > datetime(vc.tat_deadline) THEN 'TAT Breached'
                WHEN vc.tat_deadline IS NOT NULL AND date('now') = date(vc.tat_deadline) THEN 'Due Today'
                ELSE 'Within TAT'
              END as tat_status
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       LEFT JOIN verification_progress vp ON e.employee_id = vp.employee_id
       LEFT JOIN users u ON vc.assigned_reviewer_id = u.id
       ${whereSql}
       ORDER BY
         CASE e.verification_status
           WHEN 'Pending BGV Review' THEN 1
           WHEN 'In Progress' THEN 2
           WHEN 'Reverification Required' THEN 3
           WHEN 'Not Started' THEN 4
           WHEN 'Verified' THEN 5
           ELSE 6
         END,
         e.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // Filter by computed TAT status if requested
    let filteredItems = items;
    if (tatStatus && tatStatus !== 'ALL') {
      filteredItems = items.filter((item) => item.tat_status === tatStatus);
    }

    res.json({
      items: filteredItems,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Queue error:', err);
    res.status(500).json({ error: 'Failed to retrieve verification queue.' });
  }
});

// POST /api/queue/assign - Assign BGV Reviewer
router.post('/assign', authenticateAdmin, async (req, res) => {
  try {
    const { caseReferences, employeeIds, reviewerId } = req.body;

    if (!reviewerId) {
      return res.status(400).json({ error: 'Please select a reviewer to assign.' });
    }

    const reviewer = await query.get('SELECT id, full_name FROM users WHERE id = ?', [reviewerId]);
    if (!reviewer) {
      return res.status(404).json({ error: 'Reviewer user not found.' });
    }

    let targetEmpIds = employeeIds || [];
    if (caseReferences && caseReferences.length > 0) {
      const cases = await query.all(
        `SELECT employee_id FROM verification_cases WHERE case_reference IN (${caseReferences.map(() => '?').join(',')})`,
        caseReferences
      );
      targetEmpIds = cases.map((c) => c.employee_id);
    }

    for (const empId of targetEmpIds) {
      await query.run('UPDATE employees SET assigned_reviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?', [reviewerId, empId]);
      await query.run('UPDATE verification_cases SET assigned_reviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?', [reviewerId, empId]);
      
      await query.run(
        `INSERT INTO verification_timeline (employee_id, action, actor_type, actor_name, details)
         VALUES (?, 'Reviewer Assigned', 'HR', ?, ?)`,
        [empId, req.user.full_name, `Assigned case to BGV Reviewer: ${reviewer.full_name}`]
      );
    }

    res.json({ success: true, message: `Successfully assigned ${targetEmpIds.length} case(s) to ${reviewer.full_name}.` });
  } catch (err) {
    console.error('Assign error:', err);
    res.status(500).json({ error: 'Failed to assign reviewer.' });
  }
});

// DELETE /api/queue/:caseRefOrEmpId - Delete Case from Verification / Reverification Queue (Admin Only)
router.delete('/:caseRefOrEmpId', authenticateAdmin, requireRoles('Super Admin', 'HR/Admin'), async (req, res) => {
  try {
    const { caseRefOrEmpId } = req.params;
    const { deleteEmployee } = req.query; // If true, deletes employee record as well

    const caseRecord = await query.get(
      `SELECT vc.*, e.employee_name, e.employee_id as emp_code
       FROM verification_cases vc
       JOIN employees e ON vc.employee_id = e.employee_id
       WHERE vc.case_reference = ? OR vc.employee_id = ? OR e.id = ?`,
      [caseRefOrEmpId, caseRefOrEmpId, caseRefOrEmpId]
    );

    if (!caseRecord) {
      // Check if employee exists in employees
      const emp = await query.get(
        'SELECT employee_id, employee_name, verification_status FROM employees WHERE employee_id = ? OR id = ?',
        [caseRefOrEmpId, caseRefOrEmpId]
      );
      if (!emp) {
        return res.status(404).json({ error: 'Case or employee record not found.' });
      }

      // Reset employee verification status to 'Not Started'
      await query.run(
        `UPDATE employees SET verification_status = 'Not Started', assigned_reviewer_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?`,
        [emp.employee_id]
      );
      await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [emp.employee_id]);
      await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [emp.employee_id]);

      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, employee_id, ip_address, details)
         VALUES ('User', ?, ?, 'Verification Case Removed', ?, ?, ?)`,
        [
          req.user.id.toString(),
          req.user.full_name,
          emp.employee_id,
          req.ip,
          `Removed verification case for ${emp.employee_name} (${emp.employee_id}) and reset status to Not Started.`
        ]
      );

      return res.json({
        success: true,
        message: `Case for ${emp.employee_name} (${emp.employee_id}) removed from queue.`
      });
    }

    const empId = caseRecord.employee_id;
    const caseRef = caseRecord.case_reference;

    // If deleteEmployee flag is passed, delete employee completely
    if (deleteEmployee === 'true') {
      const evidenceFiles = await query.all('SELECT file_path FROM verification_evidence WHERE employee_id = ?', [empId]);
      for (const ev of evidenceFiles) {
        try {
          if (ev.file_path && fs.existsSync(ev.file_path)) fs.unlinkSync(ev.file_path);
        } catch (e) {}
      }
      await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [empId]);
      await query.run('DELETE FROM verification_attempts WHERE employee_id = ?', [empId]);
      await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [empId]);
      await query.run('DELETE FROM verification_timeline WHERE employee_id = ?', [empId]);
      await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [empId]);
      await query.run('DELETE FROM download_area_files WHERE employee_id = ?', [empId]);
      await query.run('DELETE FROM employees WHERE employee_id = ?', [empId]);

      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, employee_id, case_reference, ip_address, details)
         VALUES ('User', ?, ?, 'Employee & Case Deleted', ?, ?, ?, ?)`,
        [
          req.user.id.toString(),
          req.user.full_name,
          empId,
          caseRef,
          req.ip,
          `Permanently deleted employee ${caseRecord.employee_name} (${empId}) and case ${caseRef}.`
        ]
      );

      return res.json({
        success: true,
        message: `Case ${caseRef} and employee ${caseRecord.employee_name} permanently deleted.`
      });
    }

    // Otherwise: delete case record, attempts, progress, and reset employee status to 'Not Started'
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM verification_attempts WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [empId]);
    await query.run('DELETE FROM verification_cases WHERE id = ?', [caseRecord.id]);
    await query.run(
      `UPDATE employees SET verification_status = 'Not Started', assigned_reviewer_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?`,
      [empId]
    );

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, employee_id, case_reference, ip_address, details)
       VALUES ('User', ?, ?, 'Verification Case Deleted', ?, ?, ?, ?)`,
      [
        req.user.id.toString(),
        req.user.full_name,
        empId,
        caseRef,
        req.ip,
        `Deleted verification case ${caseRef} for ${caseRecord.employee_name} (${empId}) and reset verification status.`
      ]
    );

    res.json({
      success: true,
      message: `Case ${caseRef} deleted successfully and removed from queue.`
    });
  } catch (err) {
    console.error('Delete case error:', err);
    res.status(500).json({ error: 'Failed to delete case from queue.' });
  }
});

module.exports = router;
