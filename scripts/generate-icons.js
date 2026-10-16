import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('./public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="flask" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
      <stop offset="40%" stop-color="#0284c7" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#0369a1" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="oil" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
    <linearGradient id="gauge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>

  <!-- Background base -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#334155" stroke-width="4"/>

  <!-- PVT Cell / Reservoir Cell Body -->
  <!-- Upper Piston Assembly -->
  <rect x="226" y="70" width="60" height="45" rx="6" fill="#94a3b8"/>
  <rect x="248" y="115" width="16" height="40" fill="#cbd5e1"/>

  <!-- High-Pressure Chamber Cylinder -->
  <rect x="156" y="150" width="200" height="240" rx="28" fill="#1e293b" stroke="#475569" stroke-width="8"/>
  
  <!-- Viewing Window (Visual PVT Cell) -->
  <rect x="176" y="170" width="160" height="200" rx="16" fill="#090d16" stroke="#38bdf8" stroke-width="3"/>

  <!-- Phase Separation Layers -->
  <!-- Gas Cap Layer -->
  <rect x="178" y="172" width="156" height="50" rx="14" fill="#38bdf8" fill-opacity="0.25"/>
  <!-- Bubble Phase / Condensate Interface -->
  <circle cx="210" cy="195" r="7" fill="#bae6fd" opacity="0.7"/>
  <circle cx="250" cy="188" r="9" fill="#bae6fd" opacity="0.8"/>
  <circle cx="290" cy="200" r="6" fill="#bae6fd" opacity="0.6"/>

  <!-- Oil Column -->
  <rect x="178" y="222" width="156" height="90" fill="url(#oil)"/>
  
  <!-- Water / Bottom Layer -->
  <rect x="178" y="312" width="156" height="56" rx="14" fill="#1e3a8a" fill-opacity="0.8"/>

  <!-- Measurement Scale Graticules on Chamber -->
  <line x1="184" y1="200" x2="200" y2="200" stroke="#f8fafc" stroke-width="2" opacity="0.8"/>
  <line x1="184" y1="230" x2="194" y2="230" stroke="#f8fafc" stroke-width="2" opacity="0.6"/>
  <line x1="184" y1="260" x2="200" y2="260" stroke="#f8fafc" stroke-width="2" opacity="0.8"/>
  <line x1="184" y1="290" x2="194" y2="290" stroke="#f8fafc" stroke-width="2" opacity="0.6"/>
  <line x1="184" y1="320" x2="200" y2="320" stroke="#f8fafc" stroke-width="2" opacity="0.8"/>

  <!-- Pressure Gauge Badge Right -->
  <circle cx="370" cy="180" r="46" fill="#0f172a" stroke="#38bdf8" stroke-width="4"/>
  <circle cx="370" cy="180" r="38" fill="#1e293b"/>
  <path d="M 370 180 L 392 165" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
  <circle cx="370" cy="180" r="4" fill="#f8fafc"/>
  <text x="370" y="206" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#38bdf8" text-anchor="middle">psi</text>

  <!-- Temperature Badge Left -->
  <circle cx="142" cy="180" r="46" fill="#0f172a" stroke="#f59e0b" stroke-width="4"/>
  <circle cx="142" cy="180" r="38" fill="#1e293b"/>
  <path d="M 142 160 v 30" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
  <circle cx="142" cy="195" r="7" fill="#ef4444"/>
  <text x="142" y="208" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#f59e0b" text-anchor="middle">°F</text>

  <!-- Typography: PVT ANALYSIS -->
  <text x="256" y="430" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="800" fill="#f8fafc" letter-spacing="4" text-anchor="middle">PVT SYSTEM</text>
  <text x="256" y="462" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#38bdf8" letter-spacing="2" text-anchor="middle">RESERVOIR FLUIDS</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);

// Helper to create pure RGBA PNG buffer without native modules
function createPng(width, height, isMaskable = false) {
  // Generate RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const radius = isMaskable ? width * 0.38 : width * 0.44;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isMaskable) {
        // Deep solid navy background with inner reservoir cell design
        buffer[idx] = 15;      // R
        buffer[idx + 1] = 23;  // G
        buffer[idx + 2] = 42;  // B
        buffer[idx + 3] = 255; // A
      } else {
        // Rounded corners
        const cornerDistX = Math.max(0, Math.abs(dx) - (width * 0.35));
        const cornerDistY = Math.max(0, Math.abs(dy) - (height * 0.35));
        const cornerDist = Math.sqrt(cornerDistX * cornerDistX + cornerDistY * cornerDistY);
        if (cornerDist > width * 0.15) {
          buffer[idx] = 0;
          buffer[idx + 1] = 0;
          buffer[idx + 2] = 0;
          buffer[idx + 3] = 0;
          continue;
        } else {
          buffer[idx] = 15;
          buffer[idx + 1] = 23;
          buffer[idx + 2] = 42;
          buffer[idx + 3] = 255;
        }
      }

      // Draw stylized PVT chamber in center
      const inChamberX = Math.abs(dx) < width * 0.22;
      const inChamberY = dy > -height * 0.18 && dy < height * 0.22;
      if (inChamberX && inChamberY) {
        if (dy < -height * 0.04) {
          // Gas cap / cyan
          buffer[idx] = 56;
          buffer[idx + 1] = 189;
          buffer[idx + 2] = 248;
          buffer[idx + 3] = 255;
        } else if (dy < height * 0.12) {
          // Oil column / amber gold
          buffer[idx] = 245;
          buffer[idx + 1] = 158;
          buffer[idx + 2] = 11;
          buffer[idx + 3] = 255;
        } else {
          // Water / deep blue
          buffer[idx] = 30;
          buffer[idx + 1] = 64;
          buffer[idx + 2] = 175;
          buffer[idx + 3] = 255;
        }
      }

      // Border around chamber
      const onBorder = (Math.abs(Math.abs(dx) - width * 0.22) < 2 && dy >= -height * 0.18 && dy <= height * 0.22) ||
                       (Math.abs(dy - (-height * 0.18)) < 2 && inChamberX) ||
                       (Math.abs(dy - height * 0.22) < 2 && inChamberX);
      if (onBorder) {
        buffer[idx] = 148;
        buffer[idx + 1] = 163;
        buffer[idx + 2] = 184;
        buffer[idx + 3] = 255;
      }

      // Center pressure gauge indicator
      const gaugeDist = Math.sqrt((dx - width * 0.26) ** 2 + (dy + height * 0.2) ** 2);
      if (gaugeDist < width * 0.08) {
        buffer[idx] = 2;
        buffer[idx + 1] = 132;
        buffer[idx + 2] = 199;
        buffer[idx + 3] = 255;
      }
    }
  }

  // Encode as PNG
  return encodePNG(width, height, buffer);
}

function encodePNG(width, height, rgbaBuffer) {
  // Raw uncompressed scanlines with filter byte 0
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineLength;
    rawData[rawOffset] = 0; // Filter None
    rgbaBuffer.copy(rawData, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcTable = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 4; i < 8 + length; i++) {
    crc = crcTable[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

let crcTableCache = null;
function getCrcTable() {
  if (crcTableCache) return crcTableCache;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  crcTableCache = table;
  return table;
}

// Generate files
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(32, 32, false));

console.log('Icons generated successfully in public/');
