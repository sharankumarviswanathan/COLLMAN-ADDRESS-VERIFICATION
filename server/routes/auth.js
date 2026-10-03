const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { generateAdminToken, authenticateAdmin } = require('../middleware/auth');

// POST /api/auth/login - Secure Internal User Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email and Password are required.' });
    }

    const trimmedIdentifier = username.trim();

    // Query user by username or email
    const user = await query.get(
      `SELECT id, username, email, password_hash, full_name, role, branch, department, is_active
       FROM users
       WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?))`,
      [trimmedIdentifier, trimmedIdentifier]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'This user account is deactivated. Please contact Super Admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // Audit log failed login
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_name, action, ip_address, details)
         VALUES ('System', ?, 'Failed Login Attempt', ?, 'Invalid password entered')`,
        [trimmedIdentifier, req.ip]
      );
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const token = generateAdminToken(user);

    // Audit log successful login
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, ip_address, details)
       VALUES ('User', ?, ?, 'Login', ?, 'Successful admin portal authentication')`,
      [user.id.toString(), user.full_name, req.ip]
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        branch: user.branch,
        department: user.department
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An unexpected authentication error occurred.' });
  }
});

// GET /api/auth/me - Get Current Authenticated User Info
router.get('/me', authenticateAdmin, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      fullName: req.user.full_name,
      role: req.user.role,
      branch: req.user.branch,
      department: req.user.department
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await query.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('User', ?, ?, 'Password Changed', 'User changed their account password')`,
      [req.user.id.toString(), req.user.full_name]
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

module.exports = router;
