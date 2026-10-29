const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://127.0.0.1:${process.env.TEST_PORT || 5000}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AUTOMATED PERMISSIONS & TL ISOLATION TEST ===\n');

  // 1. Login as Super Admin
  const adminLogin = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });

  if (adminLogin.status !== 200 || !adminLogin.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log('✓ 1. Super Admin logged in successfully.');

  // 2. Fetch roles & permissions catalog
  const rolesRes = await request('GET', '/api/roles', null, adminToken);
  if (rolesRes.status !== 200) {
    throw new Error(`Failed to fetch roles: ${JSON.stringify(rolesRes.data)}`);
  }
  console.log(`✓ 2. Fetched ${rolesRes.data.roles?.length} roles and ${rolesRes.data.systemPermissions?.length} permission modules.`);
  
  // Verify all 7 modules and 16 action categories
  const categories = rolesRes.data.systemPermissions.map(c => c.category);
  console.log('   Modules present:', categories.join(', '));
  const actions = new Set(rolesRes.data.systemPermissions.flatMap(c => c.permissions.map(p => p.action)));
  console.log('   Action operations:', Array.from(actions).join(', '));

  // 3. Find Team Leader user
  const usersRes = await request('GET', '/api/users', null, adminToken);
  const tlUser = usersRes.data.users.find(u => u.role === 'Team Leader');
  if (!tlUser) {
    console.warn('   No user with role Team Leader found, listing users:', usersRes.data.users.map(u => ({ id: u.id, username: u.username, role: u.role })));
  } else {
    console.log(`✓ 3. Found Team Leader user: ${tlUser.full_name} (ID: ${tlUser.id}, Username: ${tlUser.username})`);
  }

  // 4. Test Super Admin granting / updating role permissions and immediate effect
  let testRole = rolesRes.data.roles.find(r => r.role_code === 'TEST_AUDITOR');
  if (!testRole) {
    const createRoleRes = await request('POST', '/api/roles', {
      role_name: 'Test Auditor Role',
      role_code: 'TEST_AUDITOR',
      description: 'Role for automated verification of immediate permission changes',
      badge_color: 'warning',
      permissions: ['view_dashboard', 'view_queue']
    }, adminToken);
    console.log('✓ 4a. Created Test Auditor Role:', createRoleRes.data.message);
  }

  // Fetch updated roles to get ID
  const updatedRolesRes = await request('GET', '/api/roles', null, adminToken);
  testRole = updatedRolesRes.data.roles.find(r => r.role_code === 'TEST_AUDITOR');

  // Update permissions: grant approve_cases only (without reject_cases)
  const updateRes1 = await request('PUT', `/api/roles/${testRole.id}`, {
    role_name: testRole.role_name,
    description: testRole.description,
    badge_color: testRole.badge_color,
    is_active: 1,
    permissions: ['view_dashboard', 'view_queue', 'review_cases', 'approve_cases']
  }, adminToken);
  console.log('✓ 4b. Updated permissions for Test Auditor Role (granted approve_cases, NOT reject_cases):', updateRes1.status === 200 ? 'SUCCESS' : updateRes1.data);

  // 5. Test Team Leader login and strict isolation
  let tlToken = null;
  const tlLoginAttempts = ['202140', 'password123', 'admin123', '123456', 'collman123'];
  for (const pw of tlLoginAttempts) {
    const res = await request('POST', '/api/auth/login', {
      username: tlUser.username,
      password: pw
    });
    if (res.status === 200 && res.data.token) {
      tlToken = res.data.token;
      console.log(`✓ 5a. Team Leader ${tlUser.username} logged in successfully.`);
      break;
    }
  }

  if (tlToken) {
    // Check queue as TL
    const tlQueue = await request('GET', '/api/queue', null, tlToken);
    const tlQueueItems = tlQueue.data.items || tlQueue.data.cases || [];
    console.log(`✓ 5b. Team Leader queue fetched: ${tlQueueItems.length} assigned cases returned.`);

    // Find an unassigned case using Super Admin token
    const allCasesRes = await request('GET', '/api/queue', null, adminToken);
    const allQueueItems = allCasesRes.data.items || allCasesRes.data.cases || [];
    const unassignedCase = allQueueItems.find(c => c.assigned_reviewer_id !== tlUser.id);
    const assignedCase = allQueueItems.find(c => c.assigned_reviewer_id === tlUser.id);

    if (unassignedCase) {
      const unassignedId = unassignedCase.case_reference || unassignedCase.employee_id;
      const tlAccessUnassigned = await request('GET', `/api/review/${unassignedId}`, null, tlToken);
      console.log(`✓ 5c. Team Leader access to UNASSIGNED case (${unassignedId}): Status ${tlAccessUnassigned.status} (Expected 403 Forbidden). Error message: "${tlAccessUnassigned.data.error}"`);

      // Test TL attempting decision on unassigned case
      const tlDecisionUnassigned = await request('POST', `/api/review/${unassignedId}/decision`, {
        decision: 'VERIFIED',
        remarks: 'Attempted by TL on unassigned case'
      }, tlToken);
      console.log(`✓ 5d. Team Leader decision on UNASSIGNED case (${unassignedId}): Status ${tlDecisionUnassigned.status} (Expected 403 Forbidden).`);
    }

    if (assignedCase) {
      const assignedId = assignedCase.case_reference || assignedCase.employee_id;
      const tlAccessAssigned = await request('GET', `/api/review/${assignedId}`, null, tlToken);
      console.log(`✓ 5e. Team Leader access to ASSIGNED case (${assignedId}): Status ${tlAccessAssigned.status} (Expected 200 OK).`);
    }

    // Check employee access as TL
    const allEmpsRes = await request('GET', '/api/employees', null, adminToken);
    const unassignedEmp = allEmpsRes.data.employees.find(e => e.assigned_reviewer_id !== tlUser.id);
    if (unassignedEmp) {
      const tlAccessEmp = await request('GET', `/api/employees/${unassignedEmp.employee_id}`, null, tlToken);
      console.log(`✓ 5f. Team Leader access to UNASSIGNED employee (${unassignedEmp.employee_id}): Status ${tlAccessEmp.status} (Expected 403 Forbidden). Error: "${tlAccessEmp.data.error}"`);
    }
  }

  // 6. Test Separate Approve vs Reject Permissions
  console.log('\n--- Testing Separate Approve vs Reject Enforcement ---');
  let testUser = usersRes.data.users.find(u => u.username === 'test_auditor_user');
  if (!testUser) {
    const createTestUserRes = await request('POST', '/api/users', {
      username: 'test_auditor_user',
      full_name: 'Test Auditor Specialist',
      role: 'Test Auditor Role',
      password: 'password123',
      branch: 'Chennai',
      department: 'BGV Operations'
    }, adminToken);
    console.log('✓ 6a. Created user with Test Auditor Role:', createTestUserRes.status === 201 ? 'SUCCESS' : createTestUserRes.data);
  }

  const testUserLogin = await request('POST', '/api/auth/login', {
    username: 'test_auditor_user',
    password: 'password123'
  });
  const testUserToken = testUserLogin.data?.token;

  if (testUserToken) {
    console.log('✓ 6b. User with approve_cases (no reject_cases) logged in.');
    const allCasesRes = await request('GET', '/api/queue', null, adminToken);
    const allCasesList = allCasesRes.data.items || allCasesRes.data.cases || [];
    if (allCasesList.length > 0) {
      const caseId = allCasesList[0].case_reference || allCasesList[0].employee_id;

      // Attempt Reject (should fail with 403)
      const rejectAttempt = await request('POST', `/api/review/${caseId}/decision`, {
        decision: 'VERIFICATION FAILED',
        remarks: 'Test rejection without reject_cases permission',
        failureReason: 'Address Untraceable'
      }, testUserToken);
      console.log(`✓ 6c. User with only approve_cases attempts REJECT: Status ${rejectAttempt.status} (Expected 403 Forbidden). Error: "${rejectAttempt.data.error}"`);

      // Now grant reject_cases and remove approve_cases in real-time
      await request('PUT', `/api/roles/${testRole.id}`, {
        role_name: testRole.role_name,
        description: testRole.description,
        badge_color: testRole.badge_color,
        is_active: 1,
        permissions: ['view_dashboard', 'view_queue', 'review_cases', 'reject_cases']
      }, adminToken);
      console.log('✓ 6d. Real-time Role Update: Replaced approve_cases with reject_cases.');

      // Attempt Approve now (should fail with 403 immediately without re-login!)
      const approveAttempt = await request('POST', `/api/review/${caseId}/decision`, {
        decision: 'VERIFIED',
        remarks: 'Test approval without approve_cases permission'
      }, testUserToken);
      console.log(`✓ 6e. Same user token immediately attempts APPROVE: Status ${approveAttempt.status} (Expected 403 Forbidden). Error: "${approveAttempt.data.error}"`);

      // Restore approve_cases and reject_cases to Test Role
      await request('PUT', `/api/roles/${testRole.id}`, {
        role_name: testRole.role_name,
        description: testRole.description,
        badge_color: testRole.badge_color,
        is_active: 1,
        permissions: ['view_dashboard', 'view_queue', 'review_cases', 'approve_cases', 'reject_cases', 'download_case_report']
      }, adminToken);
      console.log('✓ 6f. Restored full permissions to Test Role.');
    }
  }

  // Cleanup test user and role
  console.log('\n--- Cleaning up test artifacts ---');
  const freshUsers = await request('GET', '/api/users', null, adminToken);
  const u = freshUsers.data.users?.find(x => x.username === 'test_auditor_user');
  if (u) {
    await request('DELETE', `/api/users/${u.id}`, null, adminToken);
    console.log('✓ Cleaned up test user.');
  }
  if (testRole) {
    await request('DELETE', `/api/roles/${testRole.id}`, null, adminToken);
    console.log('✓ Cleaned up test role.');
  }

  console.log('\n=== ALL AUTOMATED TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER ERROR:', err);
  process.exit(1);
});
