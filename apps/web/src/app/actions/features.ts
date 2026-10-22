'use server'

import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import type { ActionResult } from '@/lib/action-result'
import { supabaseServer } from '@/lib/supabase/server'

// The club features from the old site's ideas (R1b · 6): the task board, impact numbers, links, follows and polls.
// Writes go through the RLS-bound client; the database's rules and triggers decide (who may write, the vote-once
// rule, a public project's new number waiting for the advisor).
const live = () => t('live')
const off = (): ActionResult => ({ ok: false, message: live()('errorFailed') })
const refused = (e: { code?: string } | null): ActionResult => ({ ok: false, message: live()(e?.code === '42501' ? 'errorNotAllowed' : 'errorFailed') })
const Uuid = z.string().uuid()

/** The board: a task moves between To do, Doing and Done. */
export async function moveTask(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({ task: Uuid, project: Uuid, state: z.enum(['todo', 'doing', 'done']) })
    .safeParse({ task: form.get('task'), project: form.get('project'), state: form.get('state') })
  if (!d.success) return off()
  const { error } = await (await supabaseServer()).from('project_tasks').update({ state: d.data.state }).eq('id', d.data.task)
  if (error) return refused(error)
  redirect(`/projects/${d.data.project}#board`)
}

export async function addTask(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({ project: Uuid, title: z.string().trim().min(1).max(200) }).safeParse({ project: form.get('project'), title: form.get('title') })
  if (!d.success) return off()
  const { error } = await (await supabaseServer()).from('project_tasks').insert({ project_id: d.data.project, title: d.data.title, position: Math.floor(Date.now() / 1000) })
  if (error) return refused(error)
  redirect(`/projects/${d.data.project}#board`)
}

/** An impact number. On an approved public project it sends the project back to the advisor (07 §6). */
export async function addImpact(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({
    project: Uuid,
    label: z.string().trim().min(2).max(80),
    value: z.coerce.number().min(0).max(9_999_999_999),
    unit: z.string().trim().max(30),
    how: z.string().trim().max(300),
  }).safeParse({ project: form.get('project'), label: form.get('label'), value: form.get('value'), unit: form.get('unit') ?? '', how: form.get('how') ?? '' })
  if (!d.success) return off()
  const { error } = await (await supabaseServer()).from('project_impacts').insert({ project_id: d.data.project, label: d.data.label, value: d.data.value, unit: d.data.unit, how: d.data.how })
  if (error) return refused(error)
  updateTag(`project:${d.data.project}`)
  updateTag('directory')
  redirect(`/projects/${d.data.project}#impact`)
}

export async function removeImpact(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({ id: Uuid, project: Uuid }).safeParse({ id: form.get('id'), project: form.get('project') })
  if (!d.success) return off()
  const { error } = await (await supabaseServer()).from('project_impacts').delete().eq('id', d.data.id)
  if (error) return refused(error)
  updateTag(`project:${d.data.project}`)
  updateTag('directory')
  redirect(`/projects/${d.data.project}#impact`)
}

/** A link to the project's own files: https only, members only. */
export async function addLink(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({ project: Uuid, label: z.string().trim().min(1).max(80), url: z.string().trim().url().max(500).startsWith('https://') })
    .safeParse({ project: form.get('project'), label: form.get('label'), url: form.get('url') })
  if (!d.success) return off()
  const { error } = await (await supabaseServer()).from('project_links').insert({ project_id: d.data.project, label: d.data.label, url: d.data.url })
  if (error) return refused(error)
  redirect(`/projects/${d.data.project}#files`)
}

export async function removeLink(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({ id: Uuid, project: Uuid }).safeParse({ id: form.get('id'), project: form.get('project') })
  if (!d.success) return off()
  const { error } = await (await supabaseServer()).from('project_links').delete().eq('id', d.data.id)
  if (error) return refused(error)
  redirect(`/projects/${d.data.project}#files`)
}

/** Follow or stop following a club (never a person). */
export async function followClub(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({ club: Uuid, slug: z.string().max(80), follow: z.enum(['1', '0']) }).safeParse({ club: form.get('club'), slug: form.get('slug'), follow: form.get('follow') })
  if (!d.success) return off()
  const sb = await supabaseServer()
  const { error } = d.data.follow === '1'
    ? await sb.from('club_follows').insert({ club_id: d.data.club })
    : await sb.from('club_follows').delete().eq('club_id', d.data.club)
  if (error && error.code !== '23505') return refused(error) // already following: fine
  redirect(`/clubs/${d.data.slug}`)
}

/** A poll in a club thread: 2–4 choices; a link or a flagged word is refused by the database. */
export async function startPoll(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const options = [1, 2, 3, 4].map((n) => String(form.get(`choice${n}`) ?? '').trim()).filter(Boolean)
  const d = z.object({ thread: Uuid, slug: z.string().max(80), question: z.string().trim().min(3).max(200), options: z.array(z.string().max(80)).min(2).max(4) })
    .safeParse({ thread: form.get('thread'), slug: form.get('slug'), question: form.get('question'), options })
  if (!d.success) return off()
  const { error } = await (await supabaseServer()).from('polls').insert({ thread_id: d.data.thread, question: d.data.question, options: d.data.options })
  if (error) return refused(error)
  redirect(`/clubs/${d.data.slug}/space?tab=threads`)
}

/** A vote: one per person, which they can change while the poll is open. */
export async function vote(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  if (backend !== 'supabase') return off()
  const d = z.object({ poll: Uuid, slug: z.string().max(80), choice: z.coerce.number().int().min(0).max(5) })
    .safeParse({ poll: form.get('poll'), slug: form.get('slug'), choice: form.get('choice') })
  if (!d.success) return off()
  const sb = await supabaseServer()
  const { data: had } = await sb.from('poll_votes').select('poll_id').eq('poll_id', d.data.poll).maybeSingle()
  const { error } = had
    ? await sb.from('poll_votes').update({ choice: d.data.choice }).eq('poll_id', d.data.poll)
    : await sb.from('poll_votes').insert({ poll_id: d.data.poll, choice: d.data.choice })
  if (error) return refused(error)
  redirect(`/clubs/${d.data.slug}/space?tab=threads`)
}
