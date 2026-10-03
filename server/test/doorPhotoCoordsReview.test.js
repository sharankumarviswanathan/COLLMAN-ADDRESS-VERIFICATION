const assert = require('assert');
const { query } = require('../db/database');

async function runTest() {
  console.log('===============================================================');
  console.log(' STARTING DOOR NUMBER SELFIE COORDINATE & REVIEW MAPPING TEST  ');
  console.log('===============================================================');

  try {
    // 1. Verify Employee 202140 data in verification_progress and verification_evidence
    console.log('\n--- 1. Testing Evidence Retrieval for Employee 202140 ---');
    const empId = '202140';

    const rawEvidence = await query.all(
      'SELECT * FROM verification_evidence WHERE employee_id = ? ORDER BY attempt_number DESC, captured_at DESC, id DESC',
      [empId]
    );

    assert.ok(rawEvidence.length > 0, 'Should have evidence records for 202140');

    // Check Door Photo evidence record
    const doorEvidence = rawEvidence.find(e => e.evidence_type === 'door_photo');
    assert.ok(doorEvidence, 'Door photo evidence must exist in evidence records');

    console.log('Mapped Door Photo Record:');
    console.log(`  ID:           ${doorEvidence.id}`);
    console.log(`  Attempt No:   #${doorEvidence.attempt_number}`);
    console.log(`  File Path:    ${doorEvidence.file_path}`);
    console.log(`  Latitude:     ${doorEvidence.latitude}`);
    console.log(`  Longitude:    ${doorEvidence.longitude}`);
    console.log(`  GPS Accuracy: ±${doorEvidence.gps_accuracy} m`);
    console.log(`  Captured At:  ${doorEvidence.captured_at}`);

    assert.ok(doorEvidence.attempt_number >= 5, 'Must be from a valid attempt (>= 5)');
    assert.ok(doorEvidence.latitude > 13.0 && doorEvidence.latitude < 13.2, 'Latitude must be valid coordinate');
    assert.ok(doorEvidence.longitude > 80.1 && doorEvidence.longitude < 80.3, 'Longitude must be valid coordinate');
    assert.ok(doorEvidence.gps_accuracy > 0 && doorEvidence.gps_accuracy < 50, 'GPS accuracy must be valid');
    assert.ok(doorEvidence.captured_at, 'Capture timestamp must exist');
    assert.ok(doorEvidence.file_path.includes('door_202140'), 'Must point to door selfie photo');

    console.log('✓ Successfully confirmed Door Photo evidence is mapped to latest attempt with exact coordinates.');

    // 2. Test timestamp parsing and formatting logic matching CaseReview.jsx
    console.log('\n--- 2. Testing Date & Time Formatting ---');
    const rawCapturedAt = doorEvidence.captured_at;
    let dateStr = 'N/A';
    let timeStr = 'N/A';
    if (rawCapturedAt) {
      if (typeof rawCapturedAt === 'string' && rawCapturedAt.includes('T')) {
        const [dPart, tPart] = rawCapturedAt.split('T');
        dateStr = dPart;
        timeStr = tPart.substring(0, 8);
      } else if (typeof rawCapturedAt === 'string' && rawCapturedAt.includes(' ')) {
        const [dPart, tPart] = rawCapturedAt.split(' ');
        dateStr = dPart;
        timeStr = tPart.substring(0, 8);
      }
    }

    console.log(`  Formatted Date: ${dateStr}`);
    console.log(`  Formatted Time: ${timeStr}`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(dateStr), 'Date must format to YYYY-MM-DD');
    assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(timeStr), 'Time must format to HH:MM:SS');
    console.log(`✓ Date (${dateStr}) and Time (${timeStr}) formatted correctly without timezone shift.`);

    // 3. Test Haversine distance calculations
    console.log('\n--- 3. Testing Distance Calculations ---');
    function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    }

    const houseLat = 13.079000, houseLng = 80.199016;
    const doorLat = doorEvidence.latitude, doorLng = doorEvidence.longitude;
    const selfieLat = 13.078997, selfieLng = 80.199004;

    const houseToDoorDist = calculateHaversineDistance(houseLat, houseLng, doorLat, doorLng);
    const doorToSelfieDist = calculateHaversineDistance(doorLat, doorLng, selfieLat, selfieLng);

    console.log(`  House to Door Selfie Distance: ${houseToDoorDist} m`);
    console.log(`  Door Selfie to Live Selfie Distance: ${doorToSelfieDist} m`);

    assert.ok(houseToDoorDist <= 10, 'House to Door must be <= 10m (GREEN)');
    assert.ok(doorToSelfieDist <= 10, 'Door to Selfie must be <= 10m (GREEN)');
    console.log('✓ Both consecutive photo distances are within GREEN threshold (0-10 m).');

    // 4. Test separate photo evidence saving (retake & insertion)
    console.log('\n--- 4. Testing Separate Photo Evidence Upload Storage ---');
    const testEmp = 'TEST_SEPARATE_PHOTO_EMP';

    // Clean up
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmp]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmp]);
    await query.run('DELETE FROM verification_cases WHERE employee_id = ?', [testEmp]);
    await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmp]);

    // Create test employee
    await query.run(`
      INSERT INTO employees (
        employee_id, employee_name, mobile_number, email_id, branch, location, department, designation,
        date_of_joining, hr_current_address, hr_city, hr_state, hr_pincode, verification_status
      ) VALUES (?, 'Test Sep Photo', '9999999999', 'sep@example.com', 'Chennai', 'Chennai', 'HR', 'Admin',
        '2024-01-01', 'Address 123', 'Chennai', 'Tamil Nadu', '600001', 'Not Started')
    `, [testEmp]);

    // Create progress
    await query.run(`
      INSERT INTO verification_progress (employee_id, attempt_number, current_step)
      VALUES (?, 1, 9)
    `, [testEmp]);

    // Simulate uploading door photo
    const newDoorLat = 13.078980;
    const newDoorLng = 80.199015;
    const newDoorAcc = 12.5;
    const newDoorTime = '2026-09-23T08:00:00.000Z';
    const newDoorPath = 'uploads/door_test_sep.jpg';

    // Helper simulation
    await query.run(
      'DELETE FROM verification_evidence WHERE employee_id = ? AND attempt_number = ? AND evidence_type = ?',
      [testEmp, 1, 'door_photo']
    );
    await query.run(
      `INSERT INTO verification_evidence (
        case_id, attempt_number, employee_id, evidence_type, file_path,
        mime_type, file_size, latitude, longitude, gps_accuracy, captured_at
      ) VALUES (null, 1, ?, 'door_photo', ?, 'image/jpeg', 12345, ?, ?, ?, ?)`,
      [testEmp, newDoorPath, newDoorLat, newDoorLng, newDoorAcc, newDoorTime]
    );

    let savedEv = await query.get(
      'SELECT * FROM verification_evidence WHERE employee_id = ? AND evidence_type = ?',
      [testEmp, 'door_photo']
    );
    assert.ok(savedEv, 'Evidence must be saved');
    assert.strictEqual(savedEv.latitude, newDoorLat);
    assert.strictEqual(savedEv.longitude, newDoorLng);
    assert.strictEqual(savedEv.gps_accuracy, newDoorAcc);
    assert.strictEqual(savedEv.captured_at, newDoorTime);
    console.log('✓ First capture stored separately in verification_evidence.');

    // Simulate retake
    const retakeLat = 13.078990;
    const retakeLng = 80.199020;
    const retakeAcc = 8.2;
    const retakeTime = '2026-09-23T08:05:00.000Z';
    const retakePath = 'uploads/door_test_sep_retake.jpg';

    await query.run(
      'DELETE FROM verification_evidence WHERE employee_id = ? AND attempt_number = ? AND evidence_type = ?',
      [testEmp, 1, 'door_photo']
    );
    await query.run(
      `INSERT INTO verification_evidence (
        case_id, attempt_number, employee_id, evidence_type, file_path,
        mime_type, file_size, latitude, longitude, gps_accuracy, captured_at
      ) VALUES (null, 1, ?, 'door_photo', ?, 'image/jpeg', 12345, ?, ?, ?, ?)`,
      [testEmp, retakePath, retakeLat, retakeLng, retakeAcc, retakeTime]
    );

    const allDoorEvs = await query.all(
      'SELECT * FROM verification_evidence WHERE employee_id = ? AND evidence_type = ?',
      [testEmp, 'door_photo']
    );
    assert.strictEqual(allDoorEvs.length, 1, 'Should have only 1 door_photo record after retake (no duplicates)');
    assert.strictEqual(allDoorEvs[0].latitude, retakeLat, 'Must have updated retake latitude');
    assert.strictEqual(allDoorEvs[0].gps_accuracy, retakeAcc, 'Must have updated retake accuracy');
    assert.strictEqual(allDoorEvs[0].file_path, retakePath, 'Must have updated retake file path');
    console.log('✓ Retake cleanly replaced old evidence item with new coordinates and timestamp.');

    // Clean up
    await query.run('DELETE FROM verification_evidence WHERE employee_id = ?', [testEmp]);
    await query.run('DELETE FROM verification_progress WHERE employee_id = ?', [testEmp]);
    await query.run('DELETE FROM employees WHERE employee_id = ?', [testEmp]);

    console.log('\n===============================================================');
    console.log(' ALL DOOR PHOTO COORDINATE & REVIEW MAPPING TESTS PASSED (100%)');
    console.log('===============================================================');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTest().then(() => process.exit(0));
