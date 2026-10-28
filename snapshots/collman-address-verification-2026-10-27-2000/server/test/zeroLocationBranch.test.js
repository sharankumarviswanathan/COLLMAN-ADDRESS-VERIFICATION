const assert = require('assert');
const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

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
  console.log('--- STARTING ZERO-LOCATION BRANCH & OPTIONAL LOCATION TESTS ---');

  // 1. Authenticate Admin
  const loginRes = await makeRequest('POST', '/auth/login', {
    username: 'admin@collman.com',
    password: 'admin123'
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
  const token = loginRes.body.token;
  console.log('✓ 1. Admin login successful');

  // 2. Create a test branch with 1 single location
  const branchCode = `ZLOC_${Date.now()}`.slice(0, 10);
  const branchName = `Zero Loc Branch ${Date.now()}`;
  const createBranchRes = await makeRequest(
    'POST',
    '/masters/branches',
    {
      branch_code: branchCode,
      branch_name: branchName,
      city: 'Mysore',
      state: 'Karnataka',
      is_active: 1,
      locations: [
        { location_name: 'Mysore Palace Zone' }
      ]
    },
    token
  );
  assert.strictEqual(createBranchRes.status, 200);
  assert.strictEqual(createBranchRes.body.locations.length, 1);
  const branchId = createBranchRes.body.branch.id;
  const initialLocId = createBranchRes.body.locations[0].id;
  console.log(`✓ 2. Created branch '${branchName}' (ID: ${branchId}) with exactly 1 location (ID: ${initialLocId})`);

  // 3. Remove the ONLY (last) location using DELETE /api/masters/locations/:id
  const deleteLocRes = await makeRequest('DELETE', `/masters/locations/${initialLocId}`, null, token);
  assert.strictEqual(deleteLocRes.status, 200);
  assert.strictEqual(deleteLocRes.body.removed, true, 'Location must be removed');
  console.log(`✓ 3. Successfully removed the last remaining location from the branch`);

  // 4. Verify branch now has ZERO locations
  const getBranchLocsRes = await makeRequest('GET', `/masters/branches/${branchId}/locations`, null, token);
  assert.strictEqual(getBranchLocsRes.status, 200);
  assert.strictEqual(getBranchLocsRes.body.locations.length, 0, 'Branch must have exactly 0 locations');
  console.log(`✓ 4. Verified branch now operates with 0 locations (Empty location list)`);

  // 5. Update branch with empty locations array
  const updateBranchRes = await makeRequest(
    'PUT',
    `/masters/branches/${branchId}`,
    {
      branch_code: branchCode,
      branch_name: branchName,
      city: 'Mysore',
      state: 'Karnataka',
      is_active: 1,
      locations: []
    },
    token
  );
  assert.strictEqual(updateBranchRes.status, 200);
  assert.strictEqual(updateBranchRes.body.locations.length, 0, 'Updated branch must retain 0 locations');
  console.log(`✓ 5. Successfully updated branch with empty locations array`);

  // 6. Test creating an employee under this 0-location branch WITHOUT location (Location is optional)
  const empId1 = `ZEMP_${Date.now()}`.slice(0, 15);
  const createEmpRes1 = await makeRequest(
    'POST',
    '/employees',
    {
      employeeId: empId1,
      employeeName: 'Zero Location Employee',
      mobileNumber: '9123456780',
      dateOfJoining: '2026-10-27',
      department: 'Operations',
      branch: branchName,
      location: '', // Empty location!
      currentAddress: 'Mysore Main Road 45',
      city: 'Mysore',
      state: 'Karnataka',
      pincode: '570001'
    },
    token
  );
  assert([200, 201].includes(createEmpRes1.status), `Employee creation without location must succeed: ${JSON.stringify(createEmpRes1.body)}`);
  console.log(`✓ 6. Created employee ${empId1} under branch with 0 locations (Location is optional)`);

  // 7. Test creating another branch directly with 0 locations
  const noLocBranchCode = `NOLOC_${Date.now()}`.slice(0, 10);
  const noLocBranchName = `Pure No Loc Branch ${Date.now()}`;
  const createPureBranchRes = await makeRequest(
    'POST',
    '/masters/branches',
    {
      branch_code: noLocBranchCode,
      branch_name: noLocBranchName,
      city: 'Hubli',
      state: 'Karnataka',
      is_active: 1,
      locations: []
    },
    token
  );
  assert.strictEqual(createPureBranchRes.status, 200);
  assert.strictEqual(createPureBranchRes.body.locations.length, 0);
  const pureBranchId = createPureBranchRes.body.branch.id;
  console.log(`✓ 7. Created branch '${noLocBranchName}' directly without any locations`);

  // 8. Create employee under pure 0-location branch
  const empId2 = `NLEMP_${Date.now()}`.slice(0, 15);
  const createEmpRes2 = await makeRequest(
    'POST',
    '/employees',
    {
      employeeId: empId2,
      employeeName: 'Pure Branch Employee',
      mobileNumber: '9123456781',
      dateOfJoining: '2026-10-27',
      department: 'Operations',
      branch: noLocBranchName,
      location: '', // Optional location
      currentAddress: 'Hubli Central 10',
      city: 'Hubli',
      state: 'Karnataka',
      pincode: '580020'
    },
    token
  );
  assert([200, 201].includes(createEmpRes2.status), 'Employee creation without location on pure branch must succeed');
  console.log(`✓ 8. Created employee ${empId2} without location`);

  // 9. Clean up test records
  await makeRequest('DELETE', `/employees/${empId1}`, null, token);
  await makeRequest('DELETE', `/employees/${empId2}`, null, token);
  await makeRequest('DELETE', `/masters/branches/${branchId}`, null, token);
  await makeRequest('DELETE', `/masters/branches/${pureBranchId}`, null, token);
  console.log(`✓ 9. Cleaned up all test branches and employees`);

  console.log('\n======================================================');
  console.log(' ALL ZERO-LOCATION BRANCH & OPTIONAL TESTS PASSED! ');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
