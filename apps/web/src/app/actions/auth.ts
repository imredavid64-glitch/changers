'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import type { ActionResult } from '@/lib/action-result'
import { supabaseServer } from '@/lib/supabase/server'

// Code sign-in and the first-run profile (07 §4; R1b). Supabase Auth sends a 6-digit code (no magic links: school
// link scanners use them up); verifying it starts the session. A brand-new account then answers /welcome; under 13,
// or 13–15 without an invite, nothing is kept.

const BAND = 'cm_band' // the age group chosen on /start or /join before the email (07 §4: age first)
const JOIN = 'cm_join' // a club code typed on /join before signing in
const START = 'cm_start' // came from "Start a club": /welcome goes on to the club form
const short = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 3600, secure: process.env.NODE_ENV === 'production' }
const live = () => t('live')
const nextPath = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/home')

const Email = z.string().trim().toLowerCase().email().max(254)
const Code = z.string().trim().regex(/^\d{6}$/)
const Band = z.enum(['16-17', 'adult'])

/** Step 1: send the code. Called by the sign-in form; the age flow passes the age group and any club code. */
export async function sendCode(email: string, opts: { band?: string; joinCode?: string; start?: boolean } = {}): Promise<ActionResult> {
  if (backend !== 'supabase') return { ok: false, message: live()('errorFailed') }
  const e = Email.safeParse(email)
  if (!e.success) return { ok: false, message: live()('errorEmail') }
  const jar = await cookies()
  const band = Band.safeParse(opts.band)
  if (band.success) jar.set(BAND, band.data, short)
  if (opts.joinCode) jar.set(JOIN, opts.joinCode.trim().slice(0, 20), short)
  if (opts.start) jar.set(START, '1', short)
  const sb = await supabaseServer()
  const { error } = await sb.auth.signInWithOtp({ email: e.data, options: { shouldCreateUser: true } })
  if (error) return { ok: false, message: error.status === 429 ? live()('errorWait') : live()('errorSend') }
  return { ok: true }
}

/** Step 2: the code. A new account goes to /welcome; a returning one finishes any club join, then goes on. */
export async function verifyCode(email: string, code: string, next?: string): Promise<ActionResult> {
  if (backend !== 'supabase') return { ok: false, message: live()('errorFailed') }
  const e = Email.safeParse(email), c = Code.safeParse(code)
  if (!e.success || !c.success) return { ok: false, message: t('signIn')('errorWrong') }
  const sb = await supabaseServer()
  const { data, error } = await sb.auth.verifyOtp({ email: e.data, token: c.data, type: 'email' })
  if (error || !data.user) return { ok: false, message: /expired/i.test(error?.message ?? '') ? t('signIn')('errorExpired') : t('signIn')('errorWrong') }
  const { data: profile } = await sb.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
  // A brand-new account from an invite link makes its profile on the invite page (with the invite's age group).
  if (!profile) redirect(next?.startsWith('/invite/') ? nextPath(next) : next ? `/welcome?next=${encodeURIComponent(nextPath(next))}` : '/welcome')
  // An adult with an authenticator app finishes signing in with it (07 §4: aal2 before any power works).
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') redirect(`/sign-in/factor?next=${encodeURIComponent(nextPath(next))}`)
  await afterSignIn()
  redirect(nextPath(next))
}

/** /welcome: the first name and initial, the country, the code of conduct; the age group if it wasn't asked yet. */
export async function completeSignup(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return { ok: false, message: live()('errorFailed') }
  const jar = await cookies()
  const band = String(form.get('band') ?? jar.get(BAND)?.value ?? '')
  const sb = await supabaseServer()
  if (band === 'under13' || band === '13-15') {
    // No account: the sign-in that just happened is deleted at once, and only a count is kept (07 §4).
    await sb.rpc('decline_signup', { p_reason: band === 'under13' ? 'under_13' : 'under_16_no_invite' })
    await sb.auth.signOut({ scope: 'local' })
    for (const k of [BAND, JOIN, START]) jar.delete(k)
    return { ok: false, message: band === 'under13' ? t('onboarding')('under13Stop') : t('onboarding')('band1315Stop') }
  }
  const parsed = z.object({
    band: Band,
    name: z.string().trim().regex(/^[\p{L}][\p{L}'’-]{0,29} \p{L}\.$/u),
    country: z.string().regex(/^[A-Z]{2}$/),
    conduct: z.literal('on'),
  }).safeParse({ band, name: form.get('name'), country: form.get('country'), conduct: form.get('conduct') })
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    return { ok: false, message: live()(field === 'name' ? 'errorName' : field === 'country' ? 'errorCountry' : field === 'conduct' ? 'errorConduct' : 'errorAge') }
  }
  const { error } = await sb.rpc('complete_signup', {
    p_display_name: parsed.data.name, p_age_band: parsed.data.band, p_country: parsed.data.country, p_accept_conduct: true,
  })
  if (error && !/already set up/.test(error.message)) return { ok: false, message: live()('errorFailed') }
  await afterSignIn()
  redirect(nextPath(form.get('next')))
}

/** What the person came to do before signing in: start a club, or join one with its code. */
async function afterSignIn() {
  const jar = await cookies()
  jar.delete(BAND)
  if (jar.get(START)?.value) { jar.delete(START); redirect('/start/club') }
  const code = jar.get(JOIN)?.value
  if (!code) return
  jar.delete(JOIN)
  const sb = await supabaseServer()
  const { error } = await sb.rpc('join_with_code', { p_code: code })
  redirect(error ? '/join?code=wrong' : '/home?joined=1')
}

/** Sign out on this device. */
export async function signOutHere(): Promise<ActionResult> {
  if (backend === 'supabase') await (await supabaseServer()).auth.signOut({ scope: 'local' })
  redirect('/')
}

/** 07 §4: "Sign out everywhere is signOut({ scope: 'global' })": every device, this one too. */
export async function signOutEverywhere(): Promise<ActionResult> {
  if (backend !== 'supabase') return { ok: false, message: live()('errorFailed') }
  await (await supabaseServer()).auth.signOut({ scope: 'global' })
  redirect('/')
}
