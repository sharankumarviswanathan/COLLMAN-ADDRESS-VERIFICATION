const fs = require('fs');
const path = require('path');
const {
  getIndianLanguageWorker,
  getDualLanguageWorker,
  detectDocumentLanguage,
  normalizeIndicNumerals
} = require('./indianLanguageOcr');
const { extractTextFromPdfBuffer } = require('./documentAddressMatcher');
const { compareAddressComponents } = require('./documentAddressMatcher');

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
 * Simple image brightness / contrast / blur inspection from Buffer
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
    error: null,
    score: 85
  };

  if (blurScore !== null && blurScore !== undefined && blurScore < 20) {
    quality.isClear = false;
    quality.error = 'Image is not clear. Please retake or replace the document.';
    quality.score -= 40;
  }

  if (brightness !== null && brightness !== undefined) {
    if (brightness < 30) {
      quality.hasGoodLighting = false;
      quality.error = 'Image is too dark. Please ensure sufficient lighting and retake.';
      quality.score -= 30;
    } else if (brightness > 245) {
      quality.hasGoodLighting = false;
      quality.error = 'Image is overexposed or washed out. Please retake the document.';
      quality.score -= 30;
    }
  }

  if (contrast !== null && contrast !== undefined && contrast < 12) {
    quality.hasGoodContrast = false;
    quality.error = quality.error || 'Image has poor contrast. Text is not clearly visible.';
    quality.score -= 20;
  }

  return quality;
}

