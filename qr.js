/** QR Code Model 2 encoder (byte mode). No DOM. */

const MIN_VERSION = 1;
const MAX_VERSION = 40;
const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

/** Error correction: ordinal, format bits. */
export const ECC_LOW = { ordinal: 0, formatBits: 1 };
export const ECC_MEDIUM = { ordinal: 1, formatBits: 0 };
export const ECC_QUARTILE = { ordinal: 2, formatBits: 3 };
export const ECC_HIGH = { ordinal: 3, formatBits: 2 };

const ECC_LEVELS = [ECC_LOW, ECC_MEDIUM, ECC_QUARTILE, ECC_HIGH];

// index 0 unused; versions 1–40
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

function getBit(x, i) {
  return ((x >>> i) & 1) !== 0;
}

function appendBits(val, len, bb) {
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
}

function getNumRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(ver, ecl) {
  return Math.floor(getNumRawDataModules(ver) / 8)
    - ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver]
    * NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
}

function byteCountBits(ver) {
  return ver <= 9 ? 8 : 16;
}

function reedSolomonMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree) {
  const result = [];
  for (let i = 0; i < degree - 1; i++) result.push(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    if (factor === 0) continue;
    for (let i = 0; i < result.length; i++) {
      result[i] ^= reedSolomonMultiply(divisor[i], factor);
    }
  }
  return result;
}

function alignmentPositions(version, size) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

function addEccAndInterleave(data, version, ecl) {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const rsDiv = reedSolomonDivisor(blockEccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = reedSolomonRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

function maskInvert(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    default: return false;
  }
}

function finderPenaltyAddHistory(currentRunLength, runHistory, size) {
  if (runHistory[0] === 0) currentRunLength += size;
  runHistory.pop();
  runHistory.unshift(currentRunLength);
}

function finderPenaltyCountPatterns(runHistory) {
  const n = runHistory[1];
  const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
  return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
    + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
}

function finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory, size) {
  if (currentRunColor) {
    finderPenaltyAddHistory(currentRunLength, runHistory, size);
    currentRunLength = 0;
  }
  currentRunLength += size;
  finderPenaltyAddHistory(currentRunLength, runHistory, size);
  return finderPenaltyCountPatterns(runHistory);
}

function penaltyScore(modules, size) {
  let result = 0;

  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runX = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (modules[y][x] === runColor) {
        runX++;
        if (runX === 5) result += PENALTY_N1;
        else if (runX > 5) result++;
      } else {
        finderPenaltyAddHistory(runX, runHistory, size);
        if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
        runColor = modules[y][x];
        runX = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(runColor, runX, runHistory, size) * PENALTY_N3;
  }

  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runY = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (modules[y][x] === runColor) {
        runY++;
        if (runY === 5) result += PENALTY_N1;
        else if (runY > 5) result++;
      } else {
        finderPenaltyAddHistory(runY, runHistory, size);
        if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
        runColor = modules[y][x];
        runY = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(runColor, runY, runHistory, size) * PENALTY_N3;
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = modules[y][x];
      if (
        color === modules[y][x + 1]
        && color === modules[y + 1][x]
        && color === modules[y + 1][x + 1]
      ) {
        result += PENALTY_N2;
      }
    }
  }

  let dark = 0;
  for (const row of modules) {
    for (const cell of row) if (cell) dark++;
  }
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * PENALTY_N4;
  return result;
}

