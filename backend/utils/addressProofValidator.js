const fs = require('fs');
const path = require('path');
const {
  getIndianLanguageWorker,
  getDualLanguageWorker,
  detectDocumentLanguage,
  normalizeIndicNumerals
} = require('./indianLanguageOcr');
const {
  extractTextFromPdfBuffer,
  compareAddressComponents,
  extractAddressFromText,
  extractNameFromText,
  compareNameComponents,
  extractPincode,
  extractHouseNumber
} = require('./documentAddressMatcher');
const { preprocessDocumentImage } = require('./documentPreprocessor');

/**
 * Supported Document Types
 */
const DOCUMENT_TYPES = {
  AADHAAR: 'Aadhaar Card',
  DRIVING_LICENCE: 'Driving Licence',
  VOTER_ID: 'Voter ID',
  GAS_BILL: 'Gas Bill',
  RENTAL_AGREEMENT: 'Registered Rental Agreement',
  PASSPORT: 'Passport'
};

/**
 * Document Type Identification Signatures
 * Supports English, Hindi, Tamil, Telugu, Kannada, and Malayalam keywords and patterns.
 */
const DOC_SIGNATURES = {
  [DOCUMENT_TYPES.AADHAAR]: {
    keywordsEn: [
      'unique identification authority of india',
      'government of india',
      'aadhaar',
      'aadhar',
      'uidai',
      'enrollment no',
      'help@uidai.gov.in',
      'www.uidai.gov.in',
      'mera aadhaar',
      'vid:',
      'male',
      'female',
      'dob:',
      'year of birth',
      'yob:'
    ],
    keywordsHi: [
      'भारतीय विशिष्ट पहचान प्राधिकरण',
      'भारत सरकार',
      'आधार',
      'मेरा आधार मेरी पहचान',
      'जन्म तिथि',
      'पुरुष',
      'महिला',
      'नामांकन संख्या',
      'पता'
    ],
    keywordsTa: [
      'இந்திய தனித்துவ அடையாள ஆணையம்',
      'இந்திய அரசு',
      'ஆதார்',
      'எனது ஆதார் எனது அடையாளம்',
      'பிறந்த தேதி',
      'ஆண்',
      'பெண்',
      'பதிவு எண்',
      'முகவரி'
    ],
    keywordsTe: [
      'భారత విశిష్ట గుర్తింపు ప్రాధికార సంస్థ',
      'భారత ప్రభుత్వం',
      'ఆధార్',
      'నా ఆధార్ నా గుర్తింపు',
      'పుట్టిన తేదీ',
      'పురుషుడు',
      'స్త్రీ',
      'నమోదు సంఖ్య',
      'చిరునామా'
    ],
    keywordsKn: [
      'ಭಾರತೀಯ ವಿಶಿಷ್ಟ ಗುರುತಿನ ಪ್ರಾಧಿಕಾರ',
      'ಭಾರತ ಸರ್ಕಾರ',
      'ಆಧಾರ್',
      'ನನ್ನ ಆಧಾರ್ ನನ್ನ ಗುರುತು',
      'ಹುಟ್ಟಿದ ದಿನಾಂಕ',
      'ಪುರುಷ',
      'ಮಹಿಳೆ',
      'ದಾಖಲಾತಿ ಸಂಖ್ಯೆ',
      'ವಿಳಾಸ'
    ],
    keywordsMl: [
      'ഭാരതീയ വിശിഷ്ട തിരിച്ചറിയൽ അതോറിറ്റി',
      'ഭാരത സർക്കാർ',
      'ആധാർ',
      'എന്റെ ആധാർ എന്റെ തിരിച്ചറിയൽ',
      'ജനന തീയതി',
      'പുരുഷൻ',
      'സ്ത്രീ',
      'എൻറോൾമെന്റ് നമ്പർ',
      'മേൽവിലാസം'
    ],
    patterns: [
      /\b\d{4}\s+\d{4}\s+\d{4}\b/, // 12-digit Aadhaar number pattern
      /\b\d{4}\s*\d{4}\s*\d{4}\b/
    ],
    frontMarkers: [
      'male', 'female', 'dob', 'year of birth',
      'ஆண்', 'பெண்', 'பிறந்த தேதி',
      'पुरुष', 'महिला', 'जन्म तिथि',
      'పురుషుడు', 'స్త్రీ', 'పుట్టిన తేదీ',
      'ಪುರುಷ', 'ಮಹಿಳೆ', 'ಹುಟ್ಟಿದ ದಿನಾಂಕ',
      'പുരുഷൻ', 'സ്ത്രീ', 'ജനന തീയതി'
    ],
    backMarkers: [
      'address', 's/o', 'd/o', 'w/o', 'c/o',
      'முகவரி', 'த/பெ', 'க/பெ',
      'पता', 'आत्मज', 'सुपुत्र', 'सुपुत्री', 'पत्नी',
      'చిరునామా', 'కుమారుడు', 'కుమార్తె', 'భార్య',
      'ವಿಳಾಸ', 'ಮಗ', 'ಮಗಳು', 'ಹೆಂಡತಿ',
      'മേൽവിലാസം', 'മകൻ', 'മകൾ', 'ഭാര്യ'
    ]
  },

  [DOCUMENT_TYPES.DRIVING_LICENCE]: {
    keywordsEn: [
      'driving licence',
      'driving license',
      'motor vehicles act',
      'transport department',
      'union of india',
      'indian union driving licence',
      'licence to drive',
      'dl no',
      'form 7',
      'r.t.o',
      'rto',
      'dto',
      'badge no',
      'validity',
      'authorisation to drive',
      'lmv',
      'mcwg',
      'cov'
    ],
    keywordsHi: [
      'ड्राइविंग लाइसेंस',
      'चालन अनुज्ञप्ति',
      'परिवहन विभाग',
      'लाइसेंस सं',
      'वैधता',
      'मोटर वाहन'
    ],
    keywordsTa: [
      'ஓட்டுநர் உரிமம்',
      'போக்குவரத்து துறை',
      'உரிமம் எண்',
      'தமிழ்நாடு அரசு'
    ],
    keywordsTe: [
      'డ్రైవింగ్ లైసెన్స్',
      'రవాణా శాఖ',
      'లైసెన్స్ సంఖ్య',
      'మోటార్ వాహనాల చట్టం'
    ],
    keywordsKn: [
      'ಚಾಲನಾ ಪರವಾನಗಿ',
      'ಸಾರಿಗೆ ಇಲಾಖೆ',
      'ಪರವಾನಗಿ ಸಂಖ್ಯೆ',
      'ಮೋಟಾರು ವಾಹನ ಕಾಯ್ದೆ'
    ],
    keywordsMl: [
      'ഡ്രൈവിംഗ് ലൈസൻസ്',
      'മോട്ടോർ വാഹന വകുപ്പ്',
      'ലൈസൻസ് നമ്പർ',
      'മോട്ടോർ വാഹന നിയമം'
    ],
    patterns: [
      /\b[A-Z]{2}[-\s]?\d{2}[-\s]?(?:\d{4}|\d{11})\b/i // e.g. TN-05-2015..., DL-04...
    ],
    frontMarkers: [
      'licence to drive', 'validity', 'cov', 'dob', 'blood group',
      'ஓட்டுநர் உரிமம்', 'ड्राइविंग लाइसेंस', 'चालन अनुज्ञप्ति',
      'డ్రైవింగ్ లైసెన్స్', 'ಚಾಲನಾ ಪರವಾನಗಿ', 'ഡ്രൈവിംഗ് ലൈസൻസ്'
    ],
    backMarkers: [
      'organ donor', 'badge', 'issuing authority', 'address',
      'முகவரி', 'पता', 'చిరునామా', 'ವಿಳಾಸ', 'മേൽവിലാസം'
    ]
  },

  [DOCUMENT_TYPES.VOTER_ID]: {
    keywordsEn: [
      'election commission of india',
      'elector photo identity card',
      'epic no',
      'epic',
      'voter id',
      'identity card',
      'electoral registration officer',
      'assembly constituency',
      'parliamentary constituency',
      'polling station',
      'part no',
      'elector'
    ],
    keywordsHi: [
      'भारत निर्वाचन आयोग',
      'निर्वाचक फोटो पहचान पत्र',
      'मतदाता पहचान पत्र',
      'पहचान पत्र',
      'विधान सभा निर्वाचन क्षेत्र',
      'संसदीय निर्वाचन क्षेत्र',
      'मतदाता'
    ],
    keywordsTa: [
      'இந்திய தேர்தல் ஆணையம்',
      'வாக்காளர் புகைப்பட அடையாள அட்டை',
      'வாக்காளர் அடையாள அட்டை',
      'சட்டமன்ற தொகுதி',
      'வாக்காளர்'
    ],
    keywordsTe: [
      'భారత ఎన్నికల సంఘం',
      'ఓటరు ఫోటో గుర్తింపు కార్డు',
      'ఓటరు గుర్తింపు కార్డు',
      'శాసనసభ నియోజకవర్గం',
      'ఓటరు'
    ],
    keywordsKn: [
      'ಭಾರತ ಚುನಾವಣಾ ಆಯೋಗ',
      'ಮತದಾರರ ಭಾವಚಿತ್ರವಿರುವ ಗುರುತಿನ ಚೀಟಿ',
      'ಮತದಾರರ ಗುರುತಿನ ಚೀಟಿ',
      'ವಿಧಾನಸಭಾ ಕ್ಷೇತ್ರ',
      'ಮತದಾರ'
    ],
    keywordsMl: [
      'ഭാരത തെരഞ്ഞെടുപ്പ് കമ്മീഷൻ',
      'തിരിച്ചറിയൽ കാർഡ്',
      'വോട്ടർ ഐഡി',
      'നിയമസഭാ മണ്ഡലം',
      'വോട്ടർ'
    ],
    patterns: [
      /\b[A-Z]{3}[0-9]{7}\b/i // standard EPIC format e.g. ABC1234567
    ],
    frontMarkers: [
      'elector photo identity card', 'elector name', 'epic',
      'வாக்காளர் புகைப்பட', 'निर्वाचक फोटो', 'ఓటరు ఫోటో',
      'ಭಾವಚಿತ್ರವಿರುವ ಗುರುತಿನ', 'തിരിച്ചറിയൽ കാർഡ്'
    ],
    backMarkers: [
      'address', 'assembly constituency', 'date of issue',
      'முகவரி', 'சட்டமன்ற தொகுதி', 'पता', 'निर्वाचन क्षेत्र',
      'చిరునామా', 'విಳಾಸ', 'മേൽവിലാസം'
    ]
  },

  [DOCUMENT_TYPES.GAS_BILL]: {
    keywordsEn: [
      'indane',
      'bharat gas',
      'hp gas',
      'lpg',
      'liquid petroleum gas',
      'consumer no',
      'consumer number',
      'sv no',
      'distributor',
      'gas agency',
      'refill booking',
      'cylinder',
      'cash memo',
      'delivery challan',
      'subsidy',
      'indian oil corporation',
      'bpcl',
      'hpcl',
      'piped natural gas',
      'png',
      'adani gas',
      'torrent gas',
      'retail invoice'
    ],
    keywordsHi: [
      'भारत गैस',
      'इण्डेन',
      'एचपी गैस',
      'रसोई गैस',
      'सिलेंडर',
      'उपभोक्ता संख्या',
      'गैस एजेंसी',
      'कैश मेमो'
    ],
    keywordsTa: [
      'பாரத் கேஸ்',
      'இண்டேன்',
      'எச்பி கேஸ்',
      'எரிவாயு',
      'சிலிண்டர்',
      'நுகர்வோர் எண்',
      'விலைப்பட்டியல்'
    ],
    keywordsTe: [
      'భారత్ గ్యాస్',
      'ఇండేన్',
      'హెచ్‌పి గ్యాస్',
      'గ్యాస్ సిలిండర్',
      'వినియోగదారు సంఖ్య',
      'గ్యాస్ ఏజెన్సీ'
    ],
    keywordsKn: [
      'ಭಾರತ್ ಗ್ಯಾಸ್',
      'ಇಂಡೇನ್',
      'ಹೆಚ್‌ಪಿ ಗ್ಯಾಸ್',
      'ಗ್ಯಾಸ್ ಸಿಲಿಂಡರ್',
      'ಗ್ರಾಹಕರ ಸಂಖ್ಯೆ',
      'ಗ್ಯಾಸ್ ಏಜೆನ್ಸಿ'
    ],
    keywordsMl: [
      'ഭാരത് ഗ്യാസ്',
      'ഇൻഡെയ്ൻ',
      'എച്ച്പി ഗ്യാസ്',
      'ഗ്യാസ് സിലിണ്ടർ',
      'ഉപഭോക്തൃ നമ്പർ',
      'ഗ്യാസ് ഏജൻസി'
    ],
    patterns: [
      /consumer\s*(?:no|number|id)[\s.:]*\d+/i,
      /refill\s*(?:booking|order)[\s.:]*\d+/i
    ],
    frontMarkers: ['cash memo', 'invoice', 'consumer', 'bill', 'distributor', 'उपभोक्ता', 'நுகர்வோர்', 'వినియోగదారు', 'ಗ್ರಾಹಕ', 'ഉപഭോക്താവ്'],
    backMarkers: ['safety', 'instructions', 'terms', 'conditions', 'सुरक्षा', 'பாதுகாப்பு']
  },

  [DOCUMENT_TYPES.RENTAL_AGREEMENT]: {
    keywordsEn: [
      'rental agreement',
      'rent agreement',
      'lease agreement',
      'tenancy agreement',
      'lease deed',
      'stamp paper',
      'indian non judicial',
      'non-judicial stamp',
      'sub-registrar',
      'landlord',
      'lessor',
      'tenant',
      'lessee',
      'premises',
      'monthly rent',
      'security deposit',
      'schedule of property',
      'witnesseth',
      'herein after called'
    ],
    keywordsHi: [
      'किरायानामा',
      'किराया अनुबंध',
      'पट्टा विलेख',
      'स्टाम्प पेपर',
      'गैर न्यायिक',
      'मकान मालिक',
      'किरायेदार',
      'मासिक किराया'
    ],
    keywordsTa: [
      'வாடகை ஒப்பந்தம்',
      'குத்தகை ஒப்பந்தம்',
      'முத்திரைத்தாள்',
      'வாடகை',
      'குத்தகை',
      'உரிமையாளர்',
      'குடியிருப்பவர்'
    ],
    keywordsTe: [
      'అద్దె ఒప్పందం',
      'లీజు ఒప్పందం',
      'స్టాంప్ పేపర్',
      'ఇంటి యజమాని',
      'అద్దెదారు'
    ],
    keywordsKn: [
      'ಬಾಡಿಗೆ ಒಪ್ಪಂದ',
      'ಗುತ್ತಿಗೆ ಒಪ್ಪಂದ',
      'ಸ್ಟ್ಯಾಂಪ್ ಪೇಪರ್',
      'ಮನೆ ಮಾಲೀಕ',
      'ಬಾಡಿಗೆದಾರ'
    ],
    keywordsMl: [
      'വാടക കരാർ',
      'മുദ്രപ്പത്രം',
      'വീട്ടുടമസ്ഥൻ',
      'വാടകക്കാരൻ'
    ],
    patterns: [
      /rental\s+agreement/i,
      /lease\s+agreement/i,
      /tenancy\s+agreement/i,
      /stamp\s+duty/i
    ],
    frontMarkers: ['non judicial', 'stamp', 'this agreement', 'between', 'முத்திரைத்தாள்', 'स्टाम्प', 'స్టాంప్', 'ಸ್ಟ್ಯಾಂಪ್', 'മുദ്രപ്പത്രം'],
    backMarkers: ['witness', 'signature', 'lessor', 'lessee', 'tenant', 'landlord', 'हस्ताक्षर', 'கையொப்பம்']
  },

  [DOCUMENT_TYPES.PASSPORT]: {
    keywordsEn: [
      'passport',
      'republic of india',
      'ministry of external affairs',
      'passport no',
      'type p',
      'code ind',
      'given name',
      'surname',
      'place of birth',
      'place of issue',
      'date of issue',
      'date of expiry',
      'national status indian',
      'indian passport'
    ],
    keywordsHi: [
      'पासपोर्ट',
      'भारत गणराज्य',
      'विदेश मंत्रालय',
      'पासपोर्ट संख्या'
    ],
    keywordsTa: [
      'கடவுச்சீட்டு',
      'இந்தியக் குடியரசு',
      'வெளியுறவு அமைச்சகம்'
    ],
    keywordsTe: [
      'పాస్‌పోర్ట్',
      'భారత గణతంత్రం',
      'విదేశీ వ్యవహారాల మంత్రిత్వ శాఖ'
    ],
    keywordsKn: [
      'ಪಾಸ್‌ಪೋರ್ಟ್',
      'ಭಾರತ ಗಣರಾಜ್ಯ',
      'ವಿದೇಶಾಂಗ ಸಚಿವಾಲಯ'
    ],
    keywordsMl: [
      'പാസ്പോർട്ട്',
      'ഭാരത റിപ്പബ്ലിക്',
      'വിദേശകാര്യ മന്ത്രാലയം'
    ],
    patterns: [
      /\b[A-Z]\d{7}\b/i, // Indian passport number: 1 letter + 7 digits
      /P<IND[A-Z<]+/ // Machine Readable Zone line 1
    ],
    frontMarkers: ['type p', 'code ind', 'given name', 'surname', 'date of birth'],
    backMarkers: ['father', 'mother', 'spouse', 'address', 'file no', 'old passport', 'पता', 'முகவரி', 'చిరునామా', 'ವಿಳಾಸ', 'മേൽവിലാസം']
  }
};

