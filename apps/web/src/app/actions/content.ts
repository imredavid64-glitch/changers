'use server'

import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import type { ActionResult } from '@/lib/action-result'
import { supabaseServer } from '@/lib/supabase/server'

// Members' writes (R1b): through the RLS-bound client, so the database's rules and triggers decide (07 §6: students
// start drafts and proposals; posts wait for approval unless the advisor switched that off for club-only text).
const live = () => t('live')
const off = (): ActionResult => ({ ok: false, message: live()('errorFailed') })
const refused = (e: { code?: string } | null): ActionResult => ({ ok: false, message: live()(e?.code === '42501' || e?.code === '42P17' ? 'errorNotAllowed' : 'errorFailed') })
const Uuid = z.string().uuid()

/** A project proposal (07 §3: members and leads propose; an advisor may start one active). */
export async function createProject(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({
    club: Uuid,
    slug: z.string().max(80),
    title: z.string().trim().min(3).max(120),
    strand: z.enum(['nature', 'economy', 'society', 'wellbeing']),
    problem: z.string().trim().max(2000),
    action: z.string().trim().max(2000),
    evidence: z.string().trim().max(2000),
    reflection: z.string().trim().max(2000),
    visibility: z.enum(['club', 'public']),
  }).safeParse({
    club: form.get('club'), slug: form.get('slug'), title: form.get('title'), strand: form.get('strand'),
    problem: form.get('problem') ?? '', action: form.get('action') ?? '', evidence: form.get('evidence') ?? '',
    reflection: form.get('reflection') ?? '', visibility: form.get('visibility') ?? 'club',
  })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const d = parsed.data
  const sb = await supabaseServer()
  const { data, error } = await sb.from('projects')
    .insert({ club_id: d.club, title: d.title, strand: d.strand, problem: d.problem, action: d.action, evidence: d.evidence, reflection: d.reflection, visibility: d.visibility, status: 'proposed' })
    .select('id').single()
  if (error || !data) return refused(error)
  redirect(`/clubs/${d.slug}/space?tab=projects`)
}

/** An update to the club (held for approval by default, 07 §7). */
export async function postUpdate(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({ club: Uuid, slug: z.string().max(80), body: z.string().trim().min(1).max(2000) })
    .safeParse({ club: form.get('club'), slug: form.get('slug'), body: form.get('body') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.from('updates').insert({ club_id: parsed.data.club, body: parsed.data.body })
  if (error) return refused(error)
  redirect(`/clubs/${parsed.data.slug}/space`)
}

/** Going, or not going (07 §6: rsvp() checks who may see the event and its capacity). */
export async function rsvp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({ event: Uuid, going: z.enum(['1', '0']) }).safeParse({ event: form.get('event'), going: form.get('going') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.rpc('rsvp', { p_event: parsed.data.event, p_going: parsed.data.going === '1' })
  if (error) return refused(error)
  updateTag(`event:${parsed.data.event}`)
  updateTag('events')
  redirect(`/events/${parsed.data.event}`)
}

/** Delete my account (07 §4): immediate. The club keeps its projects; the photos' files go too (R3, with uploads). */
export async function deleteMyAccount(): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const sb = await supabaseServer()
  const { error } = await sb.rpc('delete_my_account')
  if (error) return refused(error)
  await sb.auth.signOut({ scope: 'local' })
  redirect('/')
}

/** A club thread (07 §7: club threads replace direct messages; every member reads them, the advisor always sees). */
export async function startThread(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({ club: Uuid, slug: z.string().max(80), title: z.string().trim().min(3).max(120) })
    .safeParse({ club: form.get('club'), slug: form.get('slug'), title: form.get('title') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.from('threads').insert({ club_id: parsed.data.club, title: parsed.data.title })
  if (error) return refused(error)
  redirect(`/clubs/${parsed.data.slug}/space?tab=threads`)
}

/** A reply in a club thread: it appears at once, unless it has a link or a flagged word (Luke, 11 Oct). */
export async function replyThread(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const parsed = z.object({ thread: Uuid, slug: z.string().max(80), body: z.string().trim().min(1).max(2000) })
    .safeParse({ thread: form.get('thread'), slug: form.get('slug'), body: form.get('body') })
  if (!parsed.success) return { ok: false, message: live()('errorFailed') }
  const sb = await supabaseServer()
  const { error } = await sb.from('thread_posts').insert({ thread_id: parsed.data.thread, body: parsed.data.body })
  if (error) return refused(error)
  redirect(`/clubs/${parsed.data.slug}/space?tab=threads`)
}
