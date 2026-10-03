const assert = require('assert');
const { query } = require('../db/database');
const { validateImage } = require('../utils/imageValidator');

async function runTest() {
  console.log('===========================================================');
  console.log(' STARTING IMAGE VALIDATION & 5-PHOTO SEQUENCE TEST SUITE   ');
  console.log('===========================================================');

  const testEmpId = 'TEST_PHOTO_SEQ_5';

  try {
    // 1. Clean up previous test run
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);

    // 2. Insert test employee with full HR address
    await query.run(`
      INSERT INTO employees (
        employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
        date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, verification_status
      ) VALUES (?, 'Test 5-Photo Employee', '9876543210', 'test5@example.com', 'Chennai Central', 'Chennai', 'Engineering', 'Developer',
        '2024-01-15', 'Flat 402 Lake View Apartments 1st Cross Street Gandhi Nagar Chennai Tamil Nadu 600020 India', 'Chennai', 'Tamil Nadu', '600020', 'Not Started')
    `, [testEmpId]);

    // 3. Test Image Validator with simulated client metrics
    console.log('\n--- 1. Testing Automated Image Quality Rules ---');

    // Test A: Blurry image rule
    const blurryReport = await validateImage({
      photoType: 'landmark',
      clientMetrics: { blurScore: 10, brightness: 120, contrast: 40 }
    });
    assert.strictEqual(blurryReport.valid, false, 'Blurry image must fail');
    assert.strictEqual(blurryReport.error, 'Image is not clear. Please retake the photo.');
    console.log('✓ Blur detection passed: Correctly returned "Image is not clear. Please retake the photo."');

    // Test B: Dark image rule
    const darkReport = await validateImage({
      photoType: 'building',
      clientMetrics: { blurScore: 60, brightness: 20, contrast: 30 }
    });
    assert.strictEqual(darkReport.valid, false, 'Dark image must fail');
    assert.ok(darkReport.error.includes('too dark'), 'Dark image must report lighting error');
    console.log('✓ Dark lighting detection passed:', darkReport.error);

    // Test C: Street Board text rule
    const streetNoTextReport = await validateImage({
      photoType: 'street',
      clientMetrics: { blurScore: 70, brightness: 130, contrast: 50, hasTextFeatures: false }
    });
    assert.strictEqual(streetNoTextReport.valid, false, 'Street board without text must fail');
    assert.ok(streetNoTextReport.error.includes('Street name/text could not be read'), 'Must specify street text error');
    console.log('✓ Street Board text requirement passed:', streetNoTextReport.error);

    // Test D: Door Number Selfie face & number rule
    const doorNoFaceReport = await validateImage({
      photoType: 'door_selfie',
      clientMetrics: { blurScore: 75, brightness: 125, contrast: 55, faceDetected: false, hasTextFeatures: true }
    });
    assert.strictEqual(doorNoFaceReport.valid, false, 'Door selfie without face must fail');
    assert.ok(doorNoFaceReport.error.includes('Employee face is not clearly visible'), 'Must report face error in door selfie');
    console.log('✓ Door Selfie face requirement passed:', doorNoFaceReport.error);

    const doorNoNumReport = await validateImage({
      photoType: 'door_selfie',
      clientMetrics: { blurScore: 75, brightness: 125, contrast: 55, faceDetected: true, hasTextFeatures: false }
    });
    assert.strictEqual(doorNoNumReport.valid, false, 'Door selfie without door number must fail');
    assert.ok(doorNoNumReport.error.includes('Door/house number could not be read'), 'Must report door number error');
    console.log('✓ Door Selfie door number requirement passed:', doorNoNumReport.error);

    // Test E: Live Selfie face rule
    const selfieNoFaceReport = await validateImage({
      photoType: 'selfie',
      clientMetrics: { blurScore: 80, brightness: 140, contrast: 60, faceDetected: false }
    });
    assert.strictEqual(selfieNoFaceReport.valid, false, 'Live selfie without face must fail');
    assert.ok(selfieNoFaceReport.error.includes('Employee face is not clearly visible'), 'Must report live face error');
    console.log('✓ Live Selfie face requirement passed:', selfieNoFaceReport.error);

    // Test F: Clear valid photo
    const clearReport = await validateImage({
      photoType: 'landmark',
      clientMetrics: { blurScore: 85, brightness: 145, contrast: 65 }
    });
    assert.strictEqual(clearReport.valid, true, 'Clear photo with good metrics must pass');
    console.log('✓ High quality photo passed validation successfully.');

    // 4. Test 5-Photo Database Storage with Distinct Coordinates
    console.log('\n--- 2. Testing 5-Photo Storage with Independent Coordinates ---');

    const photo1_landmark = { lat: 13.083100, lng: 80.271100, acc: 4.5, time: '2026-09-09T10:01:00.000Z' };
    const photo2_street   = { lat: 13.082950, lng: 80.270920, acc: 4.0, time: '2026-09-09T10:03:30.000Z' };
    const photo3_building = { lat: 13.082800, lng: 80.270810, acc: 3.8, time: '2026-09-09T10:05:15.000Z' };
    const photo4_door     = { lat: 13.082750, lng: 80.270750, acc: 3.2, time: '2026-09-09T10:07:00.000Z' };
    const photo5_selfie   = { lat: 13.082720, lng: 80.270720, acc: 2.8, time: '2026-09-09T10:09:00.000Z' };

    await query.run(`
      INSERT INTO verification_progress (
        employee_id, attempt_number, current_step,
        details_confirmed, address_confirmed, residence_type, location_captured,
        latitude, longitude, gps_accuracy,
        landmark_photo_captured, landmark_photo_path, landmark_photo_latitude, landmark_photo_longitude, landmark_photo_accuracy, landmark_photo_captured_at,
        street_photo_captured, street_photo_path, street_photo_latitude, street_photo_longitude, street_photo_accuracy, street_photo_captured_at,
        house_photo_captured, house_photo_path, house_photo_latitude, house_photo_longitude, house_photo_accuracy, house_photo_captured_at,
        door_photo_captured, door_photo_path, door_photo_latitude, door_photo_longitude, door_photo_accuracy, door_photo_captured_at,
        selfie_captured, selfie_path, selfie_latitude, selfie_longitude, selfie_accuracy, selfie_captured_at,
        address_proof_uploaded, document_type, document_path, declaration_accepted
      ) VALUES (
        ?, 1, 12,
        1, 1, 'Own House', 1,
        13.082720, 80.270720, 3.0,
        1, 'uploads/landmark_test.jpg', ?, ?, ?, ?,
        1, 'uploads/street_test.jpg', ?, ?, ?, ?,
        1, 'uploads/building_test.jpg', ?, ?, ?, ?,
        1, 'uploads/door_test.jpg', ?, ?, ?, ?,
        1, 'uploads/selfie_test.jpg', ?, ?, ?, ?,
        1, 'Electricity Bill', 'uploads/bill_test.pdf', 1
      )
    `, [
      testEmpId,
      photo1_landmark.lat, photo1_landmark.lng, photo1_landmark.acc, photo1_landmark.time,
      photo2_street.lat, photo2_street.lng, photo2_street.acc, photo2_street.time,
      photo3_building.lat, photo3_building.lng, photo3_building.acc, photo3_building.time,
      photo4_door.lat, photo4_door.lng, photo4_door.acc, photo4_door.time,
      photo5_selfie.lat, photo5_selfie.lng, photo5_selfie.acc, photo5_selfie.time
    ]);

    // Verify progress row has all 5 photos with separate coordinates
    const prog = await query.get('SELECT * FROM verification_progress WHERE employee_id = ?', [testEmpId]);
    assert.strictEqual(prog.landmark_photo_captured, 1, 'Landmark photo captured');
    assert.strictEqual(prog.street_photo_captured, 1, 'Street board captured');
    assert.strictEqual(prog.house_photo_captured, 1, 'Building photo captured');
    assert.strictEqual(prog.door_photo_captured, 1, 'Door selfie captured');
    assert.strictEqual(prog.selfie_captured, 1, 'Live selfie captured');

    assert.strictEqual(prog.landmark_photo_latitude, photo1_landmark.lat);
    assert.strictEqual(prog.street_photo_latitude, photo2_street.lat);
    assert.strictEqual(prog.house_photo_latitude, photo3_building.lat);
    assert.strictEqual(prog.door_photo_latitude, photo4_door.lat);
    assert.strictEqual(prog.selfie_latitude, photo5_selfie.lat);

    console.log('✓ verification_progress verified with all 5 distinct photo coordinates:');
    console.log(`  1. Nearby Landmark: Lat ${prog.landmark_photo_latitude}, Lng ${prog.landmark_photo_longitude}`);
    console.log(`  2. Street Board:    Lat ${prog.street_photo_latitude}, Lng ${prog.street_photo_longitude}`);
    console.log(`  3. Full Building:   Lat ${prog.house_photo_latitude}, Lng ${prog.house_photo_longitude}`);
    console.log(`  4. Door Selfie:     Lat ${prog.door_photo_latitude}, Lng ${prog.door_photo_longitude}`);
    console.log(`  5. Live Selfie:     Lat ${prog.selfie_latitude}, Lng ${prog.selfie_longitude}`);

    // Insert into verification_evidence
    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'landmark_photo', 'uploads/landmark_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, photo1_landmark.lat, photo1_landmark.lng, photo1_landmark.acc, photo1_landmark.time]);

    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'street_photo', 'uploads/street_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, photo2_street.lat, photo2_street.lng, photo2_street.acc, photo2_street.time]);

    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'house_photo', 'uploads/building_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, photo3_building.lat, photo3_building.lng, photo3_building.acc, photo3_building.time]);

    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'door_photo', 'uploads/door_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, photo4_door.lat, photo4_door.lng, photo4_door.acc, photo4_door.time]);

    await query.run(`
      INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, file_path, latitude, longitude, gps_accuracy, captured_at)
      VALUES (1, 1, ?, 'selfie', 'uploads/selfie_test.jpg', ?, ?, ?, ?)
    `, [testEmpId, photo5_selfie.lat, photo5_selfie.lng, photo5_selfie.acc, photo5_selfie.time]);

    const evidenceList = await query.all('SELECT * FROM verification_evidence WHERE employee_id = ? ORDER BY captured_at ASC', [testEmpId]);
    assert.strictEqual(evidenceList.length, 5, 'Should have exactly 5 evidence records');

    const expectedSequence = ['landmark_photo', 'street_photo', 'house_photo', 'door_photo', 'selfie'];
    const actualSequence = evidenceList.map(e => e.evidence_type);
    assert.deepStrictEqual(actualSequence, expectedSequence, 'Sequence must be Landmark -> Street -> Building -> Door -> Selfie');

    // Verify all 5 coordinates are distinct
    const lats = evidenceList.map(e => e.latitude);
    const uniqueLats = new Set(lats);
    assert.strictEqual(uniqueLats.size, 5, 'All 5 photos must have non-identical live coordinates');

    console.log('✓ Sequence and independent coordinates verified in verification_evidence:');
    evidenceList.forEach((e, idx) => {
      console.log(`  ${idx + 1}. [${e.evidence_type}]: Lat ${e.latitude}, Lng ${e.longitude}, Acc ±${e.gps_accuracy}m @ ${e.captured_at}`);
    });

    // 5. Clean up
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmpId]);
    await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmpId]);

    console.log('\n===========================================================');
    console.log(' ALL 5-PHOTO & IMAGE VALIDATION TESTS PASSED (100%)       ');
    console.log('===========================================================');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTest().then(() => process.exit(0));
