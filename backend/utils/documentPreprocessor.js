const { Jimp } = require('jimp');
const tesseract = require('tesseract.js');

/**
 * Mobile Document Scanner Engine for Address Proof Documents
 *
 * Implements full mobile scanner pipeline:
 * 1. EXIF Orientation Normalization
 * 2. Automatic Document Boundary & Corner Detection (Sobel Gradients & Quadrilateral Envelope)
 * 3. Four-Point Perspective Transformation (Homography Warp with Bilinear Sampling)
 * 4. Automatic Upright Orientation Correction (0°, 90°, 180°, 270° with Keyword & OCR Confidence Scoring)
 * 5. Aspect Ratio Preservation (ISO/IEC 7810 ID-1: ~1.586 : 1 for Aadhaar, DL, Voter ID)
 * 6. Readability Enhancement (Adaptive Dynamic Range Contrast + Laplacian Text Stroke Sharpening)
 * 7. Non-Destructive Archival (Original preserved untouched, enhanced stored separately)
 * 8. Safe Fallback & Retake Notification on detection failure
 */

// ISO/IEC 7810 ID-1 standard aspect ratio (85.60mm / 53.98mm = 1.5858)
const ID1_ASPECT_RATIO = 1.5858;
const TARGET_SCAN_WIDTH = 1600;
const TARGET_SCAN_HEIGHT = Math.round(TARGET_SCAN_WIDTH / ID1_ASPECT_RATIO); // 1009px

// Canonical keywords indicative of upright Indian ID documents
const UPRIGHT_KEYWORDS = [
  'government', 'india', 'aadhaar', 'aadhar', 'uidai',
  'authority', 'male', 'female', 'dob', 'birth',
  'address', 'father', 'husband', 'mother', 'son',
  'daughter', 'care of', 'c/o', 's/o', 'd/o', 'w/o',
  'tamil', 'nadu', 'chennai', 'delhi', 'bangalore',
  'karnataka', 'maharashtra', 'kerala', 'road', 'street',
  'nagar', 'floor', 'enrolment', 'help@uidai', '1947',
  'bharat', 'sarkar', 'identification', 'proof', 'resident',
  'unique'
];

const AADHAAR_NUM_REGEX = /\b\d{4}\s*\d{4}\s*\d{4}\b/;
const DOB_REGEX = /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/;

/**
 * Controlled Laplacian sharpening kernel
 */
const LAPLACIAN_KERNEL = [
  [0, -1, 0],
  [-1, 5, -1],
  [0, -1, 0]
];

/**
 * Check if buffer is an image
 */
function isImageBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 50) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  return false;
}

/**
 * Extract EXIF orientation tag from JPEG buffer
 * Returns 1 (normal) if not found or not JPEG
 */
function getExifOrientation(buf) {
  if (!buf || buf.length < 12 || buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let offset = 2;
  try {
    while (offset < buf.length - 4) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      if (marker === 0xe1) { // APP1 Exif marker
        const length = buf.readUInt16BE(offset + 2);
        const exifHeader = buf.toString('ascii', offset + 4, offset + 8);
        if (exifHeader === 'Exif') {
          const tiffOffset = offset + 10;
          const isBE = buf.toString('ascii', tiffOffset, tiffOffset + 2) === 'MM';
          const readUInt16 = (pos) => isBE ? buf.readUInt16BE(pos) : buf.readUInt16LE(pos);
          const readUInt32 = (pos) => isBE ? buf.readUInt32BE(pos) : buf.readUInt32LE(pos);

          const ifd0Offset = tiffOffset + readUInt32(tiffOffset + 4);
          if (ifd0Offset < buf.length - 2) {
            const numEntries = readUInt16(ifd0Offset);
            for (let i = 0; i < numEntries; i++) {
              const entryOffset = ifd0Offset + 2 + i * 12;
              if (entryOffset + 10 > buf.length) break;
              const tag = readUInt16(entryOffset);
              if (tag === 0x0112) { // Orientation tag
                const orientation = readUInt16(entryOffset + 8);
                if (orientation >= 1 && orientation <= 8) return orientation;
              }
            }
          }
        }
        offset += 2 + length;
      } else if (marker === 0xd9 || marker === 0xda) {
        break; // End of image or start of scan
      } else {
        offset += 2 + buf.readUInt16BE(offset + 2);
      }
    }
  } catch (err) {
    // Non-fatal EXIF parsing error
  }
  return 1;
}

/**
 * Normalize image rotation according to EXIF orientation tag
 */
