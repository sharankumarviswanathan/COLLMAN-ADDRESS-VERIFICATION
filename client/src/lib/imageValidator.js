/**
 * Client-Side Real-Time Image Quality & Content Validator
 * Analyzes image clarity, blur (Laplacian variance), lighting, contrast,
 * face presence (rejecting hair-only and partial face), and text/door number features.
 * Strictly enforces validation rules with zero employee manual bypasses.
 */

/**
 * Computes luminance of an RGB pixel using ITU-R BT.709
 */
function getLuminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Check if an RGB color falls into human skin tone chrominance ranges (RGB + YCbCr)
 * Covers diverse skin complexions (fair, wheatish, dark, Indian, etc.)
 */
function isSkinTone(r, g, b) {
  // 1. Basic RGB range & color dominance
  if (r <= 45 || g <= 30 || b <= 15) return false;
  if (r <= g || r <= b) return false;
  if (Math.abs(r - g) <= 12) return false;

  // 2. YCbCr color space conversion
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  // Standard skin tone cluster
  const isYCbCrSkin = (cb >= 75 && cb <= 135 && cr >= 130 && cr <= 180 && y >= 32 && y <= 245);
  return isYCbCrSkin || (r > 80 && g > 40 && b > 25 && r > g && g > b && (r - g) >= 15);
}

/**
 * Check if an RGB pixel is dark hair (black/dark-brown hair)
 */
function isDarkHair(r, g, b) {
  const max = Math.max(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 58 && max < 75 && !isSkinTone(r, g, b);
}

/**
 * Analyze raw canvas pixel data for blur (Laplacian variance), lighting, and contrast
 */
function analyzeCanvasPixels(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const numPixels = width * height;

  let totalLuminance = 0;
  let darkPixelCount = 0;
  let overexposedPixelCount = 0;
  let skinPixelCount = 0;
  let hairPixelCount = 0;
  let paperPixelCount = 0;

  // Grayscale buffer for Laplacian convolution
  const gray = new Float32Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = getLuminance(r, g, b);
    gray[i] = lum;
    totalLuminance += lum;

    if (lum < 28) darkPixelCount++;
    if (lum > 240) overexposedPixelCount++;
    if (isSkinTone(r, g, b)) skinPixelCount++;
    if (isDarkHair(r, g, b)) hairPixelCount++;
    // Flat near-white / neutral light paper or screen pixel
    if (lum >= 180 && Math.abs(r - g) < 25 && Math.abs(r - b) < 25 && Math.abs(g - b) < 25) {
      paperPixelCount++;
    }
  }

  const meanLuminance = totalLuminance / numPixels;

  // Compute standard deviation (contrast)
  let varianceSum = 0;
  for (let i = 0; i < numPixels; i++) {
    const diff = gray[i] - meanLuminance;
    varianceSum += diff * diff;
  }
  const contrastStdDev = Math.sqrt(varianceSum / numPixels);

  // Laplacian kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
  // Downsample grid for blur variance calculation to maintain high performance
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let edgeCount = 0;
  const step = 2;

  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const idx = y * width + x;
      const val =
        gray[idx - width] +
        gray[idx + width] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];

      laplacianSum += val;
      laplacianSqSum += val * val;
      edgeCount++;
    }
  }

  const laplacianMean = laplacianSum / edgeCount;
  const laplacianVariance = laplacianSqSum / edgeCount - laplacianMean * laplacianMean;
  const blurScore = Math.min(100, Math.max(0, Math.round(laplacianVariance * 0.45)));

  return {
    blurScore,
    laplacianVariance,
    brightness: Math.round(meanLuminance),
    contrast: Math.round(contrastStdDev),
    darkRatio: darkPixelCount / numPixels,
    overexposedRatio: overexposedPixelCount / numPixels,
    skinRatio: skinPixelCount / numPixels,
    hairRatio: hairPixelCount / numPixels,
    paperBackgroundRatio: paperPixelCount / numPixels
  };
}

/**
 * Detect face presence using browser Shape Detection API or multi-sector geometric skin/hair analysis.
 * Strictly flags hair-only shots and partial face crops.
 */
