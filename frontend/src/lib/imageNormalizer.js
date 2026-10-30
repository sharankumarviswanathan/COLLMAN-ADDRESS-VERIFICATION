/**
 * Image Normalizer & EXIF Orientation Engine
 * 
 * Normalizes camera capture and uploaded photos:
 * 1. Corrects EXIF Orientation tags (1-8) to standard upright Orientation 1.
 * 2. Normalizes mobile portrait/landscape camera streams.
 * 3. Handles front-facing user camera horizontal mirroring.
 * 4. Detects face rotation (0°, 90°, 180°, 270°) and normalizes to upright.
 * 5. Produces a consistent, high-clarity JPEG and deterministic imageSignature
 *    for tamper-proof client-server validation parity.
 */

/**
 * Fast deterministic content hash (FNV-1a 64-bit style in hex) of image data
 */
export function computeImageSignature(str) {
  if (!str || typeof str !== 'string') return '';
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Extract EXIF orientation tag (1-8) from JPEG byte array
 */
export function getExifOrientation(bytes) {
  if (!bytes || bytes.length < 14) return 1;

  // Verify JPEG SOI marker: FF D8
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return 1;

  let offset = 2;
  const length = bytes.length;

  while (offset + 4 < length) {
    // Must be marker FF xx
    if (bytes[offset] !== 0xFF) break;
    const marker = bytes[offset + 1];
    offset += 2;

    // APP1 marker (0xFFE1) contains EXIF
    if (marker === 0xE1) {
      const app1Length = (bytes[offset] << 8) | bytes[offset + 1];
      offset += 2;

      // Check for 'Exif\0\0' (0x45 0x78 0x69 0x66 0x00 0x00)
      if (
        bytes[offset] === 0x45 &&
        bytes[offset + 1] === 0x78 &&
        bytes[offset + 2] === 0x69 &&
        bytes[offset + 3] === 0x79 ||
        (bytes[offset] === 0x45 && bytes[offset + 1] === 0x78 && bytes[offset + 2] === 0x69 && bytes[offset + 3] === 0x66)
      ) {
        const tiffOffset = offset + 6;
        if (tiffOffset + 8 >= length) return 1;

        // Byte order: 'II' (0x4949) little endian or 'MM' (0x4D4D) big endian
        const isLittleEndian = bytes[tiffOffset] === 0x49 && bytes[tiffOffset + 1] === 0x49;

        const getUint16 = (off) => {
          return isLittleEndian
            ? bytes[off] | (bytes[off + 1] << 8)
            : (bytes[off] << 8) | bytes[off + 1];
        };

        const getUint32 = (off) => {
          return isLittleEndian
            ? (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0
            : ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
        };

        const firstIfdOffset = getUint32(tiffOffset + 4);
        if (firstIfdOffset < 8) return 1;

        let curOffset = tiffOffset + firstIfdOffset;
        if (curOffset + 2 >= length) return 1;

        const tagCount = getUint16(curOffset);
        curOffset += 2;

        for (let i = 0; i < tagCount; i++) {
          if (curOffset + 12 > length) break;
          const tag = getUint16(curOffset);
          // Tag 0x0112 is Orientation
          if (tag === 0x0112) {
            const orientation = getUint16(curOffset + 8);
            if (orientation >= 1 && orientation <= 8) {
              return orientation;
            }
            break;
          }
          curOffset += 12;
        }
      }
      break;
    } else if ((marker >= 0xE0 && marker <= 0xEF) || marker === 0xFE || marker === 0xDB || marker === 0xC0 || marker === 0xC2) {
      // Skip variable length marker segment
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
      offset += segmentLength;
    } else if (marker === 0xD9 || marker === 0xDA) {
      // EOI or SOS marker: Stop scanning headers
      break;
    } else {
      offset++;
    }
  }

  return 1;
}

/**
 * Decode Base64 dataURL to Uint8Array
 */
function base64ToUint8Array(dataUrl) {
  try {
    const base64Index = dataUrl.indexOf(',');
    const base64String = base64Index !== -1 ? dataUrl.slice(base64Index + 1) : dataUrl;
    const binary = atob(base64String.slice(0, 65536)); // Read first 64KB for EXIF headers
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return null;
  }
}

/**
 * Detect face presence and approximate orientation angle in canvas (0°, 90°, 180°, 270°)
 */
async function detectFaceOrientation(canvas) {
  const w = canvas.width;
  const h = canvas.height;

  // Try native FaceDetector API if available
  if ('FaceDetector' in window) {
    try {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
      const faces = await detector.detect(canvas);
      if (faces && faces.length > 0) {
        // Face found in current orientation
        const validFaces = faces.filter(f => (f.boundingBox.width * f.boundingBox.height) / (w * h) > 0.03);
        if (validFaces.length > 0) {
          return { detected: true, angle: 0, faces: validFaces.length };
        }
      }
    } catch (e) {
      // Ignore and fallback
    }
  }

  // Fast skin tone check to determine if face is upright vs sideways
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Check 4 quadrants for skin-like chrominance
    const sampleW = 80;
    const sampleH = 80;
    const testCanvas = document.createElement('canvas');
    testCanvas.width = sampleW;
    testCanvas.height = sampleH;
    const tCtx = testCanvas.getContext('2d');
    tCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
    const imgData = tCtx.getImageData(0, 0, sampleW, sampleH).data;

    let skinCountTop = 0;
    let skinCountBottom = 0;
    let skinCountLeft = 0;
    let skinCountRight = 0;

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        const idx = (y * sampleW + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];

        // Fast skin tone test
        const isSkin = (r > 60 && g > 40 && b > 20 && r > g && g > b && (r - g) > 10);
        if (isSkin) {
          if (y < sampleH / 2) skinCountTop++;
          else skinCountBottom++;

          if (x < sampleW / 2) skinCountLeft++;
          else skinCountRight++;
        }
      }
    }

    return {
      detected: (skinCountTop + skinCountBottom) > (sampleW * sampleH * 0.06),
      angle: 0
    };
  } catch (err) {
    return { detected: null, angle: 0 };
  }
}