function normalizeExifOrientation(image, orientation) {
  switch (orientation) {
    case 2:
      image.flip({ horizontal: true, vertical: false });
      break;
    case 3:
      image.rotate(180);
      break;
    case 4:
      image.flip({ horizontal: false, vertical: true });
      break;
    case 5:
      image.rotate(90);
      image.flip({ horizontal: true, vertical: false });
      break;
    case 6:
      image.rotate(90);
      break;
    case 7:
      image.rotate(270);
      image.flip({ horizontal: true, vertical: false });
      break;
    case 8:
      image.rotate(270);
      break;
    default:
      break;
  }
}

/**
 * Detect document boundaries and extract four corners
 * Returns { valid: boolean, corners: Point[], aspectRatio: number, isPortrait: boolean, areaRatio: number }
 */
function detectDocumentCorners(image) {
  const origW = image.bitmap.width;
  const origH = image.bitmap.height;

  // Analysis resolution: width ~500px for speed and noise filtering
  const analysisW = 500;
  const scale = analysisW / origW;
  const analysisH = Math.max(10, Math.round(origH * scale));

  const small = image.clone().resize({ w: analysisW, h: analysisH });
  const data = small.bitmap.data;

  // 1. Grayscale luminance and border background estimation
  const gray = new Float32Array(analysisW * analysisH);
  for (let y = 0; y < analysisH; y++) {
    for (let x = 0; x < analysisW; x++) {
      const idx = (y * analysisW + x) * 4;
      gray[y * analysisW + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  // 2. Sobel Edge Gradient Magnitude
  const edges = new Float32Array(analysisW * analysisH);
  let maxEdge = 0;
  for (let y = 1; y < analysisH - 1; y++) {
    for (let x = 1; x < analysisW - 1; x++) {
      const gx =
        -1 * gray[(y - 1) * analysisW + (x - 1)] + 1 * gray[(y - 1) * analysisW + (x + 1)] +
        -2 * gray[y * analysisW + (x - 1)]       + 2 * gray[y * analysisW + (x + 1)] +
        -1 * gray[(y + 1) * analysisW + (x - 1)] + 1 * gray[(y + 1) * analysisW + (x + 1)];
      const gy =
        -1 * gray[(y - 1) * analysisW + (x - 1)] - 2 * gray[(y - 1) * analysisW + x] - 1 * gray[(y - 1) * analysisW + (x + 1)] +
         1 * gray[(y + 1) * analysisW + (x - 1)] + 2 * gray[(y + 1) * analysisW + x] + 1 * gray[(y + 1) * analysisW + (x + 1)];
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[y * analysisW + x] = mag;
      if (mag > maxEdge) maxEdge = mag;
    }
  }

  // 3. Compute row and column projection profiles
  const colSum = new Float32Array(analysisW);
  const rowSum = new Float32Array(analysisH);
  const edgeThresh = Math.max(22, maxEdge * 0.16);

  const startY = Math.max(1, Math.round(analysisH * 0.02));
  const endY = Math.min(analysisH - 1, Math.round(analysisH * 0.98));
  const startX = Math.max(1, Math.round(analysisW * 0.02));
  const endX = Math.min(analysisW - 1, Math.round(analysisW * 0.98));

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const e = edges[y * analysisW + x];
      if (e > edgeThresh) {
        colSum[x] += e;
        rowSum[y] += e;
      }
    }
  }

  const maxColSum = Math.max(...colSum);
  const maxRowSum = Math.max(...rowSum);

  // If contrast or edge response is too low, detection fails
  if (maxColSum < 100 || maxRowSum < 100) {
    return { valid: false, reason: 'LOW_EDGE_CONTRAST' };
  }

  const colCutoff = maxColSum * 0.18;
  const rowCutoff = maxRowSum * 0.18;

  let minX = 0, maxX = analysisW - 1, minY = 0, maxY = analysisH - 1;
  for (let x = 0; x < analysisW; x++) { if (colSum[x] > colCutoff) { minX = x; break; } }
  for (let x = analysisW - 1; x >= 0; x--) { if (colSum[x] > colCutoff) { maxX = x; break; } }
  for (let y = 0; y < analysisH; y++) { if (rowSum[y] > rowCutoff) { minY = y; break; } }
  for (let y = analysisH - 1; y >= 0; y--) { if (rowSum[y] > rowCutoff) { maxY = y; break; } }

  // 4. Find the 4 extremal corners of the document quadrilateral within the bounding envelope
  let bestTL = { x: minX, y: minY, score: Infinity };
  let bestTR = { x: maxX, y: minY, score: -Infinity };
  let bestBR = { x: maxX, y: maxY, score: -Infinity };
  let bestBL = { x: minX, y: maxY, score: Infinity };

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const e = edges[y * analysisW + x];
      if (e > edgeThresh) {
        // TL minimizes x + y
        if (x + y < bestTL.score) {
          bestTL = { x, y, score: x + y };
        }
        // TR maximizes x - y
        if (x - y > bestTR.score) {
          bestTR = { x, y, score: x - y };
        }
        // BR maximizes x + y
        if (x + y > bestBR.score) {
          bestBR = { x, y, score: x + y };
        }
        // BL minimizes x - y
        if (x - y < bestBL.score) {
          bestBL = { x, y, score: x - y };
        }
      }
    }
  }

  // 5. Scale corners back to original image dimensions
  const corners = [
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestTL.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestTL.y / scale))) },
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestTR.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestTR.y / scale))) },
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestBR.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestBR.y / scale))) },
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestBL.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestBL.y / scale))) }
  ];

  // Calculate geometric properties
  const wTop = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const wBottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  const hLeft = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
  const hRight = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

  const avgW = (wTop + wBottom) / 2;
  const avgH = (hLeft + hRight) / 2;
  const area = avgW * avgH;
  const totalArea = origW * origH;
  const areaRatio = area / (totalArea || 1);

  const longer = Math.max(avgW, avgH);
  const shorter = Math.min(avgW, avgH);
  const aspectRatio = longer / (shorter || 1);

  const isPortrait = avgH > avgW;

  // Validation criteria:
  // - Document must occupy between 10% and 96% of the photo
  // - Aspect ratio must be between 1.15 and 2.30 (standard ID-1 is ~1.586, A4 is ~1.414)
  const isValid = areaRatio >= 0.10 && areaRatio <= 0.96 && aspectRatio >= 1.15 && aspectRatio <= 2.30;

  return {
    valid: isValid,
    reason: isValid ? 'OK' : (areaRatio < 0.10 ? 'DOCUMENT_TOO_SMALL' : (areaRatio > 0.96 ? 'NO_DISTINCT_DOCUMENT' : 'INVALID_ASPECT_RATIO')),
    corners,
    aspectRatio,
    isPortrait,
    areaRatio
  };
}

