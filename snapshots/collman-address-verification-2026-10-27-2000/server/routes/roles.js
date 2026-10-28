const express = require('express');
const router = express.Router();
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles, requirePermission } = require('../middleware/auth');
const { SYSTEM_PERMISSIONS, ALL_PERMISSION_KEYS } = require('../utils/permissions');

// GET /api/roles - List all roles with their assigned permissions and user count
router.get('/', authenticateAdmin, requirePermission('manage_roles', 'manage_permissions', 'view_users'), async (req, res) => {
  try {
    const roles = await query.all('SELECT * FROM roles ORDER BY is_system DESC, is_active DESC, role_name ASC');

    const enrichedRoles = await Promise.all(
      roles.map(async (r) => {
        const perms = await query.all(
          'SELECT permission_key FROM role_permissions WHERE role_name = ? ORDER BY permission_key ASC',
          [r.role_name]
        );
        const userCount = await query.get(
          'SELECT COUNT(*) as count FROM users WHERE role = ?',
          [r.role_name]
        );

        return {
          ...r,
          permissions: perms.map((p) => p.permission_key),
          user_count: userCount?.count || 0
        };
      })
    );

    res.json({
      roles: enrichedRoles,
      systemPermissions: SYSTEM_PERMISSIONS,
      permissionsCatalog: SYSTEM_PERMISSIONS
    });
  } catch (err) {
    console.error('List roles error:', err);
    res.status(500).json({ error: 'Failed to retrieve roles.' });
  }
});

// GET /api/roles/permissions-catalog - Master list of categorized permissions
router.get('/permissions-catalog', authenticateAdmin, (req, res) => {
  res.json({ systemPermissions: SYSTEM_PERMISSIONS, catalog: SYSTEM_PERMISSIONS });
});

// POST /api/roles - Create new custom role with permissions
router.post('/', authenticateAdmin, requirePermission('manage_roles'), async (req, res) => {
  try {
    const { role_name, role_code, description, badge_color, permissions = [] } = req.body || {};

    if (!role_name || !role_name.trim()) {
      return res.status(400).json({ error: 'Role name is required.' });
    }

    const cleanName = role_name.trim();
    const cleanCode = (role_code || cleanName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()).trim().toUpperCase();
    const color = badge_color || 'purple';

    // Check unique name
    const existingName = await query.get(
      'SELECT id FROM roles WHERE LOWER(role_name) = ?',
      [cleanName.toLowerCase()]
    );
    if (existingName) {
      return res.status(400).json({ error: `A role named '${cleanName}' already exists.` });
    }

    // Check unique code
    const existingCode = await query.get(
      'SELECT id FROM roles WHERE UPPER(role_code) = ?',
      [cleanCode]
    );
    if (existingCode) {
      return res.status(400).json({ error: `Role code '${cleanCode}' already exists.` });
    }

    const roleResult = await query.run(
      `INSERT INTO roles (role_name, role_code, description, badge_color, is_system, is_active)
       VALUES (?, ?, ?, ?, 0, 1)`,
      [cleanName, cleanCode, description ? description.trim() : '', color]
    );

    // Insert permissions
    if (Array.isArray(permissions)) {
      for (const permKey of permissions) {
        if (ALL_PERMISSION_KEYS.includes(permKey)) {
          await query.run(
            'INSERT OR IGNORE INTO role_permissions (role_name, permission_key) VALUES (?, ?)',
            [cleanName, permKey]
          );
        }
      }
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Role Created', ?)`,
      [req.user.id.toString(), req.user.full_name, `Created role '${cleanName}' (${cleanCode}) with ${permissions.length} permissions.`]
    );

    res.status(201).json({
      success: true,
      message: `Role '${cleanName}' created successfully.`,
      role: {
        id: roleResult.lastID,
        role_name: cleanName,
        role_code: cleanCode,
        description: description || '',
        badge_color: color,
        is_system: 0,
        is_active: 1,
        permissions: permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p)),
        user_count: 0
      }
    });
  } catch (err) {
    console.error('Create role error:', err);
    res.status(500).json({ error: err.message || 'Failed to create role.' });
  }
});

// PUT /api/roles/:id - Update role details and assign/update permissions
router.put('/:id', authenticateAdmin, requirePermission('manage_roles', 'manage_permissions'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, description, badge_color, is_active, permissions } = req.body || {};

    const role = await query.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found.' });
    }

    const oldName = role.role_name;
    let targetName = oldName;

    // Custom roles can be renamed; system roles keep their standard name
    if (role.is_system === 0 && role_name && role_name.trim()) {
      targetName = role_name.trim();

      if (targetName.toLowerCase() !== oldName.toLowerCase()) {
        const duplicate = await query.get(
          'SELECT id FROM roles WHERE LOWER(role_name) = ? AND id != ?',
          [targetName.toLowerCase(), id]
        );
        if (duplicate) {
          return res.status(400).json({ error: `A role named '${targetName}' already exists.` });
        }
      }
    }

    const color = badge_color || role.badge_color;
    const active = is_active !== undefined ? (is_active ? 1 : 0) : role.is_active;
    const desc = description !== undefined ? description.trim() : role.description;

    await query.run(
      `UPDATE roles SET
        role_name = ?, description = ?, badge_color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [targetName, desc, color, active, id]
    );

    // If custom role renamed, cascade to users and role_permissions
    if (oldName !== targetName) {
      await query.run('UPDATE users SET role = ? WHERE role = ?', [targetName, oldName]);
      await query.run('UPDATE role_permissions SET role_name = ? WHERE role_name = ?', [targetName, oldName]);
    }

    // Update permissions if provided
    if (Array.isArray(permissions)) {
      // Clear old permissions
      await query.run('DELETE FROM role_permissions WHERE role_name = ?', [targetName]);

      // Insert updated permissions
      for (const permKey of permissions) {
        if (ALL_PERMISSION_KEYS.includes(permKey)) {
          await query.run(
            'INSERT OR IGNORE INTO role_permissions (role_name, permission_key) VALUES (?, ?)',
            [targetName, permKey]
          );
        }
      }
    }

    // Audit log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Role Permissions Updated', ?)`,
      [req.user.id.toString(), req.user.full_name, `Updated permissions and configuration for role '${targetName}'`]
    );

    const updatedPerms = await query.all(
      'SELECT permission_key FROM role_permissions WHERE role_name = ?',
      [targetName]
    );

    res.json({
      success: true,
      message: `Permissions for role '${targetName}' updated successfully.`,
      role: {
        id: Number(id),
        role_name: targetName,
        role_code: role.role_code,
        description: desc,
        badge_color: color,
        is_system: role.is_system,
        is_active: active,
        permissions: updatedPerms.map((p) => p.permission_key)
      }
    });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: err.message || 'Failed to update role.' });
  }
});