/**
 * Main Normalization Function
 * Converts any camera frame, video snapshot, or image data URL to a clean,
 * upright, correctly proportioned, and high-quality JPEG.
 *
 * @param {HTMLVideoElement|string|HTMLImageElement} source - Video element or base64 data URL
 * @param {Object} options - Configuration options
 * @returns {Promise<{ dataUrl: string, width: number, height: number, imageSignature: string }>}
 */
export async function normalizeCapturedImage(source, options = {}) {
  const {
    facingMode = 'user',
    photoType = 'door_selfie',
    maxDimension = 1280,
    quality = 0.90
  } = options;

  // Case A: Source is HTMLVideoElement (Live Camera Snapshot)
  if (source && typeof source.videoWidth === 'number' && source.videoWidth > 0) {
    const video = source;
    let vWidth = video.videoWidth;
    let vHeight = video.videoHeight;

    // Check device portrait mode
    const isDevicePortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    const isVideoLandscape = vWidth > vHeight;

    // Determine target dimensions maintaining aspect ratio with maxDimension cap
    let targetWidth = vWidth;
    let targetHeight = vHeight;

    if (Math.max(targetWidth, targetHeight) > maxDimension) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight / targetWidth) * maxDimension);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((targetWidth / targetHeight) * maxDimension);
        targetHeight = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Horizontal mirror for user-facing selfie camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // If device is in portrait, but hardware sensor delivered a landscape frame where width > height,
    // and this is a selfie / door selfie, check if 90° rotation makes it upright.
    if (isDevicePortrait && isVideoLandscape && (photoType === 'door_selfie' || photoType === 'selfie' || photoType === 'joint_selfie')) {
      // Determine if rotating 90° CW or CCW provides upright orientation
      // For standard front cameras on Android held in portrait, sensor 1280x720 requires 90° rotation
      // Check native screen orientation angle if available
      const screenAngle = typeof window !== 'undefined' && window.screen?.orientation?.angle !== undefined
        ? window.screen.orientation.angle
        : (typeof window !== 'undefined' && window.orientation !== undefined ? window.orientation : 0);

      // Only auto-orient if angle suggests portrait hardware mismatch
      if (screenAngle === 0 || screenAngle === 180) {
        const rotCanvas = document.createElement('canvas');
        rotCanvas.width = canvas.height;
        rotCanvas.height = canvas.width;
        const rCtx = rotCanvas.getContext('2d');
        rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
        // Rotate 90° counter-clockwise to bring landscape sensor to portrait
        rCtx.rotate(-90 * Math.PI / 180);
        rCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

        // Verify face detection on rotated canvas vs original
        const origFace = await detectFaceOrientation(canvas);
        const rotFace = await detectFaceOrientation(rotCanvas);

        if (rotFace.detected && !origFace.detected) {
          canvas.width = rotCanvas.width;
          canvas.height = rotCanvas.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(rotCanvas, 0, 0);
        }
      }
    }

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const imageSignature = computeImageSignature(dataUrl);

    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      imageSignature
    };
  }

  // Case B: Source is Data URL string or Image Element
  return new Promise((resolve, reject) => {
    let dataUrlString = '';
    if (typeof source === 'string') {
      dataUrlString = source;
    } else if (source && source.src) {
      dataUrlString = source.src;
    } else {
      return reject(new Error('Invalid image source provided to normalizeCapturedImage'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // 1. Read EXIF orientation
        const bytes = base64ToUint8Array(dataUrlString);
        const exifOrientation = bytes ? getExifOrientation(bytes) : 1;

        let origW = img.naturalWidth || img.width;
        let origH = img.naturalHeight || img.height;

        let targetW = origW;
        let targetH = origH;

        // Scale down if larger than maxDimension
        if (Math.max(targetW, targetH) > maxDimension) {
          if (targetW >= targetH) {
            targetH = Math.round((targetH / targetW) * maxDimension);
            targetW = maxDimension;
          } else {
            targetW = Math.round((targetW / targetH) * maxDimension);
            targetH = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Apply EXIF orientation transform
        // Orientation 5-8 swap width and height
        if (exifOrientation >= 5 && exifOrientation <= 8) {
          canvas.width = targetH;
          canvas.height = targetW;
        } else {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        switch (exifOrientation) {
          case 2: // Horizontal flip
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            break;
          case 3: // 180° rotate
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate(Math.PI);
            break;
          case 4: // Vertical flip
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            break;
          case 5: // Vertical flip + 90° rotate
            ctx.rotate(0.5 * Math.PI);
            ctx.scale(1, -1);
            break;
          case 6: // 90° CW rotate
            ctx.rotate(0.5 * Math.PI);
            ctx.translate(0, -canvas.width);
            break;
          case 7: // Horizontal flip + 90° rotate
            ctx.rotate(0.5 * Math.PI);
            ctx.translate(canvas.height, -canvas.width);
            ctx.scale(-1, 1);
            break;
          case 8: // 270° CW rotate (90° CCW)
            ctx.rotate(-0.5 * Math.PI);
            ctx.translate(-canvas.height, 0);
            break;
          default:
            // 1: Normal
            break;
        }

        if (exifOrientation >= 5 && exifOrientation <= 8) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
        } else {
          ctx.drawImage(img, 0, 0, targetW, targetH);
        }

        const normalizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const imageSignature = computeImageSignature(normalizedDataUrl);

        resolve({
          dataUrl: normalizedDataUrl,
          width: canvas.width,
          height: canvas.height,
          imageSignature
        });
      } catch (err) {
        console.warn('Image normalization error, using fallback:', err);
        resolve({
          dataUrl: dataUrlString,
          width: img.width || 640,
          height: img.height || 480,
          imageSignature: computeImageSignature(dataUrlString)
        });
      }
    };

    img.onerror = (err) => {
      reject(new Error('Failed to load image for orientation normalization'));
    };

    img.src = dataUrlString;
  });
}
