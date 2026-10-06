const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bits per channel
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // no interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Scanlines with filter byte 0 (None)
  const rawScanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawScanlines[rowOffset] = 0; // Filter byte: None
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(rawScanlines, rowOffset + 1, srcOffset, srcOffset + width * 4);
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Point in polygon helper
function isPointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
      (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function hexToRgba(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255
  ];
}

function renderIconBuffer(size, isMaskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [19, 19, 20, 255]; // #131314

  // Scale and offset
  const scale = isMaskable ? 0.65 : 0.8;
  const targetSize = size * scale;
  const offsetX = (size - targetSize) / 2;
  const offsetY = (size - targetSize) / 2;

  // Polygons mapped to 512x512 coordinate space
  // Cyan: [52,42], [42,71], [42,441], [52,470], [270,256]
  const polyCyan = [
    [52, 42], [42, 71], [42, 441], [52, 470], [270, 256]
  ];
  // Pink: [346,182], [92,36], [54,40], [270,256]
  const polyPink = [
    [346, 182], [92, 36], [54, 40], [270, 256]
  ];
  // Purple: [346,330], [270,256], [54,475], [92,476]
  const polyPurple = [
    [346, 330], [270, 256], [54, 475], [92, 476]
  ];
  // Yellow: [346,182], [270,256], [346,330], [430,282], [430,230]
  const polyYellow = [
    [346, 182], [270, 256], [346, 330], [430, 282], [430, 230]
  ];

  const cyanRgba = hexToRgba('00F0FF');
  const pinkRgba = hexToRgba('FF007F');
  const purpleRgba = hexToRgba('8B5CF6');
  const yellowRgba = hexToRgba('FFE600');

  const cornerRadius = isMaskable ? 0 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rect mask for standard icons
      if (!isMaskable && cornerRadius > 0) {
        let dx = 0, dy = 0;
        if (x < cornerRadius) dx = cornerRadius - x;
        else if (x > size - cornerRadius) dx = x - (size - cornerRadius);
        if (y < cornerRadius) dy = cornerRadius - y;
        else if (y > size - cornerRadius) dy = y - (size - cornerRadius);

        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          buf[idx] = 0;
          buf[idx + 1] = 0;
          buf[idx + 2] = 0;
          buf[idx + 3] = 0;
          continue;
        }
      }

      // Default background
      buf[idx] = bg[0];
      buf[idx + 1] = bg[1];
      buf[idx + 2] = bg[2];
      buf[idx + 3] = bg[3];

      // Map pixel to 512x512 space
      const normX = ((x - offsetX) / targetSize) * 512;
      const normY = ((y - offsetY) / targetSize) * 512;

      if (normX >= 0 && normX <= 512 && normY >= 0 && normY <= 512) {
        const pt = [normX, normY];
        if (isPointInPoly(pt, polyCyan)) {
          buf[idx] = cyanRgba[0];
          buf[idx + 1] = cyanRgba[1];
          buf[idx + 2] = cyanRgba[2];
          buf[idx + 3] = 255;
        } else if (isPointInPoly(pt, polyPink)) {
          buf[idx] = pinkRgba[0];
          buf[idx + 1] = pinkRgba[1];
          buf[idx + 2] = pinkRgba[2];
          buf[idx + 3] = 255;
        } else if (isPointInPoly(pt, polyPurple)) {
          buf[idx] = purpleRgba[0];
          buf[idx + 1] = purpleRgba[1];
          buf[idx + 2] = purpleRgba[2];
          buf[idx + 3] = 255;
        } else if (isPointInPoly(pt, polyYellow)) {
          buf[idx] = yellowRgba[0];
          buf[idx + 1] = yellowRgba[1];
          buf[idx + 2] = yellowRgba[2];
          buf[idx + 3] = 255;
        }
      }
    }
  }

  return createPNG(size, size, buf);
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PWA icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), renderIconBuffer(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), renderIconBuffer(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), renderIconBuffer(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderIconBuffer(180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), renderIconBuffer(32, false));

console.log('✅ Generated PWA icons successfully in /public');
