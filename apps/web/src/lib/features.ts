import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { backend } from './backend'
import { supabasePublic } from './supabase/public'
import { supabaseServer } from './supabase/server'
import {
  loadDb, roleIn, isListed, isPublicProject, summarise, toPublicProject, toPublicEvent,
  sbRows, sbRow, sbIso, sbClubOf, sbPublicEventOf, sbPublicProjectOf, sbWithSeats, sbUpdateOf,
  SB_CLUB, SB_PROJECT, SB_EVENT, SB_UPDATE, SB_UUID,
  type ClubSummary, type PublicEvent, type PublicProject, type SbClubRow, type SbEventRow, type SbProjectRow, type SbUpdateRow, type SbWithClub,
} from './data'
import type { Impact, Poll, ProjectLink, Strand, Task, TaskState, Update } from './types'
import type { Viewer } from './viewer'

// R1b · 6 (Luke, 12 Oct: "bring over everything you think we should" from the old site, changers-three.vercel.app),
// made safe for clubs of under-18s:
// - its kanban → a task board on every project (members only);
// - its Impact Score → impact numbers on projects, each saying how it was counted (public once approved);
// - its Badges → club milestones worked out from what the club did (never points or streaks for a person);
// - its Home Feed → "What's new": approved public projects and news, newest first, with an end;
// - its Network → following a club (never a person; nobody sees who follows);
// - its polls → polls inside club threads (counts for members, never who voted what);
// - its Search → clubs, projects and events (never people).
// Each read has the DEMO version (review builds) and the Supabase one (the access rules decide what each person sees).

const DAY = 86_400_000
const ACTIVE_DAYS = 60 // "active this term": something new in the last 60 days

// ── Club milestones and impact totals (public, cached) ──────────────────────────────────────────────────────────
export type Milestone = { kind: 'verified' | 'finished' | 'hosted' | 'active'; n?: number; year?: number }
export type ImpactTotal = { label: string; unit: string; value: number }
export type ClubHighlights = { milestones: Milestone[]; impacts: ImpactTotal[] }

const totals = (list: Impact[]): ImpactTotal[] => {
  const by = new Map<string, ImpactTotal>()
  for (const i of list) {
    const key = `${i.label.trim().toLowerCase()}|${i.unit.trim().toLowerCase()}`
    const t = by.get(key) ?? { label: i.label.trim(), unit: i.unit.trim(), value: 0 }
    t.value += Number(i.value)
    by.set(key, t)
  }
  return [...by.values()].sort((a, b) => b.value - a.value).slice(0, 6)
}
const milestonesOf = (o: { verified: boolean; finished: number; hosted: number[]; lastActive: string }, now: number): Milestone[] => [
  ...(o.verified ? [{ kind: 'verified' as const }] : []),
  ...(o.finished ? [{ kind: 'finished' as const, n: o.finished }] : []),
  ...o.hosted.map((year) => ({ kind: 'hosted' as const, year })),
  ...(now - Date.parse(o.lastActive) < ACTIVE_DAYS * DAY ? [{ kind: 'active' as const }] : []),
]

export async function getClubHighlights(slug: string): Promise<ClubHighlights> {
  'use cache'
  cacheTag('directory', `club:${slug}`)
  cacheLife('hours')
  const now = Date.now()
  if (backend === 'supabase') {
    const db = supabasePublic()
    const club = await sbRow<{ id: string; verified_at: string | null; last_active_at: string }>('club highlights', db.from('clubs').select('id, verified_at, last_active_at').eq('slug', slug))
    if (!club) return { milestones: [], impacts: [] }
    const [projects, hubs] = await Promise.all([
      sbRows<{ status: string; project_impacts: { label: string; value: number; unit: string; how: string }[] }>('club highlights, projects',
        db.from('projects').select('status, project_impacts(label, value, unit, how)').eq('club_id', club.id).limit(50)),
      sbRows<{ year: number }>('club highlights, hubs', db.from('conference_hubs').select('year').eq('host_club_id', club.id)),
    ])
    return {
      milestones: milestonesOf({ verified: !!club.verified_at, finished: projects.filter((p) => p.status === 'completed').length, hosted: hubs.map((h) => h.year), lastActive: club.last_active_at }, now),
      impacts: totals(projects.flatMap((p) => p.project_impacts.map((i) => ({ ...i, value: Number(i.value) })))),
    }
  }
  const data = await loadDb()
  const club = data.clubs.find((c) => c.slug === slug)
  if (!club || !isListed(data, club, now)) return { milestones: [], impacts: [] }
  const projects = data.projects.filter((p) => p.clubId === club.id && isPublicProject(p))
  return {
    milestones: milestonesOf({ verified: !!club.verifiedAt, finished: projects.filter((p) => p.status === 'completed').length, hosted: [], lastActive: club.lastActiveAt }, now),
    impacts: totals(projects.flatMap((p) => p.impacts ?? [])),
  }
}