/**
 * Mask full Aadhaar numbers in text for privacy protection
 */
function maskAadhaarNumbers(text) {
  if (!text) return '';
  return text.replace(/\b(\d{4}\s*\d{4}\s*)(\d{4})\b/g, 'XXXX-XXXX-$2');
}

/**
 * Intelligent Image Quality Inspection for Address Proof Documents
 * Tolerates normal document conditions (old, slightly scratched, faded, folded, minor wear)
 * Only rejects if severely damaged, completely unreadable (< 8 blur), pitch black (< 12), or totally washed out (> 248).
 */
function inspectImageQuality(imageBuffer, clientMetrics = {}) {
  const {
    blurScore = null,
    brightness = null,
    contrast = null
  } = clientMetrics;

  const quality = {
    isClear: true,
    hasGoodLighting: true,
    hasGoodContrast: true,
    isSeverelyDamagedOrUnreadable: false,
    needsManualReview: false,
    wearDetected: [],
    error: null,
    score: 85
  };

  // 1. Extreme Blur check: only reject if blurScore < 8 (completely illegible smudge / noise)
  if (blurScore !== null && blurScore !== undefined) {
    if (blurScore < 8) {
      quality.isClear = false;
      quality.isSeverelyDamagedOrUnreadable = true;
      quality.error = 'Image is extremely blurred. Please hold your camera steady and provide a clearer document image.';
      quality.score -= 50;
    } else if (blurScore < 20) {
      // Normal wear / slight blur / scratched document: tolerable, routes to HR/BGV review instead of hard reject
      quality.needsManualReview = true;
      quality.wearDetected.push('Minor surface scratches / fold blur');
      quality.score -= 20;
    }
  }

  // 2. Lighting tolerance: only reject if pitch black (< 12) or totally blown out / solid white (> 248)
  if (brightness !== null && brightness !== undefined) {
    if (brightness < 12) {
      quality.hasGoodLighting = false;
      quality.isSeverelyDamagedOrUnreadable = true;
      quality.error = 'Image is too dark to read document details. Please ensure sufficient lighting and retake.';
      quality.score -= 50;
    } else if (brightness > 248) {
      quality.hasGoodLighting = false;
      quality.isSeverelyDamagedOrUnreadable = true;
      quality.error = 'Image is completely overexposed or washed out. Please retake the document.';
      quality.score -= 50;
    } else if (brightness < 32 || brightness > 235) {
      quality.needsManualReview = true;
      quality.wearDetected.push('Aged paper / uneven lighting');
      quality.score -= 15;
    }
  }

  // 3. Contrast tolerance: only reject if completely flat solid color (< 6)
  if (contrast !== null && contrast !== undefined) {
    if (contrast < 6) {
      quality.hasGoodContrast = false;
      quality.isSeverelyDamagedOrUnreadable = true;
      quality.error = 'Image has insufficient contrast. Text is not discernable.';
      quality.score -= 40;
    } else if (contrast < 14) {
      quality.needsManualReview = true;
      quality.wearDetected.push('Faded print / low contrast');
      quality.score -= 10;
    }
  }

  return quality;
}

