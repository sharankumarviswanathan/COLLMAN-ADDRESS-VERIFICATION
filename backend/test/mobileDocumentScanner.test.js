const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  preprocessDocumentImage,
  detectDocumentCorners,
  perspectiveWarp,
  detectUprightOrientation,
  applyReadabilityEnhancement,
  getExifOrientation,
  ID1_ASPECT_RATIO,
  TARGET_SCAN_WIDTH,
  TARGET_SCAN_HEIGHT
} = require('../utils/documentPreprocessor');
const { extractDocumentText } = require('../utils/addressProofValidator');

async function runMobileScannerTests() {
  console.log('================================================================');
  console.log('   TESTING MOBILE DOCUMENT SCANNER ENGINE (ID-1 / AADHAAR)      ');
  console.log('================================================================\n');

  const frontPath = path.join(__dirname, '../uploads/17937011886111240794807769408422-1793701263975-83454674.jpg');
  const backPath = path.join(__dirname, '../uploads/17937012111017436658247886731575-1793701264019-57095698.jpg');

  assert(fs.existsSync(frontPath), 'Front test image must exist');
  assert(fs.existsSync(backPath), 'Back test image must exist');

  const frontOriginalBuffer = fs.readFileSync(frontPath);
  const backOriginalBuffer = fs.readFileSync(backPath);

  // --- Test 1: EXIF Orientation Detection ---
  console.log('[Test 1] EXIF Orientation parsing...');
  const fExif = getExifOrientation(frontOriginalBuffer);
  const bExif = getExifOrientation(backOriginalBuffer);
  assert(fExif >= 1 && fExif <= 8, 'Front EXIF orientation should be valid');
  assert(bExif >= 1 && bExif <= 8, 'Back EXIF orientation should be valid');
  console.log(`✓ PASS: Front EXIF = ${fExif}, Back EXIF = ${bExif}`);

  // --- Test 2: Front Document Boundary & 4-Corner Detection ---
  console.log('\n[Test 2] Front Document boundary & 4-corner detection...');
  const fRes = await preprocessDocumentImage(frontOriginalBuffer, { side: 'front', documentType: 'Aadhaar Card' });
  assert.strictEqual(fRes.success, true, 'Front processing should succeed');
  assert.strictEqual(fRes.detectionFailed, false, 'Front boundary detection should succeed');
  assert(Array.isArray(fRes.corners) && fRes.corners.length === 4, 'Should detect 4 corners');
  console.log(`✓ PASS: Front 4 corners detected:`, fRes.corners);

  // --- Test 3: Perspective Transformation & Rectangular Flat ID-1 Card ---
  console.log('\n[Test 3] Perspective transformation & ID-1 proportions...');
  assert.strictEqual(fRes.width, TARGET_SCAN_WIDTH, `Width should be standard scan width ${TARGET_SCAN_WIDTH}`);
  assert.strictEqual(fRes.height, TARGET_SCAN_HEIGHT, `Height should be standard scan height ${TARGET_SCAN_HEIGHT}`);
  const finalAspectRatio = fRes.width / fRes.height;
  assert(Math.abs(finalAspectRatio - ID1_ASPECT_RATIO) < 0.05, `Aspect ratio (${finalAspectRatio.toFixed(3)}) should match ID-1 standard (~1.586)`);
  console.log(`✓ PASS: Target dimensions = ${fRes.width}x${fRes.height}, Aspect ratio = ${finalAspectRatio.toFixed(3)}`);

  // --- Test 4: Upright Orientation Correction ---
  console.log('\n[Test 4] Upright orientation detection & correction...');
  assert(fRes.orientation !== undefined, 'Applied orientation must be recorded');
  assert(fRes.appliedSteps.some(s => s.startsWith('orientation_corrected')), 'Applied steps should record orientation correction');
  console.log(`✓ PASS: Upright orientation detected: ${fRes.orientation}° applied`);

  // --- Test 5: Back Document Processing (Independent Pipeline) ---
  console.log('\n[Test 5] Back Document processing (independent pipeline)...');
  const bRes = await preprocessDocumentImage(backOriginalBuffer, { side: 'back', documentType: 'Aadhaar Card' });
  assert.strictEqual(bRes.success, true, 'Back processing should succeed');
  assert.strictEqual(bRes.detectionFailed, false, 'Back boundary detection should succeed');
  assert.strictEqual(bRes.width, TARGET_SCAN_WIDTH, 'Back width should match standard');
  assert.strictEqual(bRes.height, TARGET_SCAN_HEIGHT, 'Back height should match standard');
  console.log(`✓ PASS: Back processed independently to ${bRes.width}x${bRes.height}`);

  // --- Test 6: Non-Destructive Archival Check ---
  console.log('\n[Test 6] Non-destructive archival check...');
  const frontReRead = fs.readFileSync(frontPath);
  assert.strictEqual(frontOriginalBuffer.equals(frontReRead), true, 'Original front file buffer must be 100% byte-for-byte untouched');
  const backReRead = fs.readFileSync(backPath);
  assert.strictEqual(backOriginalBuffer.equals(backReRead), true, 'Original back file buffer must be 100% byte-for-byte untouched');
  assert.strictEqual(fRes.originalBuffer.equals(frontOriginalBuffer), true, 'Returned originalBuffer must match original input');
  assert.notStrictEqual(fRes.enhancedBuffer.length, 0, 'Enhanced buffer must have nonzero size');
  console.log('✓ PASS: Original evidence files are 100% preserved and untouched');

  // --- Test 7: Multilingual OCR Extraction on Enhanced Image ---
  console.log('\n[Test 7] Multilingual OCR extraction on perspective-corrected image...');
  const ocrRes = await extractDocumentText(fRes.enhancedBuffer);
  assert(ocrRes.text.length > 50, `OCR should extract text from enhanced image (got ${ocrRes.text.length} chars)`);
  assert(/mariyadoss/i.test(ocrRes.text), 'OCR should extract candidate name Mariyadoss');
  assert(/dob|20\/12\/1995|male/i.test(ocrRes.text), 'OCR should extract DOB / Gender details');
  console.log(`✓ PASS: Extracted ${ocrRes.text.length} chars with name and DOB from Front: "${ocrRes.text.slice(0, 120).replace(/\s+/g, ' ')}..."`);

  const ocrBack = await extractDocumentText(bRes.enhancedBuffer);
  assert(ocrBack.text.length > 50, `Back OCR should extract text (got ${ocrBack.text.length} chars)`);
  assert(/address|santhosh|egmore|chennai|tamil/i.test(ocrBack.text), 'Back OCR should extract address components');
  console.log(`✓ PASS: Extracted ${ocrBack.text.length} chars with address from Back: "${ocrBack.text.slice(0, 120).replace(/\s+/g, ' ')}..."`);

  // --- Test 8: Safe Fallback on Blurred / Invalid Input ---
  console.log('\n[Test 8] Safe fallback on invalid image without destructive crop...');
  // 50x50 blank image
  const blankBuf = Buffer.alloc(100);
  const blankRes = await preprocessDocumentImage(blankBuf);
  assert.strictEqual(blankRes.success, false, 'Blank buffer should fail cleanly');
  assert(blankRes.appliedSteps.includes('skipped_not_image'), 'Should record clean skip step');
  console.log('✓ PASS: Safe fallback gracefully handled without crash');

  console.log('\n================================================================');
  console.log('   ALL 8 MOBILE DOCUMENT SCANNER TESTS PASSED SUCCESSFULLY!     ');
  console.log('================================================================');
}

runMobileScannerTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