async function detectFace(canvas) {
  const w = canvas.width;
  const h = canvas.height;

  // 1. Check native FaceDetector API if supported
  if ('FaceDetector' in window) {
    try {
      const detector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 3 });
      const faces = await detector.detect(canvas);
      if (faces && faces.length > 0) {
        // Filter out microscopic detections or extreme border slivers
        const validFaces = faces.filter(f => {
          const box = f.boundingBox;
          const areaRatio = (box.width * box.height) / (w * h);
          if (areaRatio < 0.035 || box.width < 45 || box.height < 45) return false;
          // Must not be clipped off at extreme boundary
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          if (centerX < 25 || centerX > w - 25 || centerY < 25 || centerY > h - 25) return false;
          return true;
        });

        if (validFaces.length > 0) {
          return { detected: true, count: validFaces.length, confidence: 0.95 };
        }
      }
    } catch (e) {
      // Fallback to geometric canvas pixel analysis
    }
  }

  // 2. Geometric & Color Analysis: Scan Candidate Sectors (Left, Center, Right)
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const sectors = [
    { name: 'center', x: Math.floor(w * 0.20), w: Math.floor(w * 0.60) },
    { name: 'left',   x: Math.floor(w * 0.05), w: Math.floor(w * 0.55) },
    { name: 'right',  x: Math.floor(w * 0.40), w: Math.floor(w * 0.55) }
  ];

  let foundFace = false;
  let hairOnlyDetected = false;
  let partialFaceDetected = false;
  let maxConfidence = 0;

  for (const sector of sectors) {
    const sx = sector.x;
    const sy = Math.floor(h * 0.10);
    const sw = sector.w;
    const sh = Math.floor(h * 0.80);

    const imgData = ctx.getImageData(sx, sy, sw, sh);
    const data = imgData.data;

    // Divide candidate region into 3 vertical tiers
    // Tier 0: Upper 33% (forehead, hairline)
    // Tier 1: Middle 34% (eyes, nose, cheeks) - ESSENTIAL FOR A REAL FACE
    // Tier 2: Lower 33% (mouth, chin)
    const tierH = Math.floor(sh / 3);
    const tierSkinCounts = [0, 0, 0];
    const tierHairCounts = [0, 0, 0];
    const tierTotalPixels = [0, 0, 0];

    for (let py = 0; py < sh; py++) {
      const tier = py < tierH ? 0 : (py < tierH * 2 ? 1 : 2);
      for (let px = 0; px < sw; px++) {
        const idx = (py * sw + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        tierTotalPixels[tier]++;
        if (isSkinTone(r, g, b)) tierSkinCounts[tier]++;
        if (isDarkHair(r, g, b)) tierHairCounts[tier]++;
      }
    }

    const t0Skin = tierSkinCounts[0] / Math.max(1, tierTotalPixels[0]);
    const t1Skin = tierSkinCounts[1] / Math.max(1, tierTotalPixels[1]);
    const t2Skin = tierSkinCounts[2] / Math.max(1, tierTotalPixels[2]);

    const t0Hair = tierHairCounts[0] / Math.max(1, tierTotalPixels[0]);
    const t1Hair = tierHairCounts[1] / Math.max(1, tierTotalPixels[1]);
    const t2Hair = tierHairCounts[2] / Math.max(1, tierTotalPixels[2]);

    const totalSkin = (tierSkinCounts[0] + tierSkinCounts[1] + tierSkinCounts[2]) / Math.max(1, sw * sh);
    const totalHair = (tierHairCounts[0] + tierHairCounts[1] + tierHairCounts[2]) / Math.max(1, sw * sh);

    // HAIR-ONLY CHECK:
    // When the employee only shows the top of their head/hair (or hair peeking in),
    // hair dominates (>28%) while the mid-face tier (eyes/nose/cheeks) has virtually NO skin tone (<4%)
    if ((totalHair > 0.28 || t1Hair > 0.35 || t2Hair > 0.35) && t1Skin < 0.045 && totalSkin < 0.06) {
      hairOnlyDetected = true;
      continue;
    }

    // PARTIAL FACE CHECK:
    // If skin tone exists in ONLY one tier (e.g. only forehead top or only chin bottom) while mid-face is empty
    const tiersWithSkin = [t0Skin > 0.05, t1Skin > 0.05, t2Skin > 0.05].filter(Boolean).length;
    if (tiersWithSkin === 1 && t1Skin < 0.05 && totalSkin > 0.04) {
      partialFaceDetected = true;
      continue;
    }

    // VALID FULL FACE REQUIREMENTS:
    // 1. Mid-face tier (eyes/cheeks/nose) MUST have healthy skin tone (>= 7.5%)
    // 2. At least 2 tiers have skin tone >= 5%
    // 3. Overall skin tone in candidate box is between 8% and 85%
    if (t1Skin >= 0.075 && tiersWithSkin >= 2 && totalSkin >= 0.08 && totalSkin <= 0.85) {
      foundFace = true;
      maxConfidence = Math.max(maxConfidence, 0.85);
      break;
    }
  }

  if (foundFace) {
    return { detected: true, confidence: maxConfidence, count: 1 };
  }

  if (hairOnlyDetected) {
    return { detected: false, reason: 'hair_only', confidence: 0 };
  }

  if (partialFaceDetected) {
    return { detected: false, reason: 'partial_face', confidence: 0 };
  }

  return { detected: false, reason: 'no_face', confidence: 0 };
}

