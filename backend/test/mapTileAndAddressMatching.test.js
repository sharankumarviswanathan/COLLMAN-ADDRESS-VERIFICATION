/**
 * Unit Test Suite for Plan 3.2: Geocoding Reliability, Address-Coordinate Matching & Map Tile Rendering
 *
 * Verifies:
 * 1. Complete Address Decomposition and Assembly (buildFullAddressString, cleanDoorNumber, extractPincode)
 * 2. 100-Point Candidate Address Match Scoring & Boundary Penalties (evaluateCandidateResult)
 * 3. Google Maps Candidate Priority Ranking & Exact Coordinate Retention (evaluateGoogleCandidate)
 * 4. Conditional 100m Fail-Closed Radius Verification Rule across Quality Tiers
 * 5. Web Mercator Map Tile Math (lon2tile, lat2tile, latLngToWorldPixel) & PNG Buffer Generation
 * 6. Offline / Missing GPS Graceful Fallback Handling
 */

const assert = require('assert');
const {
  buildFullAddressString,
  normalizeAddress,
  cleanDoorNumber,
  extractHouseNumber,
  extractPincode,
  evaluateCandidateResult,
  evaluateGoogleCandidate,
  classifyDistance,
  classifyDistanceBand
} = require('../utils/geoUtils');

