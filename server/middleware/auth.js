const jwt = require('jsonwebtoken');
const { query } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'collman_address_verification_secret_key_2026';
const VERIFY_SESSION_SECRET = process.env.VERIFY_SESSION_SECRET || 'collman_employee_verify_session_token_key_2026';

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

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
}

// Role-based access control
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges for this action' });
    }
    next();
  };
}

// Middleware for Employee Verification Session (Common link)
async function authenticateEmployeeSession(req, res, next) {
  try {
    const authHeader = req.headers['x-employee-session'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Verification session missing. Please re-enter your Employee ID.' });
    }

    const decoded = jwt.verify(authHeader, VERIFY_SESSION_SECRET);
    const employee = await query.get(
      `SELECT employee_id, employee_name, department, designation, branch, location, date_of_joining,
              hr_current_address, hr_latitude, hr_longitude, hr_reference_quality, hr_reference_type, verification_status
       FROM employees WHERE employee_id = ?`,
      [decoded.employeeId]
    );

    if (!employee) {
      return res.status(401).json({ error: 'Employee record not found.' });
    }

    req.employee = employee;
    req.attemptNumber = decoded.attemptNumber || 1;
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

function generateEmployeeSessionToken(employeeId, attemptNumber = 1) {
  return jwt.sign(
    { employeeId, attemptNumber },
    VERIFY_SESSION_SECRET,
    { expiresIn: '2h' }
  );
}

module.exports = {
  authenticateAdmin,
  requireRoles,
  authenticateEmployeeSession,
  generateAdminToken,
  generateEmployeeSessionToken,
  JWT_SECRET,
  VERIFY_SESSION_SECRET
};