/**
 * Check if canvas contains high-contrast text strokes characteristic of signs / doorplates / door numbers.
 * Excludes hair-dominated cells so hair edges NEVER produce false positive text detections.
 */
function analyzeTextStrokeFeatures(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Grid for localized text region analysis (8 cols x 6 rows)
  const cols = 8;
  const rows = 6;
  const cellW = Math.floor(w / cols);
  const cellH = Math.floor(h / rows);
  const cellEdgeCounts = new Array(cols * rows).fill(0);
  const cellHairCounts = new Array(cols * rows).fill(0);
  const cellSampleCounts = new Array(cols * rows).fill(0);

  let totalCleanEdgePoints = 0;
  let totalCleanSamplePoints = 0;
  const step = 2;

  for (let y = 10; y < h - 10; y += step) {
    const rowIdx = Math.min(rows - 1, Math.floor(y / cellH));
    for (let x = 10; x < w - 10; x += step) {
      const colIdx = Math.min(cols - 1, Math.floor(x / cellW));
      const cellIdx = rowIdx * cols + colIdx;

      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lumCenter = getLuminance(r, g, b);

      if (isDarkHair(r, g, b)) {
        cellHairCounts[cellIdx]++;
      }

      // Horizontal gradient
      const idxRight = (y * w + (x + 2)) * 4;
      const lumRight = getLuminance(data[idxRight], data[idxRight + 1], data[idxRight + 2]);
      const diffX = Math.abs(lumCenter - lumRight);

      // Vertical gradient
      const idxDown = ((y + 2) * w + x) * 4;
      const lumDown = getLuminance(data[idxDown], data[idxDown + 1], data[idxDown + 2]);
      const diffY = Math.abs(lumCenter - lumDown);

      // Text stroke detection
      const isStrokeEdge = (diffX > 28 || diffY > 28 || (diffX + diffY) > 40);

      if (isStrokeEdge) {
        cellEdgeCounts[cellIdx]++;
      }
      cellSampleCounts[cellIdx]++;
    }
  }

  // Calculate clean text density excluding cells dominated by hair
  let maxCellDensity = 0;
  let validTextCells = 0;

  for (let i = 0; i < cols * rows; i++) {
    if (cellSampleCounts[i] > 0) {
      const hairRatio = cellHairCounts[i] / cellSampleCounts[i];
      // Skip cells where hair dominates, as hair edges are not alphanumeric text
      if (hairRatio > 0.35) continue;

      const density = cellEdgeCounts[i] / cellSampleCounts[i];
      totalCleanEdgePoints += cellEdgeCounts[i];
      totalCleanSamplePoints += cellSampleCounts[i];

      if (density > 0.018) validTextCells++;
      if (density > maxCellDensity) {
        maxCellDensity = density;
      }
    }
  }

  const globalCleanEdgeRatio = totalCleanSamplePoints > 0 ? totalCleanEdgePoints / totalCleanSamplePoints : 0;

  // Door number / sign detection:
  // Requires clean localized stroke density in at least one non-hair cell >= 2.0%
  // OR at least 2 non-hair cells with >= 1.8% density
  // OR substantial clean edge points >= 90
  const hasTextFeatures = (maxCellDensity >= 0.020) || (validTextCells >= 2) || (totalCleanEdgePoints >= 90);

  return {
    textFeatureScore: Math.min(100, Math.round(maxCellDensity * 500)),
    maxCellDensity,
    globalCleanEdgeRatio,
    totalCleanEdgePoints,
    hasTextFeatures
  };
}

