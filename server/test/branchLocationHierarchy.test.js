const assert = require('assert');
const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = process.env.TEST_PORT || 5000;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const fullPath = path.startsWith('/api') ? path : `/api${path}`;
    const options = {
      method,
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: fullPath,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING BRANCH-LOCATION HIERARCHY TESTS ---');

  // 1. Login as Super Admin
  const loginRes = await makeRequest('POST', '/auth/login', {
    username: 'admin@collman.com',
    password: 'admin123'
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
  const token = loginRes.body.token;
  assert(token, 'Should have received auth token');
  console.log('✓ 1. Admin login successful');

  // 2. Fetch all masters - verify locations contain branch_id and branch_name
  const mastersRes = await makeRequest('GET', '/api/masters/all', null, token);
  assert.strictEqual(mastersRes.status, 200);
  assert(Array.isArray(mastersRes.body.branches), 'Branches array present');
  assert(Array.isArray(mastersRes.body.locations), 'Locations array present');
  console.log(`✓ 2. Loaded ${mastersRes.body.branches.length} branches and ${mastersRes.body.locations.length} locations`);

  // Verify Bangalore branch exists
  const blrBranch = mastersRes.body.branches.find(
    (b) => b.branch_name.toUpperCase() === 'BANGALORE' || b.branch_code === 'BGL'
  );
  assert(blrBranch, 'BANGALORE branch must exist in database');
  console.log(`✓ 3. Found BANGALORE branch (ID: ${blrBranch.id}, Code: ${blrBranch.branch_code})`);

  // 3. GET /api/masters/branches/:id/locations
  const blrLocsRes = await makeRequest('GET', `/api/masters/branches/${blrBranch.id}/locations`, null, token);
  assert.strictEqual(blrLocsRes.status, 200);
  assert(Array.isArray(blrLocsRes.body.locations), 'Should return locations array');
  const blrLocNames = blrLocsRes.body.locations.map((l) => l.location_name);
  console.log(`✓ 4. BANGALORE branch locations:`, blrLocNames);
  assert(blrLocNames.includes('Electronic City'), 'Should include Electronic City');
  assert(blrLocNames.includes('Bangalore Central'), 'Should include Bangalore Central');

  // 4. Test duplicate location rejection under same branch
  const dupLocRes = await makeRequest(
    'POST',
    '/masters/locations',
    {
      branch_id: blrBranch.id,
      location_name: 'electronic city' // case-insensitive duplicate
    },
    token
  );
  assert.strictEqual(dupLocRes.status, 400, 'Duplicate location under same branch must be rejected');
  assert(dupLocRes.body.error.includes('already exists'), 'Error message should indicate duplicate');
  console.log('✓ 5. Duplicate location correctly rejected under same branch');

  // 5. Test adding a unique location under Bangalore
  const uniqueLocName = `Koramangala 4th Block ${Date.now()}`;
  const addLocRes = await makeRequest(
    'POST',
    '/api/masters/locations',
    {
      branch_id: blrBranch.id,
      location_name: uniqueLocName
    },
    token
  );
  assert.strictEqual(addLocRes.status, 200, 'Adding unique location should succeed');
  assert.strictEqual(addLocRes.body.location.branch_id, blrBranch.id);
  assert.strictEqual(addLocRes.body.location.location_name, uniqueLocName);
  const createdLocId = addLocRes.body.location.id;
  console.log(`✓ 6. Created location '${uniqueLocName}' (ID: ${createdLocId}) under BANGALORE`);

  // 6. Test updating the location
  const updatedLocName = `${uniqueLocName} (Updated)`;
  const updateLocRes = await makeRequest(
    'PUT',
    `/api/masters/locations/${createdLocId}`,
    {
      location_name: updatedLocName
    },
    token
  );
  assert.strictEqual(updateLocRes.status, 200, 'Updating location should succeed');
  assert.strictEqual(updateLocRes.body.location.location_name, updatedLocName);
  console.log(`✓ 7. Updated location name to '${updatedLocName}'`);

  // 7. Test Creating a Branch with multiple locations in one shot
  const testBranchCode = `TB${String(Date.now()).slice(-4)}`;
  const testBranchName = `Test Branch Multi ${Date.now()}`;
  const createBranchRes = await makeRequest(
    'POST',
    '/api/masters/branches',
    {
      branch_code: testBranchCode,
      branch_name: testBranchName,
      city: 'Pune',
      state: 'Maharashtra',
      is_active: 1,
      locations: [
        { location_name: 'Hinjawadi Tech Zone' },
        { location_name: 'Viman Nagar Hub' },
        'Magarpatta City'
      ]
    },
    token
  );
  assert.strictEqual(createBranchRes.status, 200, 'Branch creation with locations should succeed');
  assert.strictEqual(createBranchRes.body.locations.length, 3, 'Should create all 3 locations');
  const newBranchId = createBranchRes.body.branch.id;
  console.log(`✓ 8. Created new branch '${testBranchName}' with 3 locations in one request`);

  // Verify the newly created branch's locations via GET endpoint
  const checkNewBranchLocs = await makeRequest('GET', `/api/masters/branches/${newBranchId}/locations`, null, token);
  assert.strictEqual(checkNewBranchLocs.status, 200);
  assert.strictEqual(checkNewBranchLocs.body.locations.length, 3);
  console.log('✓ 9. Retrieved and verified all 3 locations for newly created branch');

  // 8. Test Employee validation: Mismatched Branch and Location
  const invalidEmpId = `EMP_INVALID_${Date.now()}`;
  const invalidEmpRes = await makeRequest(
    'POST',
    '/api/employees',
    {
      employeeId: invalidEmpId,
      employeeName: 'Invalid Location Employee',
      mobileNumber: '9988776655',
      dateOfJoining: '2026-10-27',
      department: 'Operations',
      branch: 'BANGALORE',
      location: 'Chennai Central', // Does NOT belong to Bangalore!
      currentAddress: 'Sample Street 123',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001'
    },
    token
  );
  assert.strictEqual(invalidEmpRes.status, 400, 'Employee creation with mismatched branch-location must fail');
  assert(
    invalidEmpRes.body.error.includes("does not belong to branch 'BANGALORE'"),
    `Error should state mismatch: ${invalidEmpRes.body.error}`
  );
  console.log('✓ 10. Mismatched branch and location rejected by backend employee creation');

  // 9. Test Employee creation with VALID Branch and Location
  const validEmpId = `EMP_VALID_${Date.now()}`;
  const validEmpRes = await makeRequest(
    'POST',
    '/api/employees',
    {
      employeeId: validEmpId,
      employeeName: 'Valid Bangalore Employee',
      mobileNumber: '9988776644',
      dateOfJoining: '2026-10-27',
      department: 'Operations',
      branch: 'BANGALORE',
      location: 'Electronic City', // Valid for Bangalore!
      currentAddress: 'Electronic City Phase 1',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560100'
    },
    token
  );
  assert([200, 201].includes(validEmpRes.status), 'Valid branch-location employee creation must succeed');
  console.log(`✓ 11. Created employee ${validEmpId} with BANGALORE / Electronic City`);

  // 10. Test Safe Deletion: Attempt to remove 'Electronic City' while employee is assigned
  const ecLoc = blrLocsRes.body.locations.find((l) => l.location_name === 'Electronic City');
  assert(ecLoc, 'Electronic City location must exist');

  const safeDelRes = await makeRequest('DELETE', `/masters/locations/${ecLoc.id}`, null, token);
  assert.strictEqual(safeDelRes.status, 200);
  assert.strictEqual(safeDelRes.body.removed, true, 'Location must be removed from branch');
  assert.strictEqual(safeDelRes.body.unlinked, true, 'Location with assigned employees must be unlinked to preserve historical records');
  console.log('✓ 12. Location assigned to employee safely unlinked from branch with historical integrity preserved');

  // Verify historical employee record still has 'Electronic City'
  const empCheckRes = await makeRequest('GET', `/employees/${validEmpId}`, null, token);
  assert.strictEqual(empCheckRes.status, 200);
  assert.strictEqual(empCheckRes.body.employee.location, 'Electronic City');
  console.log('✓ 13. Historical employee record preserved with location intact');

  // Re-add Electronic City to Bangalore so normal master configuration remains intact
  await makeRequest('POST', `/masters/locations`, { branch_id: blrBranch.id, location_name: 'Electronic City' }, token);
  console.log('✓ 14. Re-added Electronic City location to Bangalore for continuous system operation');

  // 11. Test Hard Delete on unassigned location
  const unassignedDelRes = await makeRequest('DELETE', `/api/masters/locations/${createdLocId}`, null, token);
  assert.strictEqual(unassignedDelRes.status, 200);
  assert.strictEqual(unassignedDelRes.body.deactivated, undefined);
  assert(unassignedDelRes.body.message.includes('deleted successfully'));
  console.log('✓ 15. Unassigned location successfully hard-deleted');

  // Clean up test employee
  await makeRequest('DELETE', `/api/employees/${validEmpId}`, null, token);
  console.log('✓ 16. Cleaned up test employee');

  console.log('\n=============================================');
  console.log(' ALL 16 BRANCH-LOCATION TESTS PASSED SUCCESSFULLY! ');
  console.log('=============================================');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
