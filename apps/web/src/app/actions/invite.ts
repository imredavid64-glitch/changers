'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import type { ActionResult } from '@/lib/action-result'
import { supabaseServer } from '@/lib/supabase/server'

// Invites (07 §4): only a verified advisor makes one; under 16, the parent's or school's agreement is recorded first.
// Single use, one club, 14 days. The token is shown once; only its hash is stored.
const Uuid = z.string().uuid()

export async function createInvite(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return { ok: false, message: t('live')('errorFailed') }
  const parsed = z.object({
    club: Uuid,
    band: z.enum(['13-15', '16-17', 'adult']),
    consent: z.enum(['school_on_file', 'parent_email']).optional(),
  }).safeParse({ club: form.get('club'), band: form.get('band'), consent: form.get('consent') ?? undefined })
  if (!parsed.success || (parsed.data.band === '13-15' && !parsed.data.consent)) return { ok: false, message: t('onboarding')('consentIntro') }
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc('create_invite', { p_club: parsed.data.club, p_band: parsed.data.band, p_consent_method: parsed.data.consent ?? null })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return { ok: false, message: t('live')(error?.code === '42501' ? 'errorNotAllowed' : 'errorFailed') }
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  const until = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(row.expires_at))
  return { ok: true, message: `${t('invite')('made', { date: until })} ${origin}/invite/${row.token}` }
}

/** Opening the link, signed in: a new account answers the profile questions here; then the person is in. */
export async function redeemInvite(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return { ok: false, message: t('live')('errorFailed') }
  const token = z.string().regex(/^[0-9a-f]{48}$/).safeParse(form.get('token'))
  if (!token.success) return { ok: false, message: t('invite')('expired') }
  const name = form.get('name'), country = form.get('country')
  if (name !== null && !z.string().trim().regex(/^[\p{L}][\p{L}'’-]{0,29} \p{L}\.$/u).safeParse(name).success) return { ok: false, message: t('live')('errorName') }
  if (country !== null && !z.string().regex(/^[A-Z]{2}$/).safeParse(country).success) return { ok: false, message: t('live')('errorCountry') }
  if (name !== null && form.get('conduct') !== 'on') return { ok: false, message: t('live')('errorConduct') }
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc('redeem_invite', {
    p_token: token.data, p_display_name: name ? String(name).trim() : null, p_country: country ? String(country) : null, p_accept_conduct: form.get('conduct') === 'on',
  })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return { ok: false, message: error?.code === '42501' ? t('live')('errorNotAllowed') : t('invite')('expired') }
  redirect(`/clubs/${row.club_slug}/space`)
}
