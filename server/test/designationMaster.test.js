/**
 * Test Suite: Designations Master Entity Registry & Cascading Dependency
 */

const assert = require('assert');
const { query } = require('../db/database');

const API_BASE = `http://localhost:${process.env.TEST_PORT || 5000}/api`;

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('================================================================');
  console.log(' RUNNING DESIGNATIONS MASTER REGISTRY TEST SUITE');
  console.log('================================================================\n');

  let adminToken = '';
  let createdDesigId = null;
  const testDesigCode = 'QA_SPEC_' + Date.now().toString().slice(-4);
  const testDesigName = 'Quality Assurance Specialist ' + Date.now().toString().slice(-4);
  const testEmpId = 'TEST_EMP_DES_' + Date.now().toString().slice(-5);

  try {
    // 1. Authenticate Admin
    console.log('[Step 1] Authenticating Admin...');
    const authRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin@collman.com', password: 'admin123' })
    });
    assert.strictEqual(authRes.status, 200, 'Admin login must succeed');
    adminToken = authRes.data.token;
    console.log('✓ Admin authenticated successfully.\n');

    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 2. Test GET /api/masters/all includes designations
    console.log('[Step 2] Testing GET /api/masters/all contains designations...');
    const allMastersRes = await request('/masters/all', {
      headers: authHeaders
    });
    assert.strictEqual(allMastersRes.status, 200, 'GET /api/masters/all must return 200');
    assert(Array.isArray(allMastersRes.data.designations), 'masters.designations must be an array');
    assert(allMastersRes.data.designations.length > 0, 'masters.designations must contain initial designations');
    console.log(`✓ GET /api/masters/all verified with ${allMastersRes.data.designations.length} designations.\n`);

    // 3. Test GET /api/masters/designations
    console.log('[Step 3] Testing GET /api/masters/designations...');
    const desigsRes = await request('/masters/designations', {
      headers: authHeaders
    });
    assert.strictEqual(desigsRes.status, 200, 'GET /api/masters/designations must return 200');
    assert(Array.isArray(desigsRes.data.designations), 'response must have designations array');
    console.log(`✓ GET /api/masters/designations returned ${desigsRes.data.designations.length} records.\n`);

    // 4. Test POST /api/masters/designations (Creation)
    console.log('[Step 4] Creating new designation...');
    const createRes = await request('/masters/designations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        designation_code: testDesigCode,
        designation_name: testDesigName,
        description: 'Test designation for QA automation'
      })
    });
    assert.strictEqual(createRes.status, 200, 'Creating designation must return 200');
    assert.strictEqual(createRes.data.success, true, 'success flag must be true');
    createdDesigId = createRes.data.designation.id;
    assert(createdDesigId, 'Created designation must have an ID');
    console.log(`✓ Successfully created designation ID ${createdDesigId}: ${testDesigName} (${testDesigCode})\n`);

    // 5. Test Duplicate Code Prevention (Case-insensitive)
    console.log('[Step 5] Testing duplicate code prevention...');
    const dupCodeRes = await request('/masters/designations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        designation_code: testDesigCode.toLowerCase(), // testing case-insensitive check
        designation_name: 'Different Name ' + Date.now()
      })
    });
    assert.strictEqual(dupCodeRes.status, 400, 'Duplicate code must be rejected with 400');
    assert(dupCodeRes.data.error.includes('already exists'), 'Error must specify code already exists');
    console.log('✓ Duplicate designation code correctly rejected with 400.\n');

    // 6. Test Duplicate Name Prevention (Case-insensitive)
    console.log('[Step 6] Testing duplicate name prevention...');
    const dupNameRes = await request('/masters/designations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        designation_code: 'UNIQUE_' + Date.now().toString().slice(-4),
        designation_name: testDesigName.toLowerCase() // lowercase test
      })
    });
    assert.strictEqual(dupNameRes.status, 400, 'Duplicate name must be rejected with 400');
    assert(dupNameRes.data.error.includes('already exists'), 'Error must specify name already exists');
    console.log('✓ Duplicate designation name correctly rejected with 400.\n');

    // 7. Test Missing Required Fields
    console.log('[Step 7] Testing missing required fields...');
    const missingRes = await request('/masters/designations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ designation_name: '' })
    });
    assert.strictEqual(missingRes.status, 400, 'Missing fields must be rejected with 400');
    console.log('✓ Missing fields correctly rejected with 400.\n');

    // 8. Test PUT /api/masters/designations/:id (Update & Cascading Rename)
    console.log('[Step 8] Testing update and cascading rename...');
    // First, link a test employee to this designation
    await query.run(
      `INSERT INTO employees (
        employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
        hr_current_address, hr_city, hr_state, hr_pincode, date_of_joining, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testEmpId,
        'Test Employee For Desig',
        '9988776655',
        `${testEmpId.toLowerCase()}@collman.com`,
        'Chennai Headquarters',
        'Chennai Central',
        'Operations',
        testDesigName, // initial designation
        '123 Test Street',
        'Chennai',
        'Tamil Nadu',
        '600001',
        '2026-10-27',
        'Not Started'
      ]
    );

    const updatedDesigName = testDesigName + ' Updated';
    const updateRes = await request(`/masters/designations/${createdDesigId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        designation_code: testDesigCode,
        designation_name: updatedDesigName,
        description: 'Updated description'
      })
    });
    assert.strictEqual(updateRes.status, 200, 'Update designation must return 200');
    assert.strictEqual(updateRes.data.designation.designation_name, updatedDesigName);

    // Verify employee record cascade
    const updatedEmp = await query.get('SELECT designation FROM employees WHERE employee_id = ?', [testEmpId]);
    assert.strictEqual(updatedEmp.designation, updatedDesigName, 'Employee designation must cascade to updated name');
    console.log(`✓ Cascading designation rename verified: Employee updated to '${updatedEmp.designation}'.\n`);

    // 9. Test Safe Deletion / Deactivation when assigned to Employee
    console.log('[Step 9] Testing safe deactivation when assigned to employee...');
    const deleteAssignedRes = await request(`/masters/designations/${createdDesigId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert.strictEqual(deleteAssignedRes.status, 200, 'Delete assigned designation must return 200');
    assert.strictEqual(deleteAssignedRes.data.deactivated, true, 'Must be soft-deactivated, not hard deleted');
    assert(deleteAssignedRes.data.message.includes('deactivated because 1 employee record'), 'Message must indicate safe deactivation');

    const desigInDb = await query.get('SELECT is_active FROM designations WHERE id = ?', [createdDesigId]);
    assert.strictEqual(desigInDb.is_active, 0, 'is_active must be set to 0');
    console.log('✓ Safe deactivation verified: Record soft-deactivated with is_active = 0.\n');

    // 10. Clean up employee and test hard deletion
    console.log('[Step 10] Testing hard deletion after employee unlinked...');
    await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);
    const deleteUnassignedRes = await request(`/masters/designations/${createdDesigId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert.strictEqual(deleteUnassignedRes.status, 200, 'Hard delete must return 200');
    assert.strictEqual(deleteUnassignedRes.data.success, true);

    const finalCheck = await query.get('SELECT id FROM designations WHERE id = ?', [createdDesigId]);
    assert(!finalCheck, 'Designation must be completely deleted from database');
    console.log('✓ Hard delete verified: Record completely removed from database.\n');

    console.log('================================================================');
    console.log(' ALL 10 DESIGNATIONS MASTER REGISTRY TESTS PASSED! (10/10)');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    // Cleanup if test aborted
    if (createdDesigId) {
      await query.run('DELETE FROM designations WHERE id = ?', [createdDesigId]).catch(() => {});
    }
    if (testEmpId) {
      await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]).catch(() => {});
    }
    process.exit(1);
  }
}

runTests();