/**
 * Extract text from document Buffer / file (PDF or Image)
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

  if (!buffer || buffer.length === 0) return '';

  // 1. If PDF (by extension, mime, or magic bytes %PDF-), parse text stream
  const isPdf = ext === '.pdf' || mimeType === 'application/pdf' || buffer.slice(0, 5).toString() === '%PDF-';
  if (isPdf) {
    try {
      const pdfText = extractTextFromPdfBuffer(buffer);
      if (pdfText && pdfText.trim().length >= 10) {
        return pdfText;
      }
    } catch (e) {
      console.warn('PDF stream extract error in validator:', e.message);
    }
    // PDF files cannot be processed directly by Tesseract pixReadStream without rasterization
    return '';
  }

  // 2. OCR using Tesseract with all 6 Indian languages (for image buffers)
  try {
    const worker = await getIndianLanguageWorker();
    if (worker) {
      const ret = await worker.recognize(buffer);
      if (ret && ret.data && ret.data.text) {
        return ret.data.text;
      }
    }
  } catch (ocrErr) {
    console.warn('Indian-language OCR error:', ocrErr.message);
  }

  return '';
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
  if ((frontFileOrBuffer || frontMetrics?.blurScore !== undefined || extractedFrontText) && (validateSide === 'front' || validateSide === 'both')) {
    const frontQuality = inspectImageQuality(frontFileOrBuffer, frontMetrics);
    if (!frontQuality.isClear) {
      result.error = 'Image is not clear. Please retake or replace the document.';
      result.details = 'Front image appears blurry or out of focus. Sent for HR/BGV review.';
      result.reason = 'QUALITY_FAILED';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'IMAGE BLURRED – REVIEW REQUIRED';
      return result;
    }
    if (!frontQuality.hasGoodLighting) {
      result.error = frontQuality.error || 'Image lighting is poor. Please retake with sufficient light.';
      result.reason = 'QUALITY_FAILED';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'POOR LIGHTING – REVIEW REQUIRED';
      return result;
    }

    if (!extractedFrontText && frontFileOrBuffer) {
      extractedFrontText = await extractDocumentText(frontFileOrBuffer);
    }
    const frontDetect = detectDocumentTypeFromText(extractedFrontText);
    const frontSideDetect = detectDocumentSide(extractedFrontText, selectedDocumentType);

    result.frontResult = {
      textLength: extractedFrontText.length,
      detectedType: frontDetect.detectedType,
      confidence: frontDetect.confidence,
      detectedSide: frontSideDetect.side,
      quality: frontQuality
    };

    // Check if text could be read clearly
    if (!extractedFrontText || extractedFrontText.trim().length < 10) {
      result.error = 'Document text could not be clearly read. Flagged for HR/BGV manual review.';
      result.details = 'OCR was unable to extract legible text from Front side. Sent to HR/BGV review queue.';
      result.reason = 'UNREADABLE_TEXT';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'ADDRESS COULD NOT BE READ – REVIEW REQUIRED';
      return result;
    }

    // Check Document Type Mismatch for Front
    if (frontDetect.detectedType && frontDetect.detectedType !== selectedDocumentType) {
      result.error = `Uploaded document appears to be an ${frontDetect.detectedType}. Please select ${frontDetect.detectedType} from the Document Type dropdown or upload a valid ${selectedDocumentType}.`;
      result.details = `Front side matched ${frontDetect.detectedType} instead of ${selectedDocumentType}.`;
      result.reason = 'TYPE_MISMATCH';
      return result;
    }

    // Check if completely unrelated photo / non-document
    const frontMatchesSelected = (frontDetect.scores[selectedDocumentType] || 0) > 0;
    if (!frontDetect.detectedType && !frontMatchesSelected && frontSideDetect.side === 'unknown') {
      result.error = `This does not appear to be a valid ${selectedDocumentType}. Flagged for HR/BGV review.`;
      result.details = 'Front image does not contain recognizable identity/utility document text.';
      result.reason = 'DOCUMENT_TYPE_NOT_DETECTED';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'DOCUMENT TYPE UNCLEAR – REVIEW REQUIRED';
      return result;
    }

    // Front orientation check
    if (frontSideDetect.side === 'back') {
      result.details = 'Notice: Front slot appears to contain Back side details. Please verify orientation.';
    }
  }

  // 2. Analyze BACK side if provided
  let extractedBackText = backText || '';
  if ((backFileOrBuffer || backMetrics?.blurScore !== undefined || extractedBackText) && (validateSide === 'back' || validateSide === 'both')) {
    const backQuality = inspectImageQuality(backFileOrBuffer, backMetrics);
    if (!backQuality.isClear) {
      result.error = 'Image is not clear. Please retake or replace the document.';
      result.details = 'Back image appears blurry or out of focus. Sent for HR/BGV review.';
      result.reason = 'QUALITY_FAILED';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'IMAGE BLURRED – REVIEW REQUIRED';
      return result;
    }
    if (!backQuality.hasGoodLighting) {
      result.error = backQuality.error || 'Image lighting is poor. Please retake with sufficient light.';
      result.reason = 'QUALITY_FAILED';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'POOR LIGHTING – REVIEW REQUIRED';
      return result;
    }

    if (!extractedBackText && backFileOrBuffer) {
      extractedBackText = await extractDocumentText(backFileOrBuffer);
    }
    const backDetect = detectDocumentTypeFromText(extractedBackText);
    const backSideDetect = detectDocumentSide(extractedBackText, selectedDocumentType);

    result.backResult = {
      textLength: extractedBackText.length,
      detectedType: backDetect.detectedType,
      confidence: backDetect.confidence,
      detectedSide: backSideDetect.side,
      quality: backQuality
    };

    // Check if text could be read
    if (!extractedBackText || extractedBackText.trim().length < 10) {
      result.error = 'Document text could not be clearly read. Flagged for HR/BGV manual review.';
      result.details = 'OCR was unable to extract legible text from Back side. Sent to HR/BGV review queue.';
      result.reason = 'UNREADABLE_TEXT';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'ADDRESS COULD NOT BE READ – REVIEW REQUIRED';
      return result;
    }

    // Check Document Type Mismatch for Back
    if (backDetect.detectedType && backDetect.detectedType !== selectedDocumentType) {
      result.error = `Uploaded document appears to be an ${backDetect.detectedType}. Please select ${backDetect.detectedType} from the Document Type dropdown or upload a valid ${selectedDocumentType}.`;
      result.details = `Back side matched ${backDetect.detectedType} instead of ${selectedDocumentType}.`;
      result.reason = 'TYPE_MISMATCH';
      return result;
    }

    // Check if completely unrelated photo
    const backMatchesSelected = (backDetect.scores[selectedDocumentType] || 0) > 0;
    if (!backDetect.detectedType && !backMatchesSelected && backSideDetect.side === 'unknown') {
      result.error = `This does not appear to be a valid ${selectedDocumentType}. Flagged for HR/BGV review.`;
      result.details = 'Back image does not contain recognizable identity/utility document text.';
      result.reason = 'DOCUMENT_TYPE_NOT_DETECTED';
      result.requiresManualReview = true;
      result.overallResult = 'REVIEW REQUIRED';
      result.statusMessage = 'DOCUMENT TYPE UNCLEAR – REVIEW REQUIRED';
      return result;
    }
  }

  // 3. Combined Front & Back Consistency Check (when both are validated)
  const hasFront = Boolean(frontFileOrBuffer || extractedFrontText);
  const hasBack = Boolean(backFileOrBuffer || extractedBackText);

  if (validateSide === 'both' || (hasFront && hasBack)) {
    if (!hasFront || !hasBack) {
      result.error = 'Both Front and Back document sides are required.';
      result.reason = 'MISSING_SIDE';
      return result;
    }

    const frontDet = result.frontResult?.detectedType;
    const backDet = result.backResult?.detectedType;

    if (frontDet && backDet && frontDet !== backDet) {
      result.error = 'Front/Back document does not match.';
      result.details = `Front appears to be ${frontDet} while Back appears to be ${backDet}.`;
      result.reason = 'FRONT_BACK_MISMATCH';
      return result;
    }
  }

  // Passed quality & classification checks!
  result.valid = true;
  result.checks.imageClear = true;
  result.checks.textReadable = true;
  result.checks.correctDocumentType = true;
  result.checks.frontBackValid = true;
  result.qualityPassed = true;
  result.typeMatchPassed = true;
  result.sideValidPassed = true;
  result.detectedType = result.frontResult?.detectedType || result.backResult?.detectedType || selectedDocumentType;

  // 4. Address & Name Extraction & Multi-language Detection
  const combinedRawText = [extractedFrontText, extractedBackText].filter(Boolean).join('\n');
  const langDetection = detectDocumentLanguage(combinedRawText);
  result.languageDetection = langDetection;
  result.detectedLanguages = langDetection.languages;
  result.isMixedLanguage = langDetection.isMixedLanguage;
  result.languageSummary = langDetection.languageSummary;

  const { extractAddressFromText, extractNameFromText, compareNameComponents } = require('./documentAddressMatcher');
  const rawExtractedAddr = extractAddressFromText(combinedRawText) || combinedRawText.substring(0, 160).trim();
  result.extractedAddress = maskAadhaarNumbers(rawExtractedAddr);

  // Extract Name from document text (English & Indian Languages)
  const rawExtractedName = extractNameFromText(combinedRawText, selectedDocumentType, [hrName, employeeConfirmedName]) ||
                          extractNameFromText(extractedFrontText, selectedDocumentType, [hrName, employeeConfirmedName]) ||
                          extractNameFromText(extractedBackText, selectedDocumentType, [hrName, employeeConfirmedName]);
  result.extractedName = rawExtractedName;

  // Extract Masked Aadhaar number if present:
  const aadhaarMatch = combinedRawText.match(/\b\d{4}\s*\d{4}\s*(\d{4})\b/);
  if (aadhaarMatch) {
    result.maskedId = `XXXX-XXXX-${aadhaarMatch[1]}`;
  }

  // Compare Name if target name provided
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

  // Compare Address
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

  result.valid = true;
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

