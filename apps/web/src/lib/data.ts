import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { demoMode } from '@/config/switches'
import { t } from '@/i18n/t'
import {
  COUNTRY_NAMES,
  type AgeBand, type AuditEntry, type Club, type ClubEvent, type ContentStatus, type Db, type EventMode, type MemberRole, type MemberStatus,
  type Person, type Project, type ProjectStatus, type Report, type Resource, type Strand, type Thread, type Update, type Verification,
} from './types'
import type { Viewer } from './viewer'
import { backend } from './backend'
import { supabasePublic } from './supabase/public'
import { supabaseServer } from './supabase/server'

// The data access layer. Screens never decide visibility themselves: they call these functions, which
// apply the rules of docs/07-APP-SPEC.md §3 and §6. Three backends (lib/backend.ts): the DEMO fixtures in review
// builds; Supabase (R1b), where RLS enforces the same rules in the database and these functions are thin queries
// (the Supabase section at the end); and none, a launch build without a project, where every list is empty.

const EMPTY: Db = { people: [], clubs: [], projects: [], events: [], updates: [], threads: [], resources: [], reports: [], audit: [], verifications: [] }

export async function loadDb(): Promise<Db> {
  if (!demoMode) return EMPTY
  const { demo } = await import('./demo/fixtures')
  return demo
}

// ── Rules ───────────────────────────────────────────────────────────────────────────────────────────
const isApprovedProject = (p: Project) => p.approvedAt !== null && (p.status === 'active' || p.status === 'completed')
const isPublicProject = (p: Project) => p.visibility === 'public' && isApprovedProject(p)
const isStudent = (m: Club['members'][number]) => m.status === 'active' && m.role !== 'advisor'

/** Listed = verified, at least one active student, and an approved project or an upcoming event (07 §3 note 2). */
function isListed(db: Db, club: Club, now: number) {
  if (club.status !== 'verified' || !club.members.some(isStudent)) return false
  const hasProject = db.projects.some((p) => p.clubId === club.id && isApprovedProject(p))
  const hasUpcoming = db.events.some((e) => e.clubId === club.id && Date.parse(e.endsAt) > now)
  return hasProject || hasUpcoming
}

type ClubFields = Pick<Club, 'id' | 'slug' | 'name' | 'schoolName' | 'city' | 'country' | 'lat' | 'lng' | 'strands' | 'languages' | 'verifiedAt' | 'lastActiveAt' | 'createdAt' | 'tz'>
export type ClubSummary = ClubFields & { countryName: string }
const summarise = (c: ClubFields): ClubSummary => ({
  id: c.id, slug: c.slug, name: c.name, schoolName: c.schoolName, city: c.city, country: c.country, lat: c.lat, lng: c.lng,
  strands: c.strands, languages: c.languages, verifiedAt: c.verifiedAt, lastActiveAt: c.lastActiveAt, createdAt: c.createdAt, tz: c.tz,
  countryName: COUNTRY_NAMES[c.country] ?? c.country,
})

export type PublicEvent = Omit<ClubEvent, 'placeDetail' | 'onlineUrl' | 'going'> & { isPast: boolean; isFull: boolean; club: ClubSummary }
function toPublicEvent(e: ClubEvent, club: ClubFields, now: number): PublicEvent {
  const { placeDetail: _p, onlineUrl: _o, going, ...rest } = e
  void _p; void _o
  return { ...rest, isPast: Date.parse(e.endsAt) <= now, isFull: e.capacity !== null && going.length >= e.capacity, club: summarise(club) }
}

export type PublicProject = Project & { club: ClubSummary; teamCredit: string }
// Never members' things on a public page: no team names (07 §8), no checklist, no links to the club's own files.
const toPublicProject = (p: Project, club: ClubFields): PublicProject => ({ ...p, team: [], tasks: [], links: [], club: summarise(club), teamCredit: `the ${club.name} team` })

// ── What each read returns (the screens depend on these shapes) ─────────────────────────────────────
export type Directory = { clubs: ClubSummary[]; countries: { code: string; name: string }[]; languages: string[] }
export type PublicClub = { club: ClubSummary & { description: string }; projects: PublicProject[]; upcoming: PublicEvent[]; past: PublicEvent[] }
export type Showcase = { events: PublicEvent[]; project: PublicProject | null; club: ClubSummary | null }
export type StrandData = { clubs: ClubSummary[]; events: PublicEvent[]; projects: PublicProject[]; resources: Resource[] }
type Post = Thread['posts'][number]
export type Space = {
  club: ClubSummary & { description: string; preApproval: boolean }
  role: MemberRole | null
  staff: boolean
  updates: (Update & { author: string })[]
  projects: Project[]
  events: (ClubEvent & { isGoing: boolean })[]
  threads: (Omit<Thread, 'posts'> & { posts: (Post & { author: string })[] })[]
  members: { name: string; role: MemberRole }[]
}
export type EventForViewer =
  | { signedIn: false }
  | { signedIn: true; canRsvp: boolean; going: boolean; links: { placeDetail: string | null; onlineUrl: string | null } | null }
export type ClubProject = Project & { club: ClubSummary; teamNames: string[]; role: MemberRole | null }
export type Approvals = {
  club: ClubSummary
  role: 'advisor' | 'lead'
  updates: (Update & { author: string })[]
  projects: (Project & { author: string })[]
  joins: { id: string; name: string }[] // id: the club_members row (DEMO: the user's id), for approve_member
}
export type Dashboard = {
  clubs: (ClubSummary & { role: MemberRole | null })[]
  nextEvents: { id: string; title: string; startsAt: string; endsAt: string; tz: string; city: string; going: boolean }[]
  needYou: { id: string; title: string; status: ProjectStatus; strand: Strand; open: number; next: string | null }[]
  waiting: number
  approvalLinks: { slug: string; name: string; count: number }[]
}
export type ClubSettings = {
  club: ClubSummary
  preApproval: boolean
  canManageMembers: boolean
  // id: the club_members row (DEMO: the user's id), for set_member_role / remove_member. band: advisors and admins only.
  members: { id: string; name: string; role: MemberRole; band: AgeBand | null }[]
}
export type Admin = { verifications: Verification[]; reports: Report[]; audit: AuditEntry[]; resources: Resource[] }

// ── Public reads (cached; the same for every viewer) ────────────────────────────────────────────────
export async function getDirectory(): Promise<Directory> {
  'use cache'
  cacheTag('directory')
  cacheLife('hours')
  if (backend === 'supabase') return sbDirectory()
  const db = await loadDb()
  const now = Date.now()
  const clubs = db.clubs.filter((c) => isListed(db, c, now)).map(summarise)
  const countries = [...new Set(clubs.map((c) => c.country))].map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code })).sort((a, b) => a.name.localeCompare(b.name))
  const languages = [...new Set(clubs.flatMap((c) => c.languages))].sort()
  return { clubs, countries, languages }
}