/**
 * Extract text from document Buffer / file (PDF or Image)
 * Intelligently applies preprocessing (contrast, sharpening, resizing) before OCR
 * Returns rich result with text, confidence, words, and enhanced image buffers
 */
async function extractDocumentText(filePathOrBuffer, mimeType = 'application/pdf') {
  let buffer = null;
  let ext = '';

  if (typeof filePathOrBuffer === 'string') {
    if (fs.existsSync(filePathOrBuffer)) {
      buffer = fs.readFileSync(filePathOrBuffer);
      ext = path.extname(filePathOrBuffer).toLowerCase();
    } else if (filePathOrBuffer.startsWith('data:')) {
      const parts = filePathOrBuffer.split(',');
      buffer = Buffer.from(parts[1], 'base64');
      if (parts[0].includes('pdf')) ext = '.pdf';
    }
  } else if (Buffer.isBuffer(filePathOrBuffer)) {
    buffer = filePathOrBuffer;
  }

  const resultObj = {
    text: '',
    confidence: 0,
    words: [],
    enhancedBuffer: null,
    originalBuffer: buffer,
    appliedSteps: [],
    toString() { return this.text; }
  };

  if (!buffer || buffer.length === 0) return resultObj;

  // 1. If PDF (by extension, mime, or magic bytes %PDF-), parse text stream
  const isPdf = ext === '.pdf' || mimeType === 'application/pdf' || buffer.slice(0, 5).toString() === '%PDF-';
  if (isPdf) {
    try {
      const pdfText = extractTextFromPdfBuffer(buffer);
      if (pdfText && pdfText.trim().length >= 10) {
        resultObj.text = pdfText;
        resultObj.confidence = 92;
        return resultObj;
      }
    } catch (e) {
      console.warn('PDF stream extract error in validator:', e.message);
    }
    return resultObj;
  }

  // 2. Preprocess document image before OCR (adaptive contrast, sharpening, resizing)
  let enhancedBuffer = buffer;
  let appliedSteps = [];
  try {
    const prep = await preprocessDocumentImage(buffer);
    if (prep && prep.enhancedBuffer && prep.enhancedBuffer.length > 0) {
      enhancedBuffer = prep.enhancedBuffer;
      appliedSteps = prep.appliedSteps || [];
    }
  } catch (prepErr) {
    console.warn('Document preprocessing notice:', prepErr.message);
  }
  resultObj.enhancedBuffer = enhancedBuffer;
  resultObj.appliedSteps = appliedSteps;

  // 3. OCR using Tesseract with all 6 Indian languages
  try {
    const worker = await getIndianLanguageWorker();
    if (worker) {
      const ret = await worker.recognize(enhancedBuffer);
      let text = ret?.data?.text || '';
      let confidence = typeof ret?.data?.confidence === 'number' ? Math.round(ret.data.confidence) : 0;
      let words = Array.isArray(ret?.data?.words) ? ret.data.words.map(w => ({ text: w.text, confidence: Math.round(w.confidence) })) : [];

      // If text extraction yielded low confidence on enhanced, also try original as fallback
      if ((!text || text.trim().length < 15 || confidence < 35) && enhancedBuffer !== buffer) {
        try {
          const retOrig = await worker.recognize(buffer);
          if (retOrig?.data?.text && retOrig.data.text.trim().length > text.trim().length) {
            text = retOrig.data.text;
            confidence = typeof retOrig.data.confidence === 'number' ? Math.round(retOrig.data.confidence) : confidence;
            words = Array.isArray(retOrig.data.words) ? retOrig.data.words.map(w => ({ text: w.text, confidence: Math.round(w.confidence) })) : words;
          }
        } catch (origErr) {}
      }

      resultObj.text = text;
      resultObj.confidence = confidence;
      resultObj.words = words;
      return resultObj;
    }
  } catch (ocrErr) {
    console.warn('Indian-language OCR error:', ocrErr.message);
  }

  return resultObj;
}

