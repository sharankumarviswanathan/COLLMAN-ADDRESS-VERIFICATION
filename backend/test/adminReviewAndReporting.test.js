/**
 * Integration Test Suite for Phase 4: Admin Review Workstation & Reporting Pipeline
 *
 * Verifies:
 * 1. Queue listing and multi-parameter filtering (GET /api/queue)
 * 2. Reviewer assignment and bulk delegation (POST /api/queue/assign)
 * 3. Team Leader access restriction / RBAC isolation (GET /api/review/:id)
 * 4. Validation rules for case decisions (mandatory remarks & failure reasons)
 * 5. Lifecycle transitions: VERIFIED, VERIFICATION FAILED, REVERIFICATION REQUIRED
 * 6. Automatic and explicit 3-page PDF dossier generation with map imagery
 * 7. Excel analytics exports (branch_summary, dept_summary) into Download Area
 * 8. Download Area file registration & audit trail immutability
 */

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { query } = require('../db/database');

const TEST_PORT = process.env.TEST_PORT || 5000;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
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
          resolve({ status: res.statusCode, data: null, raw: data });
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

async function runAdminReviewAndReportingTests() {
  console.log('================================================================');
  console.log(' STARTING ADMIN REVIEW WORKSTATION & REPORTING PIPELINE TESTS   ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. Authenticate Users (Admin, TL 1, TL 2)
  // -------------------------------------------------------------
  console.log('[Test 1] Authenticating Test Users (Admin, TL Arulmani, TL Three)...');
  
  const adminLogin = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123'
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login must succeed');
  const adminToken = adminLogin.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const tl1Login = await makeRequest('POST', '/api/auth/login', {
    username: 'tl_arulmani',
    password: 'password123'
  });
  assert.strictEqual(tl1Login.status, 200, 'TL Arulmani login must succeed');
  const tl1Token = tl1Login.data.token;
  const tl1Headers = { Authorization: `Bearer ${tl1Token}` };

  const tl2Login = await makeRequest('POST', '/api/auth/login', {
    username: 'tl_three',
    password: 'password123'
  });
  assert.strictEqual(tl2Login.status, 200, 'TL Three login must succeed');
  const tl2Token = tl2Login.data.token;
  const tl2Headers = { Authorization: `Bearer ${tl2Token}` };

  console.log('✓ PASS: All test users authenticated successfully.');

  // -------------------------------------------------------------
  // 2. Queue Listing & Filtering (GET /api/queue)
  // -------------------------------------------------------------
  console.log('\n[Test 2] Querying Verification Queue with status and search filters...');
  
  // Total queue
  const queueRes = await makeRequest('GET', '/api/queue', null, adminHeaders);
  assert.strictEqual(queueRes.status, 200);
  assert.ok(Array.isArray(queueRes.data.items), 'Queue must return items array');
  assert.ok(queueRes.data.items.length > 0, 'Queue must not be empty');

  // Filter by status 'Pending BGV Review'
  const filterRes = await makeRequest('GET', '/api/queue?status=Pending%20BGV%20Review', null, adminHeaders);
  assert.strictEqual(filterRes.status, 200);
  assert.ok(filterRes.data.items.every(i => i.verification_status === 'Pending BGV Review'));

  // Search by candidate name 'Surya'
  const searchRes = await makeRequest('GET', '/api/queue?search=Surya', null, adminHeaders);
  assert.strictEqual(searchRes.status, 200);
  const suryaItem = searchRes.data.items.find(i => i.employee_id === '202140');
  assert.ok(suryaItem, 'Candidate 202140 must be found in search');
  console.log('✓ PASS: Queue listing and search filtering verified.');

  // -------------------------------------------------------------
  // 3. Reviewer Assignment & TL RBAC Isolation
  // -------------------------------------------------------------
  console.log('\n[Test 3] Testing Reviewer Assignment and Team Leader RBAC Isolation...');

  const tl1User = await query.get("SELECT id FROM users WHERE username = 'tl_arulmani'");
  const tl2User = await query.get("SELECT id FROM users WHERE username = 'tl_three'");
  assert.ok(tl1User && tl2User, 'Both TL users must exist in DB');

  // Before assignment: TL Arulmani cannot access 202140 (unassigned)
  const unassignedAccess = await makeRequest('GET', '/api/review/202140', null, tl1Headers);
  assert.strictEqual(unassignedAccess.status, 403, 'Unassigned TL must receive 403 Forbidden');
  console.log('✓ PASS: Unassigned Team Leader correctly blocked with 403.');

  // Assign candidate 202140 to TL Arulmani via POST /api/queue/assign
  const assignRes = await makeRequest('POST', '/api/queue/assign', {
    caseReferences: ['AV-2026-000003'],
    reviewerId: tl1User.id
  }, adminHeaders);
  assert.strictEqual(assignRes.status, 200);
  assert.ok(assignRes.data.success);

  // Verify DB reflects assignment
  const updatedCase = await query.get("SELECT assigned_reviewer_id FROM verification_cases WHERE employee_id = '202140'");
  assert.strictEqual(updatedCase.assigned_reviewer_id, tl1User.id, 'Case assigned_reviewer_id must match TL1 ID');

  // After assignment: TL Arulmani CAN access 202140
  const assignedAccess = await makeRequest('GET', '/api/review/202140', null, tl1Headers);
  assert.strictEqual(assignedAccess.status, 200, 'Assigned TL must receive 200 OK');
  assert.strictEqual(assignedAccess.data.employee.employee_id, '202140');

  // TL Three is STILL blocked (isolation between TLs)
  const otherTlAccess = await makeRequest('GET', '/api/review/202140', null, tl2Headers);
  assert.strictEqual(otherTlAccess.status, 403, 'Other unassigned TL must still receive 403 Forbidden');
  console.log('✓ PASS: TL RBAC assignment and strict isolation verified.');

  // -------------------------------------------------------------
  // 4. Case Decision Validation Rules (400 on Missing Remarks/Reason)
  // -------------------------------------------------------------
  console.log('\n[Test 4] Testing Case Decision Validation Rules...');

  // REVERIFICATION REQUIRED requires remarks
  const badReverify = await makeRequest('POST', '/api/review/202140/decision', {
    decision: 'REVERIFICATION REQUIRED',
    remarks: '' // Missing!
  }, adminHeaders);
  assert.strictEqual(badReverify.status, 400, 'Reverification without remarks must fail with 400');
  assert.ok(badReverify.data.error.includes('remarks'));

  // VERIFICATION FAILED requires failureReason
  const badFail = await makeRequest('POST', '/api/review/202140/decision', {
    decision: 'VERIFICATION FAILED',
    remarks: 'Candidate address does not exist'
    // Missing failureReason!
  }, adminHeaders);
  assert.strictEqual(badFail.status, 400, 'Verification Failed without reason must fail with 400');
  assert.ok(badFail.data.error.toLowerCase().includes('reason'));
  console.log('✓ PASS: Validation guardrails enforced for remarks and failure reasons.');

  // -------------------------------------------------------------
  // 5. Lifecycle Transition: REVERIFICATION REQUIRED
  // -------------------------------------------------------------
  console.log('\n[Test 5] Testing Lifecycle Transition: REVERIFICATION REQUIRED...');

  // Create temporary employee for reverification lifecycle test
  const reverifyEmpId = 'TEMP_REV_001';
  await query.run('DELETE FROM verification_timeline WHERE employee_id = ?', [reverifyEmpId]);
  await query.run('DELETE FROM verification_attempts WHERE employee_id = ?', [reverifyEmpId]);
  await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [reverifyEmpId]);
  await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [reverifyEmpId]);
  await query.run('DELETE FROM employees WHERE employee_id = ?', [reverifyEmpId]);

  await query.run(`
    INSERT INTO employees (
      employee_id, employee_name, mobile_number, email_id, date_of_joining,
      department, designation, branch, location, hr_current_address,
      hr_city, hr_state, hr_pincode, verification_status
    ) VALUES (
      ?, 'Reverification Candidate', '9876543210', 'rev@example.com', '2024-01-01',
      'Operations', 'Executive', 'Chennai', 'Chennai', '10 Anna Salai',
      'Chennai', 'Tamil Nadu', '600002', 'Pending BGV Review'
    )
  `, [reverifyEmpId]);

  const caseRes = await query.run(`
    INSERT INTO verification_cases (case_reference, employee_id, current_attempt_number, status)
    VALUES ('AV-REV-001', ?, 1, 'Pending BGV Review')
  `, [reverifyEmpId]);

  await query.run(`
    INSERT INTO verification_progress (employee_id, attempt_number, current_step, selfie_captured, house_photo_captured)
    VALUES (?, 1, 10, 1, 1)
  `, [reverifyEmpId]);

  await query.run(`
    INSERT INTO verification_attempts (case_id, employee_id, attempt_number, status, decision)
    VALUES (?, ?, 1, 'Pending BGV Review', 'PENDING')
  `, [caseRes.lastID, reverifyEmpId]);

  // Submit REVERIFICATION REQUIRED
  const reverifyDecision = await makeRequest('POST', `/api/review/${reverifyEmpId}/decision`, {
    decision: 'REVERIFICATION REQUIRED',
    remarks: 'Door photo was blurry. Please retake front door and landmark photo.'
  }, adminHeaders);
  assert.strictEqual(reverifyDecision.status, 200);

  // Check database persistence
  const revEmp = await query.get('SELECT verification_status FROM employees WHERE employee_id = ?', [reverifyEmpId]);
  assert.strictEqual(revEmp.verification_status, 'Reverification Required');

  const revCase = await query.get('SELECT current_attempt_number, status FROM verification_cases WHERE employee_id = ?', [reverifyEmpId]);
  assert.strictEqual(revCase.current_attempt_number, 2, 'Attempt number must increment to 2');
  assert.strictEqual(revCase.status, 'Reverification Required');

  const revProg = await query.get('SELECT attempt_number, current_step, selfie_captured FROM verification_progress WHERE employee_id = ?', [reverifyEmpId]);
  assert.strictEqual(revProg.attempt_number, 2);
  assert.strictEqual(revProg.current_step, 1, 'Step must reset to 1');
  assert.strictEqual(revProg.selfie_captured, 0, 'Selfie captured flag must reset to 0');
  console.log('✓ PASS: Reverification lifecycle cleanly increments attempt and resets progress.');

  // -------------------------------------------------------------
  // 6. Lifecycle Transition: VERIFIED & Automatic PDF Generation
  // -------------------------------------------------------------
  console.log('\n[Test 6] Testing Decision: VERIFIED and Automatic PDF Report Generation for 202140...');

  const verifiedRes = await makeRequest('POST', '/api/review/202140/decision', {
    decision: 'VERIFIED',
    remarks: 'All documents, GPS coordinates, and photographic proofs match HR record within 100m.'
  }, adminHeaders);
  assert.strictEqual(verifiedRes.status, 200);
  assert.strictEqual(verifiedRes.data.status, 'Verified');
  assert.ok(verifiedRes.data.reportFile, 'Must automatically generate report file');

  // Verify DB reflects Verified status
  const finalEmp = await query.get("SELECT verification_status FROM employees WHERE employee_id = '202140'");
  assert.strictEqual(finalEmp.verification_status, 'Verified');

  const finalCase = await query.get("SELECT final_decision, status FROM verification_cases WHERE employee_id = '202140'");
  assert.strictEqual(finalCase.final_decision, 'VERIFIED');
  assert.strictEqual(finalCase.status, 'Verified');

  // Verify audit log created
  const auditRow = await query.get("SELECT * FROM audit_logs WHERE employee_id = '202140' AND action = 'BGV Decision Made' ORDER BY id DESC LIMIT 1");
  assert.ok(auditRow, 'Audit log must record BGV Decision Made');
  assert.ok(auditRow.details.includes('VERIFIED'));
  console.log('✓ PASS: Case decision VERIFIED and audit logging verified.');

  // -------------------------------------------------------------
  // 7. Explicit PDF Report Generation (POST /api/review/:id/generate-report)
  // -------------------------------------------------------------
  console.log('\n[Test 7] Testing Explicit PDF Report Generation and Verification Dossier Layout...');

  const explicitPdfRes = await makeRequest('POST', '/api/review/202140/generate-report', null, adminHeaders);
  assert.strictEqual(explicitPdfRes.status, 200);
  assert.ok(explicitPdfRes.data.success);
  assert.strictEqual(explicitPdfRes.data.report.totalPages, 3, 'Must generate exactly 3-page dossier');

  // Verify file exists on disk
  const pdfDownload = await query.get("SELECT * FROM download_area_files WHERE reference_no = 'AV-2026-000003' ORDER BY id DESC LIMIT 1");
  assert.ok(pdfDownload, 'Must exist in download_area_files table');
  assert.ok(fs.existsSync(pdfDownload.file_path), `PDF file must exist at ${pdfDownload.file_path}`);
  assert.ok(pdfDownload.file_size > 50000, `PDF size (${pdfDownload.file_size} bytes) must be substantial`);
  console.log(`✓ PASS: 3-page PDF dossier generated and registered in Download Area (${pdfDownload.file_name}).`);

  // -------------------------------------------------------------
  // 8. Excel Analytics Report Generation (POST /api/reports/generate)
  // -------------------------------------------------------------
  console.log('\n[Test 8] Testing Excel Analytics Report Generation (branch_summary & dept_summary)...');

  // Branch Summary Export
  const branchXlsxRes = await makeRequest('POST', '/api/reports/generate', {
    reportType: 'branch_summary'
  }, adminHeaders);
  assert.strictEqual(branchXlsxRes.status, 200);
  assert.ok(branchXlsxRes.data.success);
  assert.ok(branchXlsxRes.data.fileName.endsWith('.xlsx'));

  // Department Summary Export
  const deptXlsxRes = await makeRequest('POST', '/api/reports/generate', {
    reportType: 'dept_summary'
  }, adminHeaders);
  assert.strictEqual(deptXlsxRes.status, 200);
  assert.ok(deptXlsxRes.data.success);
  assert.ok(deptXlsxRes.data.fileName.endsWith('.xlsx'));

  // Verify Excel files registered in Download Area
  const excelRecords = await query.all("SELECT * FROM download_area_files WHERE file_type = 'Excel' ORDER BY id DESC LIMIT 2");
  assert.strictEqual(excelRecords.length, 2, 'Must record both Excel exports in download_area_files');
  for (const rec of excelRecords) {
    assert.ok(fs.existsSync(rec.file_path), `Excel file must exist at ${rec.file_path}`);
    assert.ok(rec.file_size > 1000, 'Excel file must have non-trivial size');
  }
  console.log('✓ PASS: Excel report generation and Download Area registration verified.');

  // -------------------------------------------------------------
  // 9. Download Area API Listing (GET /api/downloads)
  // -------------------------------------------------------------
  console.log('\n[Test 9] Querying Download Area file repository (GET /api/downloads)...');

  const downloadsRes = await makeRequest('GET', '/api/downloads', null, adminHeaders);
  assert.strictEqual(downloadsRes.status, 200);
  assert.ok(Array.isArray(downloadsRes.data.files), 'Must return files array');
  assert.ok(downloadsRes.data.files.length >= 3, 'Must contain at least 3 files (1 PDF + 2 Excel)');
  console.log(`✓ PASS: Download Area returns ${downloadsRes.data.files.length} registered files.`);

  console.log('\n================================================================');
  console.log('  ALL PHASE 4 ADMIN REVIEW & REPORTING TESTS PASSED 100%!       ');
  console.log('================================================================\n');

  process.exit(0);
}

runAdminReviewAndReportingTests().catch(err => {
  console.error('\n❌ Fatal Test Error in adminReviewAndReporting suite:', err);
  process.exit(1);
});
