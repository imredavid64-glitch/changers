import { Hono } from 'hono'
import { getDb, withRls } from '../db/client.js'
import { SignJWT, jwtVerify } from 'jose'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { generateQrSvg } from '../util/qr.js'

const JWT_SECRET = new TextEncoder().encode(config.jwtSecret)

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let out = ''
  for (const b of buf) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of s.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function totpSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

function totpCode(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  // big-endian 64-bit
  let v = counter
  for (let i = 7; i >= 0; i--) { buf[i] = v & 0xff; v = Math.floor(v / 256) }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(code % 1000000).padStart(6, '0')
}

function verifyTotpCode(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000 / 30)
  for (let w = -1; w <= 1; w++) {
    if (totpCode(secret, now + w) === code) return true
  }
  return false
}

async function issueSession(db: any, userId: string, email: string, aal: 'aal1' | 'aal2', amr: string[]) {
  const accessToken = await new SignJWT({ sub: userId, email, role: 'authenticated', aal, amr })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${config.sessionTtlSeconds}s`)
    .sign(JWT_SECRET)
  const refreshToken = randomToken(32)
  await db.query(`INSERT INTO auth.refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, now() + interval '${config.refreshTtlSeconds} seconds')`, [refreshToken, userId])
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: config.sessionTtlSeconds, token_type: 'bearer' }
}

async function getUserRow(db: any, userId: string) {
  const rows: any = await db.query(`SELECT id, email, raw_user_meta_data, created_at FROM auth.users WHERE id = $1`, [userId])
  return rows[0] || null
}

async function getFactors(db: any, userId: string) {
  const rows: any = await db.query(`SELECT id, factor_type, friendly_name, status FROM auth.mfa_factors WHERE user_id = $1`, [userId])
  return rows.map((r: any) => ({ id: r.id, factor_type: r.factor_type, friendly_name: r.friendly_name, status: r.status }))
}

export const authRouter = new Hono()

// POST /auth/v1/otp
authRouter.post('/auth/v1/otp', async (c) => {
  const db = await getDb()
  const body = await c.req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  if (!email) return c.json({ error: 'email required' }, 400)
  // find or create user
  let rows: any = await db.query(`SELECT id FROM auth.users WHERE email = $1`, [email])
  let userId: string
  if (rows.length) {
    userId = rows[0].id
  } else {
    if (body.create_user === false) return c.json({ error: 'user not found' }, 404)
    userId = crypto.randomUUID()
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [userId, email])
  }
  const code = genCode()
  await db.query(`DELETE FROM auth.otp_codes WHERE email = $1`, [email])
  await db.query(`INSERT INTO auth.otp_codes (email, code, expires_at, user_id) VALUES ($1, $2, now() + interval '${config.codeTtlSeconds} seconds', $3)`, [email, code, userId])
  // dev: log code
  console.log(`[auth] OTP code for ${email}: ${code}`)
  if (config.devMode && config.exposeCodes) {
    // store code in a place accessible? Expose via response? GoTrue doesn't return code. We'll just log.
  }
  return c.json({ user: null, session: null })
})

// POST /auth/v1/verify
authRouter.post('/auth/v1/verify', async (c) => {
  const db = await getDb()
  const body = await c.req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const token = String(body.token || '')
  const type = body.type || 'email'
  // find code
  const rows: any = await db.query(`SELECT code, expires_at, user_id FROM auth.otp_codes WHERE email = $1 ORDER BY expires_at DESC LIMIT 1`, [email])
  if (!rows.length) return c.json({ error: 'no code' }, 400)
  const r: any = rows[0]
  if (new Date(r.expires_at).getTime() < Date.now()) return c.json({ error: 'expired' }, 400)
  if (r.code !== token) return c.json({ error: 'invalid code' }, 400)
  await db.query(`DELETE FROM auth.otp_codes WHERE email = $1`, [email])
  const userId = r.user_id
  const u: any = await getUserRow(db, userId)
  const factors = await getFactors(db, userId)
  const hasTotp = factors.some((f: any) => f.factor_type === 'totp' && f.status === 'verified')
  // default aal1 unless user has verified totp and we require step-up; at sign-in with otp, aal1. If they have totp, frontend redirects to factor.
  const aal: 'aal1' | 'aal2' = 'aal1'
  const sess = await issueSession(db, userId, email, aal, ['otp'])
  const user = { id: userId, email: u.email, factors, aud: 'authenticated', role: 'authenticated', created_at: u.created_at }
  return c.json({ ...sess, user, token_type: 'bearer' })
})

// POST /auth/v1/token?grant_type=refresh_token
authRouter.post('/auth/v1/token', async (c) => {
  const db = await getDb()
  const url = new URL(c.req.url)
  const grant = url.searchParams.get('grant_type')
  const body = await c.req.json().catch(() => ({}))
  if (grant === 'refresh_token') {
    const rt = body.refresh_token
    const rows: any = await db.query(`SELECT user_id, expires_at FROM auth.refresh_tokens WHERE token = $1`, [rt])
    if (!rows.length) return c.json({ error: 'invalid refresh token' }, 400)
    const r: any = rows[0]
    if (new Date(r.expires_at).getTime() < Date.now()) return c.json({ error: 'expired' }, 400)
    // delete old
    await db.query(`DELETE FROM auth.refresh_tokens WHERE token = $1`, [rt])
    const u: any = await getUserRow(db, r.user_id)
    const factors = await getFactors(db, r.user_id)
    const hasVerifiedTotp = factors.some((f: any) => f.factor_type === 'totp' && f.status === 'verified')
    // determine aal: if user had aal2? We don't track; default aal1. Frontend will step up if needed.
    const aal: 'aal1' | 'aal2' = 'aal1'
    const sess = await issueSession(db, r.user_id, u.email, aal, ['refresh_token'])
    const user = { id: r.user_id, email: u.email, factors, aud: 'authenticated', role: 'authenticated', created_at: u.created_at }
    return c.json({ ...sess, user, token_type: 'bearer' })
  }
  return c.json({ error: 'unsupported grant' }, 400)
})

// GET /auth/v1/user
authRouter.get('/auth/v1/user', async (c) => {
  const db = await getDb()
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return c.json({ error: 'no token' }, 401)
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ['HS256'] })
    const userId = String(payload.sub)
    const u: any = await getUserRow(db, userId)
    if (!u) return c.json({ error: 'user not found' }, 404)
    const factors = await getFactors(db, userId)
    const user = { id: userId, email: u.email, factors, aud: 'authenticated', role: 'authenticated', created_at: u.created_at, app_metadata: {}, user_metadata: u.raw_user_meta_data || {} }
    return c.json(user)
  } catch {
    return c.json({ error: 'invalid token' }, 401)
  }
})

// POST /auth/v1/logout
authRouter.post('/auth/v1/logout', async (c) => {
  const db = await getDb()
  const url = new URL(c.req.url)
  const scope = url.searchParams.get('scope') || 'local'
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ['HS256'] })
    if (scope === 'global') {
      await db.query(`DELETE FROM auth.refresh_tokens WHERE user_id = $1`, [payload.sub])
    } else {
      // local: can't identify refresh token from access token; delete all for user? Supabase local scope deletes current session. We'll delete refresh tokens issued... just delete all for simplicity.
      await db.query(`DELETE FROM auth.refresh_tokens WHERE user_id = $1`, [payload.sub])
    }
  } catch {}
  return c.json({})
})

// MFA enroll: POST /auth/v1/factors
authRouter.post('/auth/v1/factors', async (c) => {
  const db = await getDb()
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  let userId: string
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ['HS256'] })
    userId = String(payload.sub)
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const body = await c.req.json().catch(() => ({}))
  const factorType = body.factorType || body.factor_type || 'totp'
  const friendlyName = body.friendlyName || body.friendly_name || 'Authenticator'
  // unenroll unverified existing
  await db.query(`DELETE FROM auth.mfa_factors WHERE user_id = $1 AND factor_type = $2 AND status <> 'verified'`, [userId, factorType])
  const secret = totpSecret()
  const rows: any = await db.query(`INSERT INTO auth.mfa_factors (user_id, factor_type, friendly_name, secret, status) VALUES ($1, $2, $3, $4, 'unverified') RETURNING id`, [userId, factorType, friendlyName, secret])
  const id = rows[0].id
  const issuer = 'Changemakers'
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userId)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
  const qr = generateQrSvg(uri)
  return c.json({ id, type: 'totp', friendly_name: friendlyName, status: 'unverified', totp: { qr_code: qr, secret, uri } })
})

// DELETE /auth/v1/factors/:id
authRouter.delete('/auth/v1/factors/:id', async (c) => {
  const db = await getDb()
  const id = c.req.param('id')
  await db.query(`DELETE FROM auth.mfa_factors WHERE id = $1`, [id])
  return c.json({})
})

// POST /auth/v1/factors/:id/challenge
authRouter.post('/auth/v1/factors/:id/challenge', async (c) => {
  const db = await getDb()
  const id = c.req.param('id')
  // return a challenge id (reuse factor id as challenge id for simplicity)
  return c.json({ id: crypto.randomUUID(), factor_id: id })
})

// POST /auth/v1/factors/:id/verify
authRouter.post('/auth/v1/factors/:id/verify', async (c) => {
  const db = await getDb()
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const code = String(body.code || '')
  const challengeId = body.challenge_id
  const rows: any = await db.query(`SELECT user_id, secret, status FROM auth.mfa_factors WHERE id = $1`, [id])
  if (!rows.length) return c.json({ error: 'factor not found' }, 404)
  const f: any = rows[0]
  if (!verifyTotpCode(f.secret, code)) return c.json({ error: 'invalid code' }, 400)
  // mark verified
  await db.query(`UPDATE auth.mfa_factors SET status = 'verified' WHERE id = $1`, [id])
  // issue new session aal2
  const u: any = await getUserRow(db, f.user_id)
  const factors = await getFactors(db, f.user_id)
  const sess = await issueSession(db, f.user_id, u.email, 'aal2', ['otp', 'totp'])
  const user = { id: f.user_id, email: u.email, factors, aud: 'authenticated', role: 'authenticated', created_at: u.created_at }
  return c.json({ ...sess, user, token_type: 'bearer' })
})

// auth/v1/settings? not needed
// GET /auth/v1/settings
authRouter.get('/auth/v1/settings', async (c) => {
  return c.json({ external: {}, disable_signup: false, mailer_autoconfirm: true })
})
