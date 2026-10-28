const {
  detectDocumentLanguage,
  normalizeIndicNumerals,
  transliterateIndicToLatin
} = require('../server/utils/indianLanguageOcr');
const {
  detectDocumentTypeFromText,
  detectDocumentSide,
  validateAddressProofDocument,
  DOCUMENT_TYPES
} = require('../server/utils/addressProofValidator');
const {
  extractAddressFromText,
  extractNameFromText,
  compareNameComponents,
  compareAddressComponents
} = require('../server/utils/documentAddressMatcher');

console.log('====================================================');
console.log('TEST 1: LANGUAGE DETECTION & MIXED-LANGUAGE SUPPORT');
console.log('====================================================');

const samples = {
  English: 'GOVERNMENT OF INDIA UNIQUE IDENTIFICATION AUTHORITY OF INDIA ENROLLMENT NO 1234 5678 9012',
  'English & Hindi (Bilingual)': 'भारत सरकार GOVERNMENT OF INDIA \nभारतीय विशिष्ट पहचान प्राधिकरण UIDAI\nनाम / Name: सुरेश कुमार Suresh Kumar\nपता / Address: 13/ए वेलमुरुगन नगर चेन्नई 600099',
  'English & Tamil (Bilingual)': 'இந்திய அரசு GOVERNMENT OF INDIA\nஆதார் AADHAAR\nபெயர் / Name: சரண்குமார் வி SHARANKUMAR V\nமுகவரி / Address: 13/A வேல்முருகன் நகர் சென்னை 600099',
  'English & Telugu (Bilingual)': 'భారత ప్రభుత్వం GOVERNMENT OF INDIA\nఓటరు గుర్తింపు కార్డు Elector Photo Identity Card\nపేరు / Name: రమేష్ రావు Ramesh Rao\nచిరునామా / Address: 45/B గాంధీ రోడ్ హైదరాబాద్ 500001',
  'English & Kannada (Bilingual)': 'ಭಾರತ ಸರ್ಕಾರ GOVERNMENT OF INDIA\nಚಾಲನಾ ಪರವಾನಗಿ Driving Licence\nಹೆಸರು / Name: ಪ್ರವೀಣ್ ಕುಮಾರ್ Praveen Kumar\nವಿಳಾಸ / Address: 12 ಎಂ ಜಿ ರಸ್ತೆ ಬೆಂಗಳೂರು 560001',
  'English & Malayalam (Bilingual)': 'ഭാരത സർക്കാർ GOVERNMENT OF INDIA\nമേൽവിലാസം / Address: 8/C എം ജി റോഡ് കൊച്ചി 682001'
};

for (const [expected, text] of Object.entries(samples)) {
  const det = detectDocumentLanguage(text);
  console.log(`[${expected}] => Detected: ${det.languageSummary} (Primary: ${det.primaryLanguage}, Mixed: ${det.isMixedLanguage}, Langs: ${det.languages.join(', ')})`);
}

console.log('\n====================================================');
console.log('TEST 2: MULTILINGUAL ADDRESS EXTRACTION & NORMALIZATION');
console.log('====================================================');

const addrTests = [
  {
    lang: 'Hindi',
    raw: 'पता: 13/ए, वेलमुरुगन नगर, 3री गली, विनायगापुरम सुरपेट मेन रोड, चेन्नई, तमिलनाडु - ६०००९९ भारत',
    target: '13/A Velmurugan Nagar 3rd Street Vinayagapuram Surapet Main Road Tamil Nadu, Chennai 600099 India'
  },
  {
    lang: 'Tamil',
    raw: 'முகவரி: 13/A, வேல்முருகன் நகர், 3வது தெரு, விநாயகபுரம் சூரப்பேடு மெயின் ரோடு, சென்னை, தமிழ்நாடு - 600099',
    target: '13/A Velmurugan Nagar 3rd Street Vinayagapuram Surapet Main Road Tamil Nadu, Chennai 600099 India'
  },
  {
    lang: 'Telugu',
    raw: 'చిరునామా: 13/A, వెల్మురుగన్ నగర్, చెన్నై, తమిళనాడు - ౬౦౦౦౯౯',
    target: '13/A Velmurugan Nagar, Chennai, Tamil Nadu 600099'
  },
  {
    lang: 'Kannada',
    raw: 'ವಿಳಾಸ: 13/A, ವೆಲ್ಮುರುಗನ್ ನಗರ, ಚೆನ್ನೈ, ತಮಿಳುನಾಡು - ೬೦೦೦೯೯',
    target: '13/A Velmurugan Nagar, Chennai, Tamil Nadu 600099'
  },
  {
    lang: 'Malayalam',
    raw: 'മേൽവിലാസം: 13/A, വെൽമുരുകൻ നഗർ, ചെന്നൈ, തമിഴ്നാട് - ൬൦൦൦൯൯',
    target: '13/A Velmurugan Nagar, Chennai, Tamil Nadu 600099'
  }
];

