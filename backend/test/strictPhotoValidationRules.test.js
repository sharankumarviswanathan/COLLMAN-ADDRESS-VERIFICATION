const assert = require('assert');
const { validateImage } = require('../utils/imageValidator');

async function runTests() {
  console.log('================================================================');
  console.log(' RUNNING STRICT PHOTO EVIDENCE VALIDATION TEST SUITE            ');
  console.log('================================================================');

  // 1. Blurry image test
  const blurry = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: { blurScore: 12, brightness: 120, contrast: 45 }
  });
  assert.strictEqual(blurry.valid, false, 'Blurry image must fail');
  assert.ok(blurry.error.includes('Image is not clear'), 'Must indicate image is not clear');
  console.log('✓ Test 1 Passed: Blurry image strictly rejected');

  // 2. Dark lighting test
  const dark = await validateImage({
    photoType: 'selfie',
    clientMetrics: { blurScore: 70, brightness: 22, contrast: 40 }
  });
  assert.strictEqual(dark.valid, false, 'Dark image must fail');
  assert.ok(dark.error.includes('too dark'), 'Must indicate lighting too dark');
  console.log('✓ Test 2 Passed: Dark image strictly rejected');

  // 3. Overexposed lighting test
  const overexposed = await validateImage({
    photoType: 'building',
    clientMetrics: { blurScore: 75, brightness: 245, contrast: 40 }
  });
  assert.strictEqual(overexposed.valid, false, 'Overexposed image must fail');
  assert.ok(overexposed.error.includes('overexposed'), 'Must indicate overexposed image');
  console.log('✓ Test 3 Passed: Overexposed image strictly rejected');

  // 4. Low contrast test
  const lowContrast = await validateImage({
    photoType: 'street',
    clientMetrics: { blurScore: 70, brightness: 120, contrast: 10 }
  });
  assert.strictEqual(lowContrast.valid, false, 'Low contrast image must fail');
  assert.ok(lowContrast.error.includes('contrast is too low'), 'Must indicate contrast error');
  console.log('✓ Test 4 Passed: Low contrast image strictly rejected');

  // 5. Door Selfie: Both face and door number missing
  const bothMissing = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 80,
      brightness: 130,
      contrast: 50,
      faceDetected: false,
      hasTextFeatures: false
    }
  });
  assert.strictEqual(bothMissing.valid, false, 'Both face and door number missing must fail');
  assert.ok(bothMissing.error.includes('BOTH your face and readable door/house number'), 'Must require both face and door number');
  console.log('✓ Test 5 Passed: Door Selfie with both face and door number missing rejected');

  // 6. Door Selfie: Hair-only captured (user scenario from screenshot)
  const hairOnlyDoor = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 80,
      brightness: 130,
      contrast: 50,
      faceDetected: false,
      faceReason: 'hair_only',
      ocrText: 'Door No. 12'
    }
  });
  assert.strictEqual(hairOnlyDoor.valid, false, 'Hair-only in door selfie must fail');
  assert.ok(hairOnlyDoor.error.includes('Partial face or hair-only is not accepted'), 'Must reject hair-only');
  console.log('✓ Test 6 Passed: Door Selfie with hair-only strictly rejected');

  // 7. Door Selfie: Partial face captured
  const partialFaceDoor = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 80,
      brightness: 130,
      contrast: 50,
      faceDetected: false,
      faceReason: 'partial_face',
      ocrText: 'Door No. 12'
    }
  });
  assert.strictEqual(partialFaceDoor.valid, false, 'Partial face in door selfie must fail');
  assert.ok(partialFaceDoor.error.includes('Partial face or hair-only is not accepted'), 'Must reject partial face');
  console.log('✓ Test 7 Passed: Door Selfie with partial face strictly rejected');

  // 8. Door Selfie: Face present but door number missing/unreadable
  const noDoorNum = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 80,
      brightness: 130,
      contrast: 50,
      faceDetected: true,
      ocrText: ''
    }
  });
  assert.strictEqual(noDoorNum.valid, false, 'Door selfie missing door number must fail');
  assert.ok(noDoorNum.error.includes('Door/house number could not be read'), 'Must report missing door number');
  console.log('✓ Test 8 Passed: Door Selfie with missing door number strictly rejected');

  // 9. Door Selfie: BOTH Face and Door Number present -> PASS
  const validDoor = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 80,
      brightness: 130,
      contrast: 50,
      faceDetected: true,
      ocrText: 'Flat No. 102, 3rd Floor'
    }
  });
  assert.strictEqual(validDoor.valid, true, 'Valid door selfie must pass');
  console.log('✓ Test 9 Passed: Door Selfie with both face and door number validly accepted');

  // 10. Live Selfie: Hair-only rejected
  const hairOnlySelfie = await validateImage({
    photoType: 'selfie',
    clientMetrics: {
      blurScore: 85,
      brightness: 135,
      contrast: 55,
      faceDetected: false,
      faceReason: 'hair_only'
    }
  });
  assert.strictEqual(hairOnlySelfie.valid, false, 'Hair-only live selfie must fail');
  assert.ok(hairOnlySelfie.error.includes('Partial face or hair-only is not accepted'), 'Must report hair-only error');
  console.log('✓ Test 10 Passed: Live Selfie with hair-only strictly rejected');

  // 11. Street Board: Selfie in frame strictly rejected
  const streetSelfie = await validateImage({
    photoType: 'street',
    clientMetrics: {
      blurScore: 88,
      brightness: 135,
      contrast: 55,
      faceDetected: true,
      faceConfidence: 0.95
    }
  });
  assert.strictEqual(streetSelfie.valid, false, 'Selfie in street board photo must fail');
  assert.strictEqual(streetSelfie.error, 'Street board not detected or street name is not readable. Please retake the photo.');
  console.log('✓ Test 11 Passed: Street Photo with selfie strictly rejected');

  // 11b. Street Board: Person-only photo strictly rejected
  const streetPerson = await validateImage({
    photoType: 'street',
    clientMetrics: {
      blurScore: 85,
      brightness: 130,
      contrast: 50,
      skinRatio: 0.25
    }
  });
  assert.strictEqual(streetPerson.valid, false, 'Person in street board photo must fail');
  assert.strictEqual(streetPerson.error, 'Street board not detected or street name is not readable. Please retake the photo.');
  console.log('✓ Test 11b Passed: Street Photo with person-only strictly rejected');

  // 11c. Street Board: Blank wall / random object (clarity alone must NOT pass)
  const streetBlankWall = await validateImage({
    photoType: 'street',
    clientMetrics: {
      blurScore: 95,
      brightness: 140,
      contrast: 65,
      ocrText: ''
    }
  });
  assert.strictEqual(streetBlankWall.valid, false, 'Blank wall / random object in street photo must fail');
  assert.strictEqual(streetBlankWall.error, 'Street board not detected or street name is not readable. Please retake the photo.');
  console.log('✓ Test 11c Passed: Street Photo with blank wall / random object strictly rejected');

  // 11d. Street Board: Real street name text recognized via OCR -> PASS
  const streetValid = await validateImage({
    photoType: 'street',
    clientMetrics: {
      blurScore: 85,
      brightness: 130,
      contrast: 55,
      faceDetected: false,
      ocrText: 'ANNA NAGAR 1ST CROSS STREET CHENNAI'
    }
  });
  assert.strictEqual(streetValid.valid, true, 'Valid street board text must pass');
  console.log('✓ Test 11d Passed: Real Street Board with readable street text accepted');

  // 12. Building Photo: Close-up selfie taken instead of building
  const selfieAsBuilding = await validateImage({
    photoType: 'building',
    clientMetrics: {
      blurScore: 80,
      brightness: 130,
      contrast: 50,
      faceDetected: true,
      faceConfidence: 0.95,
      skinRatio: 0.50
    }
  });
  assert.strictEqual(selfieAsBuilding.valid, false, 'Selfie taken as building must fail');
  assert.ok(selfieAsBuilding.error.includes('Photo appears to be a selfie'), 'Must report selfie as building error');
  console.log('✓ Test 12 Passed: Selfie instead of building strictly rejected');

  // 13. Document / Screen photo uploaded as Landmark (User screenshot scenario)
  const docAsLandmark = await validateImage({
    photoType: 'landmark',
    clientMetrics: {
      blurScore: 90,
      brightness: 180,
      contrast: 60,
      faceDetected: false,
      ocrText: 'Unique Identification Authority of India Address in document download print pdf applicant declaration'
    }
  });
  assert.strictEqual(docAsLandmark.valid, false, 'Document uploaded as landmark must fail');
  assert.ok(docAsLandmark.error.includes('Document or computer screen detected'), 'Must reject document as landmark');
  console.log('✓ Test 13 Passed: Document/screen photo uploaded as Nearby Landmark strictly rejected');

  // 14. Document / Screen photo uploaded as Street Board
  const docAsStreet = await validateImage({
    photoType: 'street',
    clientMetrics: {
      blurScore: 90,
      brightness: 180,
      contrast: 60,
      faceDetected: false,
      ocrText: 'Intelligent Text Extraction View Back side address in document verification required candidate'
    }
  });
  assert.strictEqual(docAsStreet.valid, false, 'Document uploaded as street board must fail');
  assert.ok(docAsStreet.error.includes('Document or computer screen detected'), 'Must reject document as street board');
  console.log('✓ Test 14 Passed: Document/screen photo uploaded as Street Board strictly rejected');

  // 15. Document / Screen photo uploaded as Full Building
  const docAsBuilding = await validateImage({
    photoType: 'building',
    clientMetrics: {
      blurScore: 90,
      brightness: 180,
      contrast: 60,
      faceDetected: false,
      isDocumentOrScreen: true,
      ocrText: 'Aadhaar Government of India UIDAI helpdesk enrollment'
    }
  });
  assert.strictEqual(docAsBuilding.valid, false, 'Document uploaded as building must fail');
  assert.ok(docAsBuilding.error.includes('Document or computer screen detected'), 'Must reject document as building');
  console.log('✓ Test 15 Passed: Document/screen photo uploaded as Full Building strictly rejected');

  // 16. Door Selfie: Face only with NO door digits (Sitting on chair scenario from screenshot)
  const chairSelfieDoor = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 85,
      brightness: 130,
      contrast: 50,
      faceDetected: true,
      ocrText: 'Just some random room words without any numbers'
    }
  });
  assert.strictEqual(chairSelfieDoor.valid, false, 'Face only with no door number must fail');
  assert.ok(chairSelfieDoor.error.includes('Door/house number could not be read'), 'Must report missing door number');
  console.log('✓ Test 16 Passed: Door Selfie with face only and no door number digits strictly rejected');

  // 17. Door Selfie: Face AND readable door number digits -> PASS
  const validDoorWithDigits = await validateImage({
    photoType: 'door_selfie',
    clientMetrics: {
      blurScore: 85,
      brightness: 130,
      contrast: 50,
      faceDetected: true,
      ocrText: 'Door No. 14/B Gandhi Street'
    }
  });
  assert.strictEqual(validDoorWithDigits.valid, true, 'Door selfie with face and door digits must pass');
  console.log('✓ Test 17 Passed: Door Selfie with face and door digits accepted');

  console.log('\n================================================================');
  console.log(' ALL STRICT PHOTO VALIDATION TESTS PASSED SUCCESSFULLY!          ');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
