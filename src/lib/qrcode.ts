/**
 * Минимальный кодировщик QR-кода (байтовый режим, версии 1–10, коррекция ошибок L) — без npm-пакета
 * (пакеты сами не ставим). Нужен F-00-200 «QR на стойку» и любому другому месту со ссылкой в QR.
 * Порт известного алгоритма QR (Kazuhiko Arase, MIT, `qrcode.js`) — только байтовый режим ASCII-ссылок.
 */

type ECLevel = 'L' | 'M' | 'Q' | 'H';

const EC_INDEX: Record<ECLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Порождающие многочлены BCH для служебной информации формата/версии (ISO/IEC 18004)
const G15 = 0x537; // x^10+x^8+x^5+x^4+x^2+x+1
const G18 = 0x1f25; // x^12+x^11+x^10+x^9+x^8+x^5+x^2+1
const G15_MASK = 0x5412; // 101010000010010

const PAD0 = 0xec;
const PAD1 = 0x11;

class QRMath {
  static EXP_TABLE: number[] = new Array(256);
  static LOG_TABLE: number[] = new Array(256);
  static {
    for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
    for (let i = 8; i < 256; i++) {
      QRMath.EXP_TABLE[i] =
        QRMath.EXP_TABLE[i - 4] ^
        QRMath.EXP_TABLE[i - 5] ^
        QRMath.EXP_TABLE[i - 6] ^
        QRMath.EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
  }
  static glog(n: number): number {
    if (n < 1) throw new Error(`glog(${n})`);
    return QRMath.LOG_TABLE[n];
  }
  static gexp(n: number): number {
    let k = n;
    while (k < 0) k += 255;
    while (k >= 256) k -= 255;
    return QRMath.EXP_TABLE[k];
  }
}

class QRPolynomial {
  num: number[];
  constructor(num: number[], shift: number) {
    let offset = 0;
    while (offset < num.length - 1 && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift).fill(0);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  get(index: number): number {
    return this.num[index];
  }
  getLength(): number {
    return this.num.length;
  }
  multiply(e: QRPolynomial): QRPolynomial {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  }
  mod(e: QRPolynomial): QRPolynomial {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = this.num.slice();
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num, 0).mod(e);
  }
}

// [totalCodewords, ecCodewordsPerBlock, blocks1, dataPerBlock1, blocks2, dataPerBlock2] по версии-уровню (1..10)
const RS_BLOCK: Record<string, [number, number, number, number, number, number]> = {
  '1-L': [26, 7, 1, 19, 0, 0], '1-M': [26, 10, 1, 16, 0, 0], '1-Q': [26, 13, 1, 13, 0, 0], '1-H': [26, 17, 1, 9, 0, 0],
  '2-L': [44, 10, 1, 34, 0, 0], '2-M': [44, 16, 1, 28, 0, 0], '2-Q': [44, 22, 1, 22, 0, 0], '2-H': [44, 28, 1, 16, 0, 0],
  '3-L': [70, 15, 1, 55, 0, 0], '3-M': [70, 26, 1, 44, 0, 0], '3-Q': [70, 18, 2, 17, 0, 0], '3-H': [70, 22, 2, 13, 0, 0],
  '4-L': [100, 20, 1, 80, 0, 0], '4-M': [100, 18, 2, 32, 0, 0], '4-Q': [100, 26, 2, 24, 0, 0], '4-H': [100, 16, 4, 9, 0, 0],
  '5-L': [134, 26, 1, 108, 0, 0], '5-M': [134, 24, 2, 43, 0, 0], '5-Q': [134, 18, 2, 15, 2, 16], '5-H': [134, 22, 2, 11, 2, 12],
  '6-L': [172, 18, 2, 68, 0, 0], '6-M': [172, 16, 4, 27, 0, 0], '6-Q': [172, 24, 4, 19, 0, 0], '6-H': [172, 28, 4, 15, 0, 0],
  '7-L': [196, 20, 2, 78, 0, 0], '7-M': [196, 18, 4, 31, 0, 0], '7-Q': [196, 18, 2, 14, 4, 15], '7-H': [196, 26, 4, 13, 1, 14],
  '8-L': [242, 24, 2, 97, 0, 0], '8-M': [242, 22, 2, 38, 2, 39], '8-Q': [242, 22, 4, 18, 2, 19], '8-H': [242, 26, 4, 14, 2, 15],
  '9-L': [292, 30, 2, 116, 0, 0], '9-M': [292, 22, 3, 36, 2, 37], '9-Q': [292, 20, 4, 16, 4, 17], '9-H': [292, 24, 4, 12, 4, 13],
  '10-L': [346, 18, 2, 68, 2, 69], '10-M': [346, 26, 4, 43, 1, 44], '10-Q': [346, 24, 6, 19, 2, 20], '10-H': [346, 28, 6, 15, 2, 16],
};

function getRSBlocks(version: number, ec: ECLevel): { dataCount: number; totalCount: number }[] {
  const row = RS_BLOCK[`${version}-${ec}`];
  if (!row) throw new Error(`QR: unsupported version ${version}`);
  const [, ecPerBlock, blocks1, data1, blocks2, data2] = row;
  const blocks: { dataCount: number; totalCount: number }[] = [];
  for (let i = 0; i < blocks1; i++) blocks.push({ dataCount: data1, totalCount: data1 + ecPerBlock });
  for (let i = 0; i < blocks2; i++) blocks.push({ dataCount: data2, totalCount: data2 + ecPerBlock });
  return blocks;
}

class BitBuffer {
  buffer: number[] = [];
  length = 0;
  put(num: number, length: number) {
    for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
  }
  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> this.length % 8;
    this.length++;
  }
}

