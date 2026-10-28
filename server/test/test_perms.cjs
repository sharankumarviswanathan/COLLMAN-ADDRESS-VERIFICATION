const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { generateAdminToken } = require('../middleware/auth');

const dbPath = path.join(__dirname, '../db/collman_bgv.db');
const db = new sqlite3.Database(dbPath);

function doRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  const users = await new Promise((resolve, reject) => {
    db.all('SELECT id, username, full_name, email, role, is_active FROM users WHERE role = "Team Leader"', [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });

  const surya = users.find(u => (u.full_name && u.full_name.includes('Surya')) || u.role === 'Team Leader');
  if (!surya) {
    console.error('Surya user not found in DB');
    process.exit(1);
  }

  const token = generateAdminToken(surya);
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('--- 1. Testing GET /api/auth/me ---');
  const meRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Status:', meRes.status);
  const meJson = JSON.parse(meRes.body);
  console.log('User Name:', meJson.user?.fullName);
  console.log('User Role:', meJson.user?.role);
  console.log('User Permissions:', meJson.user?.permissions);

  console.log('\n--- 2. Testing Allowed Endpoints (Should be 200) ---');
  const empRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees?limit=1',
    method: 'GET',
    headers: authHeaders
  });
  console.log('GET /api/employees (view_employees): status', empRes.status, empRes.status === 200 ? '✓ PASS' : '✗ FAIL');

  const queueRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/queue?limit=1',
    method: 'GET',
    headers: authHeaders
  });
  console.log('GET /api/queue (view_queue): status', queueRes.status, queueRes.status === 200 ? '✓ PASS' : '✗ FAIL');

  console.log('\n--- 3. Testing Forbidden Endpoints (Should be 403) ---');
  const downloadsRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/downloads',
    method: 'GET',
    headers: authHeaders
  });
  console.log('GET /api/downloads (download_reports): status', downloadsRes.status, downloadsRes.status === 403 ? '✓ PASS' : '✗ FAIL');

  const auditRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/audit',
    method: 'GET',
    headers: authHeaders
  });
  console.log('GET /api/audit (view_audit_logs): status', auditRes.status, auditRes.status === 403 ? '✓ PASS' : '✗ FAIL');

  const usersRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/users',
    method: 'GET',
    headers: authHeaders
  });
  console.log('GET /api/users (view_users): status', usersRes.status, usersRes.status === 403 ? '✓ PASS' : '✗ FAIL');

  const rolesRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/roles',
    method: 'GET',
    headers: authHeaders
  });
  console.log('GET /api/roles (manage_roles): status', rolesRes.status, rolesRes.status === 403 ? '✓ PASS' : '✗ FAIL');

  const createEmpRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees',
    method: 'POST',
    headers: authHeaders
  }, JSON.stringify({ employeeId: 'TEST999', employeeName: 'Test' }));
  console.log('POST /api/employees (create_employee): status', createEmpRes.status, createEmpRes.status === 403 ? '✓ PASS' : '✗ FAIL');

  const deleteEmpRes = await doRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/employees/COL00101',
    method: 'DELETE',
    headers: authHeaders
  });
  console.log('DELETE /api/employees/COL00101 (delete_employee): status', deleteEmpRes.status, deleteEmpRes.status === 403 ? '✓ PASS' : '✗ FAIL');

  console.log('\n--- ALL PERMISSIONS INTEGRATION TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