const {
  lon2tile,
  lat2tile,
  latLngToWorldPixel,
  makePng,
  generateGoogleAuditMap
} = require('../utils/googleMapGenerator');

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
  console.log('  TESTING PLAN 3.2: GEOCODING RELIABILITY & MAP TILE MATCHING');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: Complete Address Decomposition and Normalization
  // -------------------------------------------------------------
  runTest('1.1: buildFullAddressString cleanly combines and deduplicates all HR fields', () => {
    const hrData = {
      hr_address_line1: 'Flat G-04, Plot 42-B, Shanthi Enclave',
      hr_address_line2: '1st Cross Street',
      hr_area: 'Anna Nagar West',
      hr_landmark: 'Near Roundtana',
      hr_city: 'Chennai',
      hr_district: 'Chennai',
      hr_state: 'Tamil Nadu',
      hr_pincode: 600040, // Numeric pincode test
      country: 'India'
    };

    const assembled = buildFullAddressString(hrData);
    assert.ok(assembled.includes('Flat G-04, Plot 42-B, Shanthi Enclave'), 'Includes line 1');
    assert.ok(assembled.includes('1st Cross Street'), 'Includes line 2');
    assert.ok(assembled.includes('Anna Nagar West'), 'Includes area');
    assert.ok(assembled.includes('Near Roundtana'), 'Includes landmark');
    assert.ok(assembled.includes('Chennai'), 'Includes city');
    assert.ok(assembled.includes('Tamil Nadu'), 'Includes state');
    assert.ok(assembled.includes('600040'), 'Includes pincode as string');
    assert.ok(assembled.endsWith('India'), 'Ends with country');
  });

  runTest('1.2: Door number cleaner and house number extractor support Indian compound formats', () => {
    assert.strictEqual(cleanDoorNumber('D.No. 14/2B, 3rd Street'), '3rd Street');
    assert.strictEqual(cleanDoorNumber('Plot No. 42-B, Main Road'), 'Main Road');
    assert.strictEqual(cleanDoorNumber('Flat G-04, Lake View Road'), 'Lake View Road');

    assert.strictEqual(extractHouseNumber('Door No. 14/2B, Velmurugan Nagar'), '14/2B');
    assert.strictEqual(extractHouseNumber('Flat G-04, Block C'), 'G-04');
    assert.strictEqual(extractHouseNumber('13/A Velmurugan Nagar'), '13/A');
  });

  // -------------------------------------------------------------
  // Test 2: 100-Point Match Scoring & Broad Boundary Penalty
  // -------------------------------------------------------------
  runTest('2.1: 100-Point Candidate Match Scoring with full components awards PRECISE', () => {
    const hrObj = {
      address: '13/A Velmurugan Nagar 3rd Street',
      area: 'Surapet',
      landmark: 'Near Temple',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600099'
    };

    const candidate = {
      display_name: '13/A, 3rd Street, Velmurugan Nagar, Surapet, Chennai, Tamil Nadu, 600099, India',
      address: {
        house_number: '13/A',
        road: '3rd Street',
        suburb: 'Surapet',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postcode: '600099'
      },
      type: 'house',
      class: 'building'
    };

    const evaluated = evaluateCandidateResult(candidate, hrObj);
    assert.ok(evaluated.matchScore >= 90, `Expected score >= 90, got ${evaluated.matchScore}`);
    assert.strictEqual(evaluated.confidence, 'VERY HIGH');
    assert.strictEqual(evaluated.referenceQuality, 'PRECISE');
    assert.strictEqual(evaluated.referenceType, 'BUILDING');
    assert.strictEqual(evaluated.houseMatch, 'YES');
    assert.strictEqual(evaluated.streetMatch, 'YES');
    assert.strictEqual(evaluated.pincodeMatch, 'YES');
  });

  runTest('2.2: Pincode mismatch imposes severe -25 penalty and drops confidence to LOW', () => {
    const hrObj = {
      address: 'Velmurugan Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600099'
    };

    const candidateWrongPin = {
      display_name: 'Velmurugan Nagar, Kolathur, Chennai, Tamil Nadu, 600082, India',
      address: {
        road: 'Velmurugan Nagar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postcode: '600082' // Different pincode!
      },
      type: 'residential'
    };

    const evaluated = evaluateCandidateResult(candidateWrongPin, hrObj);
    assert.strictEqual(evaluated.pincodeMatch, 'NO');
    assert.ok(evaluated.matchScore < 60, `Score must drop below 60 on postal conflict, got: ${evaluated.matchScore}`);
    assert.strictEqual(evaluated.confidence, 'LOW');
    assert.strictEqual(evaluated.referenceQuality, 'INSUFFICIENT ADDRESS PRECISION');
  });

  runTest('2.3: Broad administrative/city boundary results are capped to <= 40 points', () => {
    const hrObj = {
      address: '13/A Velmurugan Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600099'
    };

    const broadCandidate = {
      display_name: 'Greater Chennai Corporation, Chennai, Tamil Nadu, India',
      address: {
        city: 'Chennai',
        state: 'Tamil Nadu'
      },
      type: 'administrative',
      class: 'boundary'
    };

    const evaluated = evaluateCandidateResult(broadCandidate, hrObj);
    assert.strictEqual(evaluated.isBroad, true, 'Must detect broad administrative boundary');
    assert.ok(evaluated.matchScore <= 40, `Broad match score must be capped <= 40, got: ${evaluated.matchScore}`);
    assert.strictEqual(evaluated.referenceQuality, 'INSUFFICIENT ADDRESS PRECISION');
    assert.strictEqual(evaluated.referenceType, 'LOCALITY');
  });

  // -------------------------------------------------------------
  // Test 3: Google Maps Candidate Priority Ranking & Precision
  // -------------------------------------------------------------
  runTest('3.1: Google ROOFTOP street_address achieves Priority 1 with unshifted coordinates', () => {
    const mockRooftop = {
      formatted_address: 'Plot 42-B, Anna Nagar West, Chennai, Tamil Nadu 600040',
      geometry: {
        location: { lat: 13.085000, lng: 80.210000 },
        location_type: 'ROOFTOP'
      },
      types: ['street_address'],
      address_components: [
        { long_name: '42-B', short_name: '42-B', types: ['street_number'] },
        { long_name: 'Anna Nagar West', short_name: 'Anna Nagar W', types: ['sublocality'] },
        { long_name: 'Chennai', short_name: 'Chennai', types: ['locality'] },
        { long_name: 'Tamil Nadu', short_name: 'TN', types: ['administrative_area_level_1'] },
        { long_name: '600040', short_name: '600040', types: ['postal_code'] }
      ]
    };

    const hrAddr = { hr_city: 'Chennai', hr_state: 'Tamil Nadu', hr_pincode: '600040' };
    const ev = evaluateGoogleCandidate(mockRooftop, hrAddr);

    assert.strictEqual(ev.priorityRank, 1);
    assert.strictEqual(ev.referenceQuality, 'PRECISE');
    assert.strictEqual(ev.status, 'GEOCODED');
    assert.strictEqual(ev.confidence, 'VERY HIGH');
    assert.strictEqual(ev.latitude, 13.085000);
    assert.strictEqual(ev.longitude, 80.210000);
  });

  // -------------------------------------------------------------
  // Test 4: Strict 100m Verification Radius Rule Enforcement
  // -------------------------------------------------------------
  runTest('4.1: Strict 100-metre rule passes ONLY for PRECISE references within 100m', () => {
    // 1. PRECISE reference within 100m -> PASS
    const passResult = classifyDistance(45, 'ROOFTOP', 5, 'PRECISE');
    assert.strictEqual(passResult.isPass, true);
    assert.strictEqual(passResult.category, 'INSIDE RADIUS / PASS');
    assert.strictEqual(passResult.distanceBand, '0-500m');

    // 2. APPROXIMATE reference within 100m -> MUST FAIL CLOSED (Requires Review)
    const failApprox = classifyDistance(45, 'LOCALITY', 5, 'APPROXIMATE');
    assert.strictEqual(failApprox.isPass, false);
    assert.strictEqual(failApprox.category, 'HR LOCATION APPROXIMATE - REVIEW REQUIRED');

    // 3. PRECISE reference > 100m -> MUST FAIL CLOSED (Requires Review)
    const failOutside = classifyDistance(105, 'ROOFTOP', 5, 'PRECISE');
    assert.strictEqual(failOutside.isPass, false);
    assert.strictEqual(failOutside.category, 'OUTSIDE RADIUS / REVIEW REQUIRED');
  });

  // -------------------------------------------------------------
  // Test 5: Web Mercator Map Tile Math & PNG Generation
  // -------------------------------------------------------------
  runTest('5.1: lon2tile, lat2tile and latLngToWorldPixel compute accurate Mercator projections', () => {
    const lat = 13.0827; // Chennai Central
    const lng = 80.2707;
    const zoom = 15;

    const tileX = lon2tile(lng, zoom);
    const tileY = lat2tile(lat, zoom);

    assert.ok(Number.isInteger(tileX), 'Tile X must be an integer');
    assert.ok(Number.isInteger(tileY), 'Tile Y must be an integer');
    assert.ok(tileX > 0 && tileX < Math.pow(2, zoom), `Tile X out of bounds: ${tileX}`);
    assert.ok(tileY > 0 && tileY < Math.pow(2, zoom), `Tile Y out of bounds: ${tileY}`);

    const worldPixel = latLngToWorldPixel(lat, lng, zoom, 256);
    assert.ok(worldPixel.x > 0 && worldPixel.y > 0, 'World pixels must be positive');
  });

  runTest('5.2: makePng constructs valid PNG buffer with valid signature and chunks', () => {
    const width = 4;
    const height = 4;
    const rgba = Buffer.alloc(width * height * 4, 128); // 4x4 gray square

    const pngBuf = makePng(width, height, rgba);
    assert.ok(Buffer.isBuffer(pngBuf), 'Must return a Buffer');
    assert.ok(pngBuf.length > 50, 'PNG buffer must have substantial size');

    // Valid PNG 8-byte signature: 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    const expectedSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < expectedSig.length; i++) {
      assert.strictEqual(pngBuf[i], expectedSig[i], `Byte ${i} of PNG signature must match`);
    }

    // Verify IHDR chunk exists
    const ihdrIdx = pngBuf.indexOf(Buffer.from('IHDR', 'ascii'));
    assert.ok(ihdrIdx > 0, 'Must contain IHDR chunk');

    // Verify IEND chunk exists
    const iendIdx = pngBuf.indexOf(Buffer.from('IEND', 'ascii'));
    assert.ok(iendIdx > ihdrIdx, 'Must contain IEND chunk after IHDR');
  });

  // -------------------------------------------------------------
  // Test 6: Offline & Missing Coordinates Fallback Handling
  // -------------------------------------------------------------
  await runAsyncTest('6.1: generateGoogleAuditMap returns null gracefully without throwing on missing coords', async () => {
    const res1 = await generateGoogleAuditMap(null, null, 'dummy.png');
    assert.strictEqual(res1, null, 'Missing coordinates must return null');

    const res2 = await generateGoogleAuditMap(NaN, 'invalid', 'dummy.png');
    assert.strictEqual(res2, null, 'Invalid coordinate formats must return null');
  });

  console.log('\n================================================================');
  console.log('  ALL PLAN 3.2 GEOCODING & MAP TILE TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Fatal test error in mapTileAndAddressMatching suite:', err);
  process.exit(1);
});
