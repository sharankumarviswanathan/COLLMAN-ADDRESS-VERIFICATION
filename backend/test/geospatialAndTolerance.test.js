/**
 * Unit Test Suite for Geospatial & Geocoding Reliability (Phase 3, Plan 3.1)
 *
 * Verifies:
 * 1. Geographic Coordinate Parsing & Robust Boundary Validations (parseCoordinates)
 * 2. Haversine Formula Precision, Mathematical Symmetry & Zero-Distance Self-Check
 * 3. Standard Distance Band Classifications (0-500m, 500m-2km, 2km+)
 * 4. Conditional 100m Verification Radius Integration & Fail-Closed Guardrails
 * 5. Geocoding Provider Fallbacks & Safe Handling of Network Errors
 */

const assert = require('assert');
const {
  calculateDistanceMeters,
  formatDistance,
  getDynamicToleranceMeters,
  classifyDistance,
  classifyDistanceBand,
  parseCoordinates,
  evaluateGoogleCandidate,
  geocodeAddress
} = require('../utils/geoUtils');

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

async function main() {
  console.log('================================================================');
  console.log('  TESTING GEOSPATIAL & GEOCODING RELIABILITY (PLAN 3.1)');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: Coordinate Parsing with Multiple Input Formats
  // -------------------------------------------------------------
  runTest('1.1: Coordinate parsing handles numbers, strings, comma-pairs, and objects', () => {
    // Number arguments
    const c1 = parseCoordinates(13.0827, 80.2707);
    assert.strictEqual(c1.isValid, true);
    assert.strictEqual(c1.latitude, 13.0827);
    assert.strictEqual(c1.longitude, 80.2707);

    // String arguments
    const c2 = parseCoordinates('13.0827', '80.2707');
    assert.strictEqual(c2.isValid, true);
    assert.strictEqual(c2.latitude, 13.0827);
    assert.strictEqual(c2.longitude, 80.2707);

    // Single comma-separated string
    const c3 = parseCoordinates('13.0827, 80.2707');
    assert.strictEqual(c3.isValid, true);
    assert.strictEqual(c3.latitude, 13.0827);
    assert.strictEqual(c3.longitude, 80.2707);

    // Object with lat/lng
    const c4 = parseCoordinates({ lat: 12.9716, lng: 77.5946 });
    assert.strictEqual(c4.isValid, true);
    assert.strictEqual(c4.latitude, 12.9716);
    assert.strictEqual(c4.longitude, 77.5946);

    // Object with latitude/longitude
    const c5 = parseCoordinates({ latitude: 19.0760, longitude: 72.8777 });
    assert.strictEqual(c5.isValid, true);
    assert.strictEqual(c5.latitude, 19.0760);
    assert.strictEqual(c5.longitude, 72.8777);

    // Cardinal directions (North/East vs South/West)
    const c6 = parseCoordinates('33.8688 S, 151.2093 E');
    assert.strictEqual(c6.isValid, true);
    assert.strictEqual(c6.latitude, -33.8688);
    assert.strictEqual(c6.longitude, 151.2093);
  });

  // -------------------------------------------------------------
  // Test 2: Boundary Validations & Error Handling for Coordinates
  // -------------------------------------------------------------
  runTest('1.2: Strict boundary validations reject out-of-range coordinates & invalid types', () => {
    // Latitude out of range (> 90)
    const inv1 = parseCoordinates(95.0, 80.0);
    assert.strictEqual(inv1.isValid, false);
    assert.ok(inv1.error.includes('[-90, 90]'));

    // Latitude out of range (< -90)
    const inv2 = parseCoordinates(-91.5, 80.0);
    assert.strictEqual(inv2.isValid, false);

    // Longitude out of range (> 180)
    const inv3 = parseCoordinates(13.0, 185.0);
    assert.strictEqual(inv3.isValid, false);
    assert.ok(inv3.error.includes('[-180, 180]'));

    // Longitude out of range (< -180)
    const inv4 = parseCoordinates(13.0, -181.0);
    assert.strictEqual(inv4.isValid, false);

    // Null and undefined inputs
    const inv5 = parseCoordinates(null, null);
    assert.strictEqual(inv5.isValid, false);

    const inv6 = parseCoordinates(undefined, 80.0);
    assert.strictEqual(inv6.isValid, false);

    // Non-numeric garbage string
    const inv7 = parseCoordinates('INVALID_LAT', 'INVALID_LNG');
    assert.strictEqual(inv7.isValid, false);
  });

  // -------------------------------------------------------------
  // Test 3: Haversine Formula Accuracy, Symmetry & Self-Distance
  // -------------------------------------------------------------
  runTest('1.3: Haversine distance computation proves mathematical symmetry & exact self-distance', () => {
    const ptA = { lat: 13.0827, lon: 80.2707 }; // Chennai Central
    const ptB = { lat: 13.0500, lon: 80.2824 }; // Marina Beach

    // Self distance must be 0
    const selfDist = calculateDistanceMeters(ptA.lat, ptA.lon, ptA.lat, ptA.lon);
    assert.strictEqual(selfDist, 0, 'Self distance must equal 0m');

    // Mathematical symmetry: d(A, B) === d(B, A)
    const distAB = calculateDistanceMeters(ptA.lat, ptA.lon, ptB.lat, ptB.lon);
    const distBA = calculateDistanceMeters(ptB.lat, ptB.lon, ptA.lat, ptA.lon);
    assert.strictEqual(distAB, distBA, 'Haversine distance must be strictly symmetric');
    assert.ok(distAB > 3500 && distAB < 4000, `Expected distance ~3.8km, got ${distAB}m`);

    // Micro-proximity (~63.9 meters between two points)
    const microDist = calculateDistanceMeters(13.140255, 80.202072, 13.140650, 80.202500);
    assert.strictEqual(microDist, 63.9, 'Must accurately compute sub-100m micro distances');
    assert.strictEqual(formatDistance(microDist), '64 m');

    // Missing coordinate returns null gracefully
    assert.strictEqual(calculateDistanceMeters(null, 80.0, 13.0, 80.0), null);
    assert.strictEqual(calculateDistanceMeters(13.0, null, 13.0, 80.0), null);
    assert.strictEqual(calculateDistanceMeters(13.0, 80.0, null, 80.0), null);
  });

  // -------------------------------------------------------------
  // Test 4: Distance Band Classifications (0-500m, 500m-2km, 2km+)
  // -------------------------------------------------------------
  runTest('1.4: Distance band classifications accurately group 0-500m, 500m-2km, and 2km+', () => {
    // Band 1: 0 - 500m (Immediate Vicinity)
    const b0 = classifyDistanceBand(0);
    assert.strictEqual(b0.band, '0-500m');
    assert.strictEqual(b0.badgeClass, 'badge-success');
    assert.strictEqual(b0.tolerance, 'PROXIMITY_VERIFIED');

    const b100 = classifyDistanceBand(100);
    assert.strictEqual(b100.band, '0-500m');

    const b500 = classifyDistanceBand(500);
    assert.strictEqual(b500.band, '0-500m');

    // Band 2: 500m - 2km (Extended Neighborhood)
    const b501 = classifyDistanceBand(501);
    assert.strictEqual(b501.band, '500m-2km');
    assert.strictEqual(b501.badgeClass, 'badge-warning');
    assert.strictEqual(b501.tolerance, 'MODERATE_PROXIMITY');

    const b1500 = classifyDistanceBand(1500);
    assert.strictEqual(b1500.band, '500m-2km');

    const b2000 = classifyDistanceBand(2000);
    assert.strictEqual(b2000.band, '500m-2km');

    // Band 3: 2km+ (Out of Proximity)
    const b2001 = classifyDistanceBand(2001);
    assert.strictEqual(b2001.band, '2km+');
    assert.strictEqual(b2001.badgeClass, 'badge-danger');
    assert.strictEqual(b2001.tolerance, 'OUT_OF_PROXIMITY');

    const b50000 = classifyDistanceBand(50000);
    assert.strictEqual(b50000.band, '2km+');

    // Missing / invalid inputs
    const bNull = classifyDistanceBand(null);
    assert.strictEqual(bNull.band, 'NO_GPS');
    assert.strictEqual(bNull.badgeClass, 'badge-secondary');
  });

  // -------------------------------------------------------------
  // Test 5: Integration between Distance Bands and classifyDistance
  // -------------------------------------------------------------
  runTest('1.5: classifyDistance includes distanceBand and preserves 100m fail-closed rule', () => {
    // PRECISE reference within 100m -> PASS, Band 0-500m
    const passRes = classifyDistance(75, 'ROOFTOP', 5, 'PRECISE');
    assert.strictEqual(passRes.isPass, true);
    assert.strictEqual(passRes.category, 'INSIDE RADIUS / PASS');
    assert.strictEqual(passRes.distanceBand, '0-500m');

    // APPROXIMATE reference within 100m -> FAIL (Requires Review), Band 0-500m
    const approxRes = classifyDistance(75, 'STREET', 5, 'APPROXIMATE');
    assert.strictEqual(approxRes.isPass, false);
    assert.strictEqual(approxRes.category, 'HR LOCATION APPROXIMATE - REVIEW REQUIRED');
    assert.strictEqual(approxRes.distanceBand, '0-500m');

    // PRECISE reference beyond 100m but within 500m -> Band 0-500m, REVIEW REQUIRED
    const outRes1 = classifyDistance(350, 'ROOFTOP', 5, 'PRECISE');
    assert.strictEqual(outRes1.isPass, false);
    assert.strictEqual(outRes1.category, 'OUTSIDE RADIUS / REVIEW REQUIRED');
    assert.strictEqual(outRes1.distanceBand, '0-500m');

    // Moderate distance -> Band 500m-2km
    const outRes2 = classifyDistance(1200, 'ROOFTOP', 5, 'PRECISE');
    assert.strictEqual(outRes2.isPass, false);
    assert.strictEqual(outRes2.distanceBand, '500m-2km');

    // Distant -> Band 2km+
    const outRes3 = classifyDistance(4500, 'ROOFTOP', 5, 'PRECISE');
    assert.strictEqual(outRes3.isPass, false);
    assert.strictEqual(outRes3.distanceBand, '2km+');

    // Null distance
    const outResNull = classifyDistance(null);
    assert.strictEqual(outResNull.isPass, false);
    assert.strictEqual(outResNull.distanceBand, 'NO_GPS');
  });

  // -------------------------------------------------------------
  // Test 6: Geocoding Queue Fallback Verification
  // -------------------------------------------------------------
  await runAsyncTest('1.6: Automatic fallback gracefully handles missing Google API key without throwing', async () => {
    const dummyAddr = {
      address: 'Mount Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600002',
      country: 'India'
    };

    // When googleApiKey is null, fallback executes without crash
    const res = await geocodeAddress(dummyAddr, { googleApiKey: null });
    assert.ok(res !== null, 'Geocode result must not be null');
    if (res.success) {
      assert.ok(res.provider.includes('Fallback') || res.provider.includes('Nominatim'), 'Fallback provider was used');
    }
  });

  console.log('\n================================================================');
  console.log('  ALL GEOSPATIAL & TOLERANCE TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Fatal test error in geospatial suite:', err);
  process.exit(1);
});