/** A public project's impact numbers (cached with the project). */
export async function getPublicImpacts(id: string): Promise<Impact[]> {
  'use cache'
  cacheTag(`project:${id}`)
  cacheLife('hours')
  if (backend === 'supabase') {
    if (!SB_UUID.test(id)) return []
    return (await sbRows<Impact>('public impacts', supabasePublic().from('project_impacts').select('label, value, unit, how').eq('project_id', id).order('created_at').limit(20)))
      .map((i) => ({ ...i, value: Number(i.value) }))
  }
  const data = await loadDb()
  const p = data.projects.find((x) => x.id === id)
  return p && isPublicProject(p) ? p.impacts ?? [] : []
}

// ── A project's member tools: the board, its numbers, its files (members only, request time) ─────────────────────
export type ProjectTools = { canEdit: boolean; tasks: (Task & { id: string; state: TaskState })[]; impacts: (Impact & { id: string })[]; links: ProjectLink[] }

export async function getProjectTools(viewer: Viewer, id: string): Promise<ProjectTools | null> {
  if (viewer.kind !== 'user') return null
  if (backend === 'supabase') {
    if (!SB_UUID.test(id)) return null
    const db = await supabaseServer()
    const p = await sbRow<{ club_id: string; project_members: { user_id: string }[]; project_tasks: { id: string; title: string; state: TaskState; position: number }[];
      project_impacts: { id: string; label: string; value: number; unit: string; how: string; created_at: string }[]; project_links: { id: string; label: string; url: string; created_at: string }[] }>(
      'project tools', db.from('projects').select('club_id, project_members(user_id), project_tasks(id, title, state, position), project_impacts(id, label, value, unit, how, created_at), project_links(id, label, url, created_at)').eq('id', id))
    // The club's members see the tools (RLS returns no tasks or links to anyone else); a visitor of a public project gets null.
    const role = p ? roleIn(viewer, p.club_id) : null
    if (!p || (!role && !viewer.isAdmin)) return null
    return {
      canEdit: viewer.isAdmin || role === 'lead' || role === 'advisor' || p.project_members.some((m) => m.user_id === viewer.person.id),
      tasks: [...p.project_tasks].sort((a, b) => a.position - b.position).map((t) => ({ id: t.id, title: t.title, state: t.state, done: t.state === 'done' })),
      impacts: [...p.project_impacts].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(({ id: iid, label, value, unit, how }) => ({ id: iid, label, value: Number(value), unit, how })),
      links: [...p.project_links].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(({ id: lid, label, url }) => ({ id: lid, label, url })),
    }
  }
  const data = await loadDb()
  const p = data.projects.find((x) => x.id === id)
  if (!p) return null
  const role = roleIn(viewer, p.clubId)
  if (!role && !viewer.isAdmin) return null
  return {
    canEdit: viewer.isAdmin || role === 'lead' || role === 'advisor' || p.team.includes(viewer.person.id),
    tasks: p.tasks.map((t, i) => ({ ...t, id: `${p.id}-t${i}`, state: t.state ?? (t.done ? 'done' : 'todo') })),
    impacts: (p.impacts ?? []).map((m, i) => ({ ...m, id: `${p.id}-i${i}` })),
    links: p.links ?? [],
  }
}

// ── What's new: approved public projects and news, newest first, with an end ─────────────────────────────────────
export type FeedItem =
  | { kind: 'project'; at: string; project: PublicProject }
  | { kind: 'update'; at: string; update: Update & { club: ClubSummary; strand: Strand | null; projectTitle: string | null } }
export const FEED_SIZE = 30

