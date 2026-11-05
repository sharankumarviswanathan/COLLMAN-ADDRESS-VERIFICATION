const https = require('https');
const fs = require('fs');
const z = 16, x = 47378, y = 30366;
const url = `https://mt1.google.com/vt/lyrs=m&hl=en&scale=2&x=${x}&y=${y}&z=${z}`;
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res) => {
  console.log('Status code:', res.statusCode);
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log('Bytes received:', buf.length);
    fs.writeFileSync('scratch/google_tile_sample.png', buf);
  });
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
