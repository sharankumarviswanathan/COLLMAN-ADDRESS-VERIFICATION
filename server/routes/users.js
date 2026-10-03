const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles } = require('../middleware/auth');

// GET /api/users - List internal users
router.get('/', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const users = await query.all(
      `SELECT id, username, email, full_name, role, branch, department, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// POST /api/users - Create new internal user
router.post('/', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { username, email, password, full_name, role, branch, department } = req.body;

    if (!username || !email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Username, email, password, full name and role are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate
    const existing = await query.get(
      'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
      [cleanUsername, cleanEmail]
    );

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query.run(
      `INSERT INTO users (username, email, password_hash, full_name, role, branch, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cleanUsername, cleanEmail, passwordHash, full_name.trim(), role, branch || null, department || null]
    );

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Super Admin', ?, ?, 'User Created', ?)`,
      [req.user.id.toString(), req.user.full_name, `Created user ${cleanUsername} with role ${role}`]
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

// PUT /api/users/:id - Edit user
router.put('/:id', authenticateAdmin, requireRoles('Super Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, role, branch, department, is_active, newPassword } = req.body;

    const user = await query.get('SELECT id, username FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let passwordSql = '';
    let params = [email, full_name, role, branch, department, is_active !== undefined ? (is_active ? 1 : 0) : 1];

    if (newPassword && newPassword.length >= 6) {
      const hash = await bcrypt.hash(newPassword, 10);
      passwordSql = ', password_hash = ?';
      params.push(hash);
    }

    params.push(id);

    await query.run(
      `UPDATE users SET
        email = ?, full_name = ?, role = ?, branch = ?, department = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        ${passwordSql}
       WHERE id = ?`,
      params
    );

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Super Admin', ?, ?, 'User Modified', ?)`,
      [req.user.id.toString(), req.user.full_name, `Updated user details for ${user.username}`]
    );

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    console.error('Edit user error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

module.exports = router;