/**
 * Compute Projective Transform (Homography) Matrix mapping destination [0, 1]^2 to source quadrilateral
 */
function getPerspectiveTransform(srcCorners) {
  const [p0, p1, p2, p3] = srcCorners;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  if (Math.abs(dx3) < 1e-7 && Math.abs(dy3) < 1e-7) {
    return {
      a11: p1.x - p0.x, a12: p2.x - p1.x, a13: p0.x,
      a21: p1.y - p0.y, a22: p2.y - p1.y, a23: p0.y,
      a31: 0, a32: 0
    };
  }
  const det = dx1 * dy2 - dy1 * dx2;
  const a31 = (dx3 * dy2 - dy3 * dx2) / (det || 1e-7);
  const a32 = (dx1 * dy3 - dy1 * dx3) / (det || 1e-7);
  return {
    a11: p1.x - p0.x + a31 * p1.x,
    a12: p3.x - p0.x + a32 * p3.x,
    a13: p0.x,
    a21: p1.y - p0.y + a31 * p1.y,
    a22: p3.y - p0.y + a32 * p3.y,
    a23: p0.y,
    a31, a32
  };
}

/**
 * Four-Point Perspective Transformation (Homography Warp with Bilinear Sampling)
 */
function perspectiveWarp(srcImg, corners, dstW, dstH) {
  const M = getPerspectiveTransform(corners);
  const dstImg = new Jimp({ width: dstW, height: dstH });

  const srcW = srcImg.bitmap.width;
  const srcH = srcImg.bitmap.height;
  const srcData = srcImg.bitmap.data;
  const dstData = dstImg.bitmap.data;

  for (let dy = 0; dy < dstH; dy++) {
    const v = dy / (dstH - 1 || 1);
    for (let dx = 0; dx < dstW; dx++) {
      const u = dx / (dstW - 1 || 1);

      // Homography mapping (u, v) -> (sx, sy)
      const denom = M.a31 * u + M.a32 * v + 1;
      const sx = (M.a11 * u + M.a12 * v + M.a13) / (denom || 1);
      const sy = (M.a21 * u + M.a22 * v + M.a23) / (denom || 1);

      // Bilinear interpolation
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(sx)));
      const x1 = Math.max(0, Math.min(srcW - 1, x0 + 1));
      const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(sy)));
      const y1 = Math.max(0, Math.min(srcH - 1, y0 + 1));

      const fx = sx - x0;
      const fy = sy - y0;

      const idx00 = (y0 * srcW + x0) * 4;
      const idx10 = (y0 * srcW + x1) * 4;
      const idx01 = (y1 * srcW + x0) * 4;
      const idx11 = (y1 * srcW + x1) * 4;

      const dstIdx = (dy * dstW + dx) * 4;
      for (let c = 0; c < 3; c++) {
        const val = (1 - fy) * ((1 - fx) * srcData[idx00 + c] + fx * srcData[idx10 + c]) +
                    fy       * ((1 - fx) * srcData[idx01 + c] + fx * srcData[idx11 + c]);
        dstData[dstIdx + c] = Math.round(val);
      }
      dstData[dstIdx + 3] = 255;
    }
  }

  return dstImg;
}