/**
 * Automatically detect actual document type from extracted text
 * Supports English, Hindi, Tamil, Telugu, Kannada, and Malayalam
 */
function detectDocumentTypeFromText(rawText) {
  if (!rawText || rawText.trim().length < 8) {
    return {
      detectedType: null,
      confidence: 0,
      scores: {},
      isDocument: false
    };
  }

  const textLower = rawText.toLowerCase();
  const textNoSpaces = textLower.replace(/\s+/g, '');
  const scores = {};

  for (const [docType, sig] of Object.entries(DOC_SIGNATURES)) {
    let score = 0;

    // English keywords
    for (const kw of (sig.keywordsEn || [])) {
      if (textLower.includes(kw) || textNoSpaces.includes(kw.replace(/\s+/g, ''))) {
        score += 20;
      }
    }

    // Indic keywords (Hindi, Tamil, Telugu, Kannada, Malayalam)
    const indicLists = [sig.keywordsHi, sig.keywordsTa, sig.keywordsTe, sig.keywordsKn, sig.keywordsMl];
    for (const list of indicLists) {
      if (Array.isArray(list)) {
        for (const kw of list) {
          if (textLower.includes(kw) || textNoSpaces.includes(kw.replace(/\s+/g, ''))) {
            score += 25;
          }
        }
      }
    }

    // Regex patterns
    for (const pat of sig.patterns) {
      if (pat.test(rawText)) {
        score += 35;
      }
    }

    scores[docType] = score;
  }

  // Identify highest scoring type
  let bestType = null;
  let highestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > highestScore) {
      highestScore = score;
      bestType = type;
    }
  }

  // Determine if content is genuine document
  // Score >= 20 represents confirmed identification of a known document type
  const isIdentified = highestScore >= 20;

  return {
    detectedType: isIdentified ? bestType : null,
    confidence: Math.min(100, highestScore),
    scores,
    isDocument: isIdentified || rawText.trim().length >= 35
  };
}

