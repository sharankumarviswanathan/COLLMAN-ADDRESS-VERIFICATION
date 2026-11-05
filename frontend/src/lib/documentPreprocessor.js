/**
 * Client-Side Mobile Document Scanner & Preprocessor
 *
 * Implements real-time canvas-based mobile scanner for Address Proofs:
 * 1. Automatic Document Boundary & Corner Detection (Sobel edge & projection envelope)
 * 2. Four-Point Perspective Transformation (Homography deskewing to flat rectangle)
 * 3. Automatic Orientation Correction (preserves upright text, no sideways cards)
 * 4. Aspect Ratio Preservation (ISO/IEC 7810 ID-1: ~1.586 : 1)
 * 5. Adaptive Contrast & Histogram Stretching
 * 6. Text Stroke Sharpening (Laplacian 3x3 convolution)
 */

const ID1_ASPECT_RATIO = 1.5858;
const TARGET_SCAN_WIDTH = 1400;
const TARGET_SCAN_HEIGHT = Math.round(TARGET_SCAN_WIDTH / ID1_ASPECT_RATIO); // 883px

const LAPLACIAN_SHARPEN_KERNEL = [
  0, -1, 0,
  -1, 5, -1,
  0, -1, 0
];

/**
 * Apply 3x3 convolution to ImageData
 */
function applyConvolution(ctx, width, height, kernel) {
  const src = ctx.getImageData(0, 0, width, height);
  const srcData = src.data;
  const output = ctx.createImageData(width, height);
  const dstData = output.data;

  const kw = 3;
  const halfKw = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;

      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        dstData[dstIdx] = srcData[dstIdx];
        dstData[dstIdx + 1] = srcData[dstIdx + 1];
        dstData[dstIdx + 2] = srcData[dstIdx + 2];
        dstData[dstIdx + 3] = srcData[dstIdx + 3];
        continue;
      }

      let r = 0, g = 0, b = 0;
      for (let ky = -halfKw; ky <= halfKw; ky++) {
        for (let kx = -halfKw; kx <= halfKw; kx++) {
          const pxIdx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[(ky + halfKw) * kw + (kx + halfKw)];
          r += srcData[pxIdx] * weight;
          g += srcData[pxIdx + 1] * weight;
          b += srcData[pxIdx + 2] * weight;
        }
      }

      dstData[dstIdx] = Math.min(255, Math.max(0, Math.round(r)));
      dstData[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      dstData[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      dstData[dstIdx + 3] = 255;
    }
  }

  ctx.putImageData(output, 0, 0);
}

/**
 * Adaptive histogram normalization and contrast boost
 */
