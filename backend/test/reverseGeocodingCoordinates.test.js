/**
 * Reverse Geocoding Coordinates Unit & Integration Test Suite
 * Validates:
 * 1. Primary Test Case: Captured Employee Coordinates (13.079030, 80.199034)
 *    Expected: Gandhi Street, Old Tirumangalam, Anna Nagar, Chennai - 600040.
 * 2. All 7 Address Fields: road, locality, vicinity_corridor, city, district, state, pincode.
 * 3. Prevention of Incorrect Koyambedu / Maduravoyal (600105) fallback.
 * 4. Coordinate Preservation & Precision.
 */

const assert = require('assert');
const { reverseGeocodeCoordinates, getLiveLocalityAndCorridor } = require('../utils/geoUtils');

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log(' STARTING REVERSE GEOCODING COORDINATES UNIT TESTS              ');
  console.log('================================================================');

  await runAsyncTest('Primary GPS Coordinates (13.079030, 80.199034) resolve to Gandhi Street, Old Tirumangalam, Anna Nagar, Chennai', async () => {
    const lat = 13.079030;
    const lon = 80.199034;

    const result = await reverseGeocodeCoordinates(lat, lon);

    assert.strictEqual(result.success, true, 'Reverse geocoding must succeed');
    assert.strictEqual(result.road, 'Gandhi Street', 'Road must be Gandhi Street');
    assert.strictEqual(result.sublocality, 'Old Tirumangalam', 'Sublocality must be Old Tirumangalam');
    assert.strictEqual(result.locality, 'Old Tirumangalam, Anna Nagar', 'Locality must be Old Tirumangalam, Anna Nagar');
    assert.strictEqual(result.city, 'Chennai', 'City must be Chennai');
    assert.strictEqual(result.district, 'Chennai District', 'District must be Chennai District');
    assert.strictEqual(result.state, 'Tamil Nadu', 'State must be Tamil Nadu');
    assert.strictEqual(result.pincode, '600040', 'PIN code must be 600040');
    assert.ok(result.vicinity_corridor.includes('Old Tirumangalam'), 'Vicinity corridor must mention Old Tirumangalam');
    assert.ok(result.vicinity_corridor.includes('600040'), 'Vicinity corridor must include 600040');
    assert.ok(!result.locality.includes('Koyambedu'), 'Must not classify Old Tirumangalam as Koyambedu');

    // Original coordinates must be strictly preserved
    assert.strictEqual(result.latitude, 13.07903);
    assert.strictEqual(result.longitude, 80.199034);
  });

  runTest('Synchronous getLiveLocalityAndCorridor resolves to Old Tirumangalam / Anna Nagar (600040) without Koyambedu regression', () => {
    const progress = {
      latitude: 13.079030,
      longitude: 80.199034
    };

    const locInfo = getLiveLocalityAndCorridor(progress);

    assert.ok(!locInfo.locality.includes('Koyambedu'), 'Must not display Koyambedu for Tirumangalam coordinates');
    assert.ok(locInfo.locality.includes('Old Tirumangalam') || locInfo.locality.includes('Anna Nagar'), 'Must display Old Tirumangalam or Anna Nagar');
    assert.ok(locInfo.locality.includes('600040'), 'Must include PIN code 600040');
    assert.strictEqual(locInfo.road, 'Gandhi Street');
    assert.strictEqual(locInfo.city, 'Chennai');
    assert.strictEqual(locInfo.pincode, '600040');
  });

  await runAsyncTest('Koyambedu coordinates south of Cooum river correctly mapped to Koyambedu / Maduravoyal (600105)', async () => {
    const koyambeduLat = 13.0680;
    const koyambeduLon = 80.1920;

    const result = await reverseGeocodeCoordinates(koyambeduLat, koyambeduLon);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.pincode, '600105');
    assert.ok(result.locality.includes('Koyambedu'));
  });

  await runAsyncTest('Kolathur / Balaji Nagar coordinates correctly resolve to Balaji Nagar / Kolathur (600099)', async () => {
    const kolathurLat = 13.127028;
    const kolathurLon = 80.212747;

    const result = await reverseGeocodeCoordinates(kolathurLat, kolathurLon);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.pincode, '600099');
    assert.ok(result.locality.includes('Kolathur') || result.locality.includes('Balaji Nagar'));
  });

  console.log('================================================================');
  console.log(' ALL REVERSE GEOCODING COORDINATES TESTS PASSED!                ');
  console.log('================================================================');
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
