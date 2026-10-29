const jwt = require('jsonwebtoken');
const { query } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'collman_address_verification_secret_key_2026';
const VERIFY_SESSION_SECRET = process.env.VERIFY_SESSION_SECRET || 'collman_employee_verify_session_token_key_2026';

const { ALL_PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } = require('../utils/permissions');

// Middleware for Admin / Internal users
async function authenticateAdmin(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await query.get(
      'SELECT id, username, email, full_name, role, branch, department, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Unauthorized: User account is inactive or not found' });
    }

    let permissions = [];
    if (user.role === 'Super Admin') {
      permissions = [...ALL_PERMISSION_KEYS];
    } else {
      const perms = await query.all(
        'SELECT permission_key FROM role_permissions WHERE role_name = ?',
        [user.role]
      );
      if (perms && perms.length > 0) {
        permissions = perms.map((p) => p.permission_key);
      } else if (DEFAULT_ROLE_PERMISSIONS[user.role]) {
        permissions = [...DEFAULT_ROLE_PERMISSIONS[user.role]];
      }
    }
    user.permissions = permissions;

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
}

// Helper to check if a user is a Team Leader
function isTeamLeader(user) {
  if (!user || !user.role) return false;
  if (user.role === 'Super Admin') return false; // Super Admin is never restricted
  const roleLower = String(user.role).trim().toLowerCase();
  return roleLower === 'team leader' || roleLower.includes('team lead') || roleLower === 'tl';
}

// Granular permission check with alias & legacy fallback resolution
function checkUserHasPermission(user, ...permissionKeys) {
  if (!user) return false;
  if (user.role === 'Super Admin') return true;
  const userPerms = Array.isArray(user.permissions) ? user.permissions : [];

  return permissionKeys.some((key) => {
    if (userPerms.includes(key)) return true;

    // Backward-compatibility umbrella mappings
    if (key === 'approve_cases' || key === 'reject_cases') {
      if (userPerms.includes('make_decision')) return true;
    }
    if (key === 'upload_employees') {
      if (userPerms.includes('bulk_upload')) return true;
    }
    if (key === 'bulk_upload') {
      if (userPerms.includes('upload_employees')) return true;
    }
    if (['create_user', 'edit_user', 'activate_user', 'deactivate_user', 'delete_user'].includes(key)) {
      if (userPerms.includes('manage_users')) return true;
    }
    if (['create_masters', 'edit_masters', 'delete_masters', 'manage_settings'].includes(key)) {
      if (userPerms.includes('manage_masters')) return true;
    }
    if (key === 'manage_permissions') {
      if (userPerms.includes('manage_roles')) return true;
    }
    if (key === 'download_case_report') {
      if (userPerms.includes('download_reports')) return true;
    }
    if (['export_dashboard', 'export_employees', 'export_queue', 'export_reports', 'export_audit_logs'].includes(key)) {
      if (userPerms.includes('download_reports')) return true;
    }
    return false;
  });
}

// Permission-based access control
function requirePermission(...permissionKeys) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }
    if (req.user.role === 'Super Admin') {
      return next();
    }
    const hasPerm = checkUserHasPermission(req.user, ...permissionKeys);
    if (!hasPerm) {
      return res.status(403).json({
        error: `Forbidden: Insufficient privileges. Required permission: ${permissionKeys.join(' or ')}`
      });
    }
    next();
  };
}

// Role-based access control (with permission fallback for custom roles)
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges for this action' });
    }
    if (req.user.role === 'Super Admin') {
      return next();
    }
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }
    const userPerms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const permittedRolePerms = allowedRoles.flatMap((r) => DEFAULT_ROLE_PERMISSIONS[r] || []);
    if (userPerms.some((p) => permittedRolePerms.includes(p))) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges for this action' });
  };
}

// Middleware for Employee Verification Session (Common link)
async function authenticateEmployeeSession(req, res, next) {
  try {
    const authHeader = req.headers['x-employee-session'] ||
      (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : req.headers['authorization']);
    if (!authHeader) {
      return res.status(401).json({ error: 'Verification session missing. Please re-enter your Employee ID.' });
    }

    const decoded = jwt.verify(authHeader, VERIFY_SESSION_SECRET);
    const employee = await query.get(
      `SELECT employee_id, employee_name, department, designation, branch, location, date_of_joining,
              team_leader, hr_current_address, hr_latitude, hr_longitude, hr_reference_quality, hr_reference_type, verification_status
       FROM employees WHERE employee_id = ?`,
      [decoded.employeeId]
    );

    if (!employee) {
      return res.status(401).json({ error: 'Employee record not found.' });
    }

    req.employee = employee;
    req.attemptNumber = decoded.attemptNumber || 1;
    req.tlId = decoded.tlId || employee.team_leader || null;
    req.tlName = decoded.tlName || null;
    req.agentId = employee.employee_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Verification session expired. Please re-enter your Employee ID.' });
  }
}

function generateAdminToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function generateEmployeeSessionToken(employeeId, attemptNumber = 1, tlId = null, tlName = null) {
  return jwt.sign(
    { employeeId, attemptNumber, tlId, tlName },
    VERIFY_SESSION_SECRET,
    { expiresIn: '2h' }
  );
}

module.exports = {
  authenticateAdmin,
  requireRoles,
  requirePermission,
  checkUserHasPermission,
  isTeamLeader,
  authenticateEmployeeSession,
  generateAdminToken,
  generateEmployeeSessionToken,
  JWT_SECRET,
  VERIFY_SESSION_SECRET
};
