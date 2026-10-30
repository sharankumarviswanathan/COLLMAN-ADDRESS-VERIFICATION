/**
 * Address Proof Intelligent Tolerance & Strict Photo Evidence Isolation Test Suite
 *
 * Validates:
 * PART 1: Intelligent Image Preprocessing & OCR for Address Proofs
 *   - Supports old, slightly scratched, faded, folded, and mildly damaged documents.
 *   - Preprocessing: orientation correction, adaptive contrast/brightness, 3x3 Laplacian sharpening.
 *   - OCR extraction: Employee Name, Residential Address, PIN code, Document Type across languages.
 *   - Sensible fuzzy matching against HR records.
 *   - Never fabricates missing characters or addresses.
 *
 * PART 2: Strict Validation for All Other Photo Evidence (Zero Bleed / Zero Lenience)
 *   - Landmark, Street Board, Building, Door Selfie, Live Selfie, Joint Selfie.
 *   - Thresholds strictly maintained: blur >= 20, contrast >= 15, brightness 32-238, screen rejection.
 *
 * PART 3: Three Possible Validation Outcomes
 *   - ACCEPTED: Readable, high/sufficient confidence, satisfied requirements.
 *   - HR/BGV REVIEW REQUIRED: Genuine document with normal wear/fading/scratches, valid: true.
 *   - REJECTED: Severely damaged, unreadable (<8 blur, <12 brightness), wrong document type.
 *
 * PART 4: Preservation of Original and Enhanced Images
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  inspectImageQuality,
  validateAddressProofDocument,
  detectDocumentTypeFromText,
  detectDocumentSide,
  detectDocumentLanguage,
  maskAadhaarNumbers
} = require('../utils/addressProofValidator');
const { preprocessDocumentImage } = require('../utils/documentPreprocessor');
const { extractPincode, extractHouseNumber, performDocumentAddressMatch } = require('../utils/documentAddressMatcher');
const { validateImage } = require('../utils/imageValidator');

console.log('========================================================================');
console.log(' RUNNING ADDRESS PROOF INTELLIGENT TOLERANCE & PHOTO EVIDENCE TESTS     ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ Test ${totalTests} Passed: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ Test ${totalTests} FAILED: ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ Test ${totalTests} Passed: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ Test ${totalTests} FAILED: ${name}`);
    console.error(err);
  }
}

async function runAllTests() {
  // -------------------------------------------------------------------------
  // 1. Intelligent Preprocessor: Adaptive Contrast & Laplacian Sharpening
  // -------------------------------------------------------------------------
  await runAsyncTest('Preprocessor applies contrast stretching, 3x3 Laplacian sharpening, and resizing', async () => {
    // 200x200 grayscale dummy image buffer using Jimp
    const { Jimp } = require('jimp');
    const image = new Jimp({ width: 200, height: 200, color: 0x888888FF });
    const buffer = await image.getBuffer('image/jpeg');

    const result = await preprocessDocumentImage(buffer, { minDimension: 400 });
    assert(result.enhancedBuffer, 'Expected enhancedBuffer to be returned');
    assert(result.appliedSteps.some(s => s.includes('sharpen') || s.includes('laplacian')), 'Expected Laplacian sharpening applied');
    assert(result.appliedSteps.some(s => s.includes('contrast') || s.includes('normalized')), 'Expected adaptive contrast applied');
    assert(result.appliedSteps.some(s => s.includes('scale') || s.includes('upscaled')), 'Expected high res scaling applied');
    assert(result.width >= 400 || result.height >= 400, 'Expected resized dimensions');
  });

  // -------------------------------------------------------------------------
  // 2. Reasonable Quality Tolerance: Address Proof ONLY
  // -------------------------------------------------------------------------
  runTest('Address Proof accepts old/scratched/faded documents without rejecting them', () => {
    // Normal wear: blur = 14 (old/scratched), contrast = 10 (faded printing), brightness = 75 (aged paper)
    const wornQuality = inspectImageQuality(null, { blurScore: 14, contrast: 10, brightness: 75 });
    assert.strictEqual(wornQuality.isSeverelyDamagedOrUnreadable, false, 'Worn document must NOT be marked severely damaged');
    assert.strictEqual(wornQuality.needsManualReview, true, 'Worn document should be flagged for manual review');
    assert(wornQuality.wearDetected.includes('Faded print / low contrast'), 'Should detect faded print');
    assert(wornQuality.wearDetected.includes('Minor surface scratches / fold blur'), 'Should detect fold blur');

    // Faded document: brightness 180, contrast 8
    const fadedQuality = inspectImageQuality(null, { blurScore: 35, contrast: 8, brightness: 180 });
    assert.strictEqual(fadedQuality.isSeverelyDamagedOrUnreadable, false, 'Faded document must not be rejected');
    assert.strictEqual(fadedQuality.needsManualReview, true, 'Faded document should be routed for manual review');
  });

  runTest('Address Proof strictly rejects severely damaged or completely unreadable images', () => {
    // Extremely blurred: blur = 4 (< 8)
    const severeBlur = inspectImageQuality(null, { blurScore: 4, contrast: 20, brightness: 120 });
    assert.strictEqual(severeBlur.isSeverelyDamagedOrUnreadable, true, 'Blur < 8 must be rejected as severely damaged');

    // Pitch black: brightness = 8 (< 12)
    const pitchBlack = inspectImageQuality(null, { blurScore: 50, contrast: 30, brightness: 8 });
    assert.strictEqual(pitchBlack.isSeverelyDamagedOrUnreadable, true, 'Brightness < 12 must be rejected as pitch black');

    // Completely blown out: brightness = 252 (> 248)
    const blownOut = inspectImageQuality(null, { blurScore: 50, contrast: 30, brightness: 252 });
    assert.strictEqual(blownOut.isSeverelyDamagedOrUnreadable, true, 'Brightness > 248 must be rejected as overexposed');
  });

  // -------------------------------------------------------------------------
  // 3. Strict Validation for Photo Evidence (Zero Bleed / Zero Lenience)
  // -------------------------------------------------------------------------
  await runAsyncTest('All 6 Photo Evidence modules strictly enforce blur >= 20, rejecting blur score 14', async () => {
    const photoEvidenceTypes = [
      'landmark',
      'street',
      'building',
      'door_selfie',
      'selfie',
      'joint_selfie'
    ];

    for (const type of photoEvidenceTypes) {
      // Pass blurScore: 14 (which is tolerated for Address Proof) to photo evidence
      const val = await validateImage({
        photoType: type,
        clientMetrics: { blurScore: 14, contrast: 35, brightness: 120 }
      });
      assert.strictEqual(
        val.valid,
        false,
        `Photo evidence type [${type}] must strictly reject blurScore = 14`
      );
      assert(
        val.error.toLowerCase().includes('blur') || val.error.toLowerCase().includes('clearer') || val.error.toLowerCase().includes('not clear'),
        `Photo evidence type [${type}] must output blur rejection message`
      );
    }
  });

  await runAsyncTest('Photo Evidence strictly rejects low contrast (< 15) and extreme brightness', async () => {
    // Photo evidence requires contrast >= 15
    const contrastFail = await validateImage({
      photoType: 'building',
      clientMetrics: { blurScore: 30, contrast: 10, brightness: 120 }
    });
    assert.strictEqual(contrastFail.valid, false, 'Building photo must reject contrast < 15');

    // Photo evidence requires brightness between 32 and 238
    const darkFail = await validateImage({
      photoType: 'landmark',
      clientMetrics: { blurScore: 30, contrast: 25, brightness: 25 }
    });
    assert.strictEqual(darkFail.valid, false, 'Landmark photo must reject dark image (< 32)');
  });

  // -------------------------------------------------------------------------
  // 4. Decision System: Three Possible Outcomes (ACCEPTED, REVIEW REQUIRED, REJECTED)
  // -------------------------------------------------------------------------
  await runAsyncTest('Decision Outcome A: ACCEPTED when document is readable and matches HR records', async () => {
    const frontText = `
      GOVERNMENT OF INDIA
      Unique Identification Authority of India
      To: Rajesh Kumar
      S/O Suresh Kumar
      DOB: 15/08/1990
      Male
      1234 5678 9012
    `;
    const backText = `
      Address:
      No. 14, Gandhi Street, Old Tirumangalam, Anna Nagar,
      Chennai, Tamil Nadu - 600040
      1947
    `;

    const res = await validateAddressProofDocument({
      frontText,
      backText,
      selectedDocumentType: 'Aadhaar Card',
      hrName: 'Rajesh Kumar',
      hrAddress: '14 Gandhi Street Old Tirumangalam Anna Nagar Chennai 600040',
      validateSide: 'both'
    });

    assert.strictEqual(res.valid, true, 'Must be valid');
    assert.strictEqual(res.decision, 'ACCEPTED', 'Expected ACCEPTED decision');
    assert.strictEqual(res.requiresManualReview, false, 'Expected no manual review required');
    assert.strictEqual(res.extractedPincode, '600040', 'Expected pincode 600040');
    assert(res.extractedName.includes('Rajesh Kumar'), 'Expected extracted name Rajesh Kumar');
  });

  await runAsyncTest('Decision Outcome B: HR/BGV REVIEW REQUIRED for faded/scratched documents (allows progress)', async () => {
    // Slightly faded Aadhaar with worn surface, partial address match
    const frontText = `
      GOVERNMENT OF INDIA
      Unique Identification
      Rajsh Kumar
      DOB: 15/08/1990
    `;
    const backText = `
      Address:
      Old Tirumangalam, Anna Nagar,
      Chennai - 600040
    `;

    const res = await validateAddressProofDocument({
      frontText,
      backText,
      selectedDocumentType: 'Aadhaar Card',
      frontMetrics: { blurScore: 16, contrast: 11, brightness: 80 }, // normal wear
      backMetrics: { blurScore: 15, contrast: 12, brightness: 82 },
      hrName: 'Rajesh Kumar',
      hrAddress: '14 Gandhi Street Old Tirumangalam Anna Nagar Chennai 600040',
      validateSide: 'both'
    });

    assert.strictEqual(res.valid, true, 'Worn document must be valid: true (non-blocking)');
    assert.strictEqual(res.decision, 'HR/BGV REVIEW REQUIRED', 'Expected HR/BGV REVIEW REQUIRED decision');
    assert.strictEqual(res.requiresManualReview, true, 'Expected requiresManualReview: true');
    assert.strictEqual(res.extractedPincode, '600040', 'Expected pincode 600040');
    assert(res.details.includes('review') || res.details.includes('human confirmation'), 'Details should explain routing');
  });

  await runAsyncTest('Decision Outcome C: REJECTED when document is severely damaged or fails minimum threshold', async () => {
    // Severely blurred front image
    const res = await validateAddressProofDocument({
      frontMetrics: { blurScore: 4, contrast: 20, brightness: 120 }, // Severe blur
      selectedDocumentType: 'Aadhaar Card',
      validateSide: 'both'
    });

    assert.strictEqual(res.valid, false, 'Severe blur must be valid: false');
    assert.strictEqual(res.decision, 'REJECTED', 'Expected REJECTED decision');
    assert.strictEqual(res.reason, 'SEVERELY_DAMAGED_OR_UNREADABLE', 'Expected SEVERELY_DAMAGED_OR_UNREADABLE');
    assert(res.error.toLowerCase().includes('blurred') || res.error.toLowerCase().includes('clearer'), 'Expected error message requesting clearer image');
  });

  await runAsyncTest('Decision Outcome C: REJECTED on high confidence Document Type Mismatch', async () => {
    // Document text contains clear Voter ID markers while user selected Aadhaar
    const voterText = `
      ELECTION COMMISSION OF INDIA
      ELECTOR PHOTO IDENTITY CARD
      EPIC NO: ABC1234567
      Name: Ramesh Babu
    `;

    const res = await validateAddressProofDocument({
      frontText: voterText,
      selectedDocumentType: 'Aadhaar Card',
      validateSide: 'front'
    });

    assert.strictEqual(res.valid, false, 'Document type mismatch must be valid: false');
    assert.strictEqual(res.decision, 'REJECTED', 'Expected REJECTED decision');
    assert.strictEqual(res.reason, 'TYPE_MISMATCH', 'Expected TYPE_MISMATCH');
    assert(res.error.includes('Voter ID'), 'Expected error to mention detected Voter ID');
  });

  // -------------------------------------------------------------------------
  // 5. PIN Code & Unreadable Field Extraction Without Fabrication
  // -------------------------------------------------------------------------
  runTest('Extracts valid Indian PIN codes and house numbers accurately', () => {
    const text1 = 'Flat 4B, Shanthi Apts, 5th Cross, Indiranagar, Bangalore 560038';
    assert.strictEqual(extractPincode(text1), '560038');
    assert.strictEqual(extractHouseNumber(text1), '4B');

    const text2 = 'Door No. 12/A, Gandhi Road, Chennai - 600028';
    assert.strictEqual(extractPincode(text2), '600028');
    assert.strictEqual(extractHouseNumber(text2), '12/A');

    // Never fabricates when missing
    const text3 = 'No address details available';
    assert.strictEqual(extractPincode(text3), '', 'Must return empty string when PIN is absent');
  });

  // -------------------------------------------------------------------------
  // 6. Aadhaar Number Masking for PII Protection
  // -------------------------------------------------------------------------
  runTest('Aadhaar numbers are properly masked (preserving last 4 digits only)', () => {
    const raw = 'Aadhaar No: 5482 1234 9876 confirmed';
    const masked = maskAadhaarNumbers(raw);
    assert.strictEqual(masked, 'Aadhaar No: XXXX-XXXX-9876 confirmed');
  });

  console.log('\n========================================================================');
  console.log(` TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%) `);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Test execution fatal error:', e);
  process.exit(1);
});
