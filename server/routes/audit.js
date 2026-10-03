const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { authenticateAdmin } = require('../middleware/auth');
const { generateExcelReport } = require('../utils/excelGenerator');

// GET /api/audit - List audit events with filters & pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { actor, action, employeeId, startDate, endDate, page = 1, limit = 25 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    if (actor && actor.trim()) {
      whereClauses.push('(actor_name LIKE ? OR actor_type LIKE ?)');
      params.push(`%${actor.trim()}%`, `%${actor.trim()}%`);
    }

    if (action && action !== 'ALL') {
      whereClauses.push('action = ?');
      params.push(action);
    }

    if (employeeId && employeeId.trim()) {
      whereClauses.push('(employee_id LIKE ? OR case_reference LIKE ?)');
      params.push(`%${employeeId.trim()}%`, `%${employeeId.trim()}%`);
    }

    if (startDate) {
      whereClauses.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('created_at <= ?');
      params.push(endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await query.get(
      `SELECT COUNT(*) as total FROM audit_logs ${whereSql}`,
      params
    );
    const total = countRow ? countRow.total : 0;

    const logs = await query.all(
      `SELECT * FROM audit_logs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// POST /api/audit/export - Export audit trail to Download Area
router.post('/export', authenticateAdmin, async (req, res) => {
  try {
    const logs = await query.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000');

    const result = await generateExcelReport({
      fileNamePrefix: 'System_Audit_Log_Export',
      category: 'Audit Export',
      sheetName: 'Audit Trail',
      columns: [
        { header: 'Log ID', key: 'id' },
        { header: 'Timestamp', key: 'created_at' },
        { header: 'Actor Type', key: 'actor_type' },
        { header: 'Actor Name', key: 'actor_name' },
        { header: 'Action', key: 'action' },
        { header: 'Employee ID', key: 'employee_id' },
        { header: 'Case Reference', key: 'case_reference' },
        { header: 'IP Address', key: 'ip_address' },
        { header: 'Details', key: 'details' }
      ],
      data: logs,
      generatedBy: req.user.full_name
    });

    res.json({
      success: true,
      message: 'Audit log exported to Download Area.',
      fileName: result.fileName
    });
  } catch (err) {
    console.error('Export audit error:', err);
    res.status(500).json({ error: 'Failed to export audit log.' });
  }
});

module.exports = router;