export type DirectoryQuery = { q?: string; strand?: Strand; country?: string; language?: string; sort?: 'recent' | 'newest' | 'az'; page?: number }
export const PAGE_SIZE = 20
export function queryDirectory(clubs: ClubSummary[], query: DirectoryQuery) {
  const q = query.q?.trim().toLowerCase()
  let list = clubs.filter((c) =>
    (!q || [c.name, c.schoolName, c.city, c.countryName].some((s) => s.toLowerCase().includes(q))) &&
    (!query.strand || c.strands.includes(query.strand)) &&
    (!query.country || c.country === query.country) &&
    (!query.language || c.languages.includes(query.language)),
  )
  const sort = query.sort ?? 'recent'
  list = [...list].sort((a, b) =>
    sort === 'az' ? a.name.localeCompare(b.name) : sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : b.lastActiveAt.localeCompare(a.lastActiveAt),
  )
  const page = Math.max(1, query.page ?? 1)
  const shown = list.slice(0, page * PAGE_SIZE) // "Show the next 20" grows the finite list; there is no infinite scroll
  return { total: list.length, shown, hasMore: list.length > shown.length, page }
}

export async function listListedSlugs(): Promise<string[]> {
  'use cache'
  cacheTag('directory')
  const { clubs } = await getDirectory()
  return clubs.map((c) => c.slug)
}

