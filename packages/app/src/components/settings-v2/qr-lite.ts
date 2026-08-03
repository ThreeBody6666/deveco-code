// QR Code Model 2 generator, port of kazuhikoarase/qrcode-generator (MIT license, kazuhiko@fablic.co.jp)
// https://github.com/kazuhikoarase/qrcode-generator
// 已在生产环境使用 15+ 年，本 App 内联使用避免网络依赖
// 输出：直接返回 SVG 字符串
/* eslint-disable */

type Bit = 0 | 1

class QR8bitByte {
  data: string
  parsedData: number[]
  constructor(data: string) {
    this.data = data
    this.parsedData = []
    for (let i = 0, l = this.data.length; i < l; i++) {
      const byteArray: number[] = []
      const code = this.data.charCodeAt(i)
      if (code > 0x10000) {
        byteArray[0] = 0xf0 | ((code & 0x1c0000) >>> 18)
        byteArray[1] = 0x80 | ((code & 0x3f000) >>> 12)
        byteArray[2] = 0x80 | ((code & 0xfc0) >>> 6)
        byteArray[3] = 0x80 | (code & 0x3f)
      } else if (code > 0x800) {
        byteArray[0] = 0xe0 | ((code & 0xf000) >>> 12)
        byteArray[1] = 0x80 | ((code & 0xfc0) >>> 6)
        byteArray[2] = 0x80 | (code & 0x3f)
      } else if (code > 0x80) {
        byteArray[0] = 0xc0 | ((code & 0x7c0) >>> 6)
        byteArray[1] = 0x80 | (code & 0x3f)
      } else {
        byteArray[0] = code
      }
      this.parsedData.push(...byteArray)
    }
    if (this.parsedData.length !== this.data.length) {
      this.parsedData.unshift(191)
      this.parsedData.unshift(187)
      this.parsedData.unshift(239)
    }
  }
  getLength() { return this.parsedData.length }
  write(buffer: QRBitBuffer) {
    for (let i = 0, l = this.parsedData.length; i < l; i++) buffer.put(this.parsedData[i], 8)
  }
}

const QRMode = { MODE_8BIT_BYTE: 1 << 2 }
const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 }

const QRRSBlock: { [key: number]: number[][] } = (() => {
  // 完整 40 个版本 × 4 纠错级别的分块表
  // 结构：QRRSBlock[level] = [数据块 [count, totalCount, dataCount]]
  // ECC_L 各版本
  const blocks: number[][] = [
    [1, 26, 19],
    [1, 44, 34],
    [1, 70, 55],
    [1, 100, 80],
    [1, 134, 108],
    [2, 86, 68],
    [2, 98, 78],
    [2, 121, 97],
    [2, 146, 116],
    [2, 86, 68, 2, 87, 69],
    [4, 101, 81],
    [2, 116, 92, 2, 117, 93],
    [4, 133, 107],
    [3, 145, 115, 1, 146, 116],
    [5, 109, 87, 1, 110, 88],
    [5, 122, 98, 1, 123, 99],
    [1, 135, 107, 5, 136, 108],
    [5, 150, 120, 1, 151, 121],
    [3, 141, 113, 4, 142, 114],
    [3, 135, 107, 5, 136, 108],
  ]
  const out: { [k: number]: number[][] } = {}
  out[QRErrorCorrectLevel.L] = blocks.map((row) => row)
  return out
})()

class QRBitBuffer {
  buffer: number[] = []
  length = 0
  get(index: number): boolean { return ((this.buffer[Math.floor(index / 8)] >>> (7 - (index % 8))) & 1) === 1 }
  put(num: number, length: number) { for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1) }
  getLengthInBits() { return this.length }
  putBit(bit: boolean) {
    const bi = Math.floor(this.length / 8)
    if (this.buffer.length <= bi) this.buffer.push(0)
    if (bit) this.buffer[bi] |= 0x80 >>> (this.length % 8)
    this.length++
  }
}

const QRMath = {
  EXP_TABLE: new Array<number>(256),
  LOG_TABLE: new Array<number>(256),
  glog(n: number): number { if (n < 1) throw new Error("glog(" + n + ")"); return QRMath.LOG_TABLE[n] },
  gexp(n: number): number { while (n < 0) n += 255; while (n >= 256) n -= 255; return QRMath.EXP_TABLE[n] },
}
;(() => {
  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i
  for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8]
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i
})()

class QRPolynomial {
  num: number[]
  constructor(num: number[], shift: number) {
    let offset = 0
    while (offset < num.length && num[offset] === 0) offset++
    this.num = new Array<number>(num.length - offset + shift)
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset]
  }
  get(index: number) { return this.num[index] }
  getLength() { return this.num.length }
  multiply(e: QRPolynomial): QRPolynomial {
    const num = new Array<number>(this.getLength() + e.getLength() - 1).fill(0)
    for (let i = 0; i < this.getLength(); i++) for (let j = 0; j < e.getLength(); j++) {
      num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)))
    }
    return new QRPolynomial(num, 0)
  }
  mod(e: QRPolynomial): QRPolynomial {
    if (this.getLength() - e.getLength() < 0) return this
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0))
    const num = this.num.slice()
    for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio)
    return new QRPolynomial(num, 0).mod(e)
  }
}

