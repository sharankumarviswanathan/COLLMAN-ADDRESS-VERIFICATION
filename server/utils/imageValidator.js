const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs');

let sharedWorker = null;
let workerInitPromise = null;

function isValidImageBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 50) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
  // GIF: GIF
  if (buf.length >= 3 && buf.toString('ascii', 0, 3) === 'GIF') return true;
  return false;
}

async function getOcrWorker() {
  if (sharedWorker) return sharedWorker;
  if (!workerInitPromise) {
    workerInitPromise = (async () => {
      try {
        const worker = await createWorker('eng');
        sharedWorker = worker;
        return worker;
      } catch (err) {
        console.warn('Failed to initialize shared Tesseract worker:', err.message);
        sharedWorker = null;
        workerInitPromise = null;
        return null;
      }
    })();
  }
  return workerInitPromise;
}

/**
 * Common street keywords for street board validation
 */
const STREET_KEYWORDS = [
  'street', 'st', 'road', 'rd', 'nagar', 'lane', 'ln', 'salai', 'ave', 'avenue',
  'main', 'cross', 'colony', 'layout', 'gali', 'marg', 'block', 'ward', 'sector',
  'highway', 'hwy', 'path', 'drive', 'dr', 'circle', 'bypass', 'close', 'terrace',
  'india', 'chennai', 'tamil', 'nadu', 'delhi', 'mumbai', 'bengaluru', 'bangalore',
  'pincode', 'pin'
];

/**
 * Document & computer screen keywords
 */
const DOCUMENT_KEYWORDS = [
  'document', 'pdf', 'applicant', 'declaration', 'signature', 'page', 'form',
  'download', 'print', 'sheet', 'aadhaar', 'uidai', 'passport', 'voter', 'election',
  'driving', 'licence', 'license', 'pan', 'income tax', 'tax', 'invoice', 'bill',
  'statement', 'passbook', 'certificate', 'collman', 'review required', 'view back',
  'view front', 'back side', 'front side', 'address in document', 'intelligent text',
  'text extraction', 'enrollment', 'gender', 'dob', 'father', 'husband', 'mother',
  'reverification', 'verification required', 'candidate', 'bgv', 're-verification',
  'address verification', 'system generated', 'identity', 'government of india', 'govt of india'
];

/**
 * Detect if text indicates a document, computer screen, or PDF form
 */
function detectDocumentOrScreen(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  const docPhrases = [
    'address in document',
    'intelligent text',
    'text extraction',
    'back side',
    'front side',
    'view back',
    'view front',
    'government of india',
    'unique identification',
    'review required',
    'reverification required',
    're-verification',
    'income tax department',
    'election commission',
    'collman services',
    'address verification'
  ];

  for (const phrase of docPhrases) {
    if (lower.includes(phrase)) return true;
  }

  const tokens = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  let matchCount = 0;
  for (const kw of DOCUMENT_KEYWORDS) {
    if (tokens.includes(kw) || (kw.includes(' ') && lower.includes(kw))) {
      matchCount++;
      if (matchCount >= 2) return true;
    }
  }

  return false;
}

/**
 * Extract digits or door number candidates from string
 */
