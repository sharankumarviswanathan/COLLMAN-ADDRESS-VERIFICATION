const assert = require('assert');
const { query } = require('../db/database');

async function runTest() {
  console.log('--- STARTING PHOTO EVIDENCE & PER-PHOTO LOCATION TEST ---');
  const testEmpId = 'TEST_PHOTO_EMP_01';

  try {
    // 1. Clean up previous test run
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);

    // 2. Insert test employee
    await query.run(`
      INSERT INTO employees (
        employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
        date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, verification_status
      ) VALUES (?, 'Test Photo Employee', '9876543210', 'test@example.com', 'Chennai Central', 'Chennai', 'Operations', 'Field Officer',
        '2024-01-15', 'No 10 Anna Salai Chennai Tamil Nadu 600002 India', 'Chennai', 'Tamil Nadu', '600002', 'Not Started')
    `, [testEmpId]);

    // 3. Insert initial verification progress
    await query.run(`
      INSERT INTO verification_progress (
        employee_id, attempt_number, current_step, details_confirmed,
        address_confirmed, residence_type, location_captured, latitude, longitude, gps_accuracy
      ) VALUES (?, 1, 5, 1, 1, 'Own House', 1, 13.0827, 80.2707, 5.0)
    `, [testEmpId]);

    // 4. Test uploading 4 photos with 4 DISTINCT coordinates and timestamps
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // (A) Live Selfie
    const selfieCoords = {
      latitude: 13.082710,
      longitude: 80.270710,
      accuracy: 3.2,
      capturedAt: '2026-09-09T10:15:00.000Z'
    };
    // (B) House Photo
    const houseCoords = {
      latitude: 13.082725,
      longitude: 80.270730,
      accuracy: 4.1,
      capturedAt: '2026-09-09T10:16:30.000Z'
    };
    // (C) Street Board Image
    const streetCoords = {
      latitude: 13.082950,
      longitude: 80.270920,
      accuracy: 4.8,
      capturedAt: '2026-09-09T10:18:15.000Z'
    };
    // (D) Nearby Landmark Image
    const landmarkCoords = {
      latitude: 13.083500,
      longitude: 80.271500,
      accuracy: 5.5,
      capturedAt: '2026-09-09T10:20:45.000Z'
    };

    // Update progress table as endpoints would
    await query.run(`
      UPDATE verification_progress SET
        selfie_captured = 1,
        selfie_path = 'uploads/selfie_test.jpg',
        selfie_latitude = ?,
        selfie_longitude = ?,
        selfie_accuracy = ?,
        selfie_captured_at = ?
      WHERE employee_id = ?
    `, [selfieCoords.latitude, selfieCoords.longitude, selfieCoords.accuracy, selfieCoords.capturedAt, testEmpId]);

    await query.run(`
      UPDATE verification_progress SET
        house_photo_captured = 1,
        house_photo_path = 'uploads/house_test.jpg',
        house_photo_latitude = ?,
        house_photo_longitude = ?,
        house_photo_accuracy = ?,
        house_photo_captured_at = ?
      WHERE employee_id = ?
    `, [houseCoords.latitude, houseCoords.longitude, houseCoords.accuracy, houseCoords.capturedAt, testEmpId]);

    await query.run(`
      UPDATE verification_progress SET
        street_photo_captured = 1,
        street_photo_path = 'uploads/street_test.jpg',
        street_photo_latitude = ?,
        street_photo_longitude = ?,
        street_photo_accuracy = ?,
        street_photo_captured_at = ?
      WHERE employee_id = ?
    `, [streetCoords.latitude, streetCoords.longitude, streetCoords.accuracy, streetCoords.capturedAt, testEmpId]);

    await query.run(`
      UPDATE verification_progress SET
        landmark_photo_captured = 1,
        landmark_photo_path = 'uploads/landmark_test.jpg',
        landmark_photo_latitude = ?,
        landmark_photo_longitude = ?,
        landmark_photo_accuracy = ?,
        landmark_photo_captured_at = ?,
        address_proof_uploaded = 1,
        document_type = 'Aadhaar Card',
        document_path = 'uploads/doc_test.pdf',
        declaration_accepted = 1,
        current_step = 11
      WHERE employee_id = ?
    `, [landmarkCoords.latitude, landmarkCoords.longitude, landmarkCoords.accuracy, landmarkCoords.capturedAt, testEmpId]);

    // 5. Verify verification_progress has all 4 distinct coordinates
    const progress = await query.get('SELECT * FROM verification_progress WHERE employee_id = ?', [testEmpId]);
    assert.strictEqual(progress.selfie_captured, 1, 'Selfie should be captured');
    assert.strictEqual(progress.house_photo_captured, 1, 'House photo should be captured');
    assert.strictEqual(progress.street_photo_captured, 1, 'Street photo should be captured');
    assert.strictEqual(progress.landmark_photo_captured, 1, 'Landmark photo should be captured');

    assert.strictEqual(progress.selfie_latitude, 13.082710);
    assert.strictEqual(progress.house_photo_latitude, 13.082725);
    assert.strictEqual(progress.street_photo_latitude, 13.082950);
    assert.strictEqual(progress.landmark_photo_latitude, 13.083500);

    console.log('✓ Verification progress stored 4 independent coordinates successfully.');

    // 6. Insert evidence records into verification_evidence
    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'selfie', 'uploads/selfie_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, selfieCoords.latitude, selfieCoords.longitude, selfieCoords.accuracy, selfieCoords.capturedAt]);

    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'house_photo', 'uploads/house_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, houseCoords.latitude, houseCoords.longitude, houseCoords.accuracy, houseCoords.capturedAt]);

    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'street_photo', 'uploads/street_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, streetCoords.latitude, streetCoords.longitude, streetCoords.accuracy, streetCoords.capturedAt]);

    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'landmark_photo', 'uploads/landmark_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, landmarkCoords.latitude, landmarkCoords.longitude, landmarkCoords.accuracy, landmarkCoords.capturedAt]);

    // 7. Verify all 4 evidence records in database
    const evidenceList = await query.all('SELECT * FROM verification_evidence WHERE employee_id = ? ORDER BY captured_at ASC', [testEmpId]);
    assert.strictEqual(evidenceList.length, 4, 'Should have 4 evidence items');

    const types = evidenceList.map(e => e.evidence_type);
    assert.deepStrictEqual(types, ['selfie', 'house_photo', 'street_photo', 'landmark_photo']);

    const lats = evidenceList.map(e => e.latitude);
    assert.deepStrictEqual(lats, [13.082710, 13.082725, 13.082950, 13.083500]);

    // Check that none of the coordinates are identical
    const uniqueLats = new Set(lats);
    assert.strictEqual(uniqueLats.size, 4, 'All 4 photos MUST have distinct independent coordinates');

    console.log('✓ All 4 evidence records stored with independent live coordinates and timestamps:');
    evidenceList.forEach((e) => {
      console.log(`  - [${e.evidence_type.toUpperCase()}]: Lat ${e.latitude}, Lng ${e.longitude}, Acc ±${e.gps_accuracy}m @ ${e.captured_at}`);
    });

    // 8. Clean up test employee
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);

    console.log('--- ALL PHOTO EVIDENCE TESTS PASSED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTest().then(() => process.exit(0));
