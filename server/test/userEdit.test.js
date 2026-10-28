const http = require('http');
const { query } = require('../db/database');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const options = {
      hostname: 'localhost',
      port: process.env.TEST_PORT || 5000,
      path,
      method,
      headers: defaultHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data, raw: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runUserEditTests() {
  console.log('--- STARTING USER EDIT & MANAGEMENT TEST SUITE ---');

  // 1. Authenticate Admin
  console.log('\n[Test 1] Authenticating Admin...');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes)}`);
  }
  const adminToken = loginRes.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✓ PASS: Admin authenticated.');

  // 2. Fetch user list to get a target user (e.g. reviewer1 or hr_admin)
  console.log('\n[Test 2] Fetching user directory to identify test target user...');
  const listRes = await makeRequest('GET', '/api/users', null, adminHeaders);
  if (listRes.status !== 200 || !listRes.data.users || listRes.data.users.length === 0) {
    throw new Error(`Failed to list users: ${JSON.stringify(listRes)}`);
  }
  const targetUser = listRes.data.users.find(u => u.username === 'reviewer1') || listRes.data.users[1];
  console.log(`✓ PASS: Selected target user: @${targetUser.username} (ID: ${targetUser.id}).`);

  // 3. Update user details via PUT /api/users/:id
  console.log(`\n[Test 3] Testing PUT /api/users/${targetUser.id} with modified details...`);
  const updatePayload = {
    full_name: 'Kavita Iyer (Lead BGV Specialist)',
    email: 'kavita.lead@collman.in',
    role: 'BGV Reviewer',
    branch: 'Chennai Headquarters',
    department: 'Quality & Operations',
    is_active: 1
  };

  const updateRes = await makeRequest('PUT', `/api/users/${targetUser.id}`, updatePayload, adminHeaders);
  if (updateRes.status !== 200 || !updateRes.data.success) {
    throw new Error(`User update failed: ${JSON.stringify(updateRes)}`);
  }
  console.log(`✓ PASS: User updated successfully: ${updateRes.data.message}`);

  // 4. Verify Database Persistence
  console.log(`\n[Test 4] Verifying database persistence for User ID: ${targetUser.id}...`);
  const dbUser = await query.get('SELECT * FROM users WHERE id = ?', [targetUser.id]);
  if (
    dbUser.full_name !== 'Kavita Iyer (Lead BGV Specialist)' ||
    dbUser.email !== 'kavita.lead@collman.in' ||
    dbUser.branch !== 'Chennai Headquarters' ||
    dbUser.department !== 'Quality & Operations' ||
    dbUser.is_active !== 1
  ) {
    throw new Error(`Database verification mismatch: ${JSON.stringify(dbUser)}`);
  }
  console.log('✓ PASS: Database reflects updated user fields perfectly.');

  // 5. Verify Audit Log Entry
  console.log('\n[Test 5] Verifying audit log creation for user modification...');
  const auditRow = await query.get(
    "SELECT * FROM audit_logs WHERE action = 'User Modified' ORDER BY id DESC LIMIT 1"
  );
  if (!auditRow) {
    throw new Error('Audit log record not found for user modification.');
  }
  console.log(`✓ PASS: Audit log captured successfully: "${auditRow.details}" by ${auditRow.actor_name}`);

  // 6. Test Email Uniqueness Collision
  console.log('\n[Test 6] Testing duplicate email rejection...');
  const duplicateEmailPayload = {
    full_name: 'Kavita Iyer',
    email: 'admin@collman.com', // Already used by Super Admin
    role: 'BGV Reviewer'
  };
  const dupRes = await makeRequest('PUT', `/api/users/${targetUser.id}`, duplicateEmailPayload, adminHeaders);
  if (dupRes.status === 400 && dupRes.data.error.includes('already in use')) {
    console.log(`✓ PASS: Duplicate email rejected cleanly: "${dupRes.data.error}"`);
  } else {
    throw new Error(`Expected 400 duplicate email rejection, got: ${JSON.stringify(dupRes)}`);
  }

  // 7. Test Password Length Validation (< 6 chars)
  console.log('\n[Test 7] Testing short password validation (< 6 characters)...');
  const shortPassPayload = {
    full_name: 'Kavita Iyer',
    email: 'kavita.lead@collman.in',
    role: 'BGV Reviewer',
    newPassword: '123'
  };
  const passRes = await makeRequest('PUT', `/api/users/${targetUser.id}`, shortPassPayload, adminHeaders);
  if (passRes.status === 400 && passRes.data.error.includes('at least 6 characters')) {
    console.log(`✓ PASS: Short password rejected cleanly: "${passRes.data.error}"`);
  } else {
    throw new Error(`Expected 400 short password rejection, got: ${JSON.stringify(passRes)}`);
  }

  // 8. Test Non-existent User (404)
  console.log('\n[Test 8] Testing non-existent user update...');
  const notFoundRes = await makeRequest('PUT', '/api/users/999999', updatePayload, adminHeaders);
  if (notFoundRes.status === 404) {
    console.log('✓ PASS: Non-existent user returns 404.');
  } else {
    throw new Error(`Expected 404, got: ${JSON.stringify(notFoundRes)}`);
  }

  // 9. Test Unauthorized Access (No Token)
  console.log('\n[Test 9] Testing unauthorized update (No Token)...');
  const unauthRes = await makeRequest('PUT', `/api/users/${targetUser.id}`, updatePayload);
  if (unauthRes.status === 401) {
    console.log('✓ PASS: Unauthenticated request rejected with 401.');
  } else {
    throw new Error(`Expected 401, got: ${JSON.stringify(unauthRes)}`);
  }

  console.log('\n===============================================================');
  console.log(' ALL 9 USER EDIT & MANAGEMENT UNIT TESTS PASSED 100%! ');
  console.log('===============================================================\n');
}

if (require.main === module) {
  runUserEditTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runUserEditTests };
