const https = require('https');
const fs = require('fs');
const { latLngToWorldPixel } = require('../backend/utils/googleMapGenerator');

function fetchAndSave(z) {
  const p = latLngToWorldPixel(13.078239, 80.255977, z, 512);
  const tx = Math.floor(p.x / 512);
  const ty = Math.floor(p.y / 512);
  const url = `https://mt1.google.com/vt/lyrs=m&hl=en&scale=2&x=${tx}&y=${ty}&z=${z}`;
  console.log(`Zoom ${z}: tx=${tx}, ty=${ty}`);

  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      console.log(`Zoom ${z} status: ${res.statusCode}`);
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(`scratch/tile_z${z}.png`, buf);
        console.log(`Saved scratch/tile_z${z}.png, size: ${buf.length}`);
        resolve();
      });
    });
  });
}

async function run() {
  await fetchAndSave(15);
  await fetchAndSave(14);
}
run();
