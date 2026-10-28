const http = require('http');
const { query } = require('../db/database');
const { seed } = require('../db/seed');

// Simple HTTP request helper for testing
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'x-test-suite': 'true',
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

async function runTests() {
  console.log('--- STARTING COLLMAN SERVICES ADDRESS VERIFICATION BACKEND TESTS ---');

  // Ensure test employees exist with appropriate TL assignments
  await query.run(`
    INSERT OR IGNORE INTO employees (
      employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
      date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, team_leader, verification_status
    ) VALUES ('COL00101', 'Arun Kumar S', '9840123456', 'arun.kumar@example.com', 'Chennai - Mount Road', 'Chennai', 'Operations', 'Field Operations Executive',
      '2022-06-15', 'No. 42, Sunshine Apartments, 2nd Cross Street, Anna Nagar, Chennai, Tamil Nadu - 600040', 'Chennai', 'Tamil Nadu', '600040', 'Surya', 'Not Started')
  `);
  await query.run(`UPDATE employees SET team_leader = 'Surya', hr_current_address = 'No. 42, Sunshine Apartments, 2nd Cross Street, Anna Nagar, Chennai, Tamil Nadu - 600040', verification_status = 'Not Started' WHERE employee_id = 'COL00101'`);

  // Unassigned agent for test
  await query.run(`
    INSERT OR IGNORE INTO employees (
      employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
      date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, team_leader, verification_status
    ) VALUES ('COL_UNASSIGNED', 'Test Unassigned Agent', '9999988888', 'unassigned@example.com', 'Chennai - Mount Road', 'Chennai', 'Operations', 'Field Operations Executive',
      '2022-06-15', 'Chennai Address', 'Chennai', 'Tamil Nadu', '600040', NULL, 'Not Started')
  `);
  await query.run(`UPDATE employees SET team_leader = NULL WHERE employee_id = 'COL_UNASSIGNED'`);

  // Agent assigned to other TL (10034 / DINESHKUMAR SIVAPARAKASM)
  await query.run(`
    INSERT OR IGNORE INTO employees (
      employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
      date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, team_leader, verification_status
    ) VALUES ('COL_OTHER_TL', 'Test Other TL Agent', '9999977777', 'other_tl@example.com', 'Chennai - Mount Road', 'Chennai', 'Operations', 'Field Operations Executive',
      '2022-06-15', 'Chennai Address', 'Chennai', 'Tamil Nadu', '600040', 'DINESHKUMAR SIVAPARAKASM', 'Not Started')
  `);
  await query.run(`UPDATE employees SET team_leader = 'DINESHKUMAR SIVAPARAKASM' WHERE employee_id = 'COL_OTHER_TL'`);

  await query.run(`DELETE FROM verification_progress WHERE employee_id IN ('COL00101', 'COL_UNASSIGNED', 'COL_OTHER_TL')`);
  await query.run(`DELETE FROM verification_cases WHERE employee_id IN ('COL00101', 'COL_UNASSIGNED', 'COL_OTHER_TL')`);

  // 1. Check Health Endpoint
  console.log('\n[Test 1] Health Check...');
  const health = await makeRequest('GET', '/api/health');
  if (health.status === 200 && health.data.appName.includes('COLLMAN')) {
    console.log('✓ PASS: Health check verified.');
  } else {
    throw new Error(`Failed health check: ${JSON.stringify(health)}`);
  }

  // 2. Validate TL ID - Invalid TL
  console.log('\n[Test 2a] Validate TL ID with non-existent TL ID...');
  const invalidTlRes = await makeRequest('POST', '/api/verify/validate-tl', {
    tlId: 'INVALID_TL_9999'
  });
  if (invalidTlRes.status === 404) {
    console.log('✓ PASS: Invalid TL ID rejected cleanly.');
  } else {
    throw new Error(`Invalid TL test failed: ${JSON.stringify(invalidTlRes)}`);
  }

  // 2b. Validate TL ID - Valid TL (202140 / Surya)
  console.log('\n[Test 2b] Validate TL ID with valid authorized TL (202140)...');
  const validTlRes = await makeRequest('POST', '/api/verify/validate-tl', {
    tlId: '202140'
  });
  if (validTlRes.status === 200 && validTlRes.data.valid && validTlRes.data.teamLeader.tlName.includes('Surya')) {
    console.log(`✓ PASS: Valid TL verified: ${validTlRes.data.teamLeader.tlName} (${validTlRes.data.teamLeader.tlId}).`);
  } else {
    throw new Error(`Valid TL test failed: ${JSON.stringify(validTlRes)}`);
  }

  // 3a. Validate Agent without TL ID -> 400
  console.log('\n[Test 3a] Validate Agent ID without TL ID (Backend enforcement check)...');
  const missingTlRes = await makeRequest('POST', '/api/verify/validate-id', {
    agentId: 'COL00101'
  });
  if (missingTlRes.status === 400 && missingTlRes.data.error.includes('Team Leader')) {
    console.log('✓ PASS: Request without TL ID rejected with 400.');
  } else {
    throw new Error(`Missing TL test failed: ${JSON.stringify(missingTlRes)}`);
  }

  // 3b. Validate Agent with invalid Agent ID -> 404
  console.log('\n[Test 3b] Validate non-existent Agent ID with valid TL...');
  const invalidAgentRes = await makeRequest('POST', '/api/verify/validate-id', {
    tlId: '202140',
    agentId: 'COL99999'
  });
  if (invalidAgentRes.status === 404 && invalidAgentRes.data.code === 'AGENT_NOT_FOUND') {
    console.log('✓ PASS: Non-existent Agent ID rejected cleanly.');
  } else {
    throw new Error(`Invalid Agent test failed: ${JSON.stringify(invalidAgentRes)}`);
  }

  // 3c. Validate unassigned Agent -> 403 AGENT_UNASSIGNED
  console.log('\n[Test 3c] Validate Unassigned Agent (Access Blocked check)...');
  const unassignedRes = await makeRequest('POST', '/api/verify/validate-id', {
    tlId: '202140',
    agentId: 'COL_UNASSIGNED'
  });
  if (unassignedRes.status === 403 && unassignedRes.data.code === 'AGENT_UNASSIGNED') {
    console.log(`✓ PASS: Unassigned Agent blocked: "${unassignedRes.data.error}".`);
  } else {
    throw new Error(`Unassigned Agent test failed: ${JSON.stringify(unassignedRes)}`);
  }

  // 3d. Validate Agent assigned to other TL -> 403 AGENT_ASSIGNED_TO_OTHER_TL
  console.log('\n[Test 3d] Validate Agent assigned to different TL (Mismatch check)...');
  const otherTlRes = await makeRequest('POST', '/api/verify/validate-id', {
    tlId: '202140',
    agentId: 'COL_OTHER_TL'
  });
  if (otherTlRes.status === 403 && otherTlRes.data.code === 'AGENT_ASSIGNED_TO_OTHER_TL') {
    console.log(`✓ PASS: Agent assigned to other TL blocked: "${otherTlRes.data.error}".`);
  } else {
    throw new Error(`Mismatch TL test failed: ${JSON.stringify(otherTlRes)}`);
  }

  // 3e. Validate valid Agent assigned to entered TL -> 200
  console.log('\n[Test 3e] Validate Agent assigned to entered TL (COL00101 under Surya)...');
  const validIdRes = await makeRequest('POST', '/api/verify/validate-id', {
    tlId: '202140',
    agentId: '  col00101  ' // Test whitespace trimming & uppercase normalization
  });
  if (validIdRes.status === 200 && validIdRes.data.token && validIdRes.data.employee.employeeId === 'COL00101') {
    console.log(`✓ PASS: Agent ID validated against TL. Session token issued for ${validIdRes.data.employee.employeeName}.`);
  } else {
    throw new Error(`Valid ID test failed: ${JSON.stringify(validIdRes)}`);
  }

  const employeeToken = validIdRes.data.token;
  const authHeaders = { 'x-employee-session': employeeToken };

  // 4. Step 2 - Details Confirmation
  console.log('\n[Test 4] Step 2: Details Confirmation...');
  const detailsRes = await makeRequest('POST', '/api/verify/save-details', { confirmed: true }, authHeaders);
  if (detailsRes.status === 200 && detailsRes.data.success) {
    console.log('✓ PASS: Details confirmed.');
  } else {
    throw new Error(`Details confirmation failed: ${JSON.stringify(detailsRes)}`);
  }

  // 5. Step 3 - Address Confirmation (Address change test)
  console.log('\n[Test 5] Step 3: Address Confirmation (Non-destructive check)...');
  const addressRes = await makeRequest('POST', '/api/verify/save-address', {
    isSame: false,
    differenceReason: 'I have shifted to another address',
    newAddress: 'Flat 501, Oak Tree Heights, 12th Main, Indiranagar, Bangalore - 560038'
  }, authHeaders);
  if (addressRes.status === 200 && addressRes.data.success) {
    console.log('✓ PASS: Verified address recorded.');
  } else {
    throw new Error(`Address save failed: ${JSON.stringify(addressRes)}`);
  }

  // Check that original HR address in database was NOT modified
  const hrRecord = await query.get('SELECT hr_current_address FROM employees WHERE employee_id = ?', ['COL00101']);
  if (hrRecord.hr_current_address.includes('Sunshine Apartments')) {
    console.log('✓ PASS: Non-Destructive Data Rule Verified (Original HR address remains intact).');
  } else {
    throw new Error(`CRITICAL VIOLATION: HR Address was overwritten! Address is: ${hrRecord.hr_current_address}`);
  }

  // 6. Step 4 - Residence Details
  console.log('\n[Test 6] Step 4: Residence Details...');
  const resDetails = await makeRequest('POST', '/api/verify/save-residence', {
    residenceType: 'Rented House',
    stayingSinceMonth: 'April',
    stayingSinceYear: '2023'
  }, authHeaders);
  if (resDetails.status === 200 && resDetails.data.success) {
    console.log('✓ PASS: Residence details saved.');
  } else {
    throw new Error(`Residence details failed: ${JSON.stringify(resDetails)}`);
  }

  // 7. Step 5 - GPS Location & Haversine Distance Calculation
  console.log('\n[Test 7] Step 5: Live GPS Location Capture & Haversine Distance...');
  const locationRes = await makeRequest('POST', '/api/verify/save-location', {
    latitude: 12.9118,
    longitude: 77.6391,
    accuracy: 5.4
  }, authHeaders);
  if (locationRes.status === 200 && locationRes.data.distanceMeters !== undefined) {
    console.log(`✓ PASS: GPS location saved. Calculated distance: ${locationRes.data.distanceMeters}m (${locationRes.data.distanceCategory}).`);
  } else {
    throw new Error(`Location save failed: ${JSON.stringify(locationRes)}`);
  }

  // 8. Step 6 & 7 - Mock Base64 Photos Upload
  console.log('\n[Test 8] Step 6 & 7: Selfie and House Photo Capture...');
  const mockBase64 = 'data:image/jpeg;base64,' + Buffer.alloc(256, 0xAA).toString('base64');
  const selfieRes = await makeRequest('POST', '/api/verify/upload-selfie', {
    imageBase64: mockBase64,
    clientMetrics: { faceDetected: true, faceConfidence: 0.95 }
  }, authHeaders);
  const houseRes = await makeRequest('POST', '/api/verify/upload-house-photo', { imageBase64: mockBase64 }, authHeaders);
  if (selfieRes.data.success && houseRes.data.success) {
    console.log('✓ PASS: Live selfie and house photo stored.');
  } else {
    throw new Error(`Photo upload failed: ${JSON.stringify({ selfieRes, houseRes })}`);
  }

  // Manually update mock photo captures, document upload & declaration for unit test completion
  await query.run(
    `UPDATE verification_progress SET
      door_photo_captured = 1,
      door_photo_path = 'mock_door.jpg',
      street_photo_captured = 1,
      street_photo_path = 'mock_street.jpg',
      landmark_photo_captured = 1,
      landmark_photo_path = 'mock_landmark.jpg',
      joint_selfie_captured = 1,
      joint_selfie_path = 'mock_joint.jpg',
      address_proof_uploaded = 1,
      document_type = 'Aadhaar Card',
      document_path = 'mock_aadhaar.pdf',
      document_original_name = 'Aadhaar_Rahul_Sharma.pdf',
      declaration_accepted = 1,
      declaration_timestamp = CURRENT_TIMESTAMP
     WHERE employee_id = 'COL00101'`
  );

  const mockEvidences = ['door_photo', 'street_photo', 'landmark_photo', 'joint_selfie'];
  for (const ev of mockEvidences) {
    await query.run(
      `INSERT OR REPLACE INTO verification_evidence (
        attempt_number, employee_id, evidence_type, file_path,
        validation_status, validation_report, validated_at, tl_id, tl_name
      ) VALUES (1, 'COL00101', ?, 'mock.jpg', 'PASSED', '{"valid":true}', CURRENT_TIMESTAMP, '202140', 'Surya')`,
      [ev]
    );
  }

  // 9. Step 10 - Final Submission
  console.log('\n[Test 9] Step 10: Final Verification Submission...');
  const submitRes = await makeRequest('POST', '/api/verify/submit', {}, authHeaders);
  if (submitRes.status === 200 && submitRes.data.success && submitRes.data.referenceNo.startsWith('AV-')) {
    console.log(`✓ PASS: Verification submitted successfully. Reference Generated: ${submitRes.data.referenceNo}`);
  } else {
    throw new Error(`Submission failed: ${JSON.stringify(submitRes)}`);
  }

  // 9b. Verify Audit Log and Case TL/Agent ID Recording
  console.log('\n[Test 9b] Verify TL ID and Agent ID recorded in case and audit logs...');
  const caseRow = await query.get('SELECT tl_id, tl_name, employee_id FROM verification_cases WHERE case_reference = ?', [submitRes.data.referenceNo]);
  if (caseRow && caseRow.tl_id === '202140' && caseRow.employee_id === 'COL00101') {
    console.log(`✓ PASS: Verification case recorded tl_id: ${caseRow.tl_id} (${caseRow.tl_name}), employee_id: ${caseRow.employee_id}`);
  } else {
    throw new Error(`Case TL/Agent record failed: ${JSON.stringify(caseRow)}`);
  }

  const auditRow = await query.get(
    'SELECT tl_id, agent_id, employee_id, action FROM audit_logs WHERE case_reference = ? ORDER BY id DESC LIMIT 1',
    [submitRes.data.referenceNo]
  );
  if (auditRow && auditRow.tl_id === '202140' && (auditRow.agent_id === 'COL00101' || auditRow.employee_id === 'COL00101')) {
    console.log(`✓ PASS: Audit log recorded tl_id: ${auditRow.tl_id}, agent_id: ${auditRow.agent_id || auditRow.employee_id}`);
  } else {
    throw new Error(`Audit log TL/Agent recording failed: ${JSON.stringify(auditRow)}`);
  }

  // 10. HR/Admin Login
  console.log('\n[Test 10] HR/Admin Portal Authentication...');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  if (loginRes.status === 200 && loginRes.data.token) {
    console.log(`✓ PASS: Admin authenticated as ${loginRes.data.user.fullName} (${loginRes.data.user.role}).`);
  } else {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes)}`);
  }

  const adminToken = loginRes.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 11. BGV Review Decision & PDF Report to Download Area
  console.log('\n[Test 11] BGV Review Decision & PDF Generation into Download Area...');
  const decisionRes = await makeRequest('POST', '/api/review/COL00101/decision', {
    decision: 'VERIFIED',
    remarks: 'Verified address proof and close GPS distance (28m). Recommended for onboarding clearance.'
  }, adminHeaders);
  if (decisionRes.status === 200 && decisionRes.data.success && decisionRes.data.reportFile) {
    console.log(`✓ PASS: BGV Review marked as VERIFIED. PDF Report generated: ${decisionRes.data.reportFile}`);
  } else {
    throw new Error(`BGV Decision failed: ${JSON.stringify(decisionRes)}`);
  }

  // 12. Check Internal Download Area
  console.log('\n[Test 12] Internal Download Area validation...');
  const dlRes = await makeRequest('GET', '/api/downloads', null, adminHeaders);
  if (dlRes.status === 200 && dlRes.data.files && dlRes.data.files.length > 0) {
    console.log(`✓ PASS: Internal Download Area holds ${dlRes.data.files.length} report(s).`);
  } else {
    throw new Error(`Download Area verification failed: ${JSON.stringify(dlRes)}`);
  }

  console.log('\n===============================================================');
  console.log(' ALL 12 COLLMAN ADDRESS VERIFICATION BACKEND TESTS PASSED 100% ');
  console.log('===============================================================\n');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