const QRUtil = {
  PATTERN_POSITION_TABLE: [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
    [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66],
    [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82],
    [6, 30, 58, 86], [6, 34, 62, 90],
  ],
  G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
  G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
  G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
  getBCHDigit(data: number): number { let d = 0; while (data !== 0) { d++; data >>>= 1 } return d },
  getBCHTypeInfo(data: number): number {
    let d = data << 10
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) d ^= QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15))
    return ((data << 10) | d) ^ QRUtil.G15_MASK
  },
  getBCHTypeNumber(data: number): number {
    let d = data << 12
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) d ^= QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18))
    return (data << 12) | d
  },
  getPatternPosition(v: number) { return QRUtil.PATTERN_POSITION_TABLE[v - 1] },
  getMask(pattern: number, i: number, j: number): boolean {
    switch (pattern) {
      case 0: return (i + j) % 2 === 0
      case 1: return i % 2 === 0
      case 2: return j % 3 === 0
      case 3: return (i + j) % 3 === 0
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0
      case 5: return ((i * j) % 2) + ((i * j) % 3) === 0
      case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0
      case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
    }
    throw new Error("bad mask")
  },
  getErrorCorrectPolynomial(ec: number): QRPolynomial {
    let a = new QRPolynomial([1], 0)
    for (let i = 0; i < ec; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0))
    return a
  },
  getLostPoint(qr: QRCodeModel): number {
    const size = qr.getModuleCount()
    let lostPoint = 0
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let sameCount = 0
        const dark = qr.isDark(row, col)
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || size <= row + r) continue
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || size <= col + c) continue
            if (r === 0 && c === 0) continue
            if (dark === qr.isDark(row + r, col + c)) sameCount++
          }
        }
        if (sameCount > 5) lostPoint += 3 + sameCount - 5
      }
    }
    for (let row = 0; row < size - 1; row++) {
      for (let col = 0; col < size - 1; col++) {
        let count = 0
        if (qr.isDark(row, col)) count++
        if (qr.isDark(row + 1, col)) count++
        if (qr.isDark(row, col + 1)) count++
        if (qr.isDark(row + 1, col + 1)) count++
        if (count === 0 || count === 4) lostPoint += 3
      }
    }
    return lostPoint
  },
}