export async function getPublicClub(slug: string): Promise<PublicClub | null> {
  'use cache'
  cacheTag('directory', `club:${slug}`)
  cacheLife('hours')
  if (backend === 'supabase') return sbPublicClub(slug)
  const db = await loadDb()
  const now = Date.now()
  const club = db.clubs.find((c) => c.slug === slug)
  if (!club || !isListed(db, club, now)) return null
  const events = db.events.filter((e) => e.clubId === club.id && e.visibility === 'public').map((e) => toPublicEvent(e, club, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return {
    club: { ...summarise(club), description: club.description },
    projects: db.projects.filter((p) => p.clubId === club.id && isPublicProject(p)).map((p) => toPublicProject(p, club)),
    upcoming: events.filter((e) => !e.isPast),
    past: events.filter((e) => e.isPast).reverse(),
  }
}

export async function getPublicProject(id: string): Promise<PublicProject | null> {
  'use cache'
  cacheTag(`project:${id}`)
  cacheLife('hours')
  if (backend === 'supabase') return sbPublicProject(id)
  const db = await loadDb()
  const now = Date.now()
  const p = db.projects.find((x) => x.id === id)
  const club = p && db.clubs.find((c) => c.id === p.clubId)
  if (!p || !club || !isPublicProject(p) || !isListed(db, club, now)) return null
  return toPublicProject(p, club)
}

export async function listPublicProjectIds(): Promise<string[]> {
  'use cache'
  cacheTag('directory')
  if (backend === 'supabase') return sbPublicProjectIds()
  const db = await loadDb()
  const now = Date.now()
  return db.projects.filter((p) => isPublicProject(p) && isListed(db, db.clubs.find((c) => c.id === p.clubId)!, now)).map((p) => p.id)
}

export async function getPublicEvent(id: string): Promise<PublicEvent | null> {
  'use cache'
  cacheTag(`event:${id}`)
  cacheLife('hours')
  if (backend === 'supabase') return sbPublicEvent(id)
  const db = await loadDb()
  const now = Date.now()
  const e = db.events.find((x) => x.id === id)
  const club = e && db.clubs.find((c) => c.id === e.clubId)
  if (!e || !club || e.visibility !== 'public' || !isListed(db, club, now)) return null
  return toPublicEvent(e, club, now)
}

export async function listPublicEvents(): Promise<PublicEvent[]> {
  'use cache'
  cacheTag('events')
  cacheLife('hours')
  if (backend === 'supabase') return sbPublicEvents()
  const db = await loadDb()
  const now = Date.now()
  return db.events
    .map((e) => ({ e, club: db.clubs.find((c) => c.id === e.clubId)! }))
    .filter(({ e, club }) => e.visibility === 'public' && club && isListed(db, club, now))
    .map(({ e, club }) => toPublicEvent(e, club, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** The landing's sticker wall: real, listed, public items only (the same rules as the pages they link to). */
export async function getShowcase(): Promise<Showcase> {
  'use cache'
  cacheTag('directory', 'events')
  cacheLife('hours')
  if (backend === 'supabase') return sbShowcase()
  const db = await loadDb()
  const now = Date.now()
  const listed = db.clubs.filter((c) => isListed(db, c, now))
  const byId = (id: string) => listed.find((c) => c.id === id)
  const events = db.events
    .filter((e) => e.visibility === 'public' && byId(e.clubId) && Date.parse(e.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((e) => toPublicEvent(e, byId(e.clubId)!, now))
  const projects = db.projects.filter((p) => isPublicProject(p) && byId(p.clubId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => toPublicProject(p, byId(p.clubId)!))
  const clubs = [...listed].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt)).map(summarise)
  return { events: events.slice(0, 4), project: projects[0] ?? null, club: clubs[0] ?? null }
}

export async function getStrand(strand: Strand): Promise<StrandData> {
  'use cache'
  cacheTag(`strand:${strand}`, 'directory')
  cacheLife('hours')
  if (backend === 'supabase') return sbStrand(strand)
  const db = await loadDb()
  const now = Date.now()
  const listed = db.clubs.filter((c) => isListed(db, c, now))
  return {
    clubs: listed.filter((c) => c.strands.includes(strand)).map(summarise),
    events: db.events
      .filter((e) => e.strand === strand && e.visibility === 'public' && listed.some((c) => c.id === e.clubId) && Date.parse(e.endsAt) > now)
      .map((e) => toPublicEvent(e, listed.find((c) => c.id === e.clubId)!, now))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    projects: db.projects.filter((p) => p.strand === strand && isPublicProject(p) && listed.some((c) => c.id === p.clubId)).map((p) => toPublicProject(p, listed.find((c) => c.id === p.clubId)!)),
    resources: db.resources.filter((r) => r.strand === strand),
  }
}

export async function listResources(strand?: Strand): Promise<Resource[]> {
  'use cache'
  cacheTag('resources')
  if (backend === 'supabase') return resourcesFrom(supabasePublic(), strand)
  const db = await loadDb()
  return strand ? db.resources.filter((r) => r.strand === strand) : db.resources
}

// ── Viewer-dependent reads (request time, behind <Suspense>) ────────────────────────────────────────
export function roleIn(viewer: Viewer, clubId: string) {
  return viewer.kind === 'user' ? viewer.memberships.find((m) => m.clubId === clubId)?.role ?? null : null
}
const FORMER = 'Former member' // a name the viewer can't see: someone who left, or a deleted account
const nameOf = (db: Db, id: string) => db.people.find((p) => p.id === id)?.displayName ?? FORMER

export async function getSpace(viewer: Viewer, slug: string): Promise<Space | null> {
  if (backend === 'supabase') return sbSpace(viewer, slug)
  const db = await loadDb()
  const club = db.clubs.find((c) => c.slug === slug)
  if (!club || viewer.kind !== 'user') return null
  const role = roleIn(viewer, club.id)
  if (!role && !viewer.isAdmin) return null // members of this club, or an admin (logged in R4)
  const me = viewer.person.id
  const staff = role === 'lead' || role === 'advisor' || viewer.isAdmin
  return {
    club: { ...summarise(club), description: club.description, preApproval: club.preApproval },
    role,
    staff,
    updates: db.updates
      .filter((u) => u.clubId === club.id && (u.status === 'published' || u.authorId === me || staff))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((u) => ({ ...u, author: nameOf(db, u.authorId) })),
    projects: db.projects.filter((p) => p.clubId === club.id && (p.status !== 'draft' || p.createdBy === me)),
    events: db.events.filter((e) => e.clubId === club.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((e) => ({ ...e, going: [], isGoing: e.going.includes(me) })),
    threads: db.threads.filter((t) => t.clubId === club.id).map((t) => ({ ...t, posts: t.posts.map((p) => ({ ...p, author: nameOf(db, p.authorId) })) })),
    members: club.members.filter((m) => m.status === 'active').map((m) => ({ name: nameOf(db, m.userId), role: m.role })),
  }
}

export async function getEventForViewer(viewer: Viewer, id: string): Promise<EventForViewer> {
  if (backend === 'supabase') return sbEventForViewer(viewer, id)
  const db = await loadDb()
  const e = db.events.find((x) => x.id === id)
  if (!e || viewer.kind !== 'user') return { signedIn: false as const }
  const role = roleIn(viewer, e.clubId)
  const going = e.going.includes(viewer.person.id)
  const host = role === 'lead' || role === 'advisor'
  const canSee = e.visibility === 'public' || !!role || viewer.isAdmin
  return {
    signedIn: true as const,
    canRsvp: canSee,
    going,
    // event_links: only after an RSVP, or for hosts (07 §6)
    links: going || host ? { placeDetail: e.placeDetail, onlineUrl: e.onlineUrl } : null,
  }
}

export async function getClubProjectForViewer(viewer: Viewer, id: string): Promise<ClubProject | null> {
  if (backend === 'supabase') return sbClubProject(viewer, id)
  const db = await loadDb()
  const p = db.projects.find((x) => x.id === id)
  if (!p || viewer.kind !== 'user') return null
  const role = roleIn(viewer, p.clubId)
  if (!role && !viewer.isAdmin) return null
  if (p.status === 'draft' && p.createdBy !== viewer.person.id) return null
  const club = db.clubs.find((c) => c.id === p.clubId)!
  return { ...p, club: summarise(club), teamNames: p.team.map((id) => nameOf(db, id)), role }
}

export async function getApprovals(viewer: Viewer, slug: string): Promise<Approvals | null> {
  if (backend === 'supabase') return sbApprovals(viewer, slug)
  const db = await loadDb()
  const club = db.clubs.find((c) => c.slug === slug)
  if (!club || viewer.kind !== 'user') return null
  const role = roleIn(viewer, club.id)
  if (role !== 'lead' && role !== 'advisor' && !viewer.isAdmin) return null
  const me = viewer.person.id
  const advisor = role === 'advisor' || viewer.isAdmin
  const authorBand = (id: string) => db.people.find((p) => p.id === id)?.ageBand
  // Leads approve club-only text and members' club-only proposals; advisors approve anything; never one's own (07 §3).
  const updates = db.updates.filter((u) => u.clubId === club.id && u.status === 'pending' && u.authorId !== me && (advisor || (u.visibility === 'club' && !u.hasPhoto)))
  const projects = db.projects.filter((p) => {
    if (p.clubId !== club.id || p.status !== 'proposed' || p.createdBy === me) return false
    const byLead = club.members.some((m) => m.userId === p.createdBy && m.role === 'lead')
    return advisor || (p.visibility === 'club' && !byLead)
  })
  const joins = club.members.filter((m) => m.status === 'pending' && (advisor || authorBand(m.userId) === '16-17'))
  return {
    club: summarise(club),
    role: advisor ? ('advisor' as const) : ('lead' as const),
    updates: updates.map((u) => ({ ...u, author: nameOf(db, u.authorId) })),
    projects: projects.map((p) => ({ ...p, author: nameOf(db, p.createdBy) })),
    joins: joins.map((m) => ({ id: m.userId, name: nameOf(db, m.userId) })),
  }
}

export async function getDashboard(viewer: Viewer): Promise<Dashboard | null> {
  if (backend === 'supabase') return sbDashboard(viewer)
  if (viewer.kind !== 'user') return null
  const db = await loadDb()
  const now = Date.now()
  const me = viewer.person.id
  const clubIds = viewer.memberships.map((m) => m.clubId)
  const clubs = db.clubs.filter((c) => clubIds.includes(c.id)).map((c) => ({ ...summarise(c), role: roleIn(viewer, c.id) }))
  const nextEvents = db.events
    .filter((e) => Date.parse(e.endsAt) > now && (clubIds.includes(e.clubId) || e.going.includes(me)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5)
    .map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, tz: e.tz, city: e.city, going: e.going.includes(me) }))
  const needYou = db.projects.filter((p) => p.team.includes(me) && (p.status === 'active' || p.status === 'proposed')).map((p) => ({ id: p.id, title: p.title, status: p.status, strand: p.strand, open: p.tasks.filter((t) => !t.done).length, next: p.tasks.find((t) => !t.done)?.title ?? null }))
  let waiting = 0
  const approvalLinks: { slug: string; name: string; count: number }[] = []
  for (const c of db.clubs.filter((x) => clubIds.includes(x.id))) {
    const a = await getApprovals(viewer, c.slug)
    if (a) {
      const count = a.updates.length + a.projects.length + a.joins.length
      waiting += count
      if (count) approvalLinks.push({ slug: c.slug, name: c.name, count })
    }
  }
  return { clubs, nextEvents, needYou, waiting, approvalLinks }
}

export async function getClubSettings(viewer: Viewer, slug: string): Promise<ClubSettings | null> {
  if (backend === 'supabase') return sbClubSettings(viewer, slug)
  const db = await loadDb()
  const club = db.clubs.find((c) => c.slug === slug)
  if (!club || viewer.kind !== 'user') return null
  const role = roleIn(viewer, club.id)
  if (role !== 'lead' && role !== 'advisor' && !viewer.isAdmin) return null
  return {
    club: summarise(club),
    preApproval: club.preApproval,
    canManageMembers: role === 'advisor' || viewer.isAdmin, // only advisors remove members or change roles (07 §3)
    members: club.members.filter((m) => m.status === 'active').map((m) => ({ id: m.userId, name: nameOf(db, m.userId), role: m.role, band: db.people.find((p) => p.id === m.userId)?.ageBand ?? 'adult' })),
  }
}

export async function getAdmin(viewer: Viewer): Promise<Admin | null> {
  if (backend === 'supabase') return sbAdmin(viewer)
  if (viewer.kind !== 'user' || !viewer.isAdmin) return null
  const db = await loadDb()
  return {
    verifications: db.verifications,
    reports: [...db.reports].sort((a, b) => (a.priority === b.priority ? b.createdAt.localeCompare(a.createdAt) : a.priority === 'child_safety' ? -1 : 1)),
    audit: [...db.audit].sort((a, b) => b.at.localeCompare(a.at)),
    resources: db.resources,
  }
}

export function personName(db: Db, id: string): string {
  return nameOf(db, id)
}
export type { Person }

// ── Supabase (R1b) ──────────────────────────────────────────────────────────────────────────────────
// The same shapes, read through the access rules (07 §6), so the database decides what each person sees:
// - Public reads use the anonymous, cookie-less client (safe inside 'use cache'): the anon policies show listed
//   clubs and their approved public projects, events and updates, and published resources.
// - Viewer reads use the visitor's own session. The checks the screens rely on stay (members only, staff, role);
//   everything else is what RLS returns.
// - Names come only from club_member_names (co-members and admins); the settings and approvals lists from
//   club_roster(), which shows age bands to advisors and admins only.
// - One query per list (embedding, e.g. clubs!inner(...)): no N+1. A list that could grow is keyset-paginated with no
//   request over 50 rows (07 §9): the first page where a screen shows one, every page where it shows all.
// - snake_case rows become the screens' camelCase, and timestamps ("2026-10-14T13:00:00+00:00") become ISO UTC
//   ("2026-10-14T13:00:00.000Z"), so string sorting, lib/format.ts and the .ics export behave as on the fixtures.

type Client = SupabaseClient
type User = Extract<Viewer, { kind: 'user' }>

const MAX_ROWS = 50 // 07 §9: no request returns more than 50 rows (assumes Supabase's own max-rows setting is at least this)
const TIMEOUT_MS = 10_000 // an unreachable database fails a read instead of hanging a request or the build
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i // ids are UUIDs: anything else is a 404, not a query
const isSlug = (s: string) => s.length <= 64 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) // the clubs.slug check
const SHOWN_EVENTS = ['published', 'pending'] // cancelled and hidden events stay off the lists: the shapes carry no status

// Column lists, typed as plain strings so supabase-js doesn't type-parse them (the rows are typed below instead).
const CLUB = 'id, slug, name, school_name, city, country, lat, lng, strands, languages, verified_at, last_active_at, created_at, tz' as string
const PROJECT = 'id, club_id, title, strand, problem, action, evidence, reflection, status, visibility, year, approved_by, approved_at, created_by, created_at' as string
const PROJECT_TEAM = `${PROJECT}, project_members(user_id, role, created_at), project_tasks(title, done, position)` // members only: never anon
const EVENT = 'id, club_id, title, strand, starts_at, ends_at, tz, mode, city, capacity, visibility, description' as string
const UPDATE = 'id, club_id, project_id, author_id, body, has_photo, visibility, status, created_at, approved_by' as string
const RESOURCE = 'id, strand, title, url, source_name, description, created_at' as string

type ClubRow = {
  id: string; slug: string; name: string; school_name: string; city: string; country: string; lat: number | string; lng: number | string
  strands: Strand[]; languages: string[]; verified_at: string | null; last_active_at: string; created_at: string; tz: string
}
type ProjectRow = {
  id: string; club_id: string; title: string; strand: Strand; problem: string; action: string; evidence: string; reflection: string
  status: ProjectStatus; visibility: 'public' | 'club'; year: number; approved_by: string | null; approved_at: string | null
  created_by: string | null; created_at: string
  project_members?: { user_id: string; role: 'owner' | 'member'; created_at: string }[]
  project_tasks?: { title: string; done: boolean; position: number }[]
}
type EventRow = {
  id: string; club_id: string; title: string; strand: Strand; starts_at: string; ends_at: string; tz: string; mode: EventMode; city: string
  capacity: number | null; visibility: 'public' | 'club'; description: string
}
type WithClub<R> = R & { clubs: ClubRow }
type LinkRow = { place_detail: string | null; online_url: string | null }
type RsvpRow = { status: 'going' | 'cancelled' | 'waitlist' }
type UpdateRow = {
  id: string; club_id: string; project_id: string | null; author_id: string; body: string; has_photo: boolean
  visibility: 'club' | 'public'; status: ContentStatus; created_at: string; approved_by: string | null
}
type ResourceRow = { id: string; strand: Strand; title: string; url: string; source_name: string; description: string; created_at: string }
type NameRow = { user_id: string; display_name: string; role: MemberRole }
type RosterRow = { member_id: string; user_id: string; display_name: string; role: MemberRole; status: MemberStatus; age_band: AgeBand | null }

// ── Reading ──
// The few builder methods used here, so the helpers accept any supabase-js query without its generics.
type Failure = { message: string; code?: string }
type Reply = { data: unknown; error: Failure | null; status: number }
interface Query extends PromiseLike<Reply> { abortSignal(signal: AbortSignal): Query; maybeSingle(): PromiseLike<Reply> }
interface Page extends Query { gt(column: string, value: string): Page; order(column: string): Page; limit(count: number): Page }

/**
 * A read that failed. During `next build` an unreachable database (no answer, a timeout, or a 5xx such as a paused
 * project) must not stop the build: the page renders its empty state and revalidates later. Anything else (a wrong key,
 * a broken query) fails the build loudly. At request time every failure surfaces (error.tsx), so an outage is never
 * cached as "no clubs" or a 404.
 */
function failed(what: string, error: Failure, status: number) {
  const message = `Supabase read failed (${what}): ${error.message}${error.code ? ` [${error.code}]` : ''} (HTTP ${status})`
  if (process.env.NEXT_PHASE !== 'phase-production-build' || (status > 0 && status < 500)) throw new Error(message)
  console.warn(`${message}. The build continues without it.`)
}

async function rows<T>(what: string, query: Query): Promise<T[]> {
  const { data, error, status } = await query.abortSignal(AbortSignal.timeout(TIMEOUT_MS))
  if (error) failed(what, error, status)
  return (data ?? []) as T[]
}

async function row<T>(what: string, query: Query): Promise<T | null> {
  const { data, error, status } = await query.abortSignal(AbortSignal.timeout(TIMEOUT_MS)).maybeSingle()
  if (error) failed(what, error, status)
  return (data ?? null) as T | null
}

/** Every row of a list a screen shows whole: keyset pages of 50 on a unique key, so no request returns more. */
async function every<T>(what: string, key: keyof T & string, page: () => Page): Promise<T[]> {
  const all: T[] = []
  let after: string | null = null
  for (;;) {
    const query: Page = after === null ? page() : page().gt(key, after)
    const batch = await rows<T>(what, query.order(key).limit(MAX_ROWS))
    all.push(...batch)
    if (batch.length < MAX_ROWS) return all
    after = String(batch[batch.length - 1][key])
  }
}

// ── Rows to shapes ──
const iso = (v: string) => new Date(v).toISOString()
const isoOrNull = (v: string | null) => (v === null ? null : iso(v))
const time = (v: string) => Date.parse(v)
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null) // a to-one embed
const ROLE_ORDER: Record<MemberRole, number> = { advisor: 0, lead: 1, member: 2 }
const byRoleThenName = (a: { role: MemberRole; name: string }, b: { role: MemberRole; name: string }) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name)

const clubOf = (r: ClubRow): ClubSummary => summarise({
  id: r.id, slug: r.slug, name: r.name, schoolName: r.school_name, city: r.city, country: r.country, lat: Number(r.lat), lng: Number(r.lng),
  strands: r.strands, languages: r.languages, verifiedAt: isoOrNull(r.verified_at), lastActiveAt: iso(r.last_active_at), createdAt: iso(r.created_at), tz: r.tz,
})

const projectOf = (r: ProjectRow): Project => ({
  id: r.id, clubId: r.club_id, title: r.title, strand: r.strand, problem: r.problem, action: r.action, evidence: r.evidence, reflection: r.reflection,
  status: r.status, visibility: r.visibility, year: r.year, approvedBy: r.approved_by, approvedAt: isoOrNull(r.approved_at),
  createdBy: r.created_by ?? '', // null once the account that started it is deleted (the project stays with the club)
  createdAt: iso(r.created_at),
  // The owner first, then the team in the order they joined; the checklist in its own order.
  team: [...(r.project_members ?? [])]
    .sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner') || time(a.created_at) - time(b.created_at) || a.user_id.localeCompare(b.user_id))
    .map((m) => m.user_id),
  tasks: [...(r.project_tasks ?? [])].sort((a, b) => a.position - b.position).map(({ title, done }) => ({ title, done })),
})

const eventOf = (r: EventRow, links: LinkRow | null = null): ClubEvent => ({
  id: r.id, clubId: r.club_id, title: r.title, strand: r.strand, startsAt: iso(r.starts_at), endsAt: iso(r.ends_at), tz: r.tz, mode: r.mode,
  city: r.city, capacity: r.capacity, visibility: r.visibility, description: r.description,
  placeDetail: links?.place_detail ?? null, onlineUrl: links?.online_url ?? null, // event_links: RLS sends them to people going, hosts, admins
  going: [], // the RSVP list is for the event's hosts only (07 §6 rsvps), so nobody else can count it: isFull stays false
})

const updateOf = (r: UpdateRow): Update => ({
  id: r.id, clubId: r.club_id, projectId: r.project_id, authorId: r.author_id, body: r.body, hasPhoto: r.has_photo, visibility: r.visibility,
  status: r.status, createdAt: iso(r.created_at), approvedBy: r.approved_by,
})

const publicEventOf = (r: WithClub<EventRow>, now: number) => toPublicEvent(eventOf(r), clubOf(r.clubs), now)

/** "This event is full": the going count from going_counts() (the RSVP list itself is for hosts only, 07 §6). */
async function withSeats<T extends PublicEvent>(db: Client, list: T[]): Promise<T[]> {
  const capped = list.filter((e) => e.capacity !== null)
  if (!capped.length) return list
  const { data } = await db.rpc('going_counts', { p_events: capped.map((e) => e.id) })
  const going = new Map(((data ?? []) as { event_id: string; going: number }[]).map((r) => [r.event_id, r.going]))
  return list.map((e) => (e.capacity !== null && (going.get(e.id) ?? 0) >= e.capacity ? { ...e, isFull: true } : e))
}
const publicProjectOf = (r: WithClub<ProjectRow>) => toPublicProject(projectOf(r), clubOf(r.clubs))

async function resourcesFrom(db: Client, strand?: Strand): Promise<Resource[]> {
  // Published ones for everyone; an admin's session also sees drafts (resources_select).
  const list = await every<ResourceRow>('resources', 'id', () => {
    const q = db.from('resources').select(RESOURCE)
    return strand ? q.eq('strand', strand) : q
  })
  return list
    .sort((a, b) => time(a.created_at) - time(b.created_at) || a.title.localeCompare(b.title))
    .map((r) => ({ id: r.id, strand: r.strand, title: r.title, url: r.url, sourceName: r.source_name, description: r.description }))
}

/** The club's active members' names as this viewer may see them: co-members and admins only (club_member_names). */
async function namesIn(db: Client, clubId: string) {
  const list = await every<NameRow>('member names', 'user_id', () => db.from('club_member_names').select('user_id, display_name, role').eq('club_id', clubId))
  return new Map(list.map((n) => [n.user_id, { name: n.display_name, role: n.role }]))
}

/**
 * Whether the database lets this viewer read the club as a member: the names view lists them, or they're an admin.
 * An advisor's membership row isn't enough on its own: the rules want the second factor even to read (R1b-foundation §3,
 * choice 2), so without it the screens get null, as for a non-member, instead of a half-empty club.
 */
const reads = (viewer: User, names: Map<string, unknown>) => viewer.isAdmin || names.has(viewer.person.id)

/** club_roster(): empty unless the database counts the viewer as the club's staff (a lead, or a verified advisor with the second factor) or an admin. */
const rosterOf = (db: Client, clubId: string) => every<RosterRow>('club roster', 'member_id', () => db.rpc('club_roster', { p_club: clubId }))

// ── Public reads ──
async function sbDirectory(): Promise<Directory> {
  const clubs = (await every<ClubRow>('listed clubs', 'id', () => supabasePublic().from('clubs').select(CLUB))).map(clubOf)
  const countries = [...new Set(clubs.map((c) => c.country))].map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code })).sort((a, b) => a.name.localeCompare(b.name))
  const languages = [...new Set(clubs.flatMap((c) => c.languages))].sort()
  return { clubs, countries, languages }
}