/**
 * Score OCR text output for upright orientation indicators
 */
function scoreOcrOrientation(text, confidence) {
  if (!text || typeof text !== 'string') return 0;
  const lower = text.toLowerCase();
  let score = typeof confidence === 'number' ? confidence : 0;

  for (const kw of UPRIGHT_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 25;
    }
  }

  if (AADHAAR_NUM_REGEX.test(text)) {
    score += 40;
  }
  if (DOB_REGEX.test(text)) {
    score += 30;
  }

  return score;
}

/**
 * Automatically determine and apply correct upright orientation (0, 90, 180, 270)
 * Uses aspect ratio detection and fast OCR keyword/confidence scoring between candidate orientations.
 */
async function detectUprightOrientation(image) {
  const isPortrait = image.bitmap.height > image.bitmap.width;

  // Candidate rotations to test
  // If card is portrait, candidates are 90 CW and 270 CW (to turn it into landscape).
  // If card is landscape, candidates are 0 and 180.
  const candidateAngles = isPortrait ? [90, 270] : [0, 180];

  let bestAngle = candidateAngles[0];
  let bestScore = -1;

  try {
    for (const angle of candidateAngles) {
      let testImg = image.clone();
      if (angle !== 0) {
        testImg.rotate(angle);
      }
      // Downscale to 600px wide for ultra-fast recognition (~600ms)
      const testScale = 600 / testImg.bitmap.width;
      testImg.resize({ w: 600, h: Math.round(testImg.bitmap.height * testScale) });

      const testBuf = await testImg.getBuffer('image/jpeg', { quality: 75 });
      const ocrRes = await tesseract.recognize(testBuf, 'eng');
      const score = scoreOcrOrientation(ocrRes?.data?.text || '', ocrRes?.data?.confidence || 0);

      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
  } catch (err) {
    // If OCR fails during test, default to 90 for portrait (standard phone sideways capture) or 0 for landscape
    bestAngle = isPortrait ? 90 : 0;
  }

  if (bestAngle !== 0) {
    image.rotate(bestAngle);
  }

  return {
    appliedRotation: bestAngle,
    score: bestScore
  };
}

/**
 * Apply readability enhancement:
 * - Dynamic range contrast stretching
 * - Subtle Laplacian sharpening to enhance faded text strokes without noise explosion
 */
function applyReadabilityEnhancement(image) {
  // 1. Histogram normalization to expand faded contrast range
  image.normalize();

  // 2. Controlled contrast boost (+20%)
  image.contrast(0.20);

  // 3. Laplacian stroke sharpening
  try {
    image.convolute(LAPLACIAN_KERNEL);
  } catch (convErr) {
    // Non-fatal
  }
}

/**
 * Master Intelligent Document Image Preprocessing Engine
 *
 * @param {Buffer} inputBuffer - Original image buffer
 * @param {Object} options - Options { side: 'front' | 'back', documentType: 'Aadhaar Card' }
 * @returns {Promise<{
 *   success: boolean,
 *   originalBuffer: Buffer,
 *   enhancedBuffer: Buffer,
 *   appliedSteps: string[],
 *   corners?: Array<{x: number, y: number}>,
 *   orientation?: number,
 *   width: number,
 *   height: number,
 *   detectionFailed?: boolean,
 *   error?: string
 * }>}
 */
async function preprocessDocumentImage(inputBuffer, options = {}) {
  if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || !isImageBuffer(inputBuffer)) {
    return {
      success: false,
      originalBuffer: inputBuffer,
      enhancedBuffer: inputBuffer,
      appliedSteps: ['skipped_not_image'],
      width: 0,
      height: 0
    };
  }

  const appliedSteps = [];

  try {
    // Step 1: Read image and check EXIF
    const exifOrientation = getExifOrientation(inputBuffer);
    const image = await Jimp.read(inputBuffer);

    if (exifOrientation && exifOrientation !== 1) {
      normalizeExifOrientation(image, exifOrientation);
      appliedSteps.push(`exif_orientation_normalized_${exifOrientation}`);
    }

    // Step 2: Automatic Document Boundary & Corner Detection
    const detection = detectDocumentCorners(image);

    if (!detection.valid) {
      console.warn(`[MOBILE SCANNER] Document boundary detection failed (${detection.reason}). Falling back to safe uncropped enhancement.`);

      // Apply safe contrast, sharpening and scaling on original without cropping
      const fallbackImg = image.clone();
      const fallbackSteps = ['detection_failed_fallback_uncropped'];
      if (options.minDimension && (fallbackImg.bitmap.width < options.minDimension || fallbackImg.bitmap.height < options.minDimension)) {
        const factor = Math.max(options.minDimension / fallbackImg.bitmap.width, options.minDimension / fallbackImg.bitmap.height);
        fallbackImg.resize({ w: Math.round(fallbackImg.bitmap.width * factor), h: Math.round(fallbackImg.bitmap.height * factor) });
        fallbackSteps.push('upscaled_to_min_dimension');
      }
      applyReadabilityEnhancement(fallbackImg);
      fallbackSteps.push('adaptive_contrast_normalized', 'laplacian_sharpened');
      const fallbackBuffer = await fallbackImg.getBuffer('image/jpeg', { quality: 92 });

      return {
        success: false,
        detectionFailed: true,
        error: 'Automatic document boundary detection could not isolate the document. Please ensure the card is placed flat against a contrasting surface without glare and retake the photo.',
        originalBuffer: inputBuffer,
        enhancedBuffer: fallbackBuffer,
        appliedSteps: fallbackSteps,
        width: fallbackImg.bitmap.width,
        height: fallbackImg.bitmap.height
      };
    }

    appliedSteps.push('document_corners_detected_4pt');

    // Step 3: Four-Point Perspective Warp
    // Target dimensions conform to ISO/IEC 7810 ID-1 standard aspect ratio (~1.586 : 1)
    let targetW = TARGET_SCAN_WIDTH;
    let targetH = TARGET_SCAN_HEIGHT;

    // If card was captured vertically in frame, warp to portrait first
    if (detection.isPortrait) {
      targetW = TARGET_SCAN_HEIGHT; // 1009px
      targetH = TARGET_SCAN_WIDTH;  // 1600px
    }

    const warped = perspectiveWarp(image, detection.corners, targetW, targetH);
    appliedSteps.push(`perspective_warped_${targetW}x${targetH}`);

    // Step 4: Automatic Upright Orientation Correction
    const orientRes = await detectUprightOrientation(warped);
    appliedSteps.push(`orientation_corrected_${orientRes.appliedRotation}deg`);

    // Step 5: Readability Enhancement (Contrast + Sharpening)
    applyReadabilityEnhancement(warped);
    appliedSteps.push('adaptive_contrast_laplacian_sharpened');

    // Step 6: Export high-quality enhanced JPEG
    const enhancedBuffer = await warped.getBuffer('image/jpeg', { quality: 92 });

    return {
      success: true,
      detectionFailed: false,
      originalBuffer: inputBuffer,
      enhancedBuffer,
      appliedSteps,
      corners: detection.corners,
      orientation: orientRes.appliedRotation,
      width: warped.bitmap.width,
      height: warped.bitmap.height
    };
  } catch (err) {
    console.error('[MOBILE SCANNER] Preprocessing error:', err);
    return {
      success: false,
      detectionFailed: true,
      error: err.message,
      originalBuffer: inputBuffer,
      enhancedBuffer: inputBuffer,
      appliedSteps: ['error_fallback_to_original'],
      width: 0,
      height: 0
    };
  }
}

module.exports = {
  preprocessDocumentImage,
  detectDocumentCorners,
  perspectiveWarp,
  detectUprightOrientation,
  applyReadabilityEnhancement,
  getExifOrientation,
  normalizeExifOrientation,
  isImageBuffer,
  ID1_ASPECT_RATIO,
  TARGET_SCAN_WIDTH,
  TARGET_SCAN_HEIGHT,
  LAPLACIAN_KERNEL
};
