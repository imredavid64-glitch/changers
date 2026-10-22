// RFC 6238 TOTP (HMAC-SHA1, 30 s steps, 6 digits) over a base32 secret, as authenticator apps compute it.
// Checked against the RFC's SHA-1 test vectors. No package: node:crypto only.
import { createHmac } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Decode(secret: string): Buffer {
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const ch of secret.toUpperCase().replace(/[\s=]/g, '')) {
    const i = ALPHABET.indexOf(ch)
    if (i < 0) throw new Error('the TOTP secret is not base32')
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >> bits) & 0xff)
      value &= (1 << bits) - 1
    }
  }
  return Buffer.from(out)
}

export function totp(secret: string, atMs = Date.now(), step = 30, digits = 6): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / step)))
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const o = h[h.length - 1] & 0x0f
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

/** Milliseconds until the next 30-second step begins. */
export const msToNextStep = (atMs = Date.now(), step = 30) => step * 1000 - (atMs % (step * 1000))
