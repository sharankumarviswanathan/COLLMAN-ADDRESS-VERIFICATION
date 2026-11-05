const fs = require('fs');
const path = require('path');
const https = require('https');
const PNG = require('png-js');
const { latLngToWorldPixel, makePng } = require('../backend/utils/googleMapGenerator');

function fetchRetinaTile(x, y, z) {
  return new Promise((resolve) => {
    const sub = Math.abs((x + y) % 4);
    const url = `https://mt${sub}.google.com/vt/lyrs=m&hl=en&scale=2&x=${x}&y=${y}&z=${z}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
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
        const isBorder = dist >= rad - 2.5;
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

async function generate300DpiMap(liveLat, liveLng, outPath, zoom = 15, accuracyMeters = 11.2) {
  // 300 DPI target dimensions for 523 pt x 175 pt:
  // 523 * 4.175 = 2184, 175 * 4.18 = 732
  const outW = 2184;
  const outH = 732;

  const midPixel = latLngToWorldPixel(liveLat, liveLng, zoom, 512);
  const startX = Math.round(midPixel.x - outW / 2);
  const startY = Math.round(midPixel.y - outH / 2);

  const minTileX = Math.floor(startX / 512);
  const maxTileX = Math.floor((startX + outW) / 512);
  const minTileY = Math.floor(startY / 512);
  const maxTileY = Math.floor((startY + outH) / 512);

  console.log(`Tiles needed at zoom ${zoom}: X [${minTileX}..${maxTileX}], Y [${minTileY}..${maxTileY}]`);

  const canvas = Buffer.alloc(outW * outH * 4, 0xFF);
  const tilePromises = [];

  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      tilePromises.push(
        fetchRetinaTile(tx, ty, zoom).then(buf => ({ tx, ty, buf }))
      );
    }
  }

  const results = await Promise.all(tilePromises);
  let decodedCount = 0;

  for (const { tx, ty, buf } of results) {
    if (!buf) continue;
    const decoded = await decodePng(buf);
    if (!decoded || !decoded.pixels) continue;
    decodedCount++;

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

  console.log(`Successfully fetched and decoded ${decodedCount} tiles`);
  if (decodedCount === 0) return null;

  const livePixel = latLngToWorldPixel(liveLat, liveLng, zoom, 512);
  const liveX = Math.round(livePixel.x - startX);
  const liveY = Math.round(livePixel.y - startY);

  console.log(`Center point: (${liveX}, ${liveY}), expected (${outW/2}, ${outH/2})`);

  // Accuracy radius in pixels
  const metersPerPixel = (156543.03392 * Math.cos((liveLat * Math.PI) / 180)) / (Math.pow(2, zoom) * 2);
  const radiusPx = Math.round((parseFloat(accuracyMeters) || 15) / metersPerPixel);
  console.log(`Meters per pixel: ${metersPerPixel.toFixed(2)}, Accuracy ${accuracyMeters}m -> ${radiusPx}px`);

  // Draw accuracy circle
  drawAccuracyCircle(canvas, outW, outH, liveX, liveY, Math.max(radiusPx, 10));

  // Draw prominent green pin (pinR = 20 at 300 DPI for crisp visual prominence)
  drawPin(canvas, outW, outH, liveX, liveY, 20, 16, 185, 129);

  const png = makePng(outW, outH, canvas);
  fs.writeFileSync(outPath, png);
  console.log(`Wrote 300 DPI map to ${outPath}, size: ${png.length} bytes`);
  return outPath;
}

generate300DpiMap(13.078239, 80.255977, 'scratch/egmore_300dpi_z15.png', 15, 11.2);
