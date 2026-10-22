// The rows the suite writes against. The seed's Budapest club is the local suite's "club A"; writes never touch it.
// Instead the admin client builds a twin of world.sql's club A (the same people in the same roles: u-adv1 advisor,
// u-lead1 lead, u-mem2 16–17, u-mem1 13–15 by invite, plus a throwaway 16–17 request still waiting) with one row of
// every kind, all tagged "RLS-TEST <run>-<n>". Deleting the twin club removes nearly all of it (consent records too:
// the cascade runs as the table owner, which the append-only guard allows); teardown removes the rest.
// Only the append-only audit log keeps what the functions wrote there, as 07 §6 requires.
import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { THROWAWAY } from './auth'
import { describeError } from './outcome'
import { PERSON, ROW } from './seed'

export const TAG = 'RLS-TEST'
export type Row = Record<string, unknown>

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
/** app.hash_code(): letters and digits only, upper case, sha256 hex. */
export const hashCode = (code: string) => sha256(code.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
/** app.hash_token() */
export const hashToken = (token: string) => sha256(token)

export const isoIn = (days: number, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString()
const dateIn = (days: number) => isoIn(days).slice(0, 10)

// A 1×1 WebP for the photo objects.
export const WEBP = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64')
export const BUCKET = 'club-media'
export const mediaPath = (club: string, media: string, size: 'large' | 'small') => `clubs/${club}/${media}-${size}.webp`

type Q = PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
export async function must<T = unknown>(q: Q, what: string): Promise<T> {
  const r = await q
  if (r.error) throw new Error(`${what}: ${describeError(r.error)}`)
  return r.data as T
}

export interface World {
  run: string; n: number; tag: string
  club: string; slug: string; code: string; inviteToken: string; flaggedWord: string
  m: { adv: string; lead: string; m17: string; m15: string; wait: string } // club_members ids
  K1: string; K2: string; I1: string
  P1: string; P2: string; P3: string; P4: string; PM2: string; PT1: string // PM2: the lead's owner row on P2
  E1: string; E2: string; E3: string; R1: string
  U1: string; U2: string; U3: string; U5: string
  M1: string; M2: string; M3: string
  paths: Record<'M1' | 'M2' | 'M3', { large: string; small: string }>
  TH1: string; TP1: string; TP2: string
  RP1: string; RP2: string; N1: string; CM1: string
  // R1b · 6 (club features): impact numbers on P1 (public) and P2 (club-only), a link on P2, a poll in TH1.
  IM1: string; IM2: string; LK1: string; PL1: string
  FW1: string // keyOf(u-mem3, club): another club's member follows the twin
  PV1: string // keyOf(PL1, u-mem2): u-mem2's vote (choice 1)
  /** Everything teardown removes besides the club's cascade. */
  clubs: string[]; reports: string[]; hubs: string[]; resources: string[]; words: string[]; refs: string[]
  snap: Map<string, Row>
}

// Primary keys other than id. A follow and a vote have two-column keys; their snapshot key is keyOf(both values).
const PK: Record<string, string> = {
  club_codes: 'club_id', event_links: 'event_id', network_admins: 'user_id', flagged_words: 'word',
  club_follows: 'user_id,club_id', poll_votes: 'poll_id,user_id',
}
const pkOf = (table: string) => PK[table] ?? 'id'
const pkCols = (table: string) => pkOf(table).split(',')
/** The snapshot key of a row whose primary key has two columns, in the key's own column order. */
export const keyOf = (...values: string[]) => values.join('|')
// Generated columns are never written back: Postgres refuses any value but DEFAULT (428C9). project_tasks.done follows
// state since migration 6.
const GENERATED: Record<string, string[]> = { project_tasks: ['done'] }

export async function snapshot(admin: SupabaseClient, w: Pick<World, 'snap'>, table: string, keys: string[]): Promise<void> {
  const cols = pkCols(table)
  const rows: Row[] = []
  if (cols.length === 1) rows.push(...await must<Row[]>(admin.from(table).select('*').in(cols[0], keys), `reading ${table} back`))
  else {
    for (const key of keys) {
      const values = key.split('|')
      rows.push(...await must<Row[]>(admin.from(table).select('*').match(Object.fromEntries(cols.map((c, i) => [c, values[i]]))), `reading ${table} back`))
    }
  }
  for (const r of rows) w.snap.set(`${table}:${keyOf(...cols.map((c) => String(r[c])))}`, r)
  if (rows.length !== keys.length) throw new Error(`${table}: expected ${keys.length} fixture row(s), found ${rows.length}`)
}

/** Put a fixture row back exactly as it was built (after an allowed write, or a write a bug let through). */
export async function restore(admin: SupabaseClient, w: Pick<World, 'snap'>, table: string, key: string): Promise<void> {
  const row = w.snap.get(`${table}:${key}`)
  if (!row) throw new Error(`no snapshot of ${table} ${key}`)
  if (table === 'consents') {
    // Append-only: the secret key can't update a consent record, but it may put a missing one back.
    const there = await must<Row[]>(admin.from(table).select('id').eq('id', key), 'consents')
    if (!there.length) await must(admin.from(table).insert(row), `restoring ${table}`)
    return
  }
  const generated = GENERATED[table] ?? []
  const writable = Object.fromEntries(Object.entries(row).filter(([col]) => !generated.includes(col)))
  await must(admin.from(table).upsert(writable, { onConflict: pkOf(table) }), `restoring ${table}`)
}

export async function buildWorld(admin: SupabaseClient, opts: { run: string; n: number; waiting: string }): Promise<World> {
  const id = () => randomUUID()
  const now = new Date().toISOString()
  const tag = `${TAG} ${opts.run}-${opts.n}`
  const club = id()
  const poll = id()
  const media = { M1: id(), M2: id(), M3: id() }
  const paths = Object.fromEntries(Object.entries(media).map(([k, m]) => [k, { large: mediaPath(club, m, 'large'), small: mediaPath(club, m, 'small') }])) as World['paths']
  const w: World = {
    run: opts.run, n: opts.n, tag, club,
    slug: `rls-test-${opts.run}-${opts.n}`,
    code: `RLS-${opts.run}${opts.n}`.toUpperCase(),
    inviteToken: `rls-test-${opts.run}-${opts.n}-invite`,
    flaggedWord: `rlstest${opts.run}${opts.n}`,
    m: { adv: id(), lead: id(), m17: id(), m15: id(), wait: id() },
    K1: id(), K2: id(), I1: id(),
    P1: id(), P2: id(), P3: id(), P4: id(), PM2: '', PT1: id(),
    E1: id(), E2: id(), E3: id(), R1: id(),
    U1: id(), U2: id(), U3: id(), U5: id(),
    ...media, paths,
    TH1: id(), TP1: id(), TP2: id(),
    RP1: id(), RP2: id(), N1: id(), CM1: id(),
    IM1: id(), IM2: id(), LK1: id(), PL1: poll, FW1: keyOf(PERSON.mem3, club), PV1: keyOf(poll, PERSON.mem2),
    clubs: [club], reports: [], hubs: [], resources: [], words: [], refs: [],
    snap: new Map(),
  }
  const P = PERSON
  await must(admin.from('clubs').insert({
    id: club, slug: w.slug, name: `${tag} club`, school_name: 'RLS-TEST School A', city: 'Budapest', country: 'HU', lat: 47.5, lng: 19.04,
    tz: 'Europe/Budapest', strands: ['nature', 'society'], languages: ['English', 'Hungarian'],
    description: `${tag}: a twin of DEMO Club · Budapest for the access-rule suite`,
    status: 'verified', pre_approval: true, verified_by: P.admin, verified_at: now,
  }), 'clubs')
  const member = (mid: string, user: string, role: string, status: string, via: string) =>
    ({ id: mid, club_id: club, user_id: user, role, status, joined_via: via, approved_at: status === 'active' ? now : null })
  await must(admin.from('club_members').insert([
    member(w.m.adv, P.adv1, 'advisor', 'active', 'creator'),
    member(w.m.lead, P.lead1, 'lead', 'active', 'code'),
    member(w.m.m17, P.mem2, 'member', 'active', 'code'),
    member(w.m.m15, P.mem1, 'member', 'active', 'invite'),
    member(w.m.wait, opts.waiting, 'member', 'pending', 'code'),
  ]), 'club_members')
  await must(admin.from('club_codes').insert({ club_id: club, code_hash: hashCode(w.code) }), 'club_codes')
  await must(admin.from('consents').insert([
    { id: w.K1, subject_user_id: P.mem1, club_id: club, scope: 'join', method: 'school_on_file', recorded_by: P.adv1 },
    { id: w.K2, subject_user_id: P.mem1, club_id: club, scope: 'photos', method: 'parent_email', recorded_by: P.adv1 },
  ]), 'consents')
  await must(admin.from('invites').insert({ id: w.I1, club_id: club, created_by: P.adv1, token_hash: hashToken(w.inviteToken), intended_band: '16-17' }), 'invites')
  const project = (pid: string, title: string, strand: string, problem: string, status: string, visibility: string, approved: boolean, by: string) =>
    ({ id: pid, club_id: club, title: `${tag} ${title}`, strand, problem, status, visibility, approved_by: approved ? P.adv1 : null, approved_at: approved ? now : null, created_by: by })
  await must(admin.from('projects').insert([
    project(w.P1, 'public project', 'nature', 'Plastic', 'active', 'public', true, P.mem2),
    project(w.P2, 'club project', 'society', 'Lonely lunches', 'active', 'club', true, P.lead1),
    project(w.P3, 'proposed project', 'nature', 'Paper', 'proposed', 'club', false, P.mem2),
    project(w.P4, 'draft project', 'wellbeing', 'Exams', 'draft', 'club', false, P.mem1),
  ]), 'projects')
  const owner = await must<Row[]>(admin.from('project_members').select('id').eq('project_id', w.P2).eq('user_id', P.lead1), 'project_members')
  if (owner.length !== 1) throw new Error('the owner trigger did not put the lead on the club project')
  w.PM2 = String(owner[0].id)
  await must(admin.from('project_tasks').insert({ id: w.PT1, project_id: w.P2, title: `${tag} ask the canteen` }), 'project_tasks')
  const event = (eid: string, title: string, strand: string, inDays: number, mode: string, capacity: number | null, visibility: string, status: string, by: string, approved: boolean) =>
    ({ id: eid, club_id: club, hub_id: null, title: `${tag} ${title}`, strand, starts_at: isoIn(inDays), ends_at: isoIn(inDays, 2), tz: 'Europe/Budapest', mode, city: 'Budapest',
       capacity, visibility, status, created_by: by, approved_by: approved ? by : null, approved_at: approved ? now : null })
  await must(admin.from('events').insert([
    event(w.E1, 'public event', 'nature', 10, 'in_person', null, 'public', 'published', P.adv1, true),
    event(w.E2, 'club event', 'society', 5, 'in_person', 2, 'club', 'published', P.lead1, false),
    event(w.E3, 'waiting public event', 'society', 20, 'online', null, 'public', 'pending', P.lead1, false),
  ]), 'events')
  await must(admin.from('event_links').insert([
    { event_id: w.E2, online_url: 'https://meet.example.test/rls-test', place_detail: `${tag} room 12` },
    { event_id: w.E3, online_url: 'https://meet.example.test/rls-test-waiting', place_detail: null },
  ]), 'event_links')
  await must(admin.from('rsvps').insert({ id: w.R1, event_id: w.E2, user_id: P.mem2, status: 'going' }), 'rsvps')
  const update = (uid: string, author: string, body: string, visibility: string, status: string, approvedBy: string | null, ago: number) =>
    ({ id: uid, club_id: club, project_id: null, author_id: author, body: `${tag} ${body}`, visibility, status, approved_by: approvedBy, approved_at: approvedBy ? now : null, created_at: isoIn(-ago) })
  await must(admin.from('updates').insert([
    update(w.U1, P.lead1, 'public update', 'public', 'published', P.adv1, 2),
    update(w.U2, P.mem2, 'club update', 'club', 'published', P.lead1, 1),
    update(w.U3, P.mem1, 'waiting update', 'club', 'pending', null, 0),
    update(w.U5, P.adv1, 'advisor update', 'club', 'published', null, 0),
  ]), 'updates')
  const photo = (k: 'M1' | 'M2' | 'M3', alt: string, status: string, isPublic: boolean) =>
    ({ id: w[k], club_id: club, update_id: null, uploader_id: P.mem2, path_large: paths[k].large, path_small: paths[k].small, width: 1600, height: 1200,
       alt, status, approved_by: status === 'approved' ? P.adv1 : null, is_public: isPublic })
  await must(admin.from('media').insert([
    photo('M1', `${tag} the swap table`, 'approved', false),
    photo('M2', `${tag} boxes of bottles`, 'approved', true),
    photo('M3', '', 'pending', false),
  ]), 'media')
  await must(admin.from('threads').insert({ id: w.TH1, club_id: club, title: `${tag} swap table rota`, created_by: P.lead1, created_at: isoIn(-1) }), 'threads')
  await must(admin.from('thread_posts').insert([
    { id: w.TP1, thread_id: w.TH1, author_id: P.lead1, body: `${tag} who can do Monday?`, status: 'published', created_at: isoIn(-1) },
    { id: w.TP2, thread_id: w.TH1, author_id: P.mem1, body: `${tag} I can`, status: 'pending', created_at: now },
  ]), 'thread_posts')
  await must(admin.from('reports').insert([
    { id: w.RP1, reporter_id: P.mem2, target_type: 'update', target_id: w.U3, about_user_id: P.mem1, club_id: club, reason: 'bullying', details: tag, priority: 'normal', about_adult: false },
    { id: w.RP2, reporter_id: P.mem1, target_type: 'update', target_id: w.U5, about_user_id: P.adv1, club_id: club, reason: 'child_safety', details: tag, priority: 'child_safety', about_adult: true },
  ]), 'reports')
  await must(admin.from('notifications').insert({ id: w.N1, user_id: P.mem2, kind: 'rls-test.approved', payload: { rls: tag } }), 'notifications')
  await must(admin.from('contact_messages').insert({ id: w.CM1, club_id: club, sender_name: 'RLS-TEST parent', sender_email: 'rls-parent@example.test', body: `${tag} hello` }), 'contact_messages')
  await must(admin.from('flagged_words').insert({ word: w.flaggedWord }), 'flagged_words')
  w.words.push(w.flaggedWord)
  // R1b · 6 (club features, 12 Oct), as world.sql's last rows. The secret key has no auth.uid(), so the impacts guard
  // leaves P1 approved, and the poll has no starter (only the club's staff may remove it).
  await must(admin.from('project_impacts').insert([
    { id: w.IM1, project_id: w.P1, label: `${tag} plastic bottles not thrown away`, value: 412, unit: '', how: 'counted at the swap table' },
    { id: w.IM2, project_id: w.P2, label: `${tag} students at lunch`, value: 30, unit: 'people', how: 'a sign-in sheet' },
  ]), 'project_impacts')
  await must(admin.from('project_links').insert({ id: w.LK1, project_id: w.P2, label: `${tag} our plan`, url: 'https://docs.example.test/rls-test-plan' }), 'project_links')
  await must(admin.from('club_follows').insert({ user_id: P.mem3, club_id: club }), 'club_follows') // u-mem3 is a Kaunas member
  await must(admin.from('polls').insert({ id: w.PL1, thread_id: w.TH1, question: `${tag} which day works?`, options: ['Monday', 'Wednesday'] }), 'polls')
  await must(admin.from('poll_votes').insert({ poll_id: w.PL1, user_id: P.mem2, choice: 1 }), 'poll_votes')

  await snapshot(admin, w, 'clubs', [club])
  await snapshot(admin, w, 'club_members', Object.values(w.m))
  await snapshot(admin, w, 'club_codes', [club])
  await snapshot(admin, w, 'consents', [w.K1, w.K2])
  await snapshot(admin, w, 'invites', [w.I1])
  await snapshot(admin, w, 'projects', [w.P1, w.P2, w.P3, w.P4])
  await snapshot(admin, w, 'project_members', [w.PM2])
  await snapshot(admin, w, 'project_tasks', [w.PT1])
  await snapshot(admin, w, 'events', [w.E1, w.E2, w.E3])
  await snapshot(admin, w, 'event_links', [w.E2, w.E3])
  await snapshot(admin, w, 'rsvps', [w.R1])
  await snapshot(admin, w, 'updates', [w.U1, w.U2, w.U3, w.U5])
  await snapshot(admin, w, 'media', [w.M1, w.M2, w.M3])
  await snapshot(admin, w, 'threads', [w.TH1])
  await snapshot(admin, w, 'thread_posts', [w.TP1, w.TP2])
  await snapshot(admin, w, 'reports', [w.RP1, w.RP2])
  await snapshot(admin, w, 'notifications', [w.N1])
  await snapshot(admin, w, 'contact_messages', [w.CM1])
  await snapshot(admin, w, 'flagged_words', [w.flaggedWord])
  await snapshot(admin, w, 'project_impacts', [w.IM1, w.IM2])
  await snapshot(admin, w, 'project_links', [w.LK1])
  await snapshot(admin, w, 'club_follows', [w.FW1])
  await snapshot(admin, w, 'polls', [w.PL1])
  await snapshot(admin, w, 'poll_votes', [w.PV1])
  return w
}

// ── The matrix's extra rows ───────────────────────────────────────────────────────────────────────────────────
export const HUB_YEARS = { live: 2095, hidden: 2096, inserted: 2097 } as const

export interface MatrixExtras {
  H1: string; H2: string; E5: string
  Z: string; zMember: string                 // a pending twin of the Kraków club, u-adv7 its advisor
  D: string; dMembers: string[]              // a club for the "nobody hard-deletes a club" check (advisor + lead)
  B: string; bMembers: string[]; BP: string  // a listed twin of world.sql's club B (u-adv2 advisor, u-mem3 member, an approved project): the club the follow checks follow
  target: { id: string; email: string }      // a throwaway 13–15 profile for the "nobody deletes a profile" check
  RS2: string                                // a draft resource
}

export async function buildMatrixExtras(admin: SupabaseClient, w: World, target: { id: string; email: string }): Promise<MatrixExtras> {
  const id = () => randomUUID()
  const now = new Date().toISOString()
  const x: MatrixExtras = { H1: id(), H2: id(), E5: id(), Z: id(), zMember: id(), D: id(), dMembers: [id(), id()], B: id(), bMembers: [id(), id()], BP: id(), target, RS2: id() }
  const hub = (hid: string, year: number, title: string, inDays: number, status: string) =>
    ({ id: hid, year, host_club_id: w.club, title: `${w.tag} ${title}`, city: 'Budapest', starts_on: dateIn(inDays), ends_on: dateIn(inDays + 2), status })
  await must(admin.from('conference_hubs').insert([
    hub(x.H1, HUB_YEARS.live, 'hub (live)', 60, 'live'),
    hub(x.H2, HUB_YEARS.hidden, 'hub (hidden)', 400, 'hidden'),
  ]), 'conference_hubs')
  w.hubs.push(x.H1, x.H2)
  await must(admin.from('events').insert({
    id: x.E5, club_id: null, hub_id: x.H1, title: `${w.tag} hub opening`, strand: null, starts_at: isoIn(60), ends_at: isoIn(60, 3), tz: 'Europe/Budapest',
    mode: 'in_person', city: 'Budapest', capacity: null, visibility: 'public', status: 'published', created_by: PERSON.admin, approved_by: PERSON.admin, approved_at: now,
  }), 'events (hub)')
  const club = (cid: string, slugPart: string, name: string, status: string) => ({
    id: cid, slug: `${w.slug}-${slugPart}`, name: `${w.tag} ${name}`, school_name: 'RLS-TEST School', city: 'Kraków', country: 'PL', lat: 50.06, lng: 19.94,
    tz: 'Europe/Warsaw', status, pre_approval: true, verified_by: status === 'verified' ? PERSON.admin : null, verified_at: status === 'verified' ? now : null,
  })
  await must(admin.from('clubs').insert([
    club(x.Z, 'pending', 'pending club', 'pending'), club(x.D, 'delete-check', 'delete-check club', 'verified'), club(x.B, 'club-b', 'club B', 'verified'),
  ]), 'clubs (extra)')
  w.clubs.push(x.Z, x.D, x.B)
  await must(admin.from('club_members').insert([
    { id: x.zMember, club_id: x.Z, user_id: PERSON.adv7, role: 'advisor', status: 'active', joined_via: 'creator', approved_at: now },
    { id: x.dMembers[0], club_id: x.D, user_id: PERSON.adv1, role: 'advisor', status: 'active', joined_via: 'creator', approved_at: now },
    { id: x.dMembers[1], club_id: x.D, user_id: PERSON.lead1, role: 'lead', status: 'active', joined_via: 'code', approved_at: now },
    { id: x.bMembers[0], club_id: x.B, user_id: PERSON.adv2, role: 'advisor', status: 'active', joined_via: 'creator', approved_at: now },
    { id: x.bMembers[1], club_id: x.B, user_id: PERSON.mem3, role: 'member', status: 'active', joined_via: 'invite', approved_at: now },
  ]), 'club_members (extra)')
  // Listed (app.club_listed): verified, a student member, a verified advisor, and an approved project.
  await must(admin.from('projects').insert({
    id: x.BP, club_id: x.B, title: `${w.tag} club B project`, strand: 'economy', problem: 'Repair', status: 'active', visibility: 'club',
    approved_by: PERSON.adv2, approved_at: now, created_by: PERSON.mem3,
  }), 'projects (club B)')
  await must(admin.from('profiles').insert({ id: target.id, display_name: 'Tia T.', age_band: '13-15', country: 'HU', conduct_accepted_at: now }), 'profiles (target)')
  await must(admin.from('resources').insert({ id: x.RS2, strand: 'nature', title: `${w.tag} draft guide`, url: 'https://example.test/rls-test-draft', source_name: 'RLS-TEST', status: 'draft' }), 'resources')
  w.resources.push(x.RS2)
  for (const k of ['M1', 'M3'] as const) {
    const up = await admin.storage.from(BUCKET).upload(w.paths[k].large, WEBP, { contentType: 'image/webp', upsert: true })
    if (up.error) throw new Error(`uploading the ${k} photo: ${up.error.message}`)
  }
  await snapshot(admin, w, 'conference_hubs', [x.H1, x.H2])
  await snapshot(admin, w, 'events', [x.E5])
  await snapshot(admin, w, 'clubs', [x.Z, x.D])
  await snapshot(admin, w, 'club_members', [x.zMember, ...x.dMembers])
  await snapshot(admin, w, 'profiles', [target.id, PERSON.mem1])
  await snapshot(admin, w, 'resources', [x.RS2])
  // Seed rows a refused write would touch if a rule were broken (restored at once if that ever happens).
  await snapshot(admin, w, 'network_admins', [PERSON.admin])
  await snapshot(admin, w, 'advisor_verifications', [ROW.verification])
  return x
}

// ── Removing it all ───────────────────────────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function refsOf(w: World): string[] {
  const out = new Set<string>([w.slug, ...w.clubs, ...w.reports, ...w.refs])
  for (const v of Object.values(w)) if (typeof v === 'string' && UUID.test(v)) out.add(v)
  for (const v of Object.values(w.m)) out.add(v)
  return [...out]
}

/** Notifications the suite's actions sent to the seed's people: they point at the suite's own rows. */
export async function removeNotifications(admin: SupabaseClient, refs: string[]): Promise<number> {
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString()
  const rows = await must<Row[]>(admin.from('notifications').select('id, kind, payload').in('user_id', Object.values(PERSON)).gte('created_at', since), 'notifications')
  const ids = rows.filter((n) => String(n.kind).startsWith('rls-test') || refs.some((r) => JSON.stringify(n.payload ?? {}).includes(r))).map((n) => String(n.id))
  if (ids.length) await must(admin.from('notifications').delete().in('id', ids), 'removing notifications')
  return ids.length
}

async function removeObjects(admin: SupabaseClient, clubs: string[]): Promise<void> {
  for (const club of clubs) {
    const { data, error } = await admin.storage.from(BUCKET).list(`clubs/${club}`, { limit: 1000 })
    if (error) throw new Error(`listing photos: ${error.message}`)
    const names = (data ?? []).map((o) => `clubs/${club}/${o.name}`)
    if (names.length) {
      const del = await admin.storage.from(BUCKET).remove(names)
      if (del.error) throw new Error(`removing photos: ${del.error.message}`)
    }
  }
}

/** Every row still in the clubs, including what a flow made along the way: notifications point at these. */
async function rowsInClubs(admin: SupabaseClient, clubs: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const table of ['club_members', 'invites', 'consents', 'projects', 'events', 'updates', 'media', 'threads', 'reports', 'contact_messages']) {
    ids.push(...(await must<Row[]>(admin.from(table).select('id').in('club_id', clubs), table)).map((r) => String(r.id)))
  }
  const threads = (await must<Row[]>(admin.from('threads').select('id').in('club_id', clubs), 'threads')).map((r) => String(r.id))
  if (threads.length) ids.push(...(await must<Row[]>(admin.from('thread_posts').select('id').in('thread_id', threads), 'thread_posts')).map((r) => String(r.id)))
  return ids
}