function getBCHDigit(data: number): number {
  let digit = 0;
  let d = data;
  while (d !== 0) {
    digit++;
    d >>>= 1;
  }
  return digit;
}

function getBCHTypeInfo(data: number): number {
  let d = data << 10;
  while (getBCHDigit(d) - getBCHDigit(G15) >= 0) d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15));
  return ((data << 10) | d) ^ G15_MASK;
}

function getBCHTypeNumber(data: number): number {
  let d = data << 12;
  while (getBCHDigit(d) - getBCHDigit(G18) >= 0) d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18));
  return (data << 12) | d;
}

const PATTERN_POSITION_TABLE: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
];

function maskFunc(pattern: number, i: number, j: number): boolean {
  switch (pattern) {
    case 0: return (i + j) % 2 === 0;
    case 1: return i % 2 === 0;
    case 2: return j % 3 === 0;
    case 3: return (i + j) % 3 === 0;
    case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default: throw new Error(`mask ${pattern}`);
  }
}

/** QR-код (matrix[y][x] = true → тёмный модуль), версия подбирается автоматически 1..10 */
export function encodeQR(text: string, ec: ECLevel = 'L'): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  let blocks: { dataCount: number; totalCount: number }[] | undefined;
  for (; version <= 10; version++) {
    const candidate = getRSBlocks(version, ec);
    const totalData = candidate.reduce((s, b) => s + b.dataCount, 0);
    if (bytes.length <= totalData - 3) {
      blocks = candidate;
      break;
    }
  }
  if (!blocks) throw new Error('QR: text too long for supported versions (1-10)');

  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // байтовый режим
  buffer.put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) buffer.put(b, 8);

  const totalDataCount = blocks.reduce((s, b) => s + b.dataCount, 0);
  if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
  while (buffer.length % 8 !== 0) buffer.putBit(false);
  for (let guard = 0; buffer.length < totalDataCount * 8 && guard < totalDataCount * 2; guard++) {
    buffer.put(guard % 2 === 0 ? PAD0 : PAD1, 8);
  }

  const dataByte = buffer.buffer;
  let offset = 0;
  const dcdata: number[][] = [];
  const ecdata: number[][] = [];
  let maxDc = 0;
  let maxEc = 0;
  for (const block of blocks) {
    const dc = new Array(block.dataCount);
    for (let i = 0; i < block.dataCount; i++) dc[i] = dataByte[offset + i] & 0xff;
    offset += block.dataCount;
    const ecCount = block.totalCount - block.dataCount;
    let rsPoly = new QRPolynomial([1], 0);
    for (let i = 0; i < ecCount; i++) rsPoly = rsPoly.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
    const rawPoly = new QRPolynomial(dc, rsPoly.getLength() - 1);
    const modPoly = rawPoly.mod(rsPoly);
    const ecBytes = new Array(rsPoly.getLength() - 1);
    for (let i = 0; i < ecBytes.length; i++) {
      const modIndex = i + modPoly.getLength() - ecBytes.length;
      ecBytes[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
    dcdata.push(dc);
    ecdata.push(ecBytes);
    maxDc = Math.max(maxDc, dc.length);
    maxEc = Math.max(maxEc, ecBytes.length);
  }

  const totalCodeCount = blocks.reduce((s, b) => s + b.totalCount, 0);
  const finalData: number[] = new Array(totalCodeCount);
  let index = 0;
  for (let i = 0; i < maxDc; i++) for (const dc of dcdata) if (i < dc.length) finalData[index++] = dc[i];
  for (let i = 0; i < maxEc; i++) for (const ecArr of ecdata) if (i < ecArr.length) finalData[index++] = ecArr[i];

  const size = 21 + (version - 1) * 4;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));

  const setupPositionProbePattern = (pRow: number, pCol: number) => {
    for (let r = -1; r <= 7; r++) {
      if (pRow + r <= -1 || size <= pRow + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (pCol + c <= -1 || size <= pCol + c) continue;
        const dark =
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4);
        modules[pRow + r][pCol + c] = dark;
      }
    }
  };
  setupPositionProbePattern(0, 0);
  setupPositionProbePattern(size - 7, 0);
  setupPositionProbePattern(0, size - 7);

  const positions = PATTERN_POSITION_TABLE[version - 1] ?? [];
  for (const pr of positions) {
    for (const pc of positions) {
      if (modules[pr][pc] !== null) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          modules[pr + r][pc + c] = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (modules[i][6] === null) modules[i][6] = i % 2 === 0;
    if (modules[6][i] === null) modules[6][i] = i % 2 === 0;
  }

  modules[size - 8][8] = true;

  const typeInfo = getBCHTypeInfo((EC_INDEX[ec] << 3) | 0);
  for (let i = 0; i < 15; i++) {
    const bit = ((typeInfo >> i) & 1) === 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[size - 15 + i][8] = bit;
    if (i < 8) modules[8][size - i - 1] = bit;
    else if (i < 9) modules[8][15 - i - 1 + 1] = bit;
    else modules[8][15 - i - 1] = bit;
  }

  if (version >= 7) {
    const typeNumber = getBCHTypeNumber(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((typeNumber >> i) & 1) === 1;
      modules[Math.floor(i / 3)][(i % 3) + size - 8 - 3] = bit;
      modules[(i % 3) + size - 8 - 3][Math.floor(i / 3)] = bit;
    }
  }

  const maskPattern = 0;
  let byteIndex = 0;
  let bitIndex = 7;
  let inc = -1;
  let row = size - 1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    while (true) {
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (modules[row][x] === null) {
          let dark = byteIndex < finalData.length && ((finalData[byteIndex] >>> bitIndex) & 1) === 1;
          if (maskFunc(maskPattern, row, x)) dark = !dark;
          modules[row][x] = dark;
          bitIndex--;
          if (bitIndex === -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }
      row += inc;
      if (row < 0 || size <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }

  return modules.map((r) => r.map((v) => v === true));
}