/**
 * Detect whether document side represents FRONT or BACK (where detectable)
 */
function detectDocumentSide(rawText, expectedType) {
  if (!rawText || !expectedType || !DOC_SIGNATURES[expectedType]) {
    return { side: 'unknown', confidence: 0 };
  }

  const textLower = rawText.toLowerCase();
  const sig = DOC_SIGNATURES[expectedType];

  let frontScore = 0;
  let backScore = 0;

  for (const marker of sig.frontMarkers) {
    if (textLower.includes(marker)) frontScore += 15;
  }

  for (const marker of sig.backMarkers) {
    if (textLower.includes(marker)) backScore += 15;
  }

  if (frontScore > backScore && frontScore >= 15) {
    return { side: 'front', confidence: frontScore };
  }
  if (backScore > frontScore && backScore >= 15) {
    return { side: 'back', confidence: backScore };
  }

  return { side: 'unknown', confidence: 0 };
}

/**
 * Comprehensive Address Proof Document Validator
 *
 * Flow:
 * Upload/Take Photo
 * → Check Image Quality
 * → OCR 6 Indian Languages (English, Hindi, Tamil, Telugu, Kannada, Malayalam)
 * → Detect Document Language & Mixed-Language Status
 * → Detect Actual Document Type
 * → Compare with Selected Document Type
 * → Validate Front/Back
 * → Extract Address & Name
 * → Compare Address & Name against HR records
 * → Route unclear/failed OCR to REVIEW REQUIRED
 * → PASS / REVIEW REQUIRED / FAIL
 */