function applyAdaptiveContrastAndBrightness(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const numPixels = width * height;

  let minLum = 255;
  let maxLum = 0;
  let totalLum = 0;

  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLum += lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const avgLum = totalLum / numPixels;
  const range = maxLum - minLum;
  const shouldStretch = range > 20 && range < 220;
  const contrastFactor = 1.20;
  const intercept = 128 * (1 - contrastFactor);
  const brightnessBoost = avgLum < 110 ? Math.min(30, (128 - avgLum) * 0.4) : 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    let r = data[idx];
    let g = data[idx + 1];
    let b = data[idx + 2];

    if (shouldStretch) {
      r = ((r - minLum) / range) * 255;
      g = ((g - minLum) / range) * 255;
      b = ((b - minLum) / range) * 255;
    }

    r = r * contrastFactor + intercept + brightnessBoost;
    g = g * contrastFactor + intercept + brightnessBoost;
    b = b * contrastFactor + intercept + brightnessBoost;

    data[idx] = Math.min(255, Math.max(0, Math.round(r)));
    data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
    data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Detect document corners on canvas
 */
function detectDocumentCornersOnCanvas(canvas) {
  const origW = canvas.width;
  const origH = canvas.height;

  // Downsample to width 400 for fast edge detection
  const analysisW = 400;
  const scale = analysisW / origW;
  const analysisH = Math.max(10, Math.round(origH * scale));

  const off = document.createElement('canvas');
  off.width = analysisW;
  off.height = analysisH;
  const octx = off.getContext('2d');
  octx.drawImage(canvas, 0, 0, analysisW, analysisH);

  const imgData = octx.getImageData(0, 0, analysisW, analysisH).data;
  const gray = new Float32Array(analysisW * analysisH);
  for (let y = 0; y < analysisH; y++) {
    for (let x = 0; x < analysisW; x++) {
      const idx = (y * analysisW + x) * 4;
      gray[y * analysisW + x] = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
    }
  }

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

  const colSum = new Float32Array(analysisW);
  const rowSum = new Float32Array(analysisH);
  const edgeThresh = Math.max(20, maxEdge * 0.16);

  const startY = Math.round(analysisH * 0.02);
  const endY = Math.round(analysisH * 0.98);
  const startX = Math.round(analysisW * 0.02);
  const endX = Math.round(analysisW * 0.98);

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
  if (maxColSum < 80 || maxRowSum < 80) {
    return { valid: false, reason: 'LOW_CONTRAST' };
  }

  const colCutoff = maxColSum * 0.18;
  const rowCutoff = maxRowSum * 0.18;

  let minX = 0, maxX = analysisW - 1, minY = 0, maxY = analysisH - 1;
  for (let x = 0; x < analysisW; x++) { if (colSum[x] > colCutoff) { minX = x; break; } }
  for (let x = analysisW - 1; x >= 0; x--) { if (colSum[x] > colCutoff) { maxX = x; break; } }
  for (let y = 0; y < analysisH; y++) { if (rowSum[y] > rowCutoff) { minY = y; break; } }
  for (let y = analysisH - 1; y >= 0; y--) { if (rowSum[y] > rowCutoff) { maxY = y; break; } }

  let bestTL = { x: minX, y: minY, score: Infinity };
  let bestTR = { x: maxX, y: minY, score: -Infinity };
  let bestBR = { x: maxX, y: maxY, score: -Infinity };
  let bestBL = { x: minX, y: maxY, score: Infinity };

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const e = edges[y * analysisW + x];
      if (e > edgeThresh) {
        if (x + y < bestTL.score) bestTL = { x, y, score: x + y };
        if (x - y > bestTR.score) bestTR = { x, y, score: x - y };
        if (x + y > bestBR.score) bestBR = { x, y, score: x + y };
        if (x - y < bestBL.score) bestBL = { x, y, score: x - y };
      }
    }
  }

  const corners = [
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestTL.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestTL.y / scale))) },
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestTR.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestTR.y / scale))) },
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestBR.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestBR.y / scale))) },
    { x: Math.max(0, Math.min(origW - 1, Math.round(bestBL.x / scale))), y: Math.max(0, Math.min(origH - 1, Math.round(bestBL.y / scale))) }
  ];

  const wTop = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const wBottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  const hLeft = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
  const hRight = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

  const avgW = (wTop + wBottom) / 2;
  const avgH = (hLeft + hRight) / 2;
  const areaRatio = (avgW * avgH) / (origW * origH || 1);
  const longer = Math.max(avgW, avgH);
  const shorter = Math.min(avgW, avgH);
  const aspectRatio = longer / (shorter || 1);

  const isValid = areaRatio >= 0.10 && areaRatio <= 0.96 && aspectRatio >= 1.15 && aspectRatio <= 2.30;
  return {
    valid: isValid,
    corners,
    isPortrait: avgH > avgW,
    aspectRatio
  };
}

/**
 * 4-Point Perspective Warp on Canvas with Bilinear Sampling
 */