for (const t of addrTests) {
  const extracted = extractAddressFromText(t.raw);
  const comp = compareAddressComponents(t.target, t.raw, extracted);
  console.log(`\n--- Address Match (${t.lang}) ---`);
  console.log('Extracted:', extracted);
  console.log('Match Result:', comp.match, 'Score:', comp.score);
  console.log('Components:', JSON.stringify(comp.components));
}

console.log('\n====================================================');
console.log('TEST 3: MULTILINGUAL NAME EXTRACTION & COMPARISON');
console.log('====================================================');

const nameTests = [
  { lang: 'Hindi', raw: 'नाम: सुरेश कुमार\nजन्म तिथि: 12/05/1990', target: 'Suresh Kumar' },
  { lang: 'Tamil', raw: 'பெயர்: சரண்குமார் வி\nபிறந்த தேதி: 15/08/1995', target: 'SHARANKUMAR V' },
  { lang: 'Telugu', raw: 'పేరు: రమేష్ రావు\nపుట్టిన తేదీ: 20/01/1988', target: 'Ramesh Rao' },
  { lang: 'Kannada', raw: 'ಹೆಸರು: ಪ್ರವೀಣ್ ಕುಮಾರ್\nಹುಟ್ಟಿದ ದಿನಾಂಕ: 05/03/1992', target: 'Praveen Kumar' },
  { lang: 'Malayalam', raw: 'പേര്: സുരേഷ് കുമാർ\nജനന തീയതി: 10/10/1985', target: 'Suresh Kumar' }
];

for (const t of nameTests) {
  const extracted = extractNameFromText(t.raw);
  const comp = compareNameComponents(t.target, extracted, t.raw);
  console.log(`\n--- Name Match (${t.lang}) ---`);
  console.log('Extracted Name:', extracted);
  console.log('Target HR Name:', t.target);
  console.log('Match Result:', comp.match, 'Score:', comp.score, 'Details:', comp.details);
}

console.log('\n====================================================');
console.log('TEST 4: FAILED / UNCLEAR OCR ROUTING TO HR/BGV REVIEW');
console.log('====================================================');

const unclearText = '...'; // Very short / unreadable noise
const { performDocumentAddressMatch } = require('../server/utils/documentAddressMatcher');

(async () => {
  const validationRes = await validateAddressProofDocument({
    selectedDocumentType: DOCUMENT_TYPES.AADHAAR,
    frontText: 'xyz', // unclear
    backText: 'abc'   // unclear
  });
  console.log('Unclear Validation Status:', validationRes.statusMessage);
  console.log('Unclear Validation Requires Review:', validationRes.requiresManualReview);
  console.log('Unclear Validation Overall Result:', validationRes.overallResult);

  const matchRes = await performDocumentAddressMatch(
    { employee_name: 'Sharan Kumar', hr_current_address: '13/A Velmurugan Nagar' },
    { document_path: null } // No doc or unreadable
  );
  console.log('Missing Document Match Result:', matchRes.overallResult);
  console.log('Missing Document Status Message:', matchRes.statusMessage);

  console.log('\nALL MULTILINGUAL OCR TESTS FINISHED.');
})();