export async function getFeed(strand?: Strand): Promise<FeedItem[]> {
  'use cache'
  cacheTag('directory', 'feed')
  cacheLife('minutes')
  const matches = (s: Strand | null, clubStrands: Strand[]) => !strand || s === strand || (s === null && clubStrands.includes(strand))
  if (backend === 'supabase') {
    const db = supabasePublic()
    const projectsQ = db.from('projects').select(`${SB_PROJECT}, clubs!inner(${SB_CLUB})`).order('approved_at', { ascending: false }).limit(FEED_SIZE)
    const [projects, updates] = await Promise.all([
      sbRows<SbWithClub<SbProjectRow>>('feed projects', strand ? projectsQ.eq('strand', strand) : projectsQ),
      sbRows<SbWithClub<SbUpdateRow> & { projects: { title: string; strand: Strand } | null }>('feed updates',
        db.from('updates').select(`${SB_UPDATE}, clubs!inner(${SB_CLUB}), projects(title, strand)`).order('created_at', { ascending: false }).limit(FEED_SIZE)),
    ])
    const items: FeedItem[] = [
      ...projects.map((p): FeedItem => ({ kind: 'project', at: sbIso(p.approved_at ?? p.created_at), project: sbPublicProjectOf(p) })),
      ...updates.filter((u) => matches(u.projects?.strand ?? null, u.clubs.strands)).map((u): FeedItem => ({
        kind: 'update', at: sbIso(u.created_at), update: { ...sbUpdateOf(u), club: sbClubOf(u.clubs), strand: u.projects?.strand ?? null, projectTitle: u.projects?.title ?? null },
      })),
    ]
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_SIZE)
  }
  const data = await loadDb()
  const now = Date.now()
  const listed = data.clubs.filter((c) => isListed(data, c, now))
  const clubOf = (id: string) => listed.find((c) => c.id === id)
  const items: FeedItem[] = [
    ...data.projects.filter((p) => isPublicProject(p) && clubOf(p.clubId) && (!strand || p.strand === strand))
      .map((p): FeedItem => ({ kind: 'project', at: p.approvedAt ?? p.createdAt, project: toPublicProject(p, clubOf(p.clubId)!) })),
    ...data.updates.filter((u) => u.visibility === 'public' && u.status === 'published' && u.approvedBy && clubOf(u.clubId)).flatMap((u): FeedItem[] => {
      const club = clubOf(u.clubId)!
      const project = u.projectId ? data.projects.find((p) => p.id === u.projectId) : undefined
      const s = project?.strand ?? null
      if (!matches(s, club.strands)) return []
      return [{ kind: 'update', at: u.createdAt, update: { ...u, club: summarise(club), strand: s, projectTitle: project?.title ?? null } }]
    }),
  ]
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_SIZE)
}