/**
 * Main Client-Side Validation Function
 * Automatically validates required content, image clarity, visibility, lighting,
 * readable text/number, and employee face.
 * Strictly enforces validation rules; manual override is completely impossible.
 *
 * @param {string} dataUrl - Image data URL
 * @param {string} photoType - 'landmark' | 'street' | 'building' | 'door_selfie' | 'selfie' | 'document'
 * @param {string} hrAddress - Employee HR reference address
 * @returns {Promise<Object>} Validation report
 */
export async function validatePhotoInBrowser(dataUrl, photoType, hrAddress = '') {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const targetWidth = 640;
        const targetHeight = Math.round((img.height / img.width) * targetWidth);
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // 1. Analyze pixels for clarity, blur, lighting, contrast
        const metrics = analyzeCanvasPixels(ctx, targetWidth, targetHeight);

        // 2. Face Detection
        let faceResult = { detected: null };
        if (photoType === 'selfie' || photoType === 'door_selfie' || photoType === 'building' || photoType === 'landmark' || photoType === 'street') {
          faceResult = await detectFace(canvas);
        }

        // 3. Text & edge features (analyzed for all photos to assist document/screen & sign detection)
        const textFeatures = analyzeTextStrokeFeatures(canvas);

        // Detect document, computer monitor, or scanned form
        const isDocumentOrScreen =
          (metrics.paperBackgroundRatio > 0.45 && textFeatures.totalCleanEdgePoints > 50) ||
          (metrics.paperBackgroundRatio > 0.70);

        const report = {
          valid: true,
          score: 90,
          error: null,
          checks: {
            clarity: { passed: true, message: 'Clarity & focus are sharp' },
            lighting: { passed: true, message: 'Lighting is balanced' },
            visibility: { passed: true, message: 'Image visibility is clear' },
            content: { passed: true, message: 'Content meets required criteria' }
          },
          metrics: {
            ...metrics,
            faceDetected: faceResult.detected,
            faceReason: faceResult.reason || null,
            faceConfidence: faceResult.confidence || 0,
            hasTextFeatures: textFeatures.hasTextFeatures,
            isDocumentOrScreen
          }
        };

        // EVALUATION: Blur / Clarity
        if (metrics.blurScore < 20) {
          report.valid = false;
          report.checks.clarity = { passed: false, message: 'Image is blurry or unfocused' };
          report.error = 'Image is not clear. Please hold your camera steady and retake the photo.';
          return resolve(report);
        }

        // EVALUATION: Lighting
        if (metrics.brightness < 32) {
          report.valid = false;
          report.checks.lighting = { passed: false, message: 'Lighting is too dark' };
          report.error = 'Image is too dark. Please retake in a well-lit area.';
          return resolve(report);
        }
        if (metrics.brightness > 236 || metrics.overexposedRatio > 0.40) {
          report.valid = false;
          report.checks.lighting = { passed: false, message: 'Image is overexposed / too bright' };
          report.error = 'Image is overexposed. Please retake in softer lighting.';
          return resolve(report);
        }

        // EVALUATION: Visibility & Contrast
        if (metrics.contrast < 15) {
          report.valid = false;
          report.checks.visibility = { passed: false, message: 'Low contrast / washed out image' };
          report.error = 'Image contrast is too low. Please retake the photo.';
          return resolve(report);
        }

        // EVALUATION: Document or Computer Screen Rejection
        if (isDocumentOrScreen && photoType !== 'document' && photoType !== 'address_proof') {
          const typeLabel = {
            landmark: 'Nearby Landmark',
            street: 'Street Board',
            building: 'Full Building',
            door_selfie: 'Door Number Selfie',
            selfie: 'Live Selfie'
          }[photoType] || 'Evidence photo';

          report.valid = false;
          report.checks.content = { passed: false, message: 'Document or computer screen detected' };
          report.error = `Document or screen detected. ${typeLabel} must show the actual outdoor physical subject, not a document or computer screen.`;
          return resolve(report);
        }

        // MANDATORY CONTENT EVALUATION PER PHOTO TYPE
        if (photoType === 'door_selfie') {
          const facePassed = faceResult.detected === true;
          const textPassed = Boolean(textFeatures.hasTextFeatures);

          if (!facePassed && !textPassed) {
            report.valid = false;
            report.checks.content = { passed: false, message: 'Both face and door number missing' };
            report.error = 'Door Number Selfie must clearly show BOTH your face and readable door/house number. Partial face, hair-only, or missing number is not accepted.';
            return resolve(report);
          }

          if (!facePassed) {
            report.valid = false;
            const faceMsg = faceResult.reason === 'hair_only'
              ? 'Hair-only captured. Employee face not visible'
              : faceResult.reason === 'partial_face'
              ? 'Partial face captured. Full face required'
              : 'Employee face not detected';
            report.checks.content = { passed: false, message: faceMsg };
            report.error = 'Employee face is not clearly visible in the door selfie. Partial face or hair-only is not accepted. Please position your full face and door number in the camera frame.';
            return resolve(report);
          }

          if (!textPassed) {
            report.valid = false;
            report.checks.content = { passed: false, message: 'Door/house number could not be read' };
            report.error = 'Door/house number could not be read. Please retake ensuring the door number is clearly visible beside your face.';
            return resolve(report);
          }

          report.checks.content = { passed: true, message: 'Face and door number clearly verified' };

        } else if (photoType === 'selfie') {
          if (faceResult.detected === false) {
            report.valid = false;
            const faceMsg = faceResult.reason === 'hair_only'
              ? 'Hair-only captured. Full face required'
              : faceResult.reason === 'partial_face'
              ? 'Partial face captured. Full face required'
              : 'Employee face not detected';
            report.checks.content = { passed: false, message: faceMsg };
            report.error = 'Employee face is not clearly visible. Full employee face must be clearly visible looking directly at the camera. Partial face or hair-only is not accepted.';
            return resolve(report);
          }
          report.checks.content = { passed: true, message: 'Employee face clearly verified' };

        } else if (photoType === 'street') {
          // 1. Reject selfies or person-only photos
          if (faceResult.detected === true || metrics.skinRatio > 0.12) {
            report.valid = false;
            report.checks.content = { passed: false, message: 'Street board not detected (person/selfie in frame)' };
            report.error = 'Street board not detected or street name is not readable. Please retake the photo.';
            return resolve(report);
          }

          // 2. Reject photos without street sign board text strokes
          if (!textFeatures.hasTextFeatures || textFeatures.totalCleanEdgePoints < 60) {
            report.valid = false;
            report.checks.content = { passed: false, message: 'Street board not detected or street name is not readable' };
            report.error = 'Street board not detected or street name is not readable. Please retake the photo.';
            return resolve(report);
          }
          report.checks.content = { passed: true, message: 'Street sign/text clearly verified' };

        } else if (photoType === 'building') {
          if (faceResult.detected === true && (faceResult.confidence > 0.65 || metrics.skinRatio > 0.18)) {
            report.valid = false;
            report.checks.content = { passed: false, message: 'Photo is a selfie, not a building' };
            report.error = 'Complete building/house is not clearly visible. Please step back to capture the full building, not a selfie.';
            return resolve(report);
          }
          report.checks.content = { passed: true, message: 'Building view verified' };

        } else if (photoType === 'landmark') {
          if (faceResult.detected === true && (faceResult.confidence > 0.65 || metrics.skinRatio > 0.18)) {
            report.valid = false;
            report.checks.content = { passed: false, message: 'Photo is a selfie, not a landmark' };
            report.error = 'Please capture a clear photo of a prominent nearby landmark, not a selfie.';
            return resolve(report);
          }
          report.checks.content = { passed: true, message: 'Landmark view verified' };
        }

        resolve(report);
      } catch (err) {
        console.error('Canvas validation error:', err);
        // Fail-closed: Never permit an unverified image to proceed
        resolve({
          valid: false,
          score: 0,
          error: 'Image analysis could not verify photo quality. Please retake the photo.',
          checks: {
            clarity: { passed: false, message: 'Analysis failed' },
            lighting: { passed: false, message: 'Analysis failed' },
            visibility: { passed: false, message: 'Analysis failed' },
            content: { passed: false, message: 'Analysis failed' }
          },
          metrics: {}
        });
      }
    };

    img.onerror = () => {
      resolve({
        valid: false,
        score: 0,
        error: 'Failed to read image data for validation. Please retake.',
        checks: {
          clarity: { passed: false, message: 'Image load failed' },
          lighting: { passed: false, message: 'Image load failed' },
          visibility: { passed: false, message: 'Image load failed' },
          content: { passed: false, message: 'Image load failed' }
        },
        metrics: {}
      });
    };

    img.src = dataUrl;
  });
}