export async function teardownWorld(admin: SupabaseClient, w: World | undefined): Promise<void> {
  if (!w) return
  const clubs = w.clubs
  await removeNotifications(admin, [...refsOf(w), ...(await rowsInClubs(admin, clubs))])
  await must(admin.from('reports').delete().in('club_id', clubs), 'reports')
  await must(admin.from('reports').delete().in('target_id', clubs), 'reports about the clubs')
  if (w.reports.length) await must(admin.from('reports').delete().in('id', w.reports), 'reports filed by the flows')
  await removeObjects(admin, clubs)
  if (w.hubs.length) await must(admin.from('conference_hubs').delete().in('id', w.hubs), 'conference_hubs')
  await must(admin.from('conference_hubs').delete().in('year', [HUB_YEARS.inserted]).like('title', `${TAG}%`), 'conference_hubs')
  if (w.resources.length) await must(admin.from('resources').delete().in('id', w.resources), 'resources')
  await must(admin.from('resources').delete().like('title', `${w.tag}%`), 'resources')
  if (w.words.length) await must(admin.from('flagged_words').delete().in('word', w.words), 'flagged_words')
  await must(admin.from('advisor_verifications').delete().like('school_name', `${w.tag}%`), 'advisor_verifications')
  await must(admin.from('clubs').delete().in('id', clubs), 'clubs')
  const left = await must<Row[]>(admin.from('clubs').select('id').in('id', clubs), 'clubs')
  if (left.length) throw new Error(`clean-up left ${left.length} RLS-TEST club(s) behind`)
}