async function validateAddressProofDocument({
  frontFileOrBuffer = null,
  backFileOrBuffer = null,
  frontText = '',
  backText = '',
  selectedDocumentType,
  frontMetrics = {},
  backMetrics = {},
  hrAddress = '',
  employeeConfirmedAddress = '',
  hrName = '',
  employeeConfirmedName = '',
  validateSide = 'both' // 'front' | 'back' | 'both'
}) {
  const result = {
    valid: false,
    decision: 'REJECTED', // 'ACCEPTED' | 'HR/BGV REVIEW REQUIRED' | 'REJECTED'
    qualityPassed: false,
    typeMatchPassed: false,
    sideValidPassed: false,
    checks: {
      imageClear: false,
      textReadable: false,
      correctDocumentType: false,
      frontBackValid: false
    },
    frontResult: null,
    backResult: null,
    detectedType: null,
    selectedDocumentType,
    maskedId: null,
    extractedName: '',
    extractedAddress: '',
    extractedPincode: '',
    ocrConfidence: 0,
    confidenceLevel: 'LOW',
    unreadableFields: [],
    frontOriginalBuffer: null,
    frontEnhancedBuffer: null,
    backOriginalBuffer: null,
    backEnhancedBuffer: null,
    languageDetection: null,
    detectedLanguages: [],
    isMixedLanguage: false,
    languageSummary: '',
    nameMatch: {
      hrNameMatch: 'NOT MATCH',
      employeeConfirmedNameMatch: 'NOT MATCH',
      overallResult: 'REVIEW REQUIRED'
    },
    addressMatch: {
      hrAddressMatch: 'NOT MATCH',
      employeeConfirmedAddressMatch: 'NOT MATCH',
      overallResult: 'REVIEW REQUIRED'
    },
    error: null,
    details: '',
    requiresManualReview: false,
    statusMessage: ''
  };

  if (!selectedDocumentType) {
    result.error = 'Please select a Document Type.';
    return result;
  }

  // 1. Analyze FRONT side if provided
  let extractedFrontText = frontText || '';
  let frontQuality = null;
  let frontOcr = null;

  if ((frontFileOrBuffer || frontMetrics?.blurScore !== undefined || extractedFrontText) && (validateSide === 'front' || validateSide === 'both')) {
    frontQuality = inspectImageQuality(frontFileOrBuffer, frontMetrics);

    // Only reject if severely damaged / unreadable (< 8 blur, < 12 dark, > 248 blown out)
    if (frontQuality.isSeverelyDamagedOrUnreadable) {
      result.valid = false;
      result.decision = 'REJECTED';
      result.overallResult = 'REJECTED';
      result.reason = 'SEVERELY_DAMAGED_OR_UNREADABLE';
      result.error = frontQuality.error || 'Front document image is severely blurred or dark. Please retake or provide a clearer image.';
      result.details = 'Front document fails minimum visibility threshold. Requesting clearer image.';
      result.statusMessage = 'DOCUMENT REJECTED – PLEASE RETAKE OR UPLOAD CLEARER IMAGE';
      result.requiresManualReview = false;
      return result;
    }

    if (!extractedFrontText && frontFileOrBuffer) {
      frontOcr = await extractDocumentText(frontFileOrBuffer);
      extractedFrontText = frontOcr.text || '';
      result.frontOriginalBuffer = frontOcr.originalBuffer;
      result.frontEnhancedBuffer = frontOcr.enhancedBuffer;
    }

    const frontDetect = detectDocumentTypeFromText(extractedFrontText);
    const frontSideDetect = detectDocumentSide(extractedFrontText, selectedDocumentType);

    result.frontResult = {
      textLength: extractedFrontText.length,
      detectedType: frontDetect.detectedType,
      confidence: frontDetect.confidence,
      ocrConfidence: frontOcr?.confidence || 0,
      detectedSide: frontSideDetect.side,
      quality: frontQuality
    };

    // Document Type Mismatch check (high confidence mismatch only)
    if (frontDetect.detectedType && frontDetect.detectedType !== selectedDocumentType && frontDetect.confidence >= 45) {
      result.valid = false;
      result.decision = 'REJECTED';
      result.overallResult = 'REJECTED';
      result.reason = 'TYPE_MISMATCH';
      result.error = `Uploaded document appears to be a ${frontDetect.detectedType}. Please select ${frontDetect.detectedType} from the Document Type dropdown or upload a valid ${selectedDocumentType}.`;
      result.details = `Front side matched ${frontDetect.detectedType} instead of ${selectedDocumentType}.`;
      result.statusMessage = `DOCUMENT TYPE MISMATCH (${frontDetect.detectedType})`;
      return result;
    }
  }

  // 2. Analyze BACK side if provided
  let extractedBackText = backText || '';
  let backQuality = null;
  let backOcr = null;

  if ((backFileOrBuffer || backMetrics?.blurScore !== undefined || extractedBackText) && (validateSide === 'back' || validateSide === 'both')) {
    backQuality = inspectImageQuality(backFileOrBuffer, backMetrics);

    // Only reject if severely damaged / unreadable
    if (backQuality.isSeverelyDamagedOrUnreadable) {
      result.valid = false;
      result.decision = 'REJECTED';
      result.overallResult = 'REJECTED';
      result.reason = 'SEVERELY_DAMAGED_OR_UNREADABLE';
      result.error = backQuality.error || 'Back document image is severely blurred or dark. Please retake or provide a clearer image.';
      result.details = 'Back document fails minimum visibility threshold. Requesting clearer image.';
      result.statusMessage = 'DOCUMENT REJECTED – PLEASE RETAKE OR UPLOAD CLEARER IMAGE';
      result.requiresManualReview = false;
      return result;
    }

    if (!extractedBackText && backFileOrBuffer) {
      backOcr = await extractDocumentText(backFileOrBuffer);
      extractedBackText = backOcr.text || '';
      result.backOriginalBuffer = backOcr.originalBuffer;
      result.backEnhancedBuffer = backOcr.enhancedBuffer;
    }

    const backDetect = detectDocumentTypeFromText(extractedBackText);
    const backSideDetect = detectDocumentSide(extractedBackText, selectedDocumentType);

    result.backResult = {
      textLength: extractedBackText.length,
      detectedType: backDetect.detectedType,
      confidence: backDetect.confidence,
      ocrConfidence: backOcr?.confidence || 0,
      detectedSide: backSideDetect.side,
      quality: backQuality
    };

    // Document Type Mismatch check
    if (backDetect.detectedType && backDetect.detectedType !== selectedDocumentType && backDetect.confidence >= 45) {
      result.valid = false;
      result.decision = 'REJECTED';
      result.overallResult = 'REJECTED';
      result.reason = 'TYPE_MISMATCH';
      result.error = `Uploaded document appears to be a ${backDetect.detectedType}. Please select ${backDetect.detectedType} from the Document Type dropdown or upload a valid ${selectedDocumentType}.`;
      result.details = `Back side matched ${backDetect.detectedType} instead of ${selectedDocumentType}.`;
      result.statusMessage = `DOCUMENT TYPE MISMATCH (${backDetect.detectedType})`;
      return result;
    }
  }

  // 3. Combined Front & Back Consistency Check (when both sides are checked)
  const hasFront = Boolean(frontFileOrBuffer || extractedFrontText);
  const hasBack = Boolean(backFileOrBuffer || extractedBackText);

  if (validateSide === 'both' && (!hasFront || !hasBack)) {
    result.error = 'Both Front and Back document sides are required.';
    result.reason = 'MISSING_SIDE';
    result.decision = 'REJECTED';
    result.overallResult = 'REJECTED';
    return result;
  }

  const frontDet = result.frontResult?.detectedType;
  const backDet = result.backResult?.detectedType;
  if (frontDet && backDet && frontDet !== backDet && (result.frontResult?.confidence >= 40) && (result.backResult?.confidence >= 40)) {
    result.valid = false;
    result.decision = 'REJECTED';
    result.overallResult = 'REJECTED';
    result.error = 'Front/Back document type does not match.';
    result.details = `Front appears to be ${frontDet} while Back appears to be ${backDet}.`;
    result.reason = 'FRONT_BACK_MISMATCH';
    return result;
  }

  // 4. Combined Text, Multilingual Detection, and Field Extraction
  const combinedRawText = [extractedFrontText, extractedBackText].filter(Boolean).join('\n');
  const langDetection = detectDocumentLanguage(combinedRawText);
  result.languageDetection = langDetection;
  result.detectedLanguages = langDetection.languages;
  result.isMixedLanguage = langDetection.isMixedLanguage;
  result.languageSummary = langDetection.languageSummary;

  // Calculate overall OCR confidence score
  const frontConf = result.frontResult?.ocrConfidence || (extractedFrontText.length > 20 ? 70 : 0);
  const backConf = result.backResult?.ocrConfidence || (extractedBackText.length > 20 ? 70 : 0);
  const ocrConfidence = (frontConf > 0 && backConf > 0)
    ? Math.round((frontConf + backConf) / 2)
    : (frontConf || backConf || (combinedRawText.length > 30 ? 75 : 0));
  result.ocrConfidence = ocrConfidence;
  result.confidenceLevel = ocrConfidence >= 65 ? 'HIGH' : ocrConfidence >= 40 ? 'MEDIUM' : 'LOW';

  // Field extraction: Address
  const rawExtractedAddr = extractAddressFromText(combinedRawText) || extractAddressFromText(extractedBackText) || combinedRawText.substring(0, 160).trim();
  result.extractedAddress = maskAadhaarNumbers(rawExtractedAddr);

  // Field extraction: Employee Name
  const rawExtractedName = extractNameFromText(combinedRawText, selectedDocumentType, [hrName, employeeConfirmedName]) ||
                          extractNameFromText(extractedFrontText, selectedDocumentType, [hrName, employeeConfirmedName]) ||
                          extractNameFromText(extractedBackText, selectedDocumentType, [hrName, employeeConfirmedName]);
  result.extractedName = rawExtractedName;

  // Field extraction: PIN Code
  const extractedPincode = extractPincode(combinedRawText) || extractPincode(rawExtractedAddr) || '';
  result.extractedPincode = extractedPincode;

  // Field extraction: Masked ID
  const aadhaarMatch = combinedRawText.match(/\b\d{4}\s*\d{4}\s*(\d{4})\b/);
  if (aadhaarMatch) {
    result.maskedId = `XXXX-XXXX-${aadhaarMatch[1]}`;
  } else if (selectedDocumentType === DOCUMENT_TYPES.VOTER_ID) {
    const vMatch = combinedRawText.match(/\b([A-Z]{3}[0-9]{7})\b/i);
    if (vMatch) result.maskedId = vMatch[1].toUpperCase();
  } else if (selectedDocumentType === DOCUMENT_TYPES.PASSPORT) {
    const pMatch = combinedRawText.match(/\b([A-Z][0-9]{7})\b/i);
    if (pMatch) result.maskedId = pMatch[1].toUpperCase();
  } else if (selectedDocumentType === DOCUMENT_TYPES.DRIVING_LICENCE) {
    const dlMatch = combinedRawText.match(/\b([A-Z]{2}[-\s]?\d{2}[-\s]?(?:\d{4}|\d{11}))\b/i);
    if (dlMatch) result.maskedId = dlMatch[1].toUpperCase();
  }

  // Identify unreadable or uncertain fields
  const unreadableFields = [];
  if (!rawExtractedName || rawExtractedName.trim().length < 3 || rawExtractedName.includes('could not be')) {
    unreadableFields.push('Employee Name');
  }
  if (!rawExtractedAddr || rawExtractedAddr.trim().length < 10 || rawExtractedAddr.includes('could not be')) {
    unreadableFields.push('Residential Address');
  }
  if (!extractedPincode) {
    unreadableFields.push('PIN Code');
  }
  result.unreadableFields = unreadableFields;

  // 5. Compare Name against HR records (sensible matching)
  if (hrName || employeeConfirmedName) {
    const hrNameComp = compareNameComponents(hrName || employeeConfirmedName, rawExtractedName, combinedRawText);
    const empNameComp = compareNameComponents(employeeConfirmedName || hrName, rawExtractedName, combinedRawText);

    result.nameMatch = {
      hrNameMatch: hrNameComp.match,
      employeeConfirmedNameMatch: empNameComp.match,
      overallResult: (hrNameComp.match === 'MATCH' || empNameComp.match === 'MATCH')
        ? 'MATCH'
        : (hrNameComp.match === 'PARTIAL MATCH' || empNameComp.match === 'PARTIAL MATCH')
          ? 'PARTIAL'
          : 'NOT MATCH',
      hrScore: hrNameComp.score,
      empScore: empNameComp.score
    };
  }

  // 6. Compare Address against HR records (sensible matching)
  if (hrAddress || employeeConfirmedAddress) {
    const hrComp = compareAddressComponents(hrAddress || employeeConfirmedAddress, combinedRawText, rawExtractedAddr);
    const empComp = compareAddressComponents(employeeConfirmedAddress || hrAddress, combinedRawText, rawExtractedAddr);

    result.addressMatch = {
      hrAddressMatch: hrComp.match,
      employeeConfirmedAddressMatch: empComp.match,
      overallResult: (hrComp.match === 'MATCH' || empComp.match === 'MATCH')
        ? 'MATCHED'
        : (hrComp.match === 'PARTIAL MATCH' || empComp.match === 'PARTIAL MATCH')
          ? 'REVIEW REQUIRED'
          : 'NOT MATCHED',
      hrScore: hrComp.score,
      empScore: empComp.score
    };
  }

  result.detectedType = result.frontResult?.detectedType || result.backResult?.detectedType || selectedDocumentType;

  // 7. Check if document text could not be clearly read (Unclear / degraded text)
  const isFrontUnclear = extractedFrontText.trim().length < 8;
  const isBackUnclear = extractedBackText.trim().length < 8;
  const isTotallyUnclear = (validateSide === 'both' && isFrontUnclear && isBackUnclear) ||
                          (validateSide === 'front' && isFrontUnclear) ||
                          (validateSide === 'back' && isBackUnclear) ||
                          combinedRawText.trim().length < 8;

  if (isTotallyUnclear) {
    result.error = 'Document text could not be clearly read. Flagged for HR/BGV manual review.';
    result.details = 'OCR was unable to extract legible text. Document exhibits wear, fading, or damage. Sent to HR/BGV review queue.';
    result.reason = 'UNREADABLE_TEXT';
    result.decision = 'HR/BGV REVIEW REQUIRED';
    result.overallResult = 'REVIEW REQUIRED';
    result.statusMessage = 'ADDRESS COULD NOT BE READ – REVIEW REQUIRED';
    result.requiresManualReview = true;
    result.valid = true;
    return result;
  }

  // 8. Three-Tier Validation Decision System
  const isNameMatch = result.nameMatch?.overallResult === 'MATCH';
  const isNamePartial = result.nameMatch?.overallResult === 'PARTIAL';
  const isAddressMatch = result.addressMatch?.overallResult === 'MATCHED';
  const isAddressPartial = result.addressMatch?.overallResult === 'REVIEW REQUIRED';
  const hasCriticalFields = Boolean(rawExtractedName && rawExtractedAddr && extractedPincode);

  // OUTCOME A: ACCEPTED
  // Important information is readable, OCR confidence is sufficient, and document requirements are satisfied
  if (
    (ocrConfidence >= 45 || isAddressMatch) &&
    (isNameMatch || isNamePartial) &&
    (isAddressMatch || (isAddressPartial && (result.addressMatch.hrScore >= 70 || result.addressMatch.empScore >= 70))) &&
    hasCriticalFields
  ) {
    result.valid = true;
    result.decision = 'ACCEPTED';
    result.overallResult = 'MATCHED';
    result.statusMessage = 'DOCUMENT ACCEPTED';
    result.requiresManualReview = false;
    result.qualityPassed = true;
    result.typeMatchPassed = true;
    result.sideValidPassed = true;
    result.checks = {
      imageClear: true,
      textReadable: true,
      correctDocumentType: true,
      frontBackValid: true
    };
    result.details = 'Important identity and address information is readable, OCR confidence is sufficient, and document requirements are satisfied.';
    return result;
  }

  // OUTCOME B: HR/BGV REVIEW REQUIRED
  // The document is genuine-looking and partially readable, but some important fields or OCR results need human confirmation
  // Supports old, slightly scratched, faded, folded, and mildly damaged documents without rejecting them
  result.valid = true;
  result.decision = 'HR/BGV REVIEW REQUIRED';
  result.overallResult = 'REVIEW REQUIRED';
  result.statusMessage = 'DOCUMENT ACCEPTED – SENT FOR HR/BGV REVIEW';
  result.requiresManualReview = true;
  result.qualityPassed = true;
  result.typeMatchPassed = true;
  result.sideValidPassed = true;
  result.checks = {
    imageClear: true,
    textReadable: true,
    correctDocumentType: true,
    frontBackValid: true
  };

  const reviewReasons = [];
  if (unreadableFields.length > 0) reviewReasons.push(`Uncertain/unreadable fields: ${unreadableFields.join(', ')}`);
  if (ocrConfidence < 50) reviewReasons.push(`OCR confidence ${ocrConfidence}%`);
  if (isNamePartial || !isNameMatch) reviewReasons.push('Name requires human confirmation');
  if (isAddressPartial || !isAddressMatch) reviewReasons.push('Address requires human confirmation');
  if (frontQuality?.needsManualReview || backQuality?.needsManualReview) reviewReasons.push('Normal document wear (faded/scratched/folded/aged)');

  result.details = reviewReasons.length > 0
    ? `Sent for HR/BGV manual review: ${reviewReasons.join(' • ')}.`
    : 'Document accepted. Flagged for HR/BGV human confirmation.';

  return result;
}

module.exports = {
  DOCUMENT_TYPES,
  DOC_SIGNATURES,
  detectDocumentTypeFromText,
  detectDocumentSide,
  inspectImageQuality,
  extractDocumentText,
  validateAddressProofDocument,
  maskAadhaarNumbers,
  getDualLanguageWorker,
  getIndianLanguageWorker,
  detectDocumentLanguage
};