async function sbPublicClub(slug: string): Promise<PublicClub | null> {
  if (!isSlug(slug)) return null
  const now = Date.now()
  const at = new Date(now).toISOString()
  const db = supabasePublic()
  // The club's events are found by its slug, so all three reads go out together.
  const events = () => db.from('events').select(`${EVENT}, clubs!inner(slug)`).eq('clubs.slug', slug)
  const [club, upcoming, past] = await Promise.all([
    row<ClubRow & { description: string; projects: ProjectRow[] }>('public club',
      db.from('clubs').select(`${CLUB}, description, projects(${PROJECT})`).eq('slug', slug)
        .order('created_at', { referencedTable: 'projects', ascending: false }).limit(MAX_ROWS, { referencedTable: 'projects' })),
    rows<EventRow>('club events, upcoming', events().gt('ends_at', at).order('starts_at').order('id').limit(MAX_ROWS)),
    rows<EventRow>('club events, past', events().lte('ends_at', at).order('starts_at', { ascending: false }).order('id').limit(PAGE_SIZE)),
  ])
  if (!club) return null
  const summary = clubOf(club)
  return {
    club: { ...summary, description: club.description },
    projects: club.projects.map((p) => toPublicProject(projectOf(p), summary)),
    upcoming: await withSeats(db, upcoming.map((e) => toPublicEvent(eventOf(e), summary, now))),
    past: past.map((e) => toPublicEvent(eventOf(e), summary, now)), // newest first, as on the fixtures
  }
}