/**
 * Removes every RLS-TEST row and throwaway account, from this run or an earlier one that stopped half-way.
 * Seed rows are never touched: everything here is matched by the tag, the rls-test- slug or a throwaway address.
 */
export async function sweep(admin: SupabaseClient): Promise<{ clubs: number; users: number }> {
  const clubs = (await must<Row[]>(admin.from('clubs').select('id, slug').like('slug', 'rls-test-%'), 'clubs')).map((c) => ({ id: String(c.id), slug: String(c.slug) }))
  const ids = clubs.map((c) => c.id)
  if (ids.length) {
    await must(admin.from('reports').delete().in('club_id', ids), 'reports')
    await must(admin.from('reports').delete().in('target_id', ids), 'reports')
    await removeObjects(admin, ids)
  }
  await removeNotifications(admin, [...ids, ...clubs.map((c) => c.slug), TAG])
  await must(admin.from('reports').delete().like('details', `${TAG}%`), 'reports')
  await must(admin.from('notifications').delete().like('kind', 'rls-test%'), 'notifications')
  await must(admin.from('conference_hubs').delete().like('title', `${TAG}%`), 'conference_hubs')
  await must(admin.from('resources').delete().like('title', `${TAG}%`), 'resources')
  await must(admin.from('flagged_words').delete().like('word', 'rlstest%'), 'flagged_words')
  await must(admin.from('advisor_verifications').delete().like('school_name', `${TAG}%`), 'advisor_verifications')
  if (ids.length) await must(admin.from('clubs').delete().in('id', ids), 'clubs')
  let users = 0
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listing accounts: ${error.message}`)
    for (const u of data.users) {
      if (u.email && THROWAWAY.test(u.email)) {
        const del = await admin.auth.admin.deleteUser(u.id)
        if (del.error && !/not.?found/i.test(del.error.message)) throw new Error(`deleting ${u.email}: ${del.error.message}`)
        users++
      }
    }
    if (data.users.length < 1000) break
  }
  return { clubs: ids.length, users }
}
