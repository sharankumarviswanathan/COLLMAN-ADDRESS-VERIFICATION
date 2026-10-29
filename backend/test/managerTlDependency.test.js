const assert = require('assert');
const http = require('http');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const reqHeaders = { ...headers };
    if (body) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: process.env.TEST_PORT || 5000,
      path: `/api${path}`,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log(' RUNNING MANAGER - TEAM LEADER DROPDOWN DEPENDENCY TEST SUITE');
  console.log('================================================================\n');

  // 1. Authenticate Admin
  const loginRes = await makeRequest('POST', '/auth/login', {
    username: 'admin@collman.com',
    password: 'admin123'
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✓ Step 1: Admin authenticated.');

  // 2. Test empty manager query returns 0 team leaders
  const emptyRes = await makeRequest('GET', '/masters/team-leaders', null, authHeaders);
  assert.strictEqual(emptyRes.status, 200);
  assert.strictEqual(emptyRes.data.teamLeaders.length, 0, 'Empty manager query must return empty list');
  console.log('✓ Step 2: Empty managerId cleanly returns 0 team leaders.');

  // 3. Test Manager ARUN CINCO (Employee ID: 11134)
  const arunCincoRes = await makeRequest('GET', '/masters/team-leaders?managerId=11134', null, authHeaders);
  assert.strictEqual(arunCincoRes.status, 200);
  assert.strictEqual(arunCincoRes.data.teamLeaders.length, 5, 'ARUN CINCO must have exactly 5 Team Leaders');
  const arunTLNames = arunCincoRes.data.teamLeaders.map(tl => tl.full_name);
  assert.ok(arunTLNames.includes('MANIKANDAN K'), 'Must include MANIKANDAN K');
  assert.ok(arunTLNames.includes('T J MADHU'), 'Must include T J MADHU');
  assert.ok(arunTLNames.includes('ULLAGANTI GURU DEVI'), 'Must include ULLAGANTI GURU DEVI');
  assert.ok(arunTLNames.includes('ARAVINDAN R'), 'Must include ARAVINDAN R');
  assert.ok(arunTLNames.includes('M. KARTHICK'), 'Must include M. KARTHICK');
  console.log(`✓ Step 3: Manager ARUN CINCO (11134) returns exactly his 5 Team Leaders: ${arunTLNames.join(', ')}`);

  // 4. Test Manager SARANGAN SAMPATH (Employee ID: 10011)
  const saranganRes = await makeRequest('GET', '/masters/team-leaders?managerId=10011', null, authHeaders);
  assert.strictEqual(saranganRes.status, 200);
  assert.strictEqual(saranganRes.data.teamLeaders.length, 3, 'SARANGAN SAMPATH must have exactly 3 Team Leaders');
  const saranganTLNames = saranganRes.data.teamLeaders.map(tl => tl.full_name);
  assert.ok(saranganTLNames.includes('ARULMANI T'), 'Must include ARULMANI T');
  console.log(`✓ Step 4: Manager SARANGAN SAMPATH (10011) returns exactly his 3 Team Leaders: ${saranganTLNames.join(', ')}`);

  // 5. Test Manager BALAJI SHANKAR (Employee ID: 10571)
  const balajiRes = await makeRequest('GET', '/masters/team-leaders?managerId=10571', null, authHeaders);
  assert.strictEqual(balajiRes.status, 200);
  assert.strictEqual(balajiRes.data.teamLeaders.length, 10, 'BALAJI SHANKAR must have exactly 10 Team Leaders');
  console.log(`✓ Step 5: Manager BALAJI SHANKAR (10571) returns exactly his 10 Team Leaders.`);

  // 6. Test Backend Enforcement: Attempting to save employee with Mismatched Manager & Team Leader
  const testMismatchId = 'TEST_DEP_MISMATCH_' + Date.now();
  const mismatchRes = await makeRequest('POST', '/employees', {
    employeeId: testMismatchId,
    employeeName: 'Mismatch Test Employee',
    mobileNumber: '9999911111',
    dateOfJoining: '2026-01-01',
    department: 'Customer Support',
    branch: 'Chennai Headquarters',
    currentAddress: 'Test Address 123',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    reportingManager: 'ARUN CINCO',
    teamLeader: 'ARULMANI T' // Belongs to SARANGAN SAMPATH, NOT ARUN CINCO!
  }, authHeaders);

  assert.strictEqual(mismatchRes.status, 400, 'Saving with mismatched Manager-TL must be rejected with 400');
  assert.ok(mismatchRes.data.error.includes('does not report to Manager'), 'Error message must specify relationship failure');
  console.log(`✓ Step 6: Backend strictly rejected saving employee with mismatched Manager-TL: "${mismatchRes.data.error}"`);

  // 7. Test Backend Enforcement: Saving employee with Valid Matching Manager & Team Leader
  const testValidId = 'TEST_DEP_VALID_' + Date.now();
  const validRes = await makeRequest('POST', '/employees', {
    employeeId: testValidId,
    employeeName: 'Valid Hierarchy Employee',
    mobileNumber: '9999922222',
    dateOfJoining: '2026-01-01',
    department: 'Customer Support',
    branch: 'Chennai Headquarters',
    currentAddress: 'Test Address 456',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    reportingManager: 'ARUN CINCO',
    teamLeader: 'MANIKANDAN K' // Valid TL for ARUN CINCO!
  }, authHeaders);

  assert.strictEqual(validRes.status, 201, 'Saving with valid Manager-TL must succeed');
  console.log(`✓ Step 7: Successfully created employee with valid Manager-TL relationship (ID: ${testValidId}).`);

  // Cleanup test employee
  const { query } = require('../db/database');
  await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testValidId]);
  await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testValidId]);
  await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [testValidId]);
  await query.run('DELETE FROM employees WHERE employee_id = ?', [testValidId]);
  console.log(`✓ Step 8: Cleaned up test record.`);

  console.log('\n================================================================');
  console.log(' ALL MANAGER - TEAM LEADER DEPENDENCY TESTS PASSED! (8/8)');
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