async function sbPublicProject(id: string): Promise<PublicProject | null> {
  if (!UUID.test(id)) return null
  const p = await row<WithClub<ProjectRow>>('public project', supabasePublic().from('projects').select(`${PROJECT}, clubs!inner(${CLUB})`).eq('id', id))
  return p && publicProjectOf(p)
}

async function sbPublicProjectIds(): Promise<string[]> {
  return (await every<{ id: string }>('public project ids', 'id', () => supabasePublic().from('projects').select('id'))).map((p) => p.id)
}

async function sbPublicEvent(id: string): Promise<PublicEvent | null> {
  if (!UUID.test(id)) return null
  const e = await row<WithClub<EventRow>>('public event', supabasePublic().from('events').select(`${EVENT}, clubs!inner(${CLUB})`).eq('id', id))
  return e && (await withSeats(supabasePublic(), [publicEventOf(e, Date.now())]))[0]
}

async function sbPublicEvents(): Promise<PublicEvent[]> {
  const now = Date.now()
  // clubs!inner: a club's events only (a live conference hub's events have no club, and no page here yet).
  const list = await every<WithClub<EventRow>>('public events', 'id', () => supabasePublic().from('events').select(`${EVENT}, clubs!inner(${CLUB})`))
  return (await withSeats(supabasePublic(), list.map((e) => publicEventOf(e, now)))).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

async function sbShowcase(): Promise<Showcase> {
  const now = Date.now()
  const db = supabasePublic()
  const [events, projects, clubs] = await Promise.all([
    rows<WithClub<EventRow>>('showcase events', db.from('events').select(`${EVENT}, clubs!inner(${CLUB})`).gt('ends_at', new Date(now).toISOString()).order('starts_at').order('id').limit(4)),
    rows<WithClub<ProjectRow>>('showcase project', db.from('projects').select(`${PROJECT}, clubs!inner(${CLUB})`).order('created_at', { ascending: false }).order('id').limit(1)),
    rows<ClubRow>('showcase club', db.from('clubs').select(CLUB).order('last_active_at', { ascending: false }).order('id').limit(1)),
  ])
  return {
    events: await withSeats(db, events.map((e) => publicEventOf(e, now))),
    project: projects[0] ? publicProjectOf(projects[0]) : null,
    club: clubs[0] ? clubOf(clubs[0]) : null,
  }
}

async function sbStrand(strand: Strand): Promise<StrandData> {
  const now = Date.now()
  const at = new Date(now).toISOString()
  const db = supabasePublic()
  const [clubs, events, projects, resources] = await Promise.all([
    rows<ClubRow>('strand clubs', db.from('clubs').select(CLUB).contains('strands', [strand]).order('last_active_at', { ascending: false }).order('id').limit(MAX_ROWS)),
    rows<WithClub<EventRow>>('strand events', db.from('events').select(`${EVENT}, clubs!inner(${CLUB})`).eq('strand', strand).gt('ends_at', at).order('starts_at').order('id').limit(MAX_ROWS)),
    rows<WithClub<ProjectRow>>('strand projects', db.from('projects').select(`${PROJECT}, clubs!inner(${CLUB})`).eq('strand', strand).order('created_at', { ascending: false }).order('id').limit(MAX_ROWS)),
    resourcesFrom(db, strand),
  ])
  return { clubs: clubs.map(clubOf), events: await withSeats(db, events.map((e) => publicEventOf(e, now))), projects: projects.map(publicProjectOf), resources }
}

// ── Viewer reads ──
type SpaceEventRow = EventRow & { event_links: LinkRow | LinkRow[] | null; rsvps: RsvpRow[] }
type ThreadRow = { id: string; title: string; thread_posts: { id: string; author_id: string; body: string; created_at: string }[] }

async function sbSpace(viewer: Viewer, slug: string): Promise<Space | null> {
  if (viewer.kind !== 'user' || !isSlug(slug)) return null
  const db = await supabaseServer()
  const club = await row<ClubRow & { description: string; pre_approval: boolean }>('space club', db.from('clubs').select(`${CLUB}, description, pre_approval`).eq('slug', slug))
  if (!club) return null
  const role = roleIn(viewer, club.id)
  if (!role && !viewer.isAdmin) return null // members of this club, or an admin
  const me = viewer.person.id
  const [names, updates, projects, events, threads] = await Promise.all([
    namesIn(db, club.id),
    // Newest first, the first page of 20 (07 §9). RLS: published ones and the viewer's own; staff and admins see all.
    rows<UpdateRow>('space updates', db.from('updates').select(UPDATE).eq('club_id', club.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE)),
    // Not removed ones, and nobody else's drafts (as on the fixtures; staff could read them).
    rows<ProjectRow>('space projects', db.from('projects').select(PROJECT_TEAM).eq('club_id', club.id).is('deleted_at', null).or(`status.neq.draft,created_by.eq.${me}`)
      .order('created_at', { ascending: false }).order('id').limit(MAX_ROWS)),
    // The newest 50 (so upcoming ones are never cut off by old ones), shown oldest first; the viewer's own RSVP only.
    rows<SpaceEventRow>('space events', db.from('events').select(`${EVENT}, event_links(place_detail, online_url), rsvps(status)`).eq('club_id', club.id)
      .in('status', SHOWN_EVENTS).eq('rsvps.user_id', me).order('starts_at', { ascending: false }).order('id').limit(MAX_ROWS)),
    // Admins have no direct read of threads (only admin_read_threads(), which logs each read), so for them this is empty.
    rows<ThreadRow>('space threads', db.from('threads').select('id, title, thread_posts(id, author_id, body, created_at)').eq('club_id', club.id).is('deleted_at', null)
      .neq('thread_posts.status', 'hidden').order('created_at', { ascending: false }).order('id')
      .order('created_at', { referencedTable: 'thread_posts', ascending: false }).limit(MAX_ROWS, { referencedTable: 'thread_posts' }).limit(PAGE_SIZE)),
  ])
  if (!reads(viewer, names)) return null
  const name = (id: string) => names.get(id)?.name ?? FORMER
  return {
    club: { ...clubOf(club), description: club.description, preApproval: club.pre_approval },
    role,
    // Staff powers: a lead, or an advisor who is verified and signed in with the authenticator app (07 §4).
    staff: role === 'lead' || (role === 'advisor' && viewer.person.isVerifiedAdult && viewer.aal2) || viewer.isAdmin,
    updates: updates.map((u) => ({ ...updateOf(u), author: name(u.author_id) })),
    projects: projects.map(projectOf),
    events: [...events].reverse().map((e) => ({ ...eventOf(e, one(e.event_links)), isGoing: e.rsvps.some((r) => r.status === 'going') })),
    threads: threads.map((th) => ({
      id: th.id, clubId: club.id, title: th.title,
      posts: [...th.thread_posts].reverse().map((p) => ({ id: p.id, authorId: p.author_id, body: p.body, createdAt: iso(p.created_at), author: name(p.author_id) })),
    })),
    members: [...names.values()].sort(byRoleThenName).map(({ name, role }) => ({ name, role })),
  }
}

async function sbEventForViewer(viewer: Viewer, id: string): Promise<EventForViewer> {
  if (viewer.kind !== 'user' || !UUID.test(id)) return { signedIn: false }
  const db = await supabaseServer()
  const e = await row<{ event_links: LinkRow | LinkRow[] | null; rsvps: RsvpRow[] }>('event for viewer',
    db.from('events').select('id, event_links(place_detail, online_url), rsvps(status)').eq('id', id).eq('rsvps.user_id', viewer.person.id))
  if (!e) return { signedIn: false }
  // Readable means the viewer may RSVP (rsvp() applies the same visibility). The exact place and the online link come
  // back only for people going, the hosts and admins (07 §6 event_links).
  const links = one(e.event_links)
  return { signedIn: true, canRsvp: true, going: e.rsvps.some((r) => r.status === 'going'), links: links && { placeDetail: links.place_detail, onlineUrl: links.online_url } }
}

async function sbClubProject(viewer: Viewer, id: string): Promise<ClubProject | null> {
  if (viewer.kind !== 'user' || !UUID.test(id)) return null
  const db = await supabaseServer()
  const p = await row<WithClub<ProjectRow>>('club project', db.from('projects').select(`${PROJECT_TEAM}, clubs!inner(${CLUB})`).eq('id', id).is('deleted_at', null))
  if (!p) return null
  const role = roleIn(viewer, p.club_id)
  if (!role && !viewer.isAdmin) return null
  if (p.status === 'draft' && p.created_by !== viewer.person.id) return null
  const names = await namesIn(db, p.club_id)
  if (!reads(viewer, names)) return null
  const project = projectOf(p)
  return { ...project, club: clubOf(p.clubs), teamNames: project.team.map((u) => names.get(u)?.name ?? FORMER), role }
}

/**
 * One club's approval queue (07 §3): leads approve club-only text and members' club-only proposals; advisors and
 * admins approve anything; nobody approves their own. Null when the database doesn't count the viewer as the club's
 * staff (an empty roster), so the screen never lists items its buttons couldn't act on.
 */
async function queueOf(db: Client, viewer: User, clubId: string, role: MemberRole | null): Promise<Omit<Approvals, 'club'> | null> {
  const me = viewer.person.id
  const [roster, names, updates, projects] = await Promise.all([
    rosterOf(db, clubId),
    namesIn(db, clubId),
    every<UpdateRow>('pending updates', 'id', () => db.from('updates').select(UPDATE).eq('club_id', clubId).eq('status', 'pending').neq('author_id', me)),
    every<ProjectRow>('proposals', 'id', () => db.from('projects').select(PROJECT_TEAM).eq('club_id', clubId).eq('status', 'proposed').is('deleted_at', null)
      .or(`created_by.is.null,created_by.neq.${me}`)),
  ])
  if (!roster.length) return null
  const advisor = role === 'advisor' || viewer.isAdmin
  const name = (id: string | null) => (id ? names.get(id)?.name : undefined) ?? FORMER
  const byLead = (id: string | null) => !!id && names.get(id)?.role === 'lead'
  const oldestFirst = (a: { created_at: string }, b: { created_at: string }) => time(a.created_at) - time(b.created_at)
  return {
    role: advisor ? 'advisor' : 'lead',
    updates: updates.filter((u) => advisor || (u.visibility === 'club' && !u.has_photo)).sort(oldestFirst).map((u) => ({ ...updateOf(u), author: name(u.author_id) })),
    projects: projects.filter((p) => advisor || (p.visibility === 'club' && !byLead(p.created_by))).sort(oldestFirst).map((p) => ({ ...projectOf(p), author: name(p.created_by) })),
    // A request waits only after a code join, which is for 16–17 only (join_with_code), so a lead may approve each one.
    joins: roster.filter((m) => m.status === 'pending').sort((a, b) => a.display_name.localeCompare(b.display_name)).map((m) => ({ id: m.member_id, name: m.display_name })),
  }
}

async function sbApprovals(viewer: Viewer, slug: string): Promise<Approvals | null> {
  if (viewer.kind !== 'user' || !isSlug(slug)) return null
  const db = await supabaseServer()
  const club = await row<ClubRow>('approvals club', db.from('clubs').select(CLUB).eq('slug', slug))
  if (!club) return null
  const role = roleIn(viewer, club.id)
  if (role !== 'lead' && role !== 'advisor' && !viewer.isAdmin) return null
  const queue = await queueOf(db, viewer, club.id, role)
  return queue && { club: clubOf(club), ...queue }
}

type HomeEventRow = { id: string; title: string; starts_at: string; ends_at: string; tz: string; city: string; rsvps: RsvpRow[] }
type MyProjectRow = { id: string; title: string; status: ProjectStatus; strand: Strand; project_tasks: { title: string; done: boolean; position: number }[] }

async function sbDashboard(viewer: Viewer): Promise<Dashboard | null> {
  if (viewer.kind !== 'user') return null
  const db = await supabaseServer()
  const me = viewer.person.id
  const now = new Date().toISOString()
  const clubIds = viewer.memberships.map((m) => m.clubId)
  const staffIn = viewer.memberships.filter((m) => m.role !== 'member' || viewer.isAdmin)
  const HOME_EVENT = 'id, title, starts_at, ends_at, tz, city'
  const [clubs, clubEvents, goingTo, mine, queues] = await Promise.all([
    clubIds.length ? rows<ClubRow>('my clubs', db.from('clubs').select(CLUB).in('id', clubIds).order('name').limit(MAX_ROWS)) : [],
    // The next five from my clubs, and the next five I'm going to anywhere: the first five of both together.
    clubIds.length
      ? rows<HomeEventRow>('my clubs\' events', db.from('events').select(`${HOME_EVENT}, rsvps(status)`).in('club_id', clubIds).in('status', SHOWN_EVENTS)
          .gt('ends_at', now).eq('rsvps.user_id', me).order('starts_at').order('id').limit(5))
      : [],
    rows<HomeEventRow>('events I\'m going to', db.from('events').select(`${HOME_EVENT}, rsvps!inner(status)`).eq('rsvps.user_id', me).eq('rsvps.status', 'going')
      .in('status', SHOWN_EVENTS).gt('ends_at', now).order('starts_at').order('id').limit(5)),
    rows<MyProjectRow>('projects that need me', db.from('projects').select('id, title, status, strand, project_members!inner(user_id), project_tasks(title, done, position)')
      .eq('project_members.user_id', me).in('status', ['active', 'proposed']).is('deleted_at', null).order('created_at', { ascending: false }).order('id').limit(PAGE_SIZE)),
    // The same queue as each club's approvals page, so Home's count always matches it (one per club I run).
    Promise.all(staffIn.map(async (m) => [m.clubId, await queueOf(db, viewer, m.clubId, m.role)] as const)),
  ])
  const going = new Set([...goingTo, ...clubEvents.filter((e) => e.rsvps.some((r) => r.status === 'going'))].map((e) => e.id))
  const nextEvents = [...new Map([...clubEvents, ...goingTo].map((e) => [e.id, e])).values()]
    .sort((a, b) => time(a.starts_at) - time(b.starts_at) || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((e) => ({ id: e.id, title: e.title, startsAt: iso(e.starts_at), endsAt: iso(e.ends_at), tz: e.tz, city: e.city, going: going.has(e.id) }))
  const needYou = mine.map((p) => {
    const open = [...p.project_tasks].sort((a, b) => a.position - b.position).filter((task) => !task.done)
    return { id: p.id, title: p.title, status: p.status, strand: p.strand, open: open.length, next: open[0]?.title ?? null }
  })
  const queueFor = new Map(queues)
  let waiting = 0
  const approvalLinks: Dashboard['approvalLinks'] = []
  for (const c of clubs) {
    const q = queueFor.get(c.id)
    if (!q) continue
    const count = q.updates.length + q.projects.length + q.joins.length
    waiting += count
    if (count) approvalLinks.push({ slug: c.slug, name: c.name, count })
  }
  return { clubs: clubs.map((c) => ({ ...clubOf(c), role: roleIn(viewer, c.id) })), nextEvents, needYou, waiting, approvalLinks }
}

async function sbClubSettings(viewer: Viewer, slug: string): Promise<ClubSettings | null> {
  if (viewer.kind !== 'user' || !isSlug(slug)) return null
  const db = await supabaseServer()
  const club = await row<ClubRow & { pre_approval: boolean }>('settings club', db.from('clubs').select(`${CLUB}, pre_approval`).eq('slug', slug))
  if (!club) return null
  const role = roleIn(viewer, club.id)
  if (role !== 'lead' && role !== 'advisor' && !viewer.isAdmin) return null
  // club_roster(): names, roles and requests for the club's staff; age bands for its advisors and admins only (07 §8).
  const roster = await rosterOf(db, club.id)
  if (!roster.length) return null // not the club's staff in the database (yet)
  return {
    club: clubOf(club),
    preApproval: club.pre_approval,
    canManageMembers: role === 'advisor' || viewer.isAdmin, // only advisors remove members or change roles (07 §3)
    members: roster
      .filter((m) => m.status === 'active')
      .map((m) => ({ id: m.member_id, name: m.display_name, role: m.role, band: m.age_band }))
      .sort(byRoleThenName),
  }
}

type VerificationRow = { id: string; step: number; school_name: string; school_domain: string; second_contact_role: string | null; profiles: { display_name: string } | { display_name: string }[] | null }
type WaitingClubRow = { id: string; name: string; school_name: string; club_members: { user_id: string }[] }
type ReportRow = {
  id: string; target_type: string; club_id: string | null; reason: string; details: string | null; priority: Report['priority']; status: Report['status']; about_adult: boolean
  created_at: string; clubs: { name: string } | { name: string }[] | null
}
type AuditRow = { id: string; at: string; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown> | null }

async function sbAdmin(viewer: Viewer): Promise<Admin | null> {
  if (viewer.kind !== 'user' || !viewer.isAdmin) return null // isAdmin already needs the second factor (lib/viewer.ts)
  const db = await supabaseServer()
  const [requests, waitingClubs, reports, audit, resources] = await Promise.all([
    rows<VerificationRow>('advisor verifications', db.from('advisor_verifications').select('id, step, school_name, school_domain, second_contact_role, profiles(display_name)')
      .eq('status', 'open').order('created_at').order('id').limit(MAX_ROWS)),
    rows<WaitingClubRow>('clubs waiting', db.from('clubs').select('id, name, school_name, club_members(user_id)').eq('status', 'pending')
      .eq('club_members.role', 'advisor').eq('club_members.status', 'active').order('created_at').order('id').limit(MAX_ROWS)),
    // The moderation queue: open and triaged reports, child safety first, then the newest.
    rows<ReportRow>('reports', db.from('reports').select('id, target_type, club_id, reason, details, priority, status, about_adult, created_at, clubs(name)')
      .in('status', ['open', 'triaged']).order('priority').order('created_at', { ascending: false }).order('id').limit(MAX_ROWS)),
    rows<AuditRow>('audit log', db.from('audit_log').select('id, at, actor_id, action, target_type, target_id, details').order('at', { ascending: false }).order('id').limit(MAX_ROWS)),
    resourcesFrom(db),
  ])

  // Second round, by id: whether each waiting club's advisor is verified, and the names behind the audit's ids.
  const targets = (type: string) => [...new Set(audit.flatMap((a) => (a.target_type === type && a.target_id ? [a.target_id] : [])))]
  const profileIds = [...new Set([...waitingClubs.flatMap((c) => c.club_members.map((m) => m.user_id)), ...audit.flatMap((a) => (a.actor_id ? [a.actor_id] : [])), ...targets('profile')])]
  const named = (what: string, table: string, label: string, ids: string[]) =>
    ids.length ? rows<Record<string, string>>(what, db.from(table).select(`id, ${label}`).in('id', ids).limit(MAX_ROWS)).then((list) => list.map((r) => [r.id, r[label]] as const)) : []
  const [people, clubNames, projectTitles, eventTitles] = await Promise.all([
    profileIds.length
      ? every<{ id: string; display_name: string; is_verified_adult: boolean }>('profiles', 'id', () => db.from('profiles').select('id, display_name, is_verified_adult').in('id', profileIds))
      : [],
    named('audit clubs', 'clubs', 'name', targets('club')),
    named('audit projects', 'projects', 'title', targets('project')),
    named('audit events', 'events', 'title', targets('event')),
  ])
  const person = new Map(people.map((p) => [p.id, p]))
  const title = new Map<string, string>([...clubNames, ...projectTitles, ...eventTitles, ...people.map((p) => [p.id, p.display_name] as const)])

  const s = t('safety')
  const reason: Record<string, string> = { child_safety: s('reasonHurt'), bullying: s('reasonBullying'), personal_info: s('reasonPersonal'), spam: s('reasonSpam'), other: s('reasonOther') }
  return {
    verifications: [
      ...requests.map((v): Verification => ({
        id: v.id, kind: 'advisor', label: `${one(v.profiles)?.display_name ?? FORMER} · ${v.school_name}`,
        step: Math.min(4, Math.max(1, v.step)) as Verification['step'], status: 'waiting',
        note: [v.school_domain, v.second_contact_role].filter(Boolean).join(' · '),
      })),
      // Clubs an admin can verify now: still pending, with an active advisor who is verified (verify_club's own check).
      ...waitingClubs
        .filter((c) => c.club_members.some((m) => person.get(m.user_id)?.is_verified_adult))
        .map((c): Verification => ({ id: c.id, kind: 'club', label: c.name, step: 3, status: 'ready', note: c.school_name })),
    ],
    reports: reports.map((r) => {
      const club = one(r.clubs)?.name ?? null
      return {
        id: r.id, clubId: r.club_id, reason: reason[r.reason] ?? r.reason, details: r.details ?? '', priority: r.priority, status: r.status, aboutAdult: r.about_adult, createdAt: iso(r.created_at),
        targetLabel: r.target_type === 'club' ? club ?? r.target_type : [r.target_type, club].filter(Boolean).join(' · '),
      }
    }),
    audit: audit.map((a) => ({
      id: a.id,
      at: iso(a.at),
      actor: a.actor_id ? person.get(a.actor_id)?.display_name ?? FORMER : '—', // no actor: the server itself
      action: a.action,
      target: (a.target_id ? title.get(a.target_id) ?? `${a.target_type ?? ''} ${a.target_id}`.trim() : null) ?? (typeof a.details?.label === 'string' ? a.details.label : '—'),
    })),
    resources,
  }
}

// ── For src/lib/features.ts (R1b · 6): the same helpers, so its reads follow the same rules ──
export {
  isListed, isPublicProject, summarise, toPublicProject, toPublicEvent, nameOf,
  rows as sbRows, row as sbRow, every as sbEvery, iso as sbIso, isoOrNull as sbIsoOrNull, clubOf as sbClubOf,
  publicEventOf as sbPublicEventOf, publicProjectOf as sbPublicProjectOf, withSeats as sbWithSeats, updateOf as sbUpdateOf,
  CLUB as SB_CLUB, PROJECT as SB_PROJECT, EVENT as SB_EVENT, UPDATE as SB_UPDATE, UUID as SB_UUID, MAX_ROWS as SB_MAX_ROWS,
}
export type { ClubRow as SbClubRow, ProjectRow as SbProjectRow, EventRow as SbEventRow, UpdateRow as SbUpdateRow, WithClub as SbWithClub }