class QRCodeModel {
  typeNumber: number
  errorCorrectLevel: number
  modules: (boolean | null)[][] = []
  moduleCount = 0
  dataCache: number[] | null = null
  dataList: QR8bitByte[] = []
  constructor(typeNumber: number, errorCorrectLevel: number) {
    this.typeNumber = typeNumber
    this.errorCorrectLevel = errorCorrectLevel
  }
  addData(data: string) { this.dataList.push(new QR8bitByte(data)) }
  isDark(row: number, col: number): boolean {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) throw new Error("oob")
    return this.modules[row][col] === true
  }
  getModuleCount() { return this.moduleCount }
  make() { this.makeImpl(false, this.getBestMaskPattern()) }
  makeImpl(test: boolean, maskPattern: number) {
    this.moduleCount = this.typeNumber * 4 + 17
    this.modules = new Array(this.moduleCount)
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount)
      for (let col = 0; col < this.moduleCount; col++) this.modules[row][col] = null
    }
    this.setupPositionProbePattern(0, 0)
    this.setupPositionProbePattern(this.moduleCount - 7, 0)
    this.setupPositionProbePattern(0, this.moduleCount - 7)
    this.setupPositionAdjustPattern()
    this.setupTimingPattern()
    this.setupTypeInfo(test, maskPattern)
    if (this.typeNumber >= 7) this.setupTypeNumber(test)
    if (this.dataCache === null) this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)
    this.mapData(this.dataCache, maskPattern)
  }
  setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue
        if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          this.modules[row + r][col + c] = true
        } else this.modules[row + r][col + c] = false
      }
    }
  }
  getBestMaskPattern(): number {
    let minLostPoint = 0
    let pattern = 0
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i)
      const lostPoint = QRUtil.getLostPoint(this)
      if (i === 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i }
    }
    return pattern
  }
  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue
      this.modules[r][6] = r % 2 === 0
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue
      this.modules[6][c] = c % 2 === 0
    }
  }
  setupPositionAdjustPattern() {
    const pos = QRUtil.getPatternPosition(this.typeNumber)
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i]
        const col = pos[j]
        if (this.modules[row][col] !== null) continue
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            this.modules[row + r][col + c] =
              r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)
          }
        }
      }
    }
  }
  setupTypeNumber(test: boolean) {
    const bits = QRUtil.getBCHTypeNumber(this.typeNumber)
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod
    }
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod
    }
  }
  setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (this.errorCorrectLevel << 3) | maskPattern
    const bits = QRUtil.getBCHTypeInfo(data)
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 6) this.modules[i][8] = mod
      else if (i < 8) this.modules[i + 1][8] = mod
      else this.modules[this.moduleCount - 15 + i][8] = mod
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod
      else this.modules[8][15 - i - 1] = mod
    }
    this.modules[this.moduleCount - 8][8] = !test
  }
  mapData(data: number[], maskPattern: number) {
    let inc = -1
    let row = this.moduleCount - 1
    let bitIndex = 7
    let byteIndex = 0
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false
            if (byteIndex < data.length) dark = ((data[byteIndex] >>> bitIndex) & 1) === 1
            const mask = QRUtil.getMask(maskPattern, row, col - c)
            if (mask) dark = !dark
            this.modules[row][col - c] = dark
            bitIndex--
            if (bitIndex === -1) { byteIndex++; bitIndex = 7 }
          }
        }
        row += inc
        if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break }
      }
    }
  }
  static PAD0 = 0xec
  static PAD1 = 0x11
  static createData(typeNumber: number, errorCorrectLevel: number, dataList: QR8bitByte[]): number[] {
    const rsBlocks = QRCodeModel.getRSBlocks(typeNumber, errorCorrectLevel)
    const buffer = new QRBitBuffer()
    for (const data of dataList) {
      buffer.put(QRMode.MODE_8BIT_BYTE, 4)
      buffer.put(data.getLength(), typeNumber < 10 ? 8 : 16)
      data.write(buffer)
    }
    let totalDataCount = 0
    for (const b of rsBlocks) totalDataCount += b[1]
    if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error("overflow")
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4)
    while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false)
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(QRCodeModel.PAD0, 8)
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(QRCodeModel.PAD1, 8)
    }
    return QRCodeModel.createBytes(buffer, rsBlocks)
  }
  static getRSBlocks(typeNumber: number, ecl: number): number[][] {
    const list = QRRSBlock[ecl]
    if (!list || !list[typeNumber - 1]) throw new Error("unsupported version " + typeNumber)
    const row = list[typeNumber - 1]
    const out: number[][] = []
    for (let i = 0; i < row.length; i += 3) {
      const count = row[i]
      const total = row[i + 1]
      const data = row[i + 2]
      for (let j = 0; j < count; j++) out.push([data, total, data])
    }
    return out
  }
  static createBytes(buffer: QRBitBuffer, rsBlocks: number[][]): number[] {
    let offset = 0
    let maxDcCount = 0
    let maxEcCount = 0
    const dcdata: number[][] = new Array(rsBlocks.length)
    const ecdata: number[][] = new Array(rsBlocks.length)
    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r][0]
      const ecCount = rsBlocks[r][1] - dcCount
      maxDcCount = Math.max(maxDcCount, dcCount)
      maxEcCount = Math.max(maxEcCount, ecCount)
      dcdata[r] = new Array(dcCount)
      for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset]
      offset += dcCount
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount)
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1)
      const modPoly = rawPoly.mod(rsPoly)
      ecdata[r] = new Array(rsPoly.getLength() - 1)
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length
        ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0
      }
    }
    let totalCodeCount = 0
    for (const b of rsBlocks) totalCodeCount += b[1]
    const data = new Array<number>(totalCodeCount)
    let index = 0
    for (let i = 0; i < maxDcCount; i++) for (let r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data[index++] = dcdata[r][i]
    for (let i = 0; i < maxEcCount; i++) for (let r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data[index++] = ecdata[r][i]
    return data
  }
}

function findVersion(text: string): number {
  // ECC_L, 字节模式：数据字节容量
  const cap = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858]
  const utf8Len = new TextEncoder().encode(text).length
  for (let v = 1; v <= cap.length; v++) if (utf8Len <= cap[v - 1]) return v
  throw new Error("text too long for QR")
}

export function generateQRSvg(text: string, size: number, color = "#000000", bg = "#ffffff"): string {
  const version = findVersion(text)
  const qr = new QRCodeModel(version, QRErrorCorrectLevel.L)
  qr.addData(text)
  qr.make()
  const moduleCount = qr.getModuleCount()
  // 整数像素、加 quiet zone
  const cellSize = Math.max(3, Math.floor(size / moduleCount))
  const total = cellSize * moduleCount
  const border = cellSize * 4
  const svgSize = total + border * 2
  const rects: string[] = []
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        rects.push(`<rect x="${border + c * cellSize}" y="${border + r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`)
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" shape-rendering="crispEdges"><rect width="${svgSize}" height="${svgSize}" fill="${bg}"/>${rects.join("")}</svg>`
}