// DELETE /api/roles/:id - Delete or safely deactivate role
router.delete('/:id', authenticateAdmin, requirePermission('manage_roles', 'manage_permissions'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reassign_to, force, action } = { ...req.query, ...req.body };
    const role = await query.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found.' });
    }

    if (role.role_name === 'Super Admin' || role.role_code === 'SUPER_ADMIN' || role.is_system === 1) {
      return res.status(400).json({ error: 'System roles cannot be deleted.' });
    }

    // Check user assignments
    const userCountResult = await query.get(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      [role.role_name]
    );
    const userCount = userCountResult?.count || 0;

    // 1. Explicit deactivate action requested
    if (action === 'deactivate') {
      await query.run('UPDATE roles SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
         VALUES ('Admin', ?, ?, 'Role Deactivated', ?)`,
        [req.user.id.toString(), req.user.full_name, `Deactivated role '${role.role_name}' with ${userCount} assigned user(s).`]
      );

      return res.json({
        success: true,
        message: `Role '${role.role_name}' was deactivated (${userCount} user(s) assigned).`,
        deactivated: true
      });
    }

    // 2. If users are assigned: require reassignment or force, or soft-deactivate
    if (userCount > 0) {
      if (reassign_to && String(reassign_to).trim() && String(reassign_to).trim() !== role.role_name) {
        const targetRole = await query.get('SELECT * FROM roles WHERE role_name = ?', [String(reassign_to).trim()]);
        if (!targetRole) {
          return res.status(400).json({ error: `Target reassignment role '${reassign_to}' does not exist.` });
        }

        // Reassign all assigned users to targetRole
        await query.run('UPDATE users SET role = ? WHERE role = ?', [targetRole.role_name, role.role_name]);

        // Delete permissions and role
        await query.run('DELETE FROM role_permissions WHERE role_name = ?', [role.role_name]);
        await query.run('DELETE FROM roles WHERE id = ?', [id]);

        await query.run(
          `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
           VALUES ('Admin', ?, ?, 'Role Deleted', ?)`,
          [req.user.id.toString(), req.user.full_name, `Deleted role '${role.role_name}' and reassigned ${userCount} user(s) to '${targetRole.role_name}'.`]
        );

        return res.json({
          success: true,
          message: `Role '${role.role_name}' deleted successfully. ${userCount} user(s) reassigned to '${targetRole.role_name}'.`,
          deleted: true,
          reassignedTo: targetRole.role_name,
          reassignedCount: userCount
        });
      }

      if (force === true || force === 'true') {
        const fallback = await query.get("SELECT role_name FROM roles WHERE role_name = 'View Only'") || { role_name: 'View Only' };
        await query.run('UPDATE users SET role = ? WHERE role = ?', [fallback.role_name, role.role_name]);

        await query.run('DELETE FROM role_permissions WHERE role_name = ?', [role.role_name]);
        await query.run('DELETE FROM roles WHERE id = ?', [id]);

        await query.run(
          `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
           VALUES ('Admin', ?, ?, 'Role Deleted', ?)`,
          [req.user.id.toString(), req.user.full_name, `Deleted role '${role.role_name}' and reset ${userCount} user(s) to '${fallback.role_name}'.`]
        );

        return res.json({
          success: true,
          message: `Role '${role.role_name}' deleted. ${userCount} user(s) unassigned to '${fallback.role_name}'.`,
          deleted: true
        });
      }

      // Default safe behavior when users are assigned: soft-deactivate to prevent orphaned users
      await query.run('UPDATE roles SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
         VALUES ('Admin', ?, ?, 'Role Deactivated', ?)`,
        [req.user.id.toString(), req.user.full_name, `Deactivated role '${role.role_name}' with ${userCount} assigned user(s).`]
      );

      return res.json({
        success: true,
        message: `Role '${role.role_name}' was soft-deactivated (${userCount} user(s) assigned).`,
        deactivated: true,
        userCount
      });
    }

    // 3. No users assigned - hard delete cleanly
    await query.run('DELETE FROM role_permissions WHERE role_name = ?', [role.role_name]);
    await query.run('DELETE FROM roles WHERE id = ?', [id]);

    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, details)
       VALUES ('Admin', ?, ?, 'Role Deleted', ?)`,
      [req.user.id.toString(), req.user.full_name, `Deleted role '${role.role_name}'`]
    );

    res.json({
      success: true,
      message: `Role '${role.role_name}' deleted successfully.`,
      deleted: true
    });
  } catch (err) {
    console.error('Delete role error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete role.' });
  }
});

module.exports = router;
