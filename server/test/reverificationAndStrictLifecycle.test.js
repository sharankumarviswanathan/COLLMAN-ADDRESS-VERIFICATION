const assert = require('assert');
const { query } = require('../db/database');
const { validateImage, detectDocumentOrScreen } = require('../utils/imageValidator');

async function runLifecycleTests() {
  console.log('================================================================');
  console.log(' RUNNING REVERIFICATION & STRICT PHOTO LIFECYCLE TEST SUITE     ');
  console.log('================================================================');

  const testEmpId = 'TEST_REVERIFY_999';

  // 1. Setup test employee in DB
  await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM verification_attempts WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);

  await query.run(`
    INSERT INTO employees (
      employee_id, employee_name, mobile_number, email_id, date_of_joining,
      department, designation, branch, location, hr_current_address,
      hr_city, hr_state, hr_pincode, verification_required, verification_status
    ) VALUES (
      ?, 'Reverify Test Employee', '9876543210', 'reverify@test.com', '2024-01-01',
      'Engineering', 'Analyst', 'Chennai', 'Chennai', '12 Anna Salai Chennai',
      'Chennai', 'Tamil Nadu', '600002', 'Yes', 'In Progress'
    )
  `, [testEmpId]);

  // Insert progress as if attempt 1 was in progress with old photos
  await query.run(`
    INSERT INTO verification_progress (
      employee_id, attempt_number, current_step,
      details_confirmed, address_confirmed, residence_type, location_captured,
      selfie_captured, selfie_path, selfie_latitude, selfie_longitude, selfie_accuracy, selfie_captured_at,
      house_photo_captured, house_photo_path, house_photo_latitude, house_photo_longitude, house_photo_accuracy, house_photo_captured_at,
      door_photo_captured, door_photo_path, door_photo_latitude, door_photo_longitude, door_photo_accuracy, door_photo_captured_at,
      street_photo_captured, street_photo_path, street_photo_latitude, street_photo_longitude, street_photo_accuracy, street_photo_captured_at,
      landmark_photo_captured, landmark_photo_path, landmark_photo_latitude, landmark_photo_longitude, landmark_photo_accuracy, landmark_photo_captured_at,
      address_proof_uploaded, document_type, document_path, declaration_accepted
    ) VALUES (
      ?, 1, 12,
      1, 1, 'Owned', 1,
      1, 'uploads/selfie_old.jpg', 13.01, 80.01, 10, '2026-09-20T10:00:00Z',
      1, 'uploads/house_old.jpg', 13.02, 80.02, 12, '2026-09-20T10:01:00Z',
      1, 'uploads/door_old.jpg', 13.03, 80.03, 8, '2026-09-20T10:02:00Z',
      1, 'uploads/street_old.jpg', 13.04, 80.04, 15, '2026-09-20T10:03:00Z',
      1, 'uploads/landmark_old.jpg', 13.05, 80.05, 20, '2026-09-20T10:04:00Z',
      1, 'Aadhaar Card', 'uploads/doc_old.pdf', 1
    )
  `, [testEmpId]);

  console.log('✓ Step 1: Initial employee and attempt 1 progress set up');

  // 2. Simulate Reviewer marking REVERIFICATION REQUIRED
  const reviewerDecision = 'REVERIFICATION REQUIRED';
  const mappedStatus = 'Reverification Required';
  const reviewerName = 'Test Reviewer';

  // Update employee status
  await query.run(
    'UPDATE employees SET verification_status = ?, updated_by = ? WHERE employee_id = ?',
    [mappedStatus, reviewerName, testEmpId]
  );

  // Update verification progress on REVERIFICATION REQUIRED (simulating server/routes/review.js)
  await query.run(
    `UPDATE verification_progress SET
      attempt_number = attempt_number + 1,
      current_step = 1,
      selfie_captured = 0,
      selfie_path = NULL,
      selfie_latitude = NULL,
      selfie_longitude = NULL,
      selfie_accuracy = NULL,
      selfie_captured_at = NULL,
      house_photo_captured = 0,
      house_photo_path = NULL,
      house_photo_latitude = NULL,
      house_photo_longitude = NULL,
      house_photo_accuracy = NULL,
      house_photo_captured_at = NULL,
      door_photo_captured = 0,
      door_photo_path = NULL,
      door_photo_latitude = NULL,
      door_photo_longitude = NULL,
      door_photo_accuracy = NULL,
      door_photo_captured_at = NULL,
      street_photo_captured = 0,
      street_photo_path = NULL,
      street_photo_latitude = NULL,
      street_photo_longitude = NULL,
      street_photo_accuracy = NULL,
      street_photo_captured_at = NULL,
      landmark_photo_captured = 0,
      landmark_photo_path = NULL,
      landmark_photo_latitude = NULL,
      landmark_photo_longitude = NULL,
      landmark_photo_accuracy = NULL,
      landmark_photo_captured_at = NULL,
      address_proof_uploaded = 0,
      document_type = NULL,
      document_path = NULL,
      document_original_name = NULL,
      document_back_path = NULL,
      document_back_original_name = NULL,
      declaration_accepted = 0,
      declaration_timestamp = NULL
     WHERE employee_id = ?`,
    [testEmpId]
  );

  // 3. Verify clean state after Reverification Required
  const cleanProg = await query.get('SELECT * FROM verification_progress WHERE employee_id = ?', [testEmpId]);
  assert.strictEqual(cleanProg.attempt_number, 2, 'Attempt number must be 2');
  assert.strictEqual(cleanProg.current_step, 1, 'Current step must be reset to 1');
  assert.strictEqual(cleanProg.selfie_captured, 0, 'Selfie captured must be 0');
  assert.strictEqual(cleanProg.selfie_path, null, 'Selfie path must be NULL');
  assert.strictEqual(cleanProg.house_photo_captured, 0, 'House photo captured must be 0');
  assert.strictEqual(cleanProg.house_photo_path, null, 'House photo path must be NULL');
  assert.strictEqual(cleanProg.door_photo_captured, 0, 'Door photo captured must be 0');
  assert.strictEqual(cleanProg.door_photo_path, null, 'Door photo path must be NULL');
  assert.strictEqual(cleanProg.street_photo_captured, 0, 'Street photo captured must be 0');
  assert.strictEqual(cleanProg.street_photo_path, null, 'Street photo path must be NULL');
  assert.strictEqual(cleanProg.landmark_photo_captured, 0, 'Landmark photo captured must be 0');
  assert.strictEqual(cleanProg.landmark_photo_path, null, 'Landmark photo path must be NULL');
  assert.strictEqual(cleanProg.declaration_accepted, 0, 'Declaration must be 0');
  console.log('✓ Step 2: Reverification reset completely wiped all 5 photo flags, paths, and coords to clean state');

  // 4. Test strict validation against document/screen in reverification
  const docPhotoValidation = await validateImage({
    photoType: 'landmark',
    clientMetrics: {
      blurScore: 85,
      brightness: 190,
      contrast: 65,
      ocrText: 'Intelligent text extraction candidate address in document view back front UIDAI Aadhaar'
    }
  });
  assert.strictEqual(docPhotoValidation.valid, false, 'Document photo must fail for landmark');
  assert.ok(docPhotoValidation.error.includes('Document or computer screen detected'), 'Must detect document/screen');
  console.log('✓ Step 3: Document/screen photo strictly rejected for reverification landmark');

  // 5. Test strict validation for street board in reverification
  const blankStreetValidation = await validateImage({
    photoType: 'street',
    clientMetrics: {
      blurScore: 90,
      brightness: 140,
      contrast: 55,
      ocrText: ''
    }
  });
  assert.strictEqual(blankStreetValidation.valid, false, 'Blank street board must fail');
  console.log('✓ Step 4: Blank/random street photo strictly rejected for reverification street board');

  // 6. Test strict validation for door selfie in reverification (sitting on chair, no door number)
  const chairSelfie = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 85,
      brightness: 120,
      contrast: 50,
      faceDetected: true,
      ocrText: ''
    }
  });
  assert.strictEqual(chairSelfie.valid, false, 'Door selfie without door number must fail');
  assert.ok(chairSelfie.error.includes('Door/house number could not be read'), 'Must reject when door number is missing');
  console.log('✓ Step 5: Door selfie without door number strictly rejected');

  // 7. Verify submission requirement: If unverified evidence photos exist for attempt 2, submission fails
  const requiredEvidenceTypes = [
    { type: 'selfie', name: 'Live Selfie' },
    { type: 'house_photo', name: 'Full Building Photo' },
    { type: 'door_photo', name: 'Door Number Selfie' },
    { type: 'street_photo', name: 'Street Board Image' },
    { type: 'landmark_photo', name: 'Nearby Landmark Image' }
  ];

  const passedEvidence = await query.all(
    `SELECT evidence_type, validation_status FROM verification_evidence
     WHERE employee_id = ? AND attempt_number = ? AND validation_status = 'PASSED'`,
    [testEmpId, 2]
  );
  const passedSet = new Set(passedEvidence.map(e => e.evidence_type));
  const unverifiedPhotos = requiredEvidenceTypes
    .filter(item => !passedSet.has(item.type))
    .map(item => item.name);

  assert.strictEqual(unverifiedPhotos.length, 5, 'All 5 photos must be flagged as unverified for attempt 2');
  console.log('✓ Step 6: Final submission blocked when attempt 2 photos have not passed validation');

  // 8. Record 5 valid photos for attempt 2 with distinct coordinates and PASSED status
  const photoSpecs = [
    { type: 'landmark_photo', path: 'uploads/landmark_v2.jpg', lat: 13.081, lon: 80.191, acc: 8 },
    { type: 'street_photo', path: 'uploads/street_v2.jpg', lat: 13.082, lon: 80.192, acc: 9 },
    { type: 'house_photo', path: 'uploads/house_v2.jpg', lat: 13.083, lon: 80.193, acc: 7 },
    { type: 'door_photo', path: 'uploads/door_v2.jpg', lat: 13.084, lon: 80.194, acc: 6 },
    { type: 'selfie', path: 'uploads/selfie_v2.jpg', lat: 13.085, lon: 80.195, acc: 5 }
  ];

  for (const p of photoSpecs) {
    await query.run(`
      INSERT INTO verification_evidence (
        attempt_number, employee_id, evidence_type, file_path,
        latitude, longitude, gps_accuracy, validation_status, validation_report
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PASSED', '{"valid":true}')
    `, [2, testEmpId, p.type, p.path, p.lat, p.lon, p.acc]);
  }

  // Check that all 5 passed now
  const passedEvidence2 = await query.all(
    `SELECT evidence_type, validation_status FROM verification_evidence
     WHERE employee_id = ? AND attempt_number = ? AND validation_status = 'PASSED'`,
    [testEmpId, 2]
  );
  const passedSet2 = new Set(passedEvidence2.map(e => e.evidence_type));
  const remainingUnverified = requiredEvidenceTypes.filter(item => !passedSet2.has(item.type));
  assert.strictEqual(remainingUnverified.length, 0, 'No unverified photos remain once all 5 have passed');
  console.log('✓ Step 7: All 5 attempt 2 photos successfully recorded with validation_status = PASSED');

  // Clean up test records
  await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM verification_attempts WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmpId]);
  await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);

  console.log('\n================================================================');
  console.log(' ALL REVERIFICATION & STRICT PHOTO LIFECYCLE TESTS PASSED!     ');
  console.log('================================================================\n');
}

runLifecycleTests().catch(err => {
  console.error('Lifecycle test failure:', err);
  process.exit(1);
});