function encodeModules(dataCodewords, version, ecl) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(x, y, dark) {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  }

  function drawFinder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
          setFunction(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  function drawAlignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  function drawFormatBits(mask) {
    const data = (ecl.formatBits << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (data << 10 | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) setFunction(8, i, getBit(bits, i));
    setFunction(8, 7, getBit(bits, 6));
    setFunction(8, 8, getBit(bits, 7));
    setFunction(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, getBit(bits, i));

    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, getBit(bits, i));
    setFunction(8, size - 8, true);
  }

  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  const alignPos = alignmentPositions(version, size);
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      if (!((i === 0 && j === 0) || (i === 0 && j === alignPos.length - 1) || (i === alignPos.length - 1 && j === 0))) {
        drawAlignment(alignPos[i], alignPos[j]);
      }
    }
  }

  drawFormatBits(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = version << 12 | rem;
    for (let i = 0; i < 18; i++) {
      const color = getBit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunction(a, b, color);
      setFunction(b, a, color);
    }
  }

  const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIndex < allCodewords.length * 8) {
          modules[y][x] = getBit(allCodewords[bitIndex >>> 3], 7 - (bitIndex & 7));
          bitIndex++;
        }
      }
    }
  }

  function applyMask(mask) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunction[y][x] && maskInvert(mask, x, y)) {
          modules[y][x] = !modules[y][x];
        }
      }
    }
  }

  let bestMask = 0;
  let minPenalty = 1e9;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormatBits(mask);
    const penalty = penaltyScore(modules, size);
    if (penalty < minPenalty) {
      bestMask = mask;
      minPenalty = penalty;
    }
    applyMask(mask);
  }
  applyMask(bestMask);
  drawFormatBits(bestMask);

  return { modules, size, version, mask: bestMask };
}

function packBits(bb) {
  const bytes = [];
  while (bytes.length * 8 < bb.length) bytes.push(0);
  bb.forEach((bit, i) => {
    bytes[i >>> 3] |= bit << (7 - (i & 7));
  });
  return bytes;
}

/**
 * Encode text as a QR module grid (UTF-8 byte mode).
 * @param {string} text
 * @param {{ ecl?: { ordinal: number, formatBits: number } }} [opts]
 * @returns {{ modules: boolean[][], size: number, version: number, mask: number }}
 */
export function encodeQr(text, { ecl = ECC_LOW } = {}) {
  if (typeof text !== 'string') throw new TypeError('QR text must be a string');
  const data = Array.from(new TextEncoder().encode(text));
  const usedBitsFor = (ver) => 4 + byteCountBits(ver) + 8 * data.length;

  let version;
  for (version = MIN_VERSION; version <= MAX_VERSION; version++) {
    if (usedBitsFor(version) <= getNumDataCodewords(version, ecl) * 8) break;
  }
  if (version > MAX_VERSION) throw new RangeError('Data too long for a QR code');

  for (const higher of [ECC_MEDIUM, ECC_QUARTILE, ECC_HIGH]) {
    if (higher.ordinal > ecl.ordinal && usedBitsFor(version) <= getNumDataCodewords(version, higher) * 8) {
      ecl = higher;
    }
  }

  const capacity = getNumDataCodewords(version, ecl) * 8;
  const bb = [];
  appendBits(0x4, 4, bb);
  appendBits(data.length, byteCountBits(version), bb);
  for (const b of data) appendBits(b, 8, bb);
  appendBits(0, Math.min(4, capacity - bb.length), bb);
  appendBits(0, (8 - bb.length % 8) % 8, bb);
  for (let pad = 0xEC; bb.length < capacity; pad ^= 0xEC ^ 0x11) appendBits(pad, 8, bb);

  return encodeModules(packBits(bb), version, ecl);
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[ch]));
}

/**
 * Render a QR grid as an SVG string (quiet zone included).
 * @param {{ modules: boolean[][], size: number }} qr
 * @param {{ border?: number, dark?: string, light?: string, label?: string }} [opts]
 */
export function qrToSvg(qr, { border = 4, dark = '#000000', light = '#ffffff', label = 'QR code' } = {}) {
  const n = qr.size;
  const dim = n + border * 2;
  const parts = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules[y][x]) parts.push(`M${x + border},${y + border}h1v1h-1z`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}"` +
    ` shape-rendering="crispEdges" role="img" aria-label="${escapeXml(label)}">` +
    `<rect width="100%" height="100%" fill="${escapeXml(light)}"/>` +
    `<path fill="${escapeXml(dark)}" d="${parts.join('')}"/>` +
    `</svg>`
  );
}