// ── Search: clubs, projects and events (never people) ───────────────────────────────────────────────────────────
export type SearchResults = { clubs: ClubSummary[]; projects: PublicProject[]; events: PublicEvent[] }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export async function searchPublic(raw: string): Promise<SearchResults> {
  'use cache'
  cacheTag('directory', 'events')
  cacheLife('minutes')
  // Letters, digits, spaces and a few marks only: the words go into a PostgREST filter, so nothing that could change it.
  const q = raw.normalize('NFC').replace(/[^\p{L}\p{N}\s'’-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (q.length < 2) return { clubs: [], projects: [], events: [] }
  const now = Date.now()
  if (backend === 'supabase') {
    const db = supabasePublic()
    const like = `%${q}%`
    const [clubs, projects, events] = await Promise.all([
      sbRows<SbClubRow>('search clubs', db.from('clubs').select(SB_CLUB).or(`name.ilike.${like},school_name.ilike.${like},city.ilike.${like}`).limit(10)),
      sbRows<SbWithClub<SbProjectRow>>('search projects', db.from('projects').select(`${SB_PROJECT}, clubs!inner(${SB_CLUB})`).or(`title.ilike.${like},problem.ilike.${like}`).limit(10)),
      sbRows<SbWithClub<SbEventRow>>('search events', db.from('events').select(`${SB_EVENT}, clubs!inner(${SB_CLUB})`).or(`title.ilike.${like},city.ilike.${like}`)
        .gt('ends_at', new Date(now).toISOString()).order('starts_at').limit(10)),
    ])
    return { clubs: clubs.map(sbClubOf), projects: projects.map(sbPublicProjectOf), events: await sbWithSeats(db, events.map((e) => sbPublicEventOf(e, now))) }
  }
  const data = await loadDb()
  const has = (...fields: string[]) => fields.some((f) => fold(f).includes(fold(q)))
  const listed = data.clubs.filter((c) => isListed(data, c, now))
  const byId = (id: string) => listed.find((c) => c.id === id)
  return {
    clubs: listed.filter((c) => has(c.name, c.schoolName, c.city)).slice(0, 10).map(summarise),
    projects: data.projects.filter((p) => isPublicProject(p) && byId(p.clubId) && has(p.title, p.problem)).slice(0, 10).map((p) => toPublicProject(p, byId(p.clubId)!)),
    events: data.events.filter((e) => e.visibility === 'public' && byId(e.clubId) && Date.parse(e.endsAt) > now && has(e.title, e.city))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 10).map((e) => toPublicEvent(e, byId(e.clubId)!, now)),
  }
}

// ── Following a club (request time) ─────────────────────────────────────────────────────────────────────────────
export type Following = { clubs: ClubSummary[]; events: PublicEvent[] }

export async function getFollowing(viewer: Viewer): Promise<Following | null> {
  if (viewer.kind !== 'user') return null
  const now = Date.now()
  if (backend === 'supabase') {
    const db = await supabaseServer()
    const follows = await sbRows<{ club_id: string; clubs: SbClubRow | null }>('follows', db.from('club_follows').select(`club_id, clubs(${SB_CLUB})`).limit(50))
    const clubs = follows.flatMap((f) => (f.clubs ? [sbClubOf(f.clubs)] : []))
    if (!clubs.length) return { clubs: [], events: [] }
    const events = await sbRows<SbWithClub<SbEventRow>>('followed events', supabasePublic().from('events').select(`${SB_EVENT}, clubs!inner(${SB_CLUB})`)
      .in('club_id', clubs.map((c) => c.id)).gt('ends_at', new Date(now).toISOString()).order('starts_at').limit(3))
    return { clubs, events: events.map((e) => sbPublicEventOf(e, now)) }
  }
  const data = await loadDb()
  const ids = (data.follows ?? []).filter((f) => f.userId === viewer.person.id).map((f) => f.clubId)
  const clubs = data.clubs.filter((c) => ids.includes(c.id) && isListed(data, c, now))
  const events = data.events.filter((e) => ids.includes(e.clubId) && e.visibility === 'public' && Date.parse(e.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 3).map((e) => toPublicEvent(e, clubs.find((c) => c.id === e.clubId)!, now))
  return { clubs: clubs.map(summarise), events }
}

export async function isFollowing(viewer: Viewer, clubId: string): Promise<boolean> {
  if (viewer.kind !== 'user') return false
  if (backend === 'supabase') {
    if (!SB_UUID.test(clubId)) return false
    return !!(await sbRow<{ club_id: string }>('is following', (await supabaseServer()).from('club_follows').select('club_id').eq('club_id', clubId)))
  }
  const data = await loadDb()
  return (data.follows ?? []).some((f) => f.userId === viewer.person.id && f.clubId === clubId)
}

// ── Polls in a club's threads (request time; counts for members, never who voted what) ──────────────────────────
export async function getPolls(viewer: Viewer, clubId: string): Promise<Poll[]> {
  if (viewer.kind !== 'user') return []
  if (backend === 'supabase') {
    if (!SB_UUID.test(clubId)) return []
    const db = await supabaseServer()
    const [polls, mine] = await Promise.all([
      sbRows<{ id: string; thread_id: string; question: string; options: string[]; closes_at: string | null }>('polls',
        db.from('polls').select('id, thread_id, question, options, closes_at, threads!inner(club_id)').eq('threads.club_id', clubId).order('created_at').limit(50)),
      sbRows<{ poll_id: string; choice: number }>('my votes', db.from('poll_votes').select('poll_id, choice').limit(200)),
    ])
    const results = await Promise.all(polls.map((p) => db.rpc('poll_results', { p_poll: p.id }).then(({ data }) => (data ?? []) as { choice: number; votes: number }[])))
    const now = Date.now()
    return polls.map((p, i) => ({
      id: p.id, threadId: p.thread_id, question: p.question, options: p.options, closesAt: p.closes_at ? sbIso(p.closes_at) : null,
      closed: !!p.closes_at && Date.parse(p.closes_at) <= now,
      votes: p.options.map((_, c) => results[i].find((r) => r.choice === c)?.votes ?? 0),
      myChoice: mine.find((m) => m.poll_id === p.id)?.choice ?? null,
    }))
  }
  const data = await loadDb()
  const threads = data.threads.filter((t) => t.clubId === clubId).map((t) => t.id)
  if (!roleIn(viewer, clubId) && !viewer.isAdmin) return []
  const now = Date.now()
  return (data.polls ?? []).filter((p) => threads.includes(p.threadId)).map((p) => ({
    ...p, closed: !!p.closesAt && Date.parse(p.closesAt) <= now, votes: p.options.map((_, c) => p.votes.filter((v) => v.choice === c).length), myChoice: p.votes.find((v) => v.userId === viewer.person.id)?.choice ?? null,
  }))
}
