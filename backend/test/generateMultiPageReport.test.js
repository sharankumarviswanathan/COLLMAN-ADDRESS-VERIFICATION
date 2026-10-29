const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateVerificationReportPDF, downloadsDir } = require('../utils/pdfGenerator');
const { query } = require('../db/database');

async function runTest() {
  console.log('=== TEST: Comprehensive Multi-Page BGV Verification Report Generation ===\n');

  const testEmpId = '202140';
  const testCaseRef = 'AV-2026-000003';

  // 1. Verify that employee exists in DB
  const employee = await query.get('SELECT * FROM employees WHERE employee_id = ?', [testEmpId]);
  assert.ok(employee, `Employee ${testEmpId} must exist in database`);
  console.log(`✓ Step 1: Employee ${testEmpId} found (${employee.employee_name}, ${employee.verification_status})`);

  // 2. Generate the PDF Report
  console.log('✓ Step 2: Generating multi-page verification report PDF...');
  const startTime = Date.now();
  const result = await generateVerificationReportPDF(
    { employee_id: testEmpId, case_reference: testCaseRef },
    'Collman Quality Reviewer'
  );
  const duration = Date.now() - startTime;

  console.log(`✓ Step 3: PDF generated in ${duration}ms:`, {
    fileName: result.fileName,
    fileSize: `${Math.round(result.fileSize / 1024)} KB`,
    totalPages: result.totalPages,
    referenceNo: result.referenceNo
  });

  // 3. Assertions
  assert.ok(fs.existsSync(result.filePath), 'PDF file must exist on disk in downloads directory');
  assert.ok(result.fileSize > 50000, `File size (${result.fileSize} bytes) must be substantial with embedded photos`);
  assert.strictEqual(result.totalPages, 3, 'Report must be a compact, well-proportioned 3-page report');
  assert.strictEqual(result.referenceNo, testCaseRef, 'Case reference must match');

  // 4. Verify database insertion in download_area_files
  const downloadRecord = await query.get(
    'SELECT * FROM download_area_files WHERE file_name = ? ORDER BY id DESC LIMIT 1',
    [result.fileName]
  );
  assert.ok(downloadRecord, 'File must be registered in download_area_files table');
  console.log(`✓ Step 4: Registered in Download Area (ID: ${downloadRecord.id}, Size: ${downloadRecord.file_size} bytes)`);

  // 5. Verify audit log entry
  const auditLog = await query.get(
    "SELECT * FROM audit_logs WHERE employee_id = ? AND action = 'Report Generated' ORDER BY id DESC LIMIT 1",
    [testEmpId]
  );
  assert.ok(auditLog, 'Audit log must record report generation');
  console.log(`✓ Step 5: Audit log verified: "${auditLog.details}"`);

  console.log('\n======================================================');
  console.log('✓ ALL MULTI-PAGE REPORT TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
