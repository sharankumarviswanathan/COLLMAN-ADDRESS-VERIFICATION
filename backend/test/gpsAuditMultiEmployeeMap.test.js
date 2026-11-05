const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateGoogleAuditMap } = require('../utils/googleMapGenerator');
const { generateVerificationReportPDF } = require('../utils/pdfGenerator');

async function runTests() {
  console.log('========================================================================');
  console.log(' RUNNING GPS GEOLOCATION AUDIT MAP MULTI-RECORD TEST SUITE');
  console.log('========================================================================\n');

  const testDir = path.join(__dirname, 'temp_map_test');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testRecords = [
    {
      id: '12705',
      name: 'Mariyadoss E',
      lat: 13.0782393,
      lng: 80.2559767,
      acc: 11.2,
      locality: 'Egmore, Chennai'
    },
    {
      id: '17510',
      name: 'SHARANKUMAR V',
      lat: 13.1392918,
      lng: 80.2002994,
      acc: 18.3,
      locality: 'Surapet / Vinayagapuram, Chennai'
    },
    {
      id: '88888',
      name: 'sha',
      lat: 13.081685,
      lng: 80.274769,
      acc: 5.0,
      locality: 'Chennai Central'
    },
    {
      id: 'COL00101',
      name: 'Arun Kumar Sampath',
      lat: 12.9118,
      lng: 77.6391,
      acc: 5.4,
      locality: 'Bangalore'
    }
  ];

  // Test 1: Each record dynamically generates its own distinct map centered on its coordinates
  console.log('[Test 1] Testing dynamic map generation for multiple distinct coordinates...');
  const generatedMapPaths = [];
  const mapFileSizes = [];

  for (const rec of testRecords) {
    const outPath = path.join(testDir, `map_test_${rec.id}.png`);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

    console.log(`  -> Generating map for ${rec.id} (${rec.locality}: ${rec.lat}, ${rec.lng})...`);
    const res = await generateGoogleAuditMap(rec.lat, rec.lng, outPath, rec.acc);

    assert.ok(res, `Map generation must succeed for ${rec.id}`);
    assert.strictEqual(res, outPath, `Returned path must match target file`);
    assert.ok(fs.existsSync(outPath), `Map file must exist on disk`);

    const stat = fs.statSync(outPath);
    assert.ok(stat.size > 20000, `Map file must be high resolution (was ${stat.size} bytes)`);

    generatedMapPaths.push(outPath);
    mapFileSizes.push(stat.size);
    console.log(`     ✓ Created: ${stat.size} bytes`);
  }

  // Verify that maps are distinct
  console.log('\n[Test 2] Verifying that different coordinates produce unique, non-identical maps...');
  const buf0 = fs.readFileSync(generatedMapPaths[0]);
  const buf1 = fs.readFileSync(generatedMapPaths[1]);
  const buf3 = fs.readFileSync(generatedMapPaths[3]);

  assert.ok(!buf0.equals(buf1), 'Egmore map must not equal Surapet map');
  assert.ok(!buf0.equals(buf3), 'Egmore map must not equal Bangalore map');
  console.log('  ✓ Verified: Each employee record has a unique geographic map');

  // Test 3: Null / Invalid Coordinates Fallback Test (Requirement 10)
  console.log('\n[Test 3] Verifying graceful null handling on missing/invalid coordinates (Requirement 10)...');
  const nullRes1 = await generateGoogleAuditMap(null, null, path.join(testDir, 'null1.png'));
  assert.strictEqual(nullRes1, null, 'Null coordinates must return null');

  const nullRes2 = await generateGoogleAuditMap(NaN, 'invalid', path.join(testDir, 'null2.png'));
  assert.strictEqual(nullRes2, null, 'Invalid coordinates must return null');
  console.log('  ✓ Verified: generateGoogleAuditMap safely returns null without throwing or using fake fallbacks');

  // Test 4: PDF Report Generation with Actual Captured Coordinates
  console.log('\n[Test 4] Generating real BGV PDF report for candidate 12705...');
  const pdfRes = await generateVerificationReportPDF({ employee_id: '12705' });
  assert.ok(pdfRes && pdfRes.filePath, 'PDF report must be generated');
  assert.ok(fs.existsSync(pdfRes.filePath), 'PDF file must exist');
  assert.strictEqual(pdfRes.totalPages, 3, 'Report must be exactly 3 pages');
  console.log(`  ✓ Verified: PDF Report generated (${pdfRes.fileName}, ${(pdfRes.fileSize / 1024).toFixed(1)} KB)`);

  // Cleanup temp test files
  try {
    for (const f of fs.readdirSync(testDir)) fs.unlinkSync(path.join(testDir, f));
    fs.rmdirSync(testDir);
  } catch (e) {}

  console.log('\n========================================================================');
  console.log(' ALL GPS GEOLOCATION AUDIT MAP TESTS PASSED 100%!');
  console.log('========================================================================');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
