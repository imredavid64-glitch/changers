'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import type { ActionResult } from '@/lib/action-result'
import { supabaseServer } from '@/lib/supabase/server'

// The authenticator app (07 §4: TOTP; advisor and admin powers need aal2, checked in the database).
const Code = z.string().trim().regex(/^\d{6}$/)
const nextPath = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/home')

/** Starts enrolment: the QR code and key go to this person's own screen only. */
export async function enrollTotp(): Promise<{ ok: true; factorId: string; qr: string; secret: string } | { ok: false; message: string }> {
  if (backend !== 'supabase') return { ok: false, message: t('live')('errorFailed') }
  const sb = await supabaseServer()
  const { data: list } = await sb.auth.mfa.listFactors()
  for (const f of list?.all ?? []) if (f.factor_type === 'totp' && f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id })
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Changemakers' })
  if (error || !data) return { ok: false, message: t('live')('errorFailed') }
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}

/** Finishes enrolment, or the sign-in step for someone who already has the app: either way the session is aal2. */
export async function verifyTotp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return { ok: false, message: t('live')('errorFailed') }
  const code = Code.safeParse(form.get('code'))
  if (!code.success) return { ok: false, message: t('mfa')('errorCode') }
  const sb = await supabaseServer()
  let factorId = String(form.get('factorId') ?? '')
  if (!factorId) {
    const { data } = await sb.auth.mfa.listFactors()
    factorId = data?.totp?.[0]?.id ?? ''
  }
  if (!factorId) return { ok: false, message: t('live')('errorFailed') }
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.data })
  if (error) return { ok: false, message: t('mfa')('errorCode') }
  redirect(nextPath(form.get('next')))
}
