const fs = require('fs');
const path = require('path');
const { latLngToWorldPixel, makePng } = require('../backend/utils/googleMapGenerator');
const https = require('https');
const PNG = require('png-js');

function fetchRetinaTile(x, y, z) {
  return new Promise((resolve) => {
    const url = `https://mt1.google.com/vt/lyrs=m&hl=en&scale=2&x=${x}&y=${y}&z=${z}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
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

async function testRetinaStitch(liveLat, liveLng, outPath) {
  const z = 16;
  const midPixel = latLngToWorldPixel(liveLat, liveLng, z, 512);
  const outW = 1046, outH = 432;
  const startX = Math.round(midPixel.x - outW / 2);
  const startY = Math.round(midPixel.y - outH / 2);

  const minTileX = Math.floor(startX / 512);
  const maxTileX = Math.floor((startX + outW) / 512);
  const minTileY = Math.floor(startY / 512);
  const maxTileY = Math.floor((startY + outH) / 512);

  console.log(`Tiles needed: X from ${minTileX} to ${maxTileX}, Y from ${minTileY} to ${maxTileY}`);
  const canvas = Buffer.alloc(outW * outH * 4, 0xFF);
  let tilesFetched = 0;

  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const tileBuf = await fetchRetinaTile(tx, ty, z);
      if (!tileBuf) {
        console.log(`Failed to fetch tile ${tx}, ${ty}`);
        continue;
      }
      const decoded = await decodePng(tileBuf);
      if (!decoded || !decoded.pixels) continue;
      tilesFetched++;
      console.log(`Fetched and decoded tile ${tx}, ${ty}`);

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
  }

  console.log(`Total tiles fetched: ${tilesFetched}`);
  if (tilesFetched === 0) return null;

  const png = makePng(outW, outH, canvas);
  fs.writeFileSync(outPath, png);
  console.log(`Successfully written to ${outPath}, size: ${png.length} bytes`);
  return outPath;
}

testRetinaStitch(13.078239, 80.255977, 'scratch/real_egmore_map.png');