function extractDoorNumbers(text) {
  if (!text) return [];
  const patterns = [
    /#?\s*\d{1,5}(?:\s*[\/\-]\s*[A-Za-z0-9]+)?/g,
    /(?:no|door|flat|plot|house)\.?\s*#?\s*\d{1,5}[A-Za-z]?/gi,
    /\b\d{1,5}[A-Za-z]?\b/g
  ];

  const found = new Set();
  for (const regex of patterns) {
    const matches = text.match(regex);
    if (matches) {
      matches.forEach(m => {
        const clean = m.trim().replace(/^#\s*/, '');
        if (clean.length > 0 && /\d/.test(clean)) {
          found.add(clean);
        }
      });
    }
  }
  return Array.from(found);
}

/**
 * Validate an image based on its type and quality metrics
 * @param {Object} options
 * @param {string|Buffer} options.imageBuffer - Buffer of the image
 * @param {string} options.photoType - 'landmark' | 'street' | 'building' | 'door_selfie' | 'selfie'
 * @param {Object} options.clientMetrics - Metrics computed on canvas (blurScore, brightness, contrast, faceDetected, etc.)
 * @param {string} options.hrAddress - Employee's HR address to check door number / street match
 */
async function validateImage({ imageBuffer, photoType, clientMetrics = {}, hrAddress = '' }) {
  const result = {
    valid: true,
    score: 85,
    error: null,
    checks: {
      clarity: { passed: true, message: 'Clarity and focus are sharp' },
      lighting: { passed: true, message: 'Lighting is well-balanced' },
      visibility: { passed: true, message: 'Subject is clearly visible' },
      content: { passed: true, message: 'Content matches required criteria' }
    },
    extractedText: null,
    doorNumbersFound: []
  };

  const {
    blurScore = 80,
    brightness = 128,
    contrast = 60,
    faceDetected = null,
    faceConfidence = 0,
    faceReason = null,
    skinRatio = 0,
    isLandscape = null,
    isDocumentOrScreen = false
  } = clientMetrics;

  // 1. Check Clarity / Blur
  if (blurScore !== null && blurScore !== undefined && blurScore < 22) {
    result.valid = false;
    result.checks.clarity = { passed: false, message: 'Image is blurry or out of focus' };
    result.error = 'Image is not clear. Please hold your camera steady and retake the photo.';
    return result;
  }

  // 2. Check Lighting
  if (brightness !== null && brightness !== undefined && brightness < 32) {
    result.valid = false;
    result.checks.lighting = { passed: false, message: 'Image is too dark' };
    result.error = 'Image is too dark. Please retake with better lighting.';
    return result;
  }
  if (brightness !== null && brightness !== undefined && brightness > 238) {
    result.valid = false;
    result.checks.lighting = { passed: false, message: 'Image is overexposed / too bright' };
    result.error = 'Image is overexposed. Please retake in softer lighting.';
    return result;
  }

  // 3. Check Visibility / Contrast
  if (contrast !== null && contrast !== undefined && contrast < 16) {
    result.valid = false;
    result.checks.visibility = { passed: false, message: 'Image has very low contrast / washed out' };
    result.error = 'Image contrast is too low. Please retake the photo.';
    return result;
  }

  // OCR extraction for text/content analysis where applicable
  let ocrText = clientMetrics.ocrText || '';
  if (!ocrText && isValidImageBuffer(imageBuffer)) {
    try {
      const worker = await getOcrWorker();
      if (worker) {
        const ret = await worker.recognize(imageBuffer);
        ocrText = ret?.data?.text || '';
      }
    } catch (ocrErr) {
      console.warn('OCR error during image validation:', ocrErr.message);
      sharedWorker = null;
      workerInitPromise = null;
    }
  }
  result.extractedText = (ocrText || '').trim();

  // 4. Document / Computer Screen Detection
  // Evidence photos must NOT be computer screens or scanned documents
  const docDetected = isDocumentOrScreen === true || detectDocumentOrScreen(ocrText);
  if (docDetected && photoType !== 'address_proof') {
    const typeLabel = {
      landmark: 'Nearby Landmark',
      street: 'Street Board',
      building: 'Full Building',
      door_selfie: 'Door Number Selfie',
      selfie: 'Live Selfie'
    }[photoType] || 'Evidence photo';

    result.valid = false;
    result.checks.content = { passed: false, message: 'Document or computer screen detected' };
    result.error = `Document or computer screen detected. ${typeLabel} must show the actual outdoor physical subject, not a document or screen.`;
    return result;
  }

  // 5. Type-Specific Validations
  switch (photoType) {
    case 'selfie': {
      // Live Selfie: Full employee face must be clearly visible (no hair-only or partial face)
      if (faceDetected === false) {
        result.valid = false;
        const msg = faceReason === 'hair_only'
          ? 'Hair-only captured. Full face required'
          : faceReason === 'partial_face'
          ? 'Partial face captured. Full face required'
          : 'Employee face not clearly visible';
        result.checks.content = { passed: false, message: msg };
        result.error = 'Employee face is not clearly visible. Full employee face must be clearly visible looking directly at the camera. Partial face or hair-only is not accepted.';
        return result;
      }
      result.checks.content = { passed: true, message: 'Employee face clearly verified' };
      break;
    }

    case 'door_selfie': {
      // Door Number Selfie: BOTH employee face AND door/house number must be clearly visible
      const doorNumbers = extractDoorNumbers(ocrText);
      result.doorNumbersFound = doorNumbers;

      const hasDigitsOrNumber = doorNumbers.length > 0 || /\d+/.test(ocrText);

      // Both missing
      if (faceDetected === false && !hasDigitsOrNumber) {
        result.valid = false;
        result.checks.content = { passed: false, message: 'Both face and door number missing' };
        result.error = 'Door Number Selfie must clearly show BOTH your face and readable door/house number. Partial face or hair-only, or missing number is not accepted.';
        return result;
      }

      // Face missing or hair-only
      if (faceDetected === false) {
        result.valid = false;
        const msg = faceReason === 'hair_only'
          ? 'Hair-only captured. Employee face not visible'
          : faceReason === 'partial_face'
          ? 'Partial face captured. Full face required'
          : 'Employee face is missing from door selfie';
        result.checks.content = { passed: false, message: msg };
        result.error = 'Employee face is not clearly visible in the door selfie. Partial face or hair-only is not accepted. Please position your full face and door number in the camera frame.';
        return result;
      }

      // Door number missing
      if (!hasDigitsOrNumber) {
        result.valid = false;
        result.checks.content = { passed: false, message: 'Door/house number could not be read' };
        result.error = 'Door/house number could not be read. Please retake ensuring the door number is clearly visible beside your face.';
        return result;
      }

      result.checks.content = { passed: true, message: 'Employee face and door number clearly verified' };
      break;
    }

    case 'street': {
      // Street Board: Must NOT accept selfies or person-only photos
      if (faceDetected === true || skinRatio > 0.12) {
        result.valid = false;
        result.checks.content = { passed: false, message: 'Street board not detected (person/selfie in photo)' };
        result.error = 'Street board not detected or street name is not readable. Please retake the photo.';
        return result;
      }

      const lowerText = (ocrText || '').toLowerCase();
      const cleanAlphaNumeric = lowerText.replace(/[^a-z0-9\s]/g, ' ');
      const words = cleanAlphaNumeric.split(/\s+/).filter(w => w.length >= 2);

      const hasStreetKeyword = STREET_KEYWORDS.some(kw => lowerText.includes(kw));
      const hasRoadNumber = /\b\d{1,4}(?:st|nd|rd|th)?\s+(?:cross|main|street|road|st|rd|feet|ft|lane|block|sector|ward)\b/i.test(lowerText) ||
                            /(?:cross|main|street|road|st|rd|lane|block|sector|ward)\s+#?\d{1,4}/i.test(lowerText);

      let matchesHrStreet = false;
      if (hrAddress) {
        const hrTokens = hrAddress.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4);
        matchesHrStreet = hrTokens.some(tok => lowerText.includes(tok));
      }

      // Image clarity alone must NEVER result in PASS.
      // Must have actual readable street words / road name extracted via OCR
      const hasValidStreetText = (hasStreetKeyword && words.length >= 1) ||
                                 hasRoadNumber ||
                                 matchesHrStreet ||
                                 (words.length >= 2 && words.some(w => w.length >= 4));

      if (!hasValidStreetText) {
        result.valid = false;
        result.checks.content = { passed: false, message: 'Street board not detected or street name is not readable' };
        result.error = 'Street board not detected or street name is not readable. Please retake the photo.';
        return result;
      }

      result.checks.content = { passed: true, message: 'Street board name & road text verified' };
      break;
    }

    case 'building': {
      // Full Building: Complete building/house must be clearly visible
      if (faceDetected === true && (faceConfidence > 0.65 || skinRatio > 0.20)) {
        result.valid = false;
        result.checks.content = { passed: false, message: 'Photo appears to be a selfie, not a building' };
        result.error = 'Photo appears to be a selfie, not a building. Please step back to capture the full building.';
        return result;
      }
      if (clientMetrics.buildingFramingScore !== undefined && clientMetrics.buildingFramingScore < 30) {
        result.valid = false;
        result.checks.content = { passed: false, message: 'Building framing is incomplete' };
        result.error = 'Complete building/house is not clearly visible. Please step back to capture the full building.';
        return result;
      }
      result.checks.content = { passed: true, message: 'Full building view verified' };
      break;
    }

    case 'landmark': {
      // Landmark: Must have clear visibility and scene structure
      if (faceDetected === true && (faceConfidence > 0.65 || skinRatio > 0.20)) {
        result.valid = false;
        result.checks.content = { passed: false, message: 'Photo appears to be a selfie, not a landmark' };
        result.error = 'Photo appears to be a selfie, not a landmark. Please capture a clear photo of a prominent nearby landmark.';
        return result;
      }
      result.checks.content = { passed: true, message: 'Nearby landmark view verified' };
      break;
    }
  }

  return result;
}

module.exports = {
  validateImage,
  extractDoorNumbers,
  detectDocumentOrScreen,
  STREET_KEYWORDS,
  DOCUMENT_KEYWORDS
};
