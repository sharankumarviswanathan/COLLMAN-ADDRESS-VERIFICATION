/**
 * Multi-Language OCR Verification & Address Proof Match Scoring Test Suite
 * GSD Phase 2 — Plan 2.2
 *
 * Verifies:
 * 1. Multi-language traineddata availability (eng, hin, tam, tel, kan, mal)
 * 2. Shared multi-language Tesseract worker initialization & safe reset
 * 3. Language & bilingual document detection across all 5 Indian languages
 * 4. Indic numeral normalization (Devanagari, Tamil, Telugu, Kannada, Malayalam)
 * 5. Document type & side detection across English and regional Indic scripts
 * 6. Multilingual address extraction & pincode normalization
 * 7. Multilingual cross-script name matching with phonetic transliteration
 * 8. Address proof fuzzy component comparison (house, street, area, city, state, pin)
 * 9. Fail-closed manual review safety (unclear OCR, missing doc, low confidence)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  SUPPORTED_OCR_LANGUAGES,
  getIndianLanguageWorker,
  resetIndianLanguageWorker,
  normalizeIndicNumerals,
  detectDocumentLanguage,
  transliterateIndicToLatin
} = require('../utils/indianLanguageOcr');

const {
  DOCUMENT_TYPES,
  DOC_SIGNATURES,
  detectDocumentTypeFromText,
  detectDocumentSide,
  validateAddressProofDocument
} = require('../utils/addressProofValidator');

const {
  extractAddressFromText,
  extractNameFromText,
  compareNameComponents,
  compareAddressComponents,
  performDocumentAddressMatch
} = require('../utils/documentAddressMatcher');

async function runTests() {
  console.log('================================================================');
  console.log(' RUNNING MULTI-LANGUAGE OCR & MATCH SCORING TEST SUITE (PLAN 2.2)');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: Traineddata File Presence in Project Root
  // -------------------------------------------------------------
  const rootDir = path.resolve(__dirname, '../../');
  const expectedLanguages = ['eng', 'hin', 'tam', 'tel', 'kan', 'mal'];
  for (const lang of expectedLanguages) {
    const traineddataPath = path.join(rootDir, `${lang}.traineddata`);
    assert.strictEqual(
      fs.existsSync(traineddataPath),
      true,
      `Traineddata file must exist for language: ${lang} at ${traineddataPath}`
    );
    const stat = fs.statSync(traineddataPath);
    assert.ok(stat.size > 500000, `Traineddata file for ${lang} must be non-empty (size: ${stat.size})`);
  }
  console.log('✓ Test 1 Passed: All 6 traineddata files exist and are verified non-empty');

  // -------------------------------------------------------------
  // Test 2: Shared Multi-Language Worker Initialization & Safe Reset
  // -------------------------------------------------------------
  const worker = await getIndianLanguageWorker();
  assert.ok(worker, 'Multi-language worker must initialize successfully');
  await resetIndianLanguageWorker();
  console.log('✓ Test 2 Passed: Multi-language worker initialized and safely reset');

  // -------------------------------------------------------------
  // Test 3: Language & Mixed-Language Detection
  // -------------------------------------------------------------
  const langSamples = [
    { text: 'GOVERNMENT OF INDIA UNIQUE IDENTIFICATION AUTHORITY OF INDIA', expectedLang: 'English', isMixed: false },
    { text: 'भारत सरकार GOVERNMENT OF INDIA \nभारतीय विशिष्ट पहचान प्राधिकरण UIDAI\nनाम: सुरेश कुमार', expectedLang: 'Hindi', isMixed: true },
    { text: 'இந்திய அரசு GOVERNMENT OF INDIA\nஆதார் AADHAAR\nபெயர்: சரண்குமார் வி', expectedLang: 'Tamil', isMixed: true },
    { text: 'భారత ప్రభుత్వం GOVERNMENT OF INDIA\nఓటరు గుర్తింపు కార్డు Elector Photo Identity Card\nపేరు: రమేష్ రావు', expectedLang: 'Telugu', isMixed: true },
    { text: 'ಭಾರತ ಸರ್ಕಾರ GOVERNMENT OF INDIA\nಚಾಲನಾ ಪರವಾನಗಿ Driving Licence\nಹೆಸರು: ಪ್ರವೀಣ್ ಕುಮಾರ್', expectedLang: 'Kannada', isMixed: true },
    { text: 'ഭാരത സർക്കാർ GOVERNMENT OF INDIA\nമേൽവിലാസം: 8/C എം ജി റോഡ് കൊച്ചി 682001', expectedLang: 'Malayalam', isMixed: true }
  ];

  for (const sample of langSamples) {
    const det = detectDocumentLanguage(sample.text);
    assert.strictEqual(det.primaryLanguage, sample.expectedLang, `Expected primary language ${sample.expectedLang}`);
    assert.strictEqual(det.isMixedLanguage, sample.isMixed, `Expected isMixedLanguage: ${sample.isMixed}`);
  }
  console.log('✓ Test 3 Passed: Document language and bilingual mixed detection verified across all scripts');

  // -------------------------------------------------------------
  // Test 4: Indic Numeral Normalization
  // -------------------------------------------------------------
  const devanagariDigits = '१३/ए - ६०००९९';
  const tamilDigits = '௧௩/A - ௬௦௦௦௯௯';
  const teluguDigits = '౧౩/A - ౬౦౦౦౯౯';
  const kannadaDigits = '೧೩/A - ೬೦೦೦೯೯';
  const malayalamDigits = '൧൩/A - ൬൦൦൦൯൯';

  assert.strictEqual(normalizeIndicNumerals(devanagariDigits), '13/A - 600099');
  assert.strictEqual(normalizeIndicNumerals(tamilDigits), '13/A - 600099');
  assert.strictEqual(normalizeIndicNumerals(teluguDigits), '13/A - 600099');
  assert.strictEqual(normalizeIndicNumerals(kannadaDigits), '13/A - 600099');
  assert.strictEqual(normalizeIndicNumerals(malayalamDigits), '13/A - 600099');
  console.log('✓ Test 4 Passed: Indic numeral & sub-division normalization verified');

  // -------------------------------------------------------------
  // Test 5: Document Type Detection Across Regional Languages
  // -------------------------------------------------------------
  const docTypeTests = [
    { text: 'भारतीय विशिष्ट पहचान प्राधिकरण भारत सरकार आधार UIDAI Enrollment No 1234', expected: DOCUMENT_TYPES.AADHAAR },
    { text: 'இந்திய தனித்துவ அடையாள ஆணையம் ஆதார் அட்டை AADHAAR', expected: DOCUMENT_TYPES.AADHAAR },
    { text: 'భారత విశిష్ట గుర్తింపు ప్రాధికార సంస్థ ఆధార్ AADHAAR', expected: DOCUMENT_TYPES.AADHAAR },
    { text: 'ಭಾರತೀಯ ವಿಶಿಷ್ಟ ಗುರುತಿನ ಪ್ರಾಧಿಕಾರ ಆಧಾರ್ AADHAAR', expected: DOCUMENT_TYPES.AADHAAR },
    { text: 'ഇന്ത്യൻ വിശിഷ്ട തിരിച്ചറിയൽ അതോറിറ്റി ആധാർ AADHAAR', expected: DOCUMENT_TYPES.AADHAAR },
    { text: 'ELECTION COMMISSION OF INDIA भारत निर्वाचन आयोग VOTER ID CARD', expected: DOCUMENT_TYPES.VOTER_ID },
    { text: 'DRIVING LICENCE UNION OF INDIA ചാലനാ പരവാനഗി TRANSPORT DEPT', expected: DOCUMENT_TYPES.DRIVING_LICENCE }
  ];

  for (const doc of docTypeTests) {
    const detected = detectDocumentTypeFromText(doc.text);
    assert.strictEqual(detected.detectedType, doc.expected, `Expected document type ${doc.expected}`);
  }
  console.log('✓ Test 5 Passed: Regional language document type identification verified');

  // -------------------------------------------------------------
  // Test 6: Document Side Detection (Front vs Back)
  // -------------------------------------------------------------
  const frontText = 'GOVERNMENT OF INDIA\nName: Suresh Kumar\nDOB: 12/05/1990\nGender: Male\nVID: 1234 5678 9012 3456';
  const backText = 'Unique Identification Authority of India\nAddress: 13/A, Velmurugan Nagar, Chennai - 600099\nHelpdesk: 1947';
  const regionalBackText = 'இந்திய அரசு\nமுகவரி: 13/A, வேல்முருகன் நகர், 3வது தெரு, சென்னை - 600099';

  assert.strictEqual(detectDocumentSide(frontText, DOCUMENT_TYPES.AADHAAR).side, 'front', 'Front side must be detected from name/DOB/gender');
  assert.strictEqual(detectDocumentSide(backText, DOCUMENT_TYPES.AADHAAR).side, 'back', 'Back side must be detected from address keyword');
  assert.strictEqual(detectDocumentSide(regionalBackText, DOCUMENT_TYPES.AADHAAR).side, 'back', 'Back side must be detected from Tamil address keyword');
  console.log('✓ Test 6 Passed: Document side (Front vs Back) detection verified in English & Tamil');

  // -------------------------------------------------------------
  // Test 7: Multilingual Address Extraction Across 5 Indian Languages
  // -------------------------------------------------------------
  const addressSamples = [
    {
      lang: 'Hindi',
      raw: 'पता: 13/ए, वेलमुरुगन नगर, 3री गली, विनायगापुरम सुरपेट मेन रोड, चेन्नई, तमिलनाडु - ६०००९९ भारत',
      target: '13/A Velmurugan Nagar 3rd Street Vinayagapuram Surapet Main Road Tamil Nadu, Chennai 600099 India',
      minScore: 90
    },
    {
      lang: 'Tamil',
      raw: 'முகவரி: 13/A, வேல்முருகன் நகர், 3வது தெரு, விநாயகபுரம் சூரப்பேடு மெயின் ரோடு, சென்னை, தமிழ்நாடு - 600099',
      target: '13/A Velmurugan Nagar 3rd Street Vinayagapuram Surapet Main Road Tamil Nadu, Chennai 600099 India',
      minScore: 85
    },
    {
      lang: 'Telugu',
      raw: 'చిరునామా: 13/A, వెల్మురుగన్ నగర్, చెన్నై, తమిళనాడు - ౬౦౦౦౯౯',
      target: '13/A Velmurugan Nagar, Chennai, Tamil Nadu 600099',
      minScore: 90
    },
    {
      lang: 'Kannada',
      raw: 'ವಿಳಾಸ: 13/A, ವೆಲ್ಮುರುಗನ್ ನಗರ, ಚೆನ್ನೈ, ತಮಿಳುನಾಡು - ೬೦೦೦೯೯',
      target: '13/A Velmurugan Nagar, Chennai, Tamil Nadu 600099',
      minScore: 90
    },
    {
      lang: 'Malayalam',
      raw: 'മേൽവിലാസം: 13/A, വെൽമുരുകൻ നഗർ, ചെന്നൈ, തമിഴ്നാട് - ൬൦൦൦൯൯',
      target: '13/A Velmurugan Nagar, Chennai, Tamil Nadu 600099',
      minScore: 85
    }
  ];

  for (const sample of addressSamples) {
    const extracted = extractAddressFromText(sample.raw);
    assert.ok(extracted && extracted.length > 5, `Address must be extracted for ${sample.lang}`);
    const comp = compareAddressComponents(sample.target, sample.raw, extracted);
    assert.ok(
      comp.score >= sample.minScore,
      `Match score for ${sample.lang} address should be >= ${sample.minScore}, got ${comp.score}`
    );
    assert.ok(
      comp.match === 'MATCH' || comp.match === 'PARTIAL MATCH',
      `Match result for ${sample.lang} should be MATCH or PARTIAL MATCH, got ${comp.match}`
    );
  }
  console.log('✓ Test 7 Passed: Multilingual address extraction & fuzzy matching verified across all 5 languages');

  // -------------------------------------------------------------
  // Test 8: Cross-Script Name Matching with Transliteration
  // -------------------------------------------------------------
  const nameSamples = [
    { lang: 'Hindi', raw: 'नाम: सुरेश कुमार\nजन्म तिथि: 12/05/1990', target: 'Suresh Kumar', minScore: 95 },
    { lang: 'Tamil', raw: 'பெயர்: சரண்குமார் வி\nபிறந்த தேதி: 15/08/1995', target: 'SHARANKUMAR V', minScore: 90 },
    { lang: 'Telugu', raw: 'పేరు: రమేష్ రావు\nపుట్టిన తేదీ: 20/01/1988', target: 'Ramesh Rao', minScore: 90 },
    { lang: 'Kannada', raw: 'ಹೆಸರು: ಪ್ರವೀಣ್ ಕುಮಾರ್\nಹುಟ್ಟಿದ ದಿನಾಂಕ: 05/03/1992', target: 'Praveen Kumar', minScore: 90 },
    { lang: 'Malayalam', raw: 'പേര്: സുരേഷ് കുമാർ\nജനന തീയതി: 10/10/1985', target: 'Suresh Kumar', minScore: 95 }
  ];

  for (const sample of nameSamples) {
    const extracted = extractNameFromText(sample.raw);
    assert.ok(extracted, `Name must be extracted for ${sample.lang}`);
    const comp = compareNameComponents(sample.target, extracted, sample.raw);
    assert.ok(
      comp.score >= sample.minScore,
      `Cross-script name match score for ${sample.lang} should be >= ${sample.minScore}, got ${comp.score}`
    );
    assert.strictEqual(comp.match, 'MATCH', `Name match result for ${sample.lang} must be MATCH`);
  }
  console.log('✓ Test 8 Passed: Cross-script name extraction & transliteration match verified across all 5 languages');

  // -------------------------------------------------------------
  // Test 9: Component-Level Address Breakdown
  // -------------------------------------------------------------
  const targetAddress = 'Flat 402, Gokul Towers, 5th Main Road, Anna Nagar, Chennai, Tamil Nadu 600040';
  const matchingOcr = 'Door No 402, Gokul Towers, 5th Main Road, Anna Nagar, Chennai 600040';
  const partialOcr = 'Anna Nagar, Chennai 600040';
  const mismatchOcr = 'Plot 12, MG Road, Whitefield, Bengaluru, Karnataka 560066';

  const exactComp = compareAddressComponents(targetAddress, matchingOcr);
  assert.ok(exactComp.score >= 90, `Exact match score should be >= 90, got ${exactComp.score}`);
  assert.strictEqual(exactComp.match, 'MATCH');

  const partComp = compareAddressComponents(targetAddress, partialOcr);
  assert.ok(partComp.score >= 40 && partComp.score < 90, `Partial match score expected 40-89, got ${partComp.score}`);
  assert.strictEqual(partComp.match, 'PARTIAL MATCH');

  const misComp = compareAddressComponents(targetAddress, mismatchOcr);
  assert.ok(misComp.score < 50, `Mismatch score should be < 50, got ${misComp.score}`);
  assert.strictEqual(misComp.match, 'NOT MATCH');
  console.log('✓ Test 9 Passed: Component-level address matching (MATCH, PARTIAL MATCH, NOT MATCH) verified');

  // -------------------------------------------------------------
  // Test 10: Fail-Closed Routing & Zero Manual Bypass
  // -------------------------------------------------------------
  // 10a. Unclear/unreadable document
  const unclearValidation = await validateAddressProofDocument({
    selectedDocumentType: DOCUMENT_TYPES.AADHAAR,
    frontText: 'x',
    backText: 'y'
  });
  assert.strictEqual(unclearValidation.requiresManualReview, true, 'Unclear document must require manual review');
  assert.strictEqual(unclearValidation.overallResult, 'REVIEW REQUIRED', 'Unclear doc result must be REVIEW REQUIRED');

  // 10b. Missing document path in performDocumentAddressMatch
  const missingDocMatch = await performDocumentAddressMatch(
    { employee_name: 'Arun Kumar', hr_current_address: '12 Gandhi Street, Chennai' },
    { document_path: null }
  );
  assert.strictEqual(missingDocMatch.requiresManualReview, true, 'Missing document must require manual review');
  assert.strictEqual(missingDocMatch.overallResult, 'REVIEW REQUIRED', 'Missing doc must yield REVIEW REQUIRED');
  assert.strictEqual(missingDocMatch.statusMessage, 'NO DOCUMENT ATTACHED', 'Status message must be NO DOCUMENT ATTACHED');

  // 10c. Mismatched name & address in performDocumentAddressMatch
  const mismatchDocMatch = await performDocumentAddressMatch(
    { employee_name: 'Priya Sharma', hr_current_address: '100 Mount Road, Chennai - 600002' },
    {
      document_path: 'uploads/fake_doc.jpg',
      extracted_text: 'Name: Rajesh Patel\nAddress: 45 MG Road, Ahmedabad - 380001'
    }
  );
  assert.strictEqual(mismatchDocMatch.requiresManualReview, true, 'Mismatched doc must require manual review');
  assert.strictEqual(mismatchDocMatch.overallResult, 'REVIEW REQUIRED', 'Mismatch must route to REVIEW REQUIRED');

  console.log('✓ Test 10 Passed: Strict fail-closed routing and manual review safety verified');

  console.log('\n================================================================');
  console.log(' ALL MULTI-LANGUAGE OCR & MATCH SCORING TESTS PASSED (10/10)!   ');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
