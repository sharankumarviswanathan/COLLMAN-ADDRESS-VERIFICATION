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

async function runEmployeeEditTests() {
  console.log('--- STARTING EMPLOYEE EDIT & CRUD TEST SUITE ---');

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

  // 2. Fetch existing employee COL00101 or ensure it exists
  console.log('\n[Test 2] Ensuring test employee COL00101 exists...');
  await query.run(`
    INSERT OR IGNORE INTO employees (
      employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
      date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, verification_status
    ) VALUES ('COL00101', 'Arun Kumar S', '9840123456', 'arun.kumar@example.com', 'Chennai - Mount Road', 'Chennai', 'Operations', 'Field Operations Executive',
      '2022-06-15', 'No. 42, Sunshine Apartments, 2nd Cross Street, Anna Nagar, Chennai, Tamil Nadu - 600040', 'Chennai', 'Tamil Nadu', '600040', 'Not Started')
  `);
  console.log('✓ PASS: COL00101 exists.');

  // 3. Update employee details via PUT /api/employees/COL00101
  console.log('\n[Test 3] Testing PUT /api/employees/COL00101 with updated details...');
  const updatePayload = {
    employeeName: 'Arun Kumar Sampath',
    mobileNumber: '9840199999',
    altMobileNumber: '9840188888',
    emailId: 'arun.sampath@collman.in',
    dateOfJoining: '2022-06-15',
    department: 'Finance & Accounts',
    designation: 'Senior Operations Executive',
    branch: 'Chennai Headquarters',
    location: 'Chennai Central',
    reportingManager: 'Rajesh Sharma',
    currentAddress: 'Flat 4B, Emerald Heights, GST Road, Guindy, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600032',
    permanentAddress: 'Village Post, Vellore District',
    permanentPincode: '632001'
  };

  const updateRes = await makeRequest('PUT', '/api/employees/COL00101', updatePayload, adminHeaders);
  if (updateRes.status !== 200 || !updateRes.data.success) {
    throw new Error(`Employee update failed: ${JSON.stringify(updateRes)}`);
  }
  console.log(`✓ PASS: Employee updated successfully: ${updateRes.data.message}`);

  // 4. Verify Database Persistence
  console.log('\n[Test 4] Verifying database persistence for COL00101...');
  const dbEmp = await query.get('SELECT * FROM employees WHERE employee_id = ?', ['COL00101']);
  if (
    dbEmp.employee_name !== 'Arun Kumar Sampath' ||
    dbEmp.mobile_number !== '9840199999' ||
    dbEmp.department !== 'Finance & Accounts' ||
    dbEmp.designation !== 'Senior Operations Executive' ||
    dbEmp.branch !== 'Chennai Headquarters' ||
    dbEmp.hr_pincode !== '600032' ||
    dbEmp.reporting_manager !== 'Rajesh Sharma'
  ) {
    throw new Error(`Database verification mismatch: ${JSON.stringify(dbEmp)}`);
  }
  console.log('✓ PASS: Database reflects updated fields perfectly.');

  // 5. Verify Audit Log Entry
  console.log('\n[Test 5] Verifying audit log creation...');
  const auditRow = await query.get(
    "SELECT * FROM audit_logs WHERE employee_id = 'COL00101' AND action = 'Employee Record Updated' ORDER BY id DESC LIMIT 1"
  );
  if (!auditRow) {
    throw new Error('Audit log record not found for employee update.');
  }
  console.log(`✓ PASS: Audit log captured successfully: "${auditRow.details}" by ${auditRow.actor_name}`);

  // 6. Test Validation - Missing Required Field
  console.log('\n[Test 6] Testing validation error on missing required field...');
  const invalidPayload = {
    employeeName: '',
    mobileNumber: '9840199999'
  };
  const invalidRes = await makeRequest('PUT', '/api/employees/COL00101', invalidPayload, adminHeaders);
  if (invalidRes.status === 400 && invalidRes.data.error) {
    console.log(`✓ PASS: Missing fields correctly rejected with 400: "${invalidRes.data.error}"`);
  } else {
    throw new Error(`Expected 400 rejection, got: ${JSON.stringify(invalidRes)}`);
  }

  // 7. Test Non-existent Employee
  console.log('\n[Test 7] Testing non-existent employee update...');
  const notFoundRes = await makeRequest('PUT', '/api/employees/NONEXISTENT999', updatePayload, adminHeaders);
  if (notFoundRes.status === 404) {
    console.log('✓ PASS: Non-existent employee returns 404.');
  } else {
    throw new Error(`Expected 404, got: ${JSON.stringify(notFoundRes)}`);
  }

  // 8. Test Unauthorized Access (No Token)
  console.log('\n[Test 8] Testing unauthorized update (No Token)...');
  const unauthRes = await makeRequest('PUT', '/api/employees/COL00101', updatePayload);
  if (unauthRes.status === 401) {
    console.log('✓ PASS: Unauthenticated request rejected with 401.');
  } else {
    throw new Error(`Expected 401, got: ${JSON.stringify(unauthRes)}`);
  }

  console.log('\n===============================================================');
  console.log(' ALL 8 EMPLOYEE EDIT & CRUD UNIT TESTS PASSED 100%! ');
  console.log('===============================================================\n');
}

if (require.main === module) {
  runEmployeeEditTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runEmployeeEditTests };
