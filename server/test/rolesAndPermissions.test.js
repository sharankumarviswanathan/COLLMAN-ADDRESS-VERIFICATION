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
  console.log(' RUNNING ROLES & PERMISSIONS FULL END-TO-END TEST SUITE');
  console.log('================================================================\n');

  // Clean up any previous test roles
  await query.run("DELETE FROM role_permissions WHERE role_name LIKE 'Compliance Auditor%'");
  await query.run("DELETE FROM users WHERE role LIKE 'Compliance Auditor%'");
  await query.run("DELETE FROM roles WHERE role_name LIKE 'Compliance Auditor%'");

  // 1. Authenticate as Super Admin
  const loginRes = await request('POST', '/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  assert.strictEqual(loginRes.status, 200, 'Super Admin login must succeed');
  const token = loginRes.data.token;
  assert.ok(token, 'Must return JWT token');
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✓ Step 1: Admin successfully authenticated as Super Admin');

  // 2. Test GET /api/roles & verify default seeded roles
  const rolesRes = await request('GET', '/roles', null, authHeaders);
  assert.strictEqual(rolesRes.status, 200, 'GET /api/roles must return 200');
  assert.ok(Array.isArray(rolesRes.data.roles), 'roles should be an array');
  assert.ok(Array.isArray(rolesRes.data.permissionsCatalog), 'permissionsCatalog should be an array');
  console.log(`✓ Step 2: GET /api/roles returned ${rolesRes.data.roles.length} roles and ${rolesRes.data.permissionsCatalog.length} permission groups`);

  const roleNames = rolesRes.data.roles.map(r => r.role_name);
  assert.ok(roleNames.includes('Super Admin'), 'Must have Super Admin role');
  assert.ok(roleNames.includes('HR/Admin'), 'Must have HR/Admin role');
  assert.ok(roleNames.includes('BGV Reviewer'), 'Must have BGV Reviewer role');
  assert.ok(roleNames.includes('View Only'), 'Must have View Only role');

  const superAdmin = rolesRes.data.roles.find(r => r.role_name === 'Super Admin');
  assert.ok(Array.isArray(superAdmin.permissions) && superAdmin.permissions.length > 10, 'Super Admin should have extensive permissions');

  // 3. Test GET /api/roles/permissions-catalog
  const catRes = await request('GET', '/roles/permissions-catalog', null, authHeaders);
  assert.strictEqual(catRes.status, 200, 'GET /api/roles/permissions-catalog must return 200');
  assert.ok(Array.isArray(catRes.data.catalog), 'Catalog must be an array');
  console.log(`✓ Step 3: GET /api/roles/permissions-catalog verified with ${catRes.data.catalog.length} categories`);

  // 4. Test POST /api/roles (Create Role)
  const testRoleCode = `TEST_AUDITOR_${Date.now()}`;
  const testRoleName = `Compliance Auditor ${Date.now()}`;
  const initialPerms = ['view_dashboard', 'view_reports', 'download_reports', 'view_audit_logs'];

  const createRoleRes = await request('POST', '/roles', {
    role_name: testRoleName,
    role_code: testRoleCode,
    description: 'Automated test role for verifying role creation and permission assignment',
    badge_color: 'emerald',
    permissions: initialPerms
  }, authHeaders);

  assert.strictEqual(createRoleRes.status, 201, `Create role should return 201, got ${createRoleRes.status}: ${JSON.stringify(createRoleRes.data)}`);
  const createdRoleId = createRoleRes.data.role.id;
  assert.ok(createdRoleId, 'Created role must have an ID');
  assert.strictEqual(createRoleRes.data.role.role_name, testRoleName);
  assert.deepStrictEqual(createRoleRes.data.role.permissions.sort(), initialPerms.sort());
  console.log(`✓ Step 4: Successfully created new custom role "${testRoleName}" (ID: ${createdRoleId})`);

  // 5. Test PUT /api/roles/:id (Update Permissions on Custom Role)
  const updatedPerms = ['view_dashboard', 'view_reports', 'download_reports', 'view_audit_logs', 'view_queue', 'review_cases'];
  const updateRoleRes = await request('PUT', `/roles/${createdRoleId}`, {
    role_name: testRoleName,
    description: 'Updated description for test role',
    badge_color: 'indigo',
    permissions: updatedPerms
  }, authHeaders);

  assert.strictEqual(updateRoleRes.status, 200, `Update role permissions should return 200, got ${updateRoleRes.status}`);
  assert.deepStrictEqual(updateRoleRes.data.role.permissions.sort(), updatedPerms.sort());
  console.log(`✓ Step 5: Successfully updated permissions for custom role to ${updatedPerms.length} permissions`);

  // 6. Test PUT /api/roles/:id (Update Permissions on System Role - e.g. View Only)
  const viewOnlyRole = rolesRes.data.roles.find(r => r.role_name === 'View Only');
  assert.ok(viewOnlyRole, 'View Only role exists');
  const originalViewOnlyPerms = viewOnlyRole.permissions || [];
  const testViewOnlyPerms = [...new Set([...originalViewOnlyPerms, 'view_audit_logs'])];

  const updateSysRoleRes = await request('PUT', `/roles/${viewOnlyRole.id}`, {
    permissions: testViewOnlyPerms
  }, authHeaders);

  assert.strictEqual(updateSysRoleRes.status, 200, 'Authorized admin should be able to update system role permissions');
  assert.ok(updateSysRoleRes.data.role.permissions.includes('view_audit_logs'), 'Updated system role must include new permission');
  console.log(`✓ Step 6: Successfully updated permissions on system role "${viewOnlyRole.role_name}"`);

  // Revert system role permissions back to original
  await request('PUT', `/roles/${viewOnlyRole.id}`, { permissions: originalViewOnlyPerms }, authHeaders);
  console.log(`✓ Step 6b: Successfully restored original permissions on "${viewOnlyRole.role_name}"`);

  // 7. Test User Assignment to Newly Created Role
  const testUsername = `user_${Date.now()}`;
  const createUserRes = await request('POST', '/users', {
    username: testUsername,
    password: 'Password123!',
    full_name: 'Test Role User',
    email: `${testUsername}@example.com`,
    role: testRoleName,
    branch: 'Chennai HQ',
    department: 'Risk Management'
  }, authHeaders);

  assert.strictEqual(createUserRes.status, 201, `Create user with custom role should return 201, got ${createUserRes.status}: ${JSON.stringify(createUserRes.data)}`);
  const createdUserId = createUserRes.data.userId;
  assert.ok(createdUserId, 'Must return created user ID');
  console.log(`✓ Step 7: Successfully created user "${testUsername}" (ID: ${createdUserId}) assigned to custom role "${testRoleName}"`);

  // Verify role's user count reflects the new user
  const rolesAfterUser = await request('GET', '/roles', null, authHeaders);
  const targetRole = rolesAfterUser.data.roles.find(r => r.id === createdRoleId);
  assert.strictEqual(targetRole.user_count, 1, 'Target role user count must be 1');
  console.log(`✓ Step 8: Verified role user_count correctly incremented to ${targetRole.user_count}`);

  // 8. Test Protection Rules: Cannot delete System Role
  const delSysRoleRes = await request('DELETE', `/roles/${viewOnlyRole.id}`, null, authHeaders);
  assert.strictEqual(delSysRoleRes.status, 400, 'Attempt to delete system role must be rejected with 400');
  console.log(`✓ Step 9: System role deletion correctly rejected with status 400`);

  // 9. Soft-deactivation when custom role has assigned users
  const delAssignedRoleRes = await request('DELETE', `/roles/${createdRoleId}`, null, authHeaders);
  assert.strictEqual(delAssignedRoleRes.status, 200, 'Deleting role with users should soft-deactivate');
  assert.strictEqual(delAssignedRoleRes.data.deactivated, true);
  console.log(`✓ Step 10: Verified soft-deactivation when custom role has active users`);

  // 10. Cleanup: Unlink/delete test user, then hard delete custom test role
  await query.run('DELETE FROM users WHERE id = ?', [createdUserId]);
  console.log(`✓ Step 11: Cleaned up test user (ID: ${createdUserId})`);

  const delRoleRes = await request('DELETE', `/roles/${createdRoleId}`, null, authHeaders);
  assert.strictEqual(delRoleRes.status, 200, 'Deleting unassigned custom test role must succeed');
  assert.strictEqual(delRoleRes.data.deleted, true);
  console.log(`✓ Step 12: Hard-deleted custom test role after unlinking`);

  console.log('\n================================================================');
  console.log(' ALL ROLES & PERMISSIONS TESTS PASSED SUCCESSFULLY! (12/12)');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
