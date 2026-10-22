const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
;(function init() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function rsGenPoly(nsym: number): number[] {
  let g = [1]
  for (let i = 0; i < nsym; i++) {
    const ng = new Array(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= gfMul(g[j], GF_EXP[i])
      ng[j + 1] ^= g[j]
    }
    g = ng
  }
  return g
}

function rsEncode(data: number[], nsym: number): number[] {
  const gen = rsGenPoly(nsym)
  const out = data.concat(new Array(nsym).fill(0))
  for (let i = 0; i < data.length; i++) {
    const coef = out[i]
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        out[i + j] ^= gfMul(gen[j], coef)
      }
    }
  }
  return out.slice(data.length)
}

const CAP_L = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271]
const DATA_CW = [19, 34, 55, 80, 108, 136, 156, 192, 230, 271]
const ECC_CW = [7, 10, 15, 20, 26, 36, 40, 50, 62, 75]

function chooseVersion(len: number): number {
  for (let v = 1; v <= 10; v++) {
    if (len <= CAP_L[v - 1]) return v
  }
  return 10
}

function makeMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => new Array(n).fill(-1))
}

function setModule(m: number[][], r: number, c: number, v: number) {
  if (r >= 0 && r < m.length && c >= 0 && c < m.length) m[r][c] = v
}

function addFinder(m: number[][], r: number, c: number) {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue
      let v = 0
      if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
        if (dr === 0 || dr === 6 || dc === 0 || dc === 6) v = 1
        else if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) v = 1
      }
      m[rr][cc] = v
    }
  }
}

function addAlignment(m: number[][], r: number, c: number) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue
      let v = 0
      if (Math.abs(dr) === 2 || Math.abs(dc) === 2) v = 1
      else if (dr === 0 && dc === 0) v = 1
      m[rr][cc] = v
    }
  }
}

const ALIGN_POS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

function addTiming(m: number[][]) {
  const n = m.length
  for (let i = 8; i < n - 8; i++) {
    if (m[6][i] === -1) m[6][i] = i % 2 === 0 ? 1 : 0
    if (m[i][6] === -1) m[i][6] = i % 2 === 0 ? 1 : 0
  }
}

function reserveFormat(m: number[][]) {
  const n = m.length
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === -1) m[8][i] = 0
    if (m[i][8] === -1) m[i][8] = 0
  }
  for (let i = 0; i < 8; i++) {
    if (m[n - 1 - i][8] === -1) m[n - 1 - i][8] = 0
    if (m[8][n - 1 - i] === -1) m[8][n - 1 - i] = 0
  }
  m[n - 8][8] = 1
}

function isProtected(r: number, c: number, n: number): boolean {
  if (r < 9 && c < 9) return true
  if (r < 9 && c >= n - 8) return true
  if (r >= n - 8 && c < 9) return true
  if (r === 6 || c === 6) return true
  if (r === 8 || c === 8) return true
  return false
}

function placeData(m: number[][], data: number[]) {
  const n = m.length
  let idx = 0
  let up = true
  for (let col = n - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5
    for (let i = 0; i < n; i++) {
      const r = up ? n - 1 - i : i
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc
        if (m[r][c] !== -1) continue
        if (idx < data.length * 8) {
          const byte = data[Math.floor(idx / 8)]
          const bit = (byte >> (7 - (idx % 8))) & 1
          m[r][c] = bit
          idx++
        } else {
          m[r][c] = 0
        }
      }
    }
    up = !up
  }
}

function pushBits(bits: number[], val: number, n: number) {
  for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1)
}

function encodeData(text: string, version: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(text))
  const D = DATA_CW[version - 1]
  const E = ECC_CW[version - 1]
  const bits: number[] = []
  pushBits(bits, 0b0100, 4)
  const countBits = version <= 9 ? 8 : 16
  pushBits(bits, bytes.length, countBits)
  for (const b of bytes) pushBits(bits, b, 8)
  pushBits(bits, 0, 4)
  while (bits.length % 8) bits.push(0)
  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
    codewords.push(v)
  }
  let pad = 0
  while (codewords.length < D) {
    codewords.push(pad % 2 === 0 ? 0xec : 0x11)
    pad++
  }
  const ecc = rsEncode(codewords, E)
  return codewords.concat(ecc)
}

const FORMAT_L0 = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]

function addFormatInfo(m: number[][]) {
  const n = m.length
  for (let i = 0; i < 8; i++) m[8][i] = FORMAT_L0[i]
  for (let i = 0; i < 7; i++) m[8][n - 1 - i] = FORMAT_L0[8 + i]
  for (let i = 0; i < 7; i++) m[n - 1 - i][8] = FORMAT_L0[i]
  for (let i = 0; i < 8; i++) m[i][8] = FORMAT_L0[7 + i]
  m[8][8] = 0
}

export function generateQrSvg(text: string): string {
  const version = chooseVersion(text.length) // approximate
  // ensure version fits bytes
  let v = version
  while (v <= 10 && text.length > CAP_L[v - 1]) v++
  if (v > 10) v = 10
  const n = 17 + v * 4
  const m = makeMatrix(n)
  addFinder(m, 0, 0)
  addFinder(m, 0, n - 7)
  addFinder(m, n - 7, 0)
  if (v >= 2) {
    const positions = ALIGN_POS[v - 1] || [6, n - 7]
    for (const r of positions) {
      for (const c of positions) {
        if (m[r][c] === -1) addAlignment(m, r, c)
      }
    }
  }
  addTiming(m)
  reserveFormat(m)
  const data = encodeData(text, v)
  placeData(m, data)
  // apply mask 0 to data modules
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c] === -1) continue
      if (isProtected(r, c, n)) continue
      const mask = (r + c) % 2 === 0
      m[r][c] = m[r][c] ^ (mask ? 1 : 0)
    }
  }
  addFormatInfo(m)
  const cell = 4
  const size = n * cell
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
  svg += `<rect width="100%" height="100%" fill="white"/>`
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c] === 1) {
        svg += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="black"/>`
      }
    }
  }
  svg += `</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