function perspectiveWarpCanvas(srcCanvas, corners, dstW, dstH) {
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let a11, a12, a13, a21, a22, a23, a31, a32;
  if (Math.abs(dx3) < 1e-7 && Math.abs(dy3) < 1e-7) {
    a11 = p1.x - p0.x; a12 = p2.x - p1.x; a13 = p0.x;
    a21 = p1.y - p0.y; a22 = p2.y - p1.y; a23 = p0.y;
    a31 = 0; a32 = 0;
  } else {
    const det = dx1 * dy2 - dy1 * dx2;
    a31 = (dx3 * dy2 - dy3 * dx2) / (det || 1e-7);
    a32 = (dx1 * dy3 - dy1 * dx3) / (det || 1e-7);
    a11 = p1.x - p0.x + a31 * p1.x;
    a12 = p3.x - p0.x + a32 * p3.x;
    a13 = p0.x;
    a21 = p1.y - p0.y + a31 * p1.y;
    a22 = p3.y - p0.y + a32 * p3.y;
    a23 = p0.y;
  }

  const sctx = srcCanvas.getContext('2d');
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  const srcData = sctx.getImageData(0, 0, srcW, srcH).data;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dctx = dstCanvas.getContext('2d');
  const dstImgData = dctx.createImageData(dstW, dstH);
  const dstData = dstImgData.data;

  for (let dy = 0; dy < dstH; dy++) {
    const v = dy / (dstH - 1 || 1);
    for (let dx = 0; dx < dstW; dx++) {
      const u = dx / (dstW - 1 || 1);

      const denom = a31 * u + a32 * v + 1;
      const sx = (a11 * u + a12 * v + a13) / (denom || 1);
      const sy = (a21 * u + a22 * v + a23) / (denom || 1);

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

  dctx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

/**
 * Rotate canvas 90 degrees clockwise
 */
function rotateCanvas90(canvas) {
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = canvas.height;
  rotCanvas.height = canvas.width;
  const ctx = rotCanvas.getContext('2d');
  ctx.translate(rotCanvas.width, 0);
  ctx.rotate(90 * Math.PI / 180);
  ctx.drawImage(canvas, 0, 0);
  return rotCanvas;
}

/**
 * Preprocess document image client-side with document scanning
 */
export async function preprocessDocumentClientSide(imageSource, options = {}) {
  let img;
  let originalUrl = '';

  if (typeof imageSource === 'string') {
    originalUrl = imageSource;
    img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageSource;
    });
  } else if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
    originalUrl = img.src;
  } else {
    throw new Error('Unsupported image source for preprocessing');
  }

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Draw original to full canvas
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = origW;
  srcCanvas.height = origH;
  const sctx = srcCanvas.getContext('2d');
  sctx.drawImage(img, 0, 0);

  const steps = [];

  // 1. Detect Document Boundaries
  const detection = detectDocumentCornersOnCanvas(srcCanvas);
  let finalCanvas;

  if (detection.valid) {
    steps.push('document_detected_4pt');

    // Warp to ID-1 target dimensions
    let targetW = TARGET_SCAN_WIDTH;
    let targetH = TARGET_SCAN_HEIGHT;
    if (detection.isPortrait) {
      targetW = TARGET_SCAN_HEIGHT;
      targetH = TARGET_SCAN_WIDTH;
    }

    let warped = perspectiveWarpCanvas(srcCanvas, detection.corners, targetW, targetH);
    steps.push(`perspective_warped_${targetW}x${targetH}`);

    // If card is portrait, auto-rotate 90 degrees to landscape
    if (detection.isPortrait) {
      warped = rotateCanvas90(warped);
      steps.push('rotated_90deg_landscape');
    }

    finalCanvas = warped;
  } else {
    // If detection failed, keep original without destructive crop
    steps.push('boundary_detection_fallback_uncropped');
    finalCanvas = srcCanvas;
  }

  // 2. Readability enhancements (Contrast + Sharpening)
  const fctx = finalCanvas.getContext('2d', { willReadFrequently: true });
  applyAdaptiveContrastAndBrightness(fctx, finalCanvas.width, finalCanvas.height);
  steps.push('adaptive_contrast');

  applyConvolution(fctx, finalCanvas.width, finalCanvas.height, LAPLACIAN_SHARPEN_KERNEL);
  steps.push('laplacian_sharpened');

  const enhancedUrl = finalCanvas.toDataURL('image/jpeg', 0.92);

  return {
    originalUrl,
    enhancedUrl,
    detectionSuccess: detection.valid,
    detectionWarning: detection.valid ? null : 'Automatic document boundary detection could not clearly isolate the document. Please ensure the card is placed flat on a contrasting background.',
    isPortrait: detection.isPortrait,
    width: finalCanvas.width,
    height: finalCanvas.height,
    steps
  };
}
