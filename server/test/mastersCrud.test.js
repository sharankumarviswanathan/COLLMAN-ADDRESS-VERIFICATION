const assert = require('assert');
const http = require('http');
const { query } = require('../db/database');

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const reqHeaders = { ...headers };
    if (data) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: reqHeaders
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log(' RUNNING MASTERS (BRANCHES & DEPARTMENTS) CRUD TEST SUITE');
  console.log('================================================================\n');

  // 1. Authenticate as Super Admin
  const loginRes = await request('POST', '/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const token = loginRes.data.token;
  assert.ok(token, 'Must return JWT token');
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✓ Step 1: Admin authenticated as Super Admin');

  // 2. Test GET /api/masters/all
  const mastersRes = await request('GET', '/masters/all?includeInactive=true', null, authHeaders);
  assert.strictEqual(mastersRes.status, 200);
  assert.ok(Array.isArray(mastersRes.data.branches), 'branches must be an array');
  assert.ok(Array.isArray(mastersRes.data.departments), 'departments must be an array');
  const initialBranchCount = mastersRes.data.branches.length;
  const initialDeptCount = mastersRes.data.departments.length;
  console.log(`✓ Step 2: Loaded masters: ${initialBranchCount} branches, ${initialDeptCount} departments`);

  // ==========================================
  // 3. Branch CRUD Tests
  // ==========================================
  console.log('\n--- 3. Testing Branch CRUD Operations ---');

  // A. Create Branch
  const createBranchRes = await request('POST', '/masters/branches', {
    branch_code: 'TEST-KOL',
    branch_name: 'Kolkata Sector V Tech Hub',
    city: 'Kolkata',
    state: 'West Bengal',
    is_active: 1
  }, authHeaders);
  assert.strictEqual(createBranchRes.status, 200, 'Create branch must return 200');
  assert.strictEqual(createBranchRes.data.success, true);
  const createdBranchId = createBranchRes.data.branch.id;
  assert.ok(createdBranchId, 'Must return new branch ID');
  console.log(`✓ 3A: Created Branch: ID ${createdBranchId} - 'Kolkata Sector V Tech Hub' (TEST-KOL)`);

  // B. Duplicate code rejection
  const dupCodeRes = await request('POST', '/masters/branches', {
    branch_code: 'TEST-KOL',
    branch_name: 'Another Kolkata Office',
    city: 'Kolkata',
    state: 'West Bengal'
  }, authHeaders);
  assert.strictEqual(dupCodeRes.status, 400, 'Duplicate code must be rejected');
  assert.ok(dupCodeRes.data.error.includes('already exists'), 'Must indicate code already exists');
  console.log('✓ 3B: Duplicate branch code correctly rejected:', dupCodeRes.data.error);

  // C. Update Branch
  const updateBranchRes = await request('PUT', `/masters/branches/${createdBranchId}`, {
    branch_code: 'KOL-SEC5',
    branch_name: 'Kolkata Sector V Tech Hub (Updated)',
    city: 'Kolkata',
    state: 'West Bengal',
    is_active: 1
  }, authHeaders);
  assert.strictEqual(updateBranchRes.status, 200, 'Update branch must return 200');
  assert.strictEqual(updateBranchRes.data.success, true);
  assert.strictEqual(updateBranchRes.data.branch.branch_code, 'KOL-SEC5');
  assert.strictEqual(updateBranchRes.data.branch.branch_name, 'Kolkata Sector V Tech Hub (Updated)');
  console.log('✓ 3C: Updated Branch successfully: Code KOL-SEC5, Name Kolkata Sector V Tech Hub (Updated)');

  // D. Test Cascading Update on Employee when Branch is renamed
  const testEmpId = 'TEMP-BR-EMP-01';
  await query.run(`
    INSERT INTO employees (
      employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
      date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, verification_status
    ) VALUES (?, 'Branch Cascade Test Employee', '9999988881', 'br_test@example.com', 'Kolkata Sector V Tech Hub (Updated)', 'Kolkata', 'Operations', 'Executive',
      '2026-01-01', 'Test Address', 'Kolkata', 'West Bengal', '700091', 'Not Started')
  `, [testEmpId]);

  // Rename branch again and verify employee record is updated
  await request('PUT', `/masters/branches/${createdBranchId}`, {
    branch_code: 'KOL-SEC5',
    branch_name: 'Kolkata Corporate Campus',
    city: 'Kolkata',
    state: 'West Bengal',
    is_active: 1
  }, authHeaders);

  const updatedEmp = await query.get('SELECT branch FROM employees WHERE employee_id = ?', [testEmpId]);
  assert.strictEqual(updatedEmp.branch, 'Kolkata Corporate Campus', 'Employee branch must cascade to new name');
  console.log('✓ 3D: Cascading Branch rename verified on linked employee:', updatedEmp.branch);

  // E. Safe Deactivation (Soft delete) when linked to employee
  const deleteLinkedRes = await request('DELETE', `/masters/branches/${createdBranchId}`, null, authHeaders);
  assert.strictEqual(deleteLinkedRes.status, 200);
  assert.strictEqual(deleteLinkedRes.data.deactivated, true, 'Must soft-deactivate instead of hard delete');
  const deactivatedBranch = await query.get('SELECT is_active FROM branches WHERE id = ?', [createdBranchId]);
  assert.strictEqual(deactivatedBranch.is_active, 0, 'Branch must be marked is_active = 0');
  console.log('✓ 3E: Soft-deactivation verified for branch linked to employee:', deleteLinkedRes.data.message);

  // F. Hard delete after employee unlinked
  await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);
  const deleteUnlinkedRes = await request('DELETE', `/masters/branches/${createdBranchId}`, null, authHeaders);
  assert.strictEqual(deleteUnlinkedRes.status, 200);
  const deletedCheck = await query.get('SELECT id FROM branches WHERE id = ?', [createdBranchId]);
  assert.strictEqual(deletedCheck, undefined, 'Unused branch must be completely deleted');
  console.log('✓ 3F: Hard delete verified for unlinked branch:', deleteUnlinkedRes.data.message);

  // ==========================================
  // 4. Department CRUD Tests
  // ==========================================
  console.log('\n--- 4. Testing Department CRUD Operations ---');

  // A. Create Department
  const createDeptRes = await request('POST', '/masters/departments', {
    department_code: 'TEST-SEC',
    department_name: 'Cybersecurity & Infrastructure',
    is_active: 1
  }, authHeaders);
  assert.strictEqual(createDeptRes.status, 200, 'Create department must return 200');
  assert.strictEqual(createDeptRes.data.success, true);
  const createdDeptId = createDeptRes.data.department.id;
  assert.ok(createdDeptId, 'Must return new department ID');
  console.log(`✓ 4A: Created Department: ID ${createdDeptId} - 'Cybersecurity & Infrastructure' (TEST-SEC)`);

  // B. Duplicate code rejection
  const dupDeptCode = await request('POST', '/masters/departments', {
    department_code: 'TEST-SEC',
    department_name: 'Another Security Team'
  }, authHeaders);
  assert.strictEqual(dupDeptCode.status, 400);
  assert.ok(dupDeptCode.data.error.includes('already exists'));
  console.log('✓ 4B: Duplicate department code correctly rejected:', dupDeptCode.data.error);

  // C. Update Department
  const updateDeptRes = await request('PUT', `/masters/departments/${createdDeptId}`, {
    department_code: 'CYBER-SEC',
    department_name: 'Information Security & Risk',
    is_active: 1
  }, authHeaders);
  assert.strictEqual(updateDeptRes.status, 200);
  assert.strictEqual(updateDeptRes.data.branch?.department_code || updateDeptRes.data.department?.department_code, 'CYBER-SEC');
  assert.strictEqual(updateDeptRes.data.branch?.department_name || updateDeptRes.data.department?.department_name, 'Information Security & Risk');
  console.log('✓ 4C: Updated Department successfully: CYBER-SEC / Information Security & Risk');

  // D. Test Cascading Update on Employee when Department is renamed
  const testDeptEmpId = 'TEMP-DEPT-EMP-01';
  await query.run(`
    INSERT INTO employees (
      employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
      date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, verification_status
    ) VALUES (?, 'Dept Cascade Test Employee', '9999988882', 'dept_test@example.com', 'Chennai Headquarters', 'Chennai', 'Information Security & Risk', 'Security Analyst',
      '2026-01-01', 'Test Address', 'Chennai', 'Tamil Nadu', '600001', 'Not Started')
  `, [testDeptEmpId]);

  // Rename department
  await request('PUT', `/masters/departments/${createdDeptId}`, {
    department_code: 'INFO-SEC',
    department_name: 'Enterprise Information Security',
    is_active: 1
  }, authHeaders);

  const updatedDeptEmp = await query.get('SELECT department FROM employees WHERE employee_id = ?', [testDeptEmpId]);
  assert.strictEqual(updatedDeptEmp.department, 'Enterprise Information Security', 'Employee department must cascade to new name');
  console.log('✓ 4D: Cascading Department rename verified on linked employee:', updatedDeptEmp.department);

  // E. Safe Deactivation (Soft delete) when linked to employee
  const deleteLinkedDept = await request('DELETE', `/masters/departments/${createdDeptId}`, null, authHeaders);
  assert.strictEqual(deleteLinkedDept.status, 200);
  assert.strictEqual(deleteLinkedDept.data.deactivated, true);
  const deactivatedDept = await query.get('SELECT is_active FROM departments WHERE id = ?', [createdDeptId]);
  assert.strictEqual(deactivatedDept.is_active, 0);
  console.log('✓ 4E: Soft-deactivation verified for department linked to employee:', deleteLinkedDept.data.message);

  // F. Hard delete after employee unlinked
  await query.run('DELETE FROM employees WHERE employee_id = ?', [testDeptEmpId]);
  const deleteUnlinkedDept = await request('DELETE', `/masters/departments/${createdDeptId}`, null, authHeaders);
  assert.strictEqual(deleteUnlinkedDept.status, 200);
  const deletedDeptCheck = await query.get('SELECT id FROM departments WHERE id = ?', [createdDeptId]);
  assert.strictEqual(deletedDeptCheck, undefined);
  console.log('✓ 4F: Hard delete verified for unlinked department:', deleteUnlinkedDept.data.message);

  console.log('\n================================================================');
  console.log(' ALL MASTERS BRANCHES & DEPARTMENTS CRUD TESTS PASSED (100%)');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
