// Signing in without email (07 §2): the admin client's generateLink({ type: 'magiclink' }) returns the 6-digit code
// (email_otp) and sends nothing; verifyOtp({ type: 'email' }) turns it into a session. Adults reach aal2 with a TOTP
// factor the suite enrols once and reuses on later runs.
//
// The factor's secret is kept in site/.env.rls.local (mode 600): ignored by git like every .env file, and blocked for
// the AI's file tools. It is never printed. Supabase allows 30 code checks per 5 minutes per IP, so the suite signs
// each actor in once per run (global-setup.ts).
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authClient } from './clients'
import { SITE } from './env'
import { msToNextStep, totp } from './totp'

export const FACTOR_NAME = 'rls-suite'
const STORE = path.join(SITE, '.env.rls.local')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface Session { client: SupabaseClient; token: string; userId: string; email: string }

/** The one-time sign-in code for an example.test account, made by the admin API (nothing is emailed). */
export async function emailCode(admin: SupabaseClient, email: string): Promise<string> {
  if (!/^[a-z0-9._%+-]+@example\.test$/.test(email)) throw new Error(`refused: ${email} is not an @example.test address`)
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const code = data?.properties?.email_otp
    if (!error && code) return code
    const wait = /after (\d+) seconds?/i.exec(error?.message ?? '')
    if (wait && attempt < 2) { await sleep((Number(wait[1]) + 1) * 1000); continue }
    throw new Error(`no sign-in code for ${email}: ${error?.message ?? 'empty response'}`)
  }
}

export async function signIn(admin: SupabaseClient, email: string): Promise<Session> {
  const code = await emailCode(admin, email)
  const client = authClient()
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error || !data.session || !data.user) {
    const limit = error?.status === 429 ? ' (Supabase allows 30 code checks per 5 minutes per IP: wait a few minutes and run again)' : ''
    throw new Error(`signing in ${email} failed: ${error?.status ?? ''} ${error?.message ?? 'no session'}${limit}`)
  }
  return { client, token: data.session.access_token, userId: data.user.id, email }
}

// ── The TOTP factor ───────────────────────────────────────────────────────────────────────────────────────────
type Stored = { factorId: string; secret: string }
const storeKey = (slug: string) => `RLS_TOTP_${slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`

function readStore(): Map<string, Stored> {
  const out = new Map<string, Stored>()
  if (!fs.existsSync(STORE)) return out
  for (const line of fs.readFileSync(STORE, 'utf8').split('\n')) {
    const m = /^(RLS_TOTP_[A-Z0-9_]+)=([0-9a-f-]{36}):([A-Z2-7]+)$/.exec(line.trim())
    if (m) out.set(m[1], { factorId: m[2], secret: m[3] })
  }
  return out
}

function writeStore(map: Map<string, Stored>): void {
  const lines = [
    '# Written by the access-rule suite (supabase/tests/rls, npm run test:rls). Never commit or share.',
    `# The secrets of the "${FACTOR_NAME}" TOTP factor on the dev project's example.test accounts, so later runs reuse it.`,
    ...[...map].map(([k, v]) => `${k}=${v.factorId}:${v.secret}`),
  ]
  fs.writeFileSync(STORE, lines.join('\n') + '\n', { mode: 0o600 })
  fs.chmodSync(STORE, 0o600)
}

/**
 * Before signing a person in: is there a verified factor whose secret the suite kept? If not, remove what an earlier
 * run left half-done (unverified factors, or the suite's own factor whose secret is gone), so a new one can be enrolled.
 * Done before any sign-in, because removing a verified factor signs that person out everywhere.
 */
export async function prepareFactor(admin: SupabaseClient, userId: string, slug: string): Promise<Stored | null> {
  const stored = readStore().get(storeKey(slug)) ?? null
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId })
  if (error) throw new Error(`listing ${slug}'s factors failed: ${error.message}`)
  const factors = data.factors.filter((f) => f.factor_type === 'totp')
  if (stored && factors.some((f) => f.id === stored.factorId && f.status === 'verified')) return stored
  for (const f of factors) {
    if (f.status !== 'verified' || f.friendly_name === FACTOR_NAME) {
      const del = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId })
      if (del.error) throw new Error(`removing a stale factor of ${slug} failed: ${del.error.message}`)
    }
  }
  if (factors.some((f) => f.status === 'verified' && f.friendly_name !== FACTOR_NAME)) {
    throw new Error(`${slug}@example.test has an authenticator the suite didn't add, so it can't reach aal2. Remove that factor (Supabase dashboard → Authentication → Users), then run again.`)
  }
  return null
}

async function verifyCode(client: SupabaseClient, factorId: string, secret: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
    if (!error && data?.access_token) return data.access_token
    if (attempt === 0 && error?.status !== 429) { await sleep(msToNextStep() + 1000); continue } // a code from a step already used
    throw new Error(`the TOTP check failed: ${error?.status ?? ''} ${error?.message ?? 'no session'}`)
  }
  throw new Error('the TOTP check failed')
}

/** Raise a fresh aal1 session to aal2, enrolling the suite's factor if needed. Returns the aal2 access token. */
export async function raiseToAal2(s: Session, slug: string, prepared: Stored | null, persist = true): Promise<string> {
  if (prepared) return verifyCode(s.client, prepared.factorId, prepared.secret)
  const { data, error } = await s.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: FACTOR_NAME })
  const secret = (data as { totp?: { secret?: string } } | null)?.totp?.secret
  if (error || !data?.id || !secret) throw new Error(`enrolling a TOTP factor for ${slug} failed: ${error?.message ?? 'no secret returned'}`)
  const token = await verifyCode(s.client, data.id, secret)
  if (persist) {
    const map = readStore()
    map.set(storeKey(slug), { factorId: data.id, secret })
    writeStore(map)
  }
  return token
}

/** Decode a JWT's claims (to check the aal a session really has). Never printed. */
export function claims(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? ''
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>
}

// ── Throwaway accounts (example.test only) ────────────────────────────────────────────────────────────────────
export const THROWAWAY = /^rls-[a-z0-9]+-[a-z0-9]+@example\.test$/

export async function createThrowaway(admin: SupabaseClient, runId: string, label: string): Promise<{ id: string; email: string }> {
  const email = `rls-${runId}-${label}@example.test`
  if (!THROWAWAY.test(email)) throw new Error(`bad throwaway address ${email}`)
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { rls_test: runId } })
  if (error || !data.user) throw new Error(`creating ${email} failed: ${error?.message ?? 'no user'}`)
  return { id: data.user.id, email }
}

export async function deleteThrowaway(admin: SupabaseClient, user: { id: string; email: string }): Promise<void> {
  if (!THROWAWAY.test(user.email)) throw new Error(`refused: ${user.email} is not a throwaway address`)
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error && !/not.?found/i.test(error.message)) throw new Error(`deleting ${user.email} failed: ${error.message}`)
}
