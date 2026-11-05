const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crc32 = require('crc-32');
const PNG = require('png-js');

/**
 * Ultra-High-Resolution Google Maps Static Audit Map Generator
 * Generates razor-sharp, crystal-clear Google Maps imagery with HR (Blue) & Live (Green) pins
 * Supports authentic high-DPI base maps and dynamic Google Retina (@2x) tile stitching
 */

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

function latLngToWorldPixel(lat, lng, zoom, tileSize = 256) {
  const scale = tileSize * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const sinY = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinY) / (1 - sinY)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function fetchRetinaTile(x, y, z) {
  return new Promise((resolve) => {
    // scale=2 fetches 512x512 retina tiles with bold typography and prominent roads
    // Round-robin between mt0, mt1, mt2, mt3
    const sub = Math.abs((x + y) % 4);
    const url = `https://mt${sub}.google.com/vt/lyrs=m&hl=en&scale=2&x=${x}&y=${y}&z=${z}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function decodePng(buffer) {
  return new Promise((resolve) => {
    try {
      const p = new PNG(buffer);
      p.decode((pixels) => resolve({ width: p.width, height: p.height, pixels }));
    } catch (e) {
      resolve(null);
    }
  });
}

function makePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crcVal = crc32.buf(body) >>> 0;
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, body, crcBuf]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const rowBytes = width * 4;
  const scanlines = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (rowBytes + 1)] = 0; // Filter None
    rgbaBuffer.copy(scanlines, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const idat = makeChunk('IDAT', zlib.deflateSync(scanlines, { level: 6 }));
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function drawLine(canvas, w, h, x1, y1, x2, y2, strokeWidth, r, g, b, a = 255) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const radius = strokeWidth / 2;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2) + radius));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2) + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let t = lenSq === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.hypot(x - projX, y - projY);
      if (dist <= radius) {
        const alpha = Math.min(1, radius - dist + 0.5) * (a / 255);
        const idx = (y * w + x) * 4;
        canvas[idx] = Math.round(canvas[idx] * (1 - alpha) + r * alpha);
        canvas[idx + 1] = Math.round(canvas[idx + 1] * (1 - alpha) + g * alpha);
        canvas[idx + 2] = Math.round(canvas[idx + 2] * (1 - alpha) + b * alpha);
      }
    }
  }
}

function drawPin(canvas, w, h, tipX, tipY, pinR, r, g, b) {
  const headY = tipY - pinR * 1.8;
  const headX = tipX;
  const totalH = pinR * 2.8;

  const minX = Math.max(0, Math.floor(tipX - pinR * 1.6));
  const maxX = Math.min(w - 1, Math.ceil(tipX + pinR * 1.6));
  const minY = Math.max(0, Math.floor(tipY - totalH));
  const maxY = Math.min(h - 1, Math.ceil(tipY + 4));

  // Drop shadow
  const shadowRx = pinR * 1.1, shadowRy = pinR * 0.45;
  for (let sy = Math.max(0, Math.floor(tipY - shadowRy)); sy <= Math.min(h - 1, Math.ceil(tipY + shadowRy)); sy++) {
    for (let sx = Math.max(0, Math.floor(tipX - shadowRx)); sx <= Math.min(w - 1, Math.ceil(tipX + shadowRx)); sx++) {
      const elDist = Math.hypot((sx - tipX) / shadowRx, (sy - tipY) / shadowRy);
      if (elDist <= 1) {
        const alpha = (1 - elDist) * 0.40;
        const sIdx = (sy * w + sx) * 4;
        canvas[sIdx] = Math.round(canvas[sIdx] * (1 - alpha));
        canvas[sIdx + 1] = Math.round(canvas[sIdx + 1] * (1 - alpha));
        canvas[sIdx + 2] = Math.round(canvas[sIdx + 2] * (1 - alpha));
      }
    }
  }

  // Teardrop pin body
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distToHead = Math.hypot(x - headX, y - headY);
      let inCone = false;
      if (y >= headY && y <= tipY) {
        const progress = (y - headY) / (tipY - headY);
        const halfWidthAtY = pinR * (1 - progress);
        if (Math.abs(x - tipX) <= halfWidthAtY + 0.5) inCone = true;
      }

      if (distToHead <= pinR || inCone) {
        const isBorder = (distToHead >= pinR - 2.0) || (inCone && Math.abs(Math.abs(x - tipX) - pinR * (1 - (y - headY) / (tipY - headY))) < 2.0);
        const isInnerDot = distToHead <= pinR * 0.42;

        const idx = (y * w + x) * 4;
        if (isInnerDot) {
          canvas[idx] = 255; canvas[idx + 1] = 255; canvas[idx + 2] = 255;
        } else if (isBorder) {
          canvas[idx] = Math.round(r * 0.45); canvas[idx + 1] = Math.round(g * 0.45); canvas[idx + 2] = Math.round(b * 0.45);
        } else {
          canvas[idx] = r; canvas[idx + 1] = g; canvas[idx + 2] = b;
        }
      }
    }
  }
}

/**
 * Draw semi-transparent accuracy radius circle on map canvas
 */
function drawAccuracyCircle(canvas, w, h, centerX, centerY, radiusPx, r = 16, g = 185, b = 129) {
  if (!radiusPx || radiusPx <= 0) return;
  const rad = Math.min(Math.max(radiusPx, 6), Math.min(w, h) / 2);
  const minX = Math.max(0, Math.floor(centerX - rad - 3));
  const maxX = Math.min(w - 1, Math.ceil(centerX + rad + 3));
  const minY = Math.max(0, Math.floor(centerY - rad - 3));
  const maxY = Math.min(h - 1, Math.ceil(centerY + rad + 3));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist <= rad) {
        const idx = (y * w + x) * 4;
        const isBorder = dist >= rad - 2.0;
        if (isBorder) {
          const borderAlpha = 0.85;
          canvas[idx] = Math.round(canvas[idx] * (1 - borderAlpha) + 5 * borderAlpha);
          canvas[idx + 1] = Math.round(canvas[idx + 1] * (1 - borderAlpha) + 150 * borderAlpha);
          canvas[idx + 2] = Math.round(canvas[idx + 2] * (1 - borderAlpha) + 105 * borderAlpha);
        } else {
          const fillAlpha = 0.18;
          canvas[idx] = Math.round(canvas[idx] * (1 - fillAlpha) + r * fillAlpha);
          canvas[idx + 1] = Math.round(canvas[idx + 1] * (1 - fillAlpha) + g * fillAlpha);
          canvas[idx + 2] = Math.round(canvas[idx + 2] * (1 - fillAlpha) + b * fillAlpha);
        }
      }
    }
  }
}

/**
 * Ultra-High-Resolution Google Retina (@2x) 300 DPI Map Generator
 * Generates genuine 300 DPI imagery at Zoom Level 15 showing wider surrounding streets, roads & landmarks
 * Strictly centers the map precisely on the captured GPS coordinates
 */
async function generateDynamicRetinaMap(liveLat, liveLng, outPath, accuracyMeters = 15, zoomLevel = 15) {
  // Zoom 15: Wide neighborhood view showing major roads, railway lines & landmarks clearly
  const z = zoomLevel || 15;

  // Target 300 DPI dimensions for 523 pt x 175 pt: 2184 x 732 px (aspect ratio 2.984 matches 523/175)
  const outW = 2184;
  const outH = 732;

  const midPixel = latLngToWorldPixel(liveLat, liveLng, z, 512);
  const startX = Math.round(midPixel.x - outW / 2);
  const startY = Math.round(midPixel.y - outH / 2);

  const minTileX = Math.floor(startX / 512);
  const maxTileX = Math.floor((startX + outW) / 512);
  const minTileY = Math.floor(startY / 512);
  const maxTileY = Math.floor((startY + outH) / 512);

  const canvas = Buffer.alloc(outW * outH * 4, 0xFF);
  const tilePromises = [];

  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      tilePromises.push(
        fetchRetinaTile(tx, ty, z).then((buf) => ({ tx, ty, buf }))
      );
    }
  }

  const results = await Promise.all(tilePromises);
  let tilesFetched = 0;

  for (const { tx, ty, buf } of results) {
    if (!buf) continue;
    const decoded = await decodePng(buf);
    if (!decoded || !decoded.pixels) continue;
    tilesFetched++;

    const tileWorldX = tx * 512;
    const tileWorldY = ty * 512;

    for (let py = 0; py < decoded.height; py++) {
      const destY = tileWorldY + py - startY;
      if (destY < 0 || destY >= outH) continue;
      for (let px = 0; px < decoded.width; px++) {
        const destX = tileWorldX + px - startX;
        if (destX < 0 || destX >= outW) continue;
        const srcIdx = (py * decoded.width + px) * 4;
        const destIdx = (destY * outW + destX) * 4;
        canvas[destIdx] = decoded.pixels[srcIdx];
        canvas[destIdx + 1] = decoded.pixels[srcIdx + 1];
        canvas[destIdx + 2] = decoded.pixels[srcIdx + 2];
        canvas[destIdx + 3] = decoded.pixels[srcIdx + 3];
      }
    }
  }

  if (tilesFetched === 0) return null;

  const livePixel = latLngToWorldPixel(liveLat, liveLng, z, 512);
  const liveX = Math.round(livePixel.x - startX);
  const liveY = Math.round(livePixel.y - startY);

  // Calculate accuracy radius in pixels at zoom 15
  const metersPerPixel = (156543.03392 * Math.cos((liveLat * Math.PI) / 180)) / (Math.pow(2, z) * 2);
  const radiusPx = Math.round((parseFloat(accuracyMeters) || 15) / metersPerPixel);

  // 1. Draw GPS Accuracy Radius Circle
  drawAccuracyCircle(canvas, outW, outH, liveX, liveY, Math.max(radiusPx, 10));

  // 2. Draw Prominent Live Capture Pin (Google Emerald Green: #10B981, pinR = 20 for 300 DPI clarity)
  drawPin(canvas, outW, outH, liveX, liveY, 20, 16, 185, 129);

  const png = makePng(outW, outH, canvas);
  fs.writeFileSync(outPath, png);
  return outPath;
}

/**
 * Generate Google Maps static audit image for the BGV PDF report at 300 DPI
 * Strictly uses exact employee live GPS coordinates without static presets or unrelated fallbacks
 */
async function generateGoogleAuditMap(...args) {
  let liveLat, liveLng, outPath, accuracyMeters, zoomLevel;
  if (typeof args[2] === 'string') {
    // Direct signature: (liveLat, liveLng, outPath, accuracyMeters, zoomLevel)
    liveLat = args[0];
    liveLng = args[1];
    outPath = args[2];
    accuracyMeters = args[3];
    zoomLevel = args[4];
  } else if (typeof args[4] === 'string' || args.length >= 6) {
    // Legacy signature: (hrLat, hrLng, liveLat, liveLng, outPath, accuracyMeters, zoomLevel)
    liveLat = args[2];
    liveLng = args[3];
    outPath = args[4];
    accuracyMeters = args[5];
    zoomLevel = args[6];
  } else {
    liveLat = args[0];
    liveLng = args[1];
    outPath = args[2];
    accuracyMeters = args[3];
    zoomLevel = args[4];
  }

  if (liveLat === null || liveLat === undefined || liveLng === null || liveLng === undefined) {
    return null;
  }
  const nLiveLat = parseFloat(liveLat), nLiveLng = parseFloat(liveLng);
  if (isNaN(nLiveLat) || isNaN(nLiveLng)) return null;

  const nAcc = accuracyMeters !== undefined && accuracyMeters !== null ? parseFloat(accuracyMeters) : 15;
  const nZoom = zoomLevel !== undefined && zoomLevel !== null ? parseInt(zoomLevel, 10) : 15;

  // Dynamically generate Google Retina map centered exactly on employee live coordinates at 300 DPI
  try {
    const dynamicRes = await generateDynamicRetinaMap(nLiveLat, nLiveLng, outPath, nAcc, nZoom);
    if (dynamicRes && fs.existsSync(dynamicRes)) {
      return dynamicRes;
    }
  } catch (err) {
    console.warn('Dynamic retina map generation warning:', err.message);
  }

  return null;
}

module.exports = {
  lon2tile,
  lat2tile,
  latLngToWorldPixel,
  makePng,
  generateDynamicRetinaMap,
  generateGoogleAuditMap
};
