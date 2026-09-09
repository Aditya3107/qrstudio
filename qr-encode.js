// Self-contained QR encoder (byte mode, versions 1-40, EC L/M/Q/H).
(function (root) {
const ECC_CW = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
};
const ECC_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 5, 8, 9, 9, 10, 12, 12, 17, 16, 18, 21, 20, 23, 23, 26, 28, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49, 53, 55, 58, 60, 63, 66, 70]
};
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

function rawDataModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}
function dataCodewords(v, ecl) {
  return Math.floor(rawDataModules(v) / 8) - ECC_CW[ecl][v] * ECC_BLOCKS[ecl][v];
}
function alignPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const size = v * 4 + 17;
  const pos = [6];
  for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
  return pos;
}

// GF(256), primitive polynomial 0x11D
function gfMul(a, b) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((b >>> i) & 1) * a;
  }
  return z & 0xFF;
}
function rsDivisor(degree) {
  const res = new Uint8Array(degree);
  res[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      res[j] = gfMul(res[j], root);
      if (j + 1 < degree) res[j] ^= res[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return res;
}
function rsRemainder(data, divisor) {
  const res = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ res[0];
    res.copyWithin(0, 1);
    res[res.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) res[i] ^= gfMul(divisor[i], factor);
  }
  return res;
}

function interleave(data, v, ecl) {
  const numBlocks = ECC_BLOCKS[ecl][v];
  const eccLen = ECC_CW[ecl][v];
  const rawCw = Math.floor(rawDataModules(v) / 8);
  const shortBlocks = numBlocks - (rawCw % numBlocks);
  const shortLen = Math.floor(rawCw / numBlocks) - eccLen;
  const divisor = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    blocks.push({ dat, ecc: rsRemainder(dat, divisor) });
  }
  const out = [];
  for (let i = 0; i < shortLen + 1; i++)
    blocks.forEach((b, j) => { if (i < b.dat.length) out.push(b.dat[i]); });
  for (let i = 0; i < eccLen; i++) blocks.forEach((b) => out.push(b.ecc[i]));
  return out;
}

function buildMatrix(codewords, v, ecl) {
  const size = v * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = dark; fn[y][x] = true; } };

  // timing
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  // finders + separators
  [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  });
  // alignment
  const ap = alignPositions(v);
  ap.forEach((ay, i) => ap.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // version info
  if (v >= 7) {
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (v << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFn(a, b, bit); setFn(b, a, bit);
    }
  }
  // reserve format areas
  for (let i = 0; i < 8; i++) {
    if (i !== 6) { setFn(i, 8, false); setFn(8, i, false); }
    setFn(size - 1 - i, 8, false);
    setFn(8, size - 1 - i, false);
  }
  setFn(8, 8, false); setFn(8, size - 8, true);

  // data
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fn[y][x] || bitIdx >= codewords.length * 8) continue;
        m[y][x] = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
        bitIdx++;
      }
    }
  }

  const maskFn = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  ];
  const applyMask = (k) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
      if (!fn[y][x] && maskFn[k](x, y)) m[y][x] = !m[y][x];
  };
  const drawFormat = (k) => {
    const d = (FORMAT_BITS[ecl] << 3) | k;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((d << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  };
  const penalty = () => {
    let p = 0, dark = 0;
    const run = (line) => {
      let n = 1, color = line[0], sum = 0;
      for (let i = 1; i < line.length; i++) {
        if (line[i] === color) { n++; if (n === 5) sum += 3; else if (n > 5) sum += 1; }
        else { color = line[i]; n = 1; }
      }
      return sum;
    };
    for (let y = 0; y < size; y++) p += run(m[y]);
    for (let x = 0; x < size; x++) p += run(m.map((r) => r[x]));
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++)
      if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    const pat = [true, false, true, true, true, false, true];
    const hasPat = (line, i) => {
      for (let k = 0; k < 7; k++) if (line[i + k] !== pat[k]) return false;
      const before = line.slice(Math.max(0, i - 4), i);
      const after = line.slice(i + 7, i + 11);
      const clear = (arr) => arr.length >= 4 && arr.every((c) => !c);
      return clear(before) || clear(after);
    };
    for (let y = 0; y < size; y++) for (let x = 0; x + 7 <= size; x++) if (hasPat(m[y], x)) p += 40;
    for (let x = 0; x < size; x++) { const col = m.map((r) => r[x]); for (let y = 0; y + 7 <= size; y++) if (hasPat(col, y)) p += 40; }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };

  let best = 0, bestScore = Infinity;
  for (let k = 0; k < 8; k++) {
    applyMask(k); drawFormat(k);
    const s = penalty();
    if (s < bestScore) { bestScore = s; best = k; }
    applyMask(k);
  }
  applyMask(best); drawFormat(best);

  return { size, modules: m, version: v, getModuleCount: () => size, isDark: (r, c) => m[r][c] };
}

function encodeQR(text, ecl = "Q") {
  const bytes = new TextEncoder().encode(String(text));
  let v = 0;
  for (let t = 1; t <= 40; t++) {
    const cc = t <= 9 ? 8 : 16;
    if (4 + cc + 8 * bytes.length <= dataCodewords(t, ecl) * 8) { v = t; break; }
  }
  if (!v) throw new Error("Content too long for a QR code");
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(4, 4);
  push(bytes.length, v <= 9 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const dcw = dataCodewords(v, ecl);
  const cap = dcw * 8;
  for (let i = 0; i < Math.min(4, cap - bits.length); i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  for (let pad = 0xEC; data.length < dcw; pad ^= 0xEC ^ 0x11) data.push(pad);
  return buildMatrix(interleave(data, v, ecl), v, ecl);
}

  root.encodeQR = encodeQR;
})(typeof window !== "undefined" ? window : globalThis);
