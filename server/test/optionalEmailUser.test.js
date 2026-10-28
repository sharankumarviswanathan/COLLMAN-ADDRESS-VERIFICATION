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
      port: 5000,
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

async function runOptionalEmailTests() {
  console.log('--- STARTING OPTIONAL EMAIL USER VERIFICATION TEST SUITE ---');

  // 1. Authenticate Admin
  console.log('\n[Test 1] Authenticating Admin...');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes)}`);
  }
  const adminHeaders = { Authorization: `Bearer ${loginRes.data.token}` };
  console.log('✓ PASS: Admin authenticated.');

  // Clean any previous test users
  await query.run("DELETE FROM users WHERE username IN ('surya_test_202140', 'surya_test_202141')");

  // 2. Create User 1 WITHOUT Email Address (Testing exact user scenario: SURYA, 202140)
  console.log('\n[Test 2] Creating User without email address (Employee ID: surya_test_202140)...');
  const create1Res = await makeRequest('POST', '/api/users', {
    employee_id: 'surya_test_202140',
    full_name: 'SURYA',
    email: '', // empty email
    password: 'password123',
    role: 'BGV Reviewer',
    branch: 'Chennai Headquarters',
    department: 'Operations'
  }, adminHeaders);

  if (create1Res.status !== 201 || !create1Res.data.success) {
    throw new Error(`Failed to create user without email: ${JSON.stringify(create1Res)}`);
  }
  console.log(`✓ PASS: User created without email! ID: ${create1Res.data.userId}`);

  // 3. Verify Database Record for User 1
  console.log('\n[Test 3] Verifying database record has null email...');
  const dbUser1 = await query.get("SELECT * FROM users WHERE username = 'surya_test_202140'");
  if (!dbUser1 || dbUser1.email !== null) {
    throw new Error(`Expected email to be null, got: ${dbUser1?.email}`);
  }
  console.log(`✓ PASS: Database reflects null email for user ${dbUser1.full_name} (${dbUser1.username}).`);

  // 4. Create User 2 ALSO WITHOUT Email Address (Verifies multiple users without email do not conflict)
  console.log('\n[Test 4] Creating second user also without email address (surya_test_202141)...');
  const create2Res = await makeRequest('POST', '/api/users', {
    employee_id: 'surya_test_202141',
    full_name: 'SURYA SECOND',
    email: null,
    password: 'password123',
    role: 'BGV Reviewer',
    branch: 'Chennai Headquarters',
    department: 'Operations'
  }, adminHeaders);

  if (create2Res.status !== 201 || !create2Res.data.success) {
    throw new Error(`Failed to create second user without email: ${JSON.stringify(create2Res)}`);
  }
  console.log(`✓ PASS: Second user without email created cleanly! ID: ${create2Res.data.userId}`);

  // 5. Test Editing User 1 without providing email
  console.log('\n[Test 5] Updating user without email...');
  const updateRes = await makeRequest('PUT', `/api/users/${dbUser1.id}`, {
    full_name: 'SURYA UPDATED',
    email: '',
    role: 'BGV Reviewer',
    branch: 'Chennai Headquarters',
    department: 'Operations',
    is_active: 1
  }, adminHeaders);

  if (updateRes.status !== 200 || !updateRes.data.success) {
    throw new Error(`Failed to update user without email: ${JSON.stringify(updateRes)}`);
  }
  console.log('✓ PASS: User updated successfully without email.');

  // 6. Test Logging in with Employee ID (No email account)
  console.log('\n[Test 6] Logging in with Employee ID for user without email...');
  const empLoginRes = await makeRequest('POST', '/api/auth/login', {
    username: 'surya_test_202140',
    password: 'password123'
  });
  if (empLoginRes.status !== 200 || !empLoginRes.data.token) {
    throw new Error(`Login failed for user without email: ${JSON.stringify(empLoginRes)}`);
  }
  console.log('✓ PASS: User without email authenticated successfully using Employee ID.');

  // Cleanup test users
  await query.run("DELETE FROM users WHERE username IN ('surya_test_202140', 'surya_test_202141')");
  console.log('\n✓ Cleaned up test records.');

  console.log('\n===============================================================');
  console.log(' ALL OPTIONAL EMAIL TESTS PASSED 100%! ');
  console.log('===============================================================\n');
}

if (require.main === module) {
  runOptionalEmailTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runOptionalEmailTests };
