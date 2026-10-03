const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles } = require('../middleware/auth');

// GET /api/downloads - List all internal Download Area files
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { category, fileType, search, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    if (category && category !== 'ALL') {
      whereClauses.push('category = ?');
      params.push(category);
    }

    if (fileType && fileType !== 'ALL') {
      whereClauses.push('file_type = ?');
      params.push(fileType);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereClauses.push('(file_name LIKE ? OR reference_no LIKE ? OR employee_id LIKE ? OR generated_by LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await query.get(
      `SELECT COUNT(*) as total FROM download_area_files ${whereSql}`,
      params
    );
    const total = countRow ? countRow.total : 0;

    const files = await query.all(
      `SELECT * FROM download_area_files
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      files,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Download area list error:', err);
    res.status(500).json({ error: 'Failed to retrieve files from Download Area.' });
  }
});

// GET /api/downloads/:id/file - Download a specific file
router.get('/:id/file', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const fileRecord = await query.get(
      'SELECT * FROM download_area_files WHERE id = ?',
      [id]
    );

    if (!fileRecord) {
      return res.status(404).json({ error: 'File record not found.' });
    }

    if (!fs.existsSync(fileRecord.file_path)) {
      return res.status(404).json({ error: 'File does not exist on disk.' });
    }

    // Increment download count
    await query.run(
      'UPDATE download_area_files SET download_count = download_count + 1 WHERE id = ?',
      [id]
    );

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('User', ?, ?, 'File Downloaded', ?)`,
      [req.user.id.toString(), req.user.full_name, `Downloaded ${fileRecord.file_name} (${fileRecord.category})`]
    );

    res.download(fileRecord.file_path, fileRecord.file_name);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download file.' });
  }
});

// DELETE /api/downloads/:id - Remove file from Download Area
router.delete('/:id', authenticateAdmin, requireRoles('Super Admin', 'HR/Admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const fileRecord = await query.get(
      'SELECT * FROM download_area_files WHERE id = ?',
      [id]
    );

    if (!fileRecord) {
      return res.status(404).json({ error: 'File record not found.' });
    }

    // Attempt to delete from disk
    if (fs.existsSync(fileRecord.file_path)) {
      try {
        fs.unlinkSync(fileRecord.file_path);
      } catch (unlinkErr) {
        console.warn('Could not remove file from disk:', unlinkErr.message);
      }
    }

    await query.run('DELETE FROM download_area_files WHERE id = ?', [id]);

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('User', ?, ?, 'File Deleted from Download Area', ?)`,
      [req.user.id.toString(), req.user.full_name, `Deleted file: ${fileRecord.file_name}`]
    );

    res.json({ success: true, message: 'File deleted from Download Area.' });
  } catch (err) {
    console.error('Delete download file error:', err);
    res.status(500).json({ error: 'Failed to delete file.' });
  }
});

module.exports = router;
