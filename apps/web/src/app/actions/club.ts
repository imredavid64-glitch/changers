'use server'

import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import { CITIES } from '@/lib/cities'
import type { ActionResult } from '@/lib/action-result'
import { supabaseServer } from '@/lib/supabase/server'

// Club writes (R1b). Each one calls a database function that checks the person itself (07 §6: "writes that cross
// rules go through SECURITY DEFINER functions, each writing audit_log"); these actions only validate the form and
// turn the answer into words. A refusal from the database is shown as "You can't do that here".

const live = () => t('live')
const off = (): ActionResult => ({ ok: false, message: live()('errorFailed') })
const refused = (e: { code?: string } | null): ActionResult => ({ ok: false, message: live()(e?.code === '42501' ? 'errorNotAllowed' : 'errorFailed') })
const Uuid = z.string().uuid()

/** Start a club (07 §3): an adult becomes its advisor, a 16–17 student its lead. The join code is shown once. */
export async function createClub(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const c = t('clubNew')
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    school: z.string().trim().min(2).max(120),
    city: z.string(),
    strands: z.array(z.enum(['nature', 'economy', 'society', 'wellbeing'])).max(4),
    languages: z.string().trim().max(200),
    description: z.string().trim().max(1200),
  }).safeParse({
    name: form.get('name'), school: form.get('school'), city: form.get('city'), strands: form.getAll('strands'),
    languages: form.get('languages') ?? '', description: form.get('description') ?? '',
  })
  const city = CITIES.find((x) => x.id === parsed.data?.city)
  if (!parsed.success || !city) return { ok: false, message: live()('errorFailed') }
  const languages = parsed.data.languages.split(',').map((l) => l.trim()).filter(Boolean).slice(0, 8)
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc('create_club', {
    p_name: parsed.data.name, p_school_name: parsed.data.school, p_city: city.city, p_country: city.country, p_lat: city.lat, p_lng: city.lng,
    p_tz: city.tz, p_strands: parsed.data.strands, p_languages: languages.length ? languages : ['English'], p_description: parsed.data.description,
  })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return refused(error)
  const { data: me } = await sb.from('profiles').select('age_band').maybeSingle()
  const adult = me?.age_band === 'adult'
  return {
    ok: true,
    message: `${c('created', { code: row.join_code })} ${adult ? c('pendingAdult', { school: parsed.data.school }) : c('pendingStudent')}`,
    href: adult ? `/start/verify?club=${row.club_id}` : `/clubs/${row.slug}/space`,
    linkText: adult ? c('getVerified') : c('open'),
  }
}

/** A teacher asks to be verified (07 §4 steps 1–2): their sign-in email must be at the school's domain. */
export async function requestVerification(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const v = t('verify')
  const parsed = z.object({
    club: Uuid.optional().or(z.literal('')),
    school: z.string().trim().min(2).max(120),
    domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
    role: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
  }).safeParse({ club: form.get('club') ?? '', school: form.get('school'), domain: form.get('domain'), role: form.get('role'), email: form.get('email') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.rpc('request_advisor_verification', {
    p_club: parsed.data.club || null, p_school_name: parsed.data.school, p_school_domain: parsed.data.domain,
    p_second_role: parsed.data.role, p_second_email: parsed.data.email,
  })
  if (error) return { ok: false, message: /school email/.test(error.message) ? v('errorDomain') : live()('errorFailed') }
  return { ok: true, message: v('sent') }
}

/** Join with the club's code (16–17; the request waits for a lead or the advisor). */
export async function joinWithCode(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const code = z.string().trim().min(4).max(20).safeParse(form.get('code'))
  if (!code.success) return { ok: false, message: live()('errorJoinCode') }
  const sb = await supabaseServer()
  const { error } = await sb.rpc('join_with_code', { p_code: code.data })
  if (error) return error.code === '42501' ? refused(error) : { ok: false, message: live()('errorJoinCode') }
  redirect('/home?joined=1')
}

/**
 * The approvals page (07 §3): approve, send back with a note, or hold. Join requests are approved or held. The
 * database decides who may approve what (leads: club-only text and members' proposals; never their own).
 */
export async function decide(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({
    kind: z.enum(['member', 'update', 'project', 'thread_post', 'event', 'media']),
    id: z.string().min(1).max(64),
    do: z.enum(['approve', 'sendBack', 'hold']),
    note: z.string().trim().max(500).optional(),
    slug: z.string().max(80),
  }).safeParse({ kind: form.get('kind'), id: form.get('id'), do: form.get('do'), note: form.get('note') ?? undefined, slug: form.get('slug') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const { kind, id, note, slug } = parsed.data
  if (parsed.data.do === 'hold') return { ok: true }
  const sb = await supabaseServer()
  const { error } = kind === 'member'
    ? await sb.rpc('approve_member', { p_member: id, p_approve: true })
    : parsed.data.do === 'approve'
      ? await sb.rpc('approve_content', { p_kind: kind, p_id: id })
      : await sb.rpc('send_back', { p_kind: kind, p_id: id, p_note: note || '' })
  if (error) return refused(error)
  updateTag(`club:${slug}`)
  updateTag('directory')
  redirect(`/clubs/${slug}/approvals`)
}

/** Settings: an advisor makes a member a lead, or a lead a member again (07 §3 note 1). */
export async function setMemberRole(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({ member: Uuid, role: z.enum(['member', 'lead']), slug: z.string().max(80) })
    .safeParse({ member: form.get('member'), role: form.get('role'), slug: form.get('slug') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.rpc('set_member_role', { p_member: parsed.data.member, p_role: parsed.data.role })
  if (error) return refused(error)
  redirect(`/clubs/${parsed.data.slug}/settings`)
}

export async function rotateCode(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const club = Uuid.safeParse(form.get('club'))
  if (!club.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc('rotate_join_code', { p_club: club.data })
  if (error || !data) return refused(error)
  return { ok: true, message: t('clubNew')('newCode', { code: String(data) }) }
}

export async function setPreApproval(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const club = Uuid.safeParse(form.get('club'))
  if (!club.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.from('clubs').update({ pre_approval: form.get('preApproval') === 'on' }).eq('id', club.data)
  if (error) return refused(error)
  return { ok: true, message: live()('saved') }
}

/** Network admins (aal2): verify a teacher, verify a club (07 §4 step 3). */
export async function verify(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  if (form.get('do') === 'hold') return { ok: true }
  const parsed = z.object({ kind: z.enum(['advisor', 'club']), id: Uuid }).safeParse({ kind: form.get('kind'), id: form.get('id') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = parsed.data.kind === 'advisor'
    ? await sb.rpc('verify_advisor', { p_verification: parsed.data.id, p_approve: true })
    : await sb.rpc('verify_club', { p_club: parsed.data.id })
  if (error) return refused(error)
  updateTag('directory')
  redirect('/admin')
}

/** Settings: an advisor removes a member (07 §3: only advisors remove members). */
export async function removeMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({ member: Uuid, slug: z.string().max(80) }).safeParse({ member: form.get('member'), slug: form.get('slug') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.rpc('remove_member', { p_member: parsed.data.member })
  if (error) return refused(error)
  redirect(`/clubs/${parsed.data.slug}/settings`)
}
