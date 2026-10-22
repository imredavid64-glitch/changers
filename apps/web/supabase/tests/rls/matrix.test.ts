// The matrix (07 §6 Tests): every table, the member-names view and the photo bucket × the ten actors × select,
// insert, update and delete, each expected to be allowed or denied as 07 §3 and §6 say. A port of the local suite's
// matrix (supabase/tests/local/rls.mjs: the same 50 targets and the same expectations, plus an update try on follows and
// polls, which have no update grant), adapted to the dev seed:
//   • reads use the seed's own rows wherever the seed has one (the Budapest club is the local suite's club A, Kaunas
//     is club B, the pending Kraków club is club C);
//   • writes use rows the suite builds with the admin client (lib/world.ts: a twin of club A, tagged RLS-TEST) and
//     puts back after every allowed write, so no write leaks into the next check. Everything is removed afterwards.
// Expectations come from the spec, not from the SQL.
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, inject, test } from 'vitest'
import { createThrowaway, deleteThrowaway } from './lib/auth'
import { actorClient, adminClient } from './lib/clients'
import { changed, inserted, seen, storage, verdict, type Outcome } from './lib/outcome'
import { ACTORS, CLUB, PERSON, ROW, type ActorName } from './lib/seed'
import {
  BUCKET, HUB_YEARS, WEBP, buildMatrixExtras, buildWorld, isoIn, mediaPath, must, restore, snapshot, teardownWorld,
  type MatrixExtras, type Row, type World,
} from './lib/world'

const ctx = inject('rls')
const admin = adminClient()
const as = Object.fromEntries(ACTORS.map((a) => [a, actorClient(ctx.actors[a].token)])) as Record<ActorName, SupabaseClient>
const selfOf = (a: ActorName) => ctx.actors[a].id ?? randomUUID() // "self" in a row: the actor's own id (a visitor has none)

let w: World
let x: MatrixExtras
let waiting: { id: string; email: string } | undefined
let target: { id: string; email: string } | undefined
let auditRow = '' // a row the suite's own call wrote, for the "nobody edits the log" checks
let lastPath = '' // the photo path the last storage write used

beforeAll(async () => {
  waiting = await createThrowaway(admin, ctx.runId, 'mwait')
  await must(admin.from('profiles').insert({ id: waiting.id, display_name: 'Wil W.', age_band: '16-17', country: 'HU', conduct_accepted_at: new Date().toISOString() }), 'the waiting student')
  target = await createThrowaway(admin, ctx.runId, 'mtarget')
  w = await buildWorld(admin, { run: ctx.runId, n: 0, waiting: waiting.id })
  x = await buildMatrixExtras(admin, w, target)
  // A logged read by the admin gives the matrix an audit row of its own to try to change.
  await must(as.admin.rpc('admin_read_threads', { p_club: w.club }), 'a logged read')
  const log = await must<Row[]>(admin.from('audit_log').select('id').eq('action', 'admin.read_threads').eq('target_id', w.club), 'the audit row')
  auditRow = String(log[0]?.id ?? '')
  if (!auditRow) throw new Error('the logged read wrote no audit row')
}, 300_000)

afterAll(async () => {
  await teardownWorld(admin, w)
  for (const u of [waiting, target]) if (u) await deleteThrowaway(admin, u)
}, 300_000)

// ── The targets ───────────────────────────────────────────────────────────────────────────────────────────────
type Probe = (c: SupabaseClient, self: string) => Promise<Outcome>
interface Op { run: Probe; allow: readonly ActorName[]; undo?: () => Promise<unknown> }
interface Target { t: string; prepare?: () => Promise<void>; select: Op; insert?: Op; update?: Op; delete?: Op }

const MEMBERS_A = ['member_1415', 'member_1617', 'lead', 'advisor'] as const
const STAFF_A = ['lead', 'advisor'] as const
const ALL = ACTORS
const now = () => new Date().toISOString()
const put = async (table: string, ...keys: string[]) => { for (const k of keys) await restore(admin, w, table, k) }
const snap = (table: string, key: string) => {
  const r = w.snap.get(`${table}:${key}`)
  if (!r) throw new Error(`no snapshot of ${table} ${key}`)
  return r
}
const drop = (table: string, q: (t: ReturnType<SupabaseClient['from']>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>) =>
  () => must(q(admin.from(table)), `undoing a ${table} write`)
const stored = async (p: PromiseLike<{ error: { message: string } | null }>, what: string) => {
  const r = await p
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
}
// A vote can be refused before the insert policy (42501) is reached, in two ways (the local suite counts any error as
// a refusal; build log R1b-6: "members vote once"):
//   • 23505: one vote each is the key (poll, person), so a second vote breaks it;
//   • 22023 "no such choice": the vote guard reads the poll with the voter's own rights, so someone the poll is hidden
//     from is stopped there.
// Anything else stays an error, and an actor who may vote still fails the check if either comes back.
const voteRefused = async (p: Promise<Outcome>): Promise<Outcome> => {
  const o = await p
  return o.kind === 'error' && /^(23505 |22023 no such choice)/.test(o.detail) ? { kind: 'refuse', detail: o.detail } : o
}
// A new or changed number on an approved public project takes it off the public site until an advisor approves it
// again (build log R1b-6, impacts_guard): every undo of an impact write puts P1 back too.
const putBackP1 = () => put('projects', w.P1)

const T: Target[] = [
  { t: 'profiles (a 13–15 member)',
    select: { run: (c) => seen(c.from('profiles').select('id').eq('id', PERSON.mem1)), allow: ['member_1415', 'admin'] },
    insert: { run: (c, self) => inserted(c.from('profiles').insert({ id: self, display_name: 'Zed Z.', age_band: '16-17', country: 'HU', conduct_accepted_at: now() })), allow: [] },
    // The member's own profile, set to the name it already has: the rule is exercised, the seed doesn't change.
    update: { run: (c) => changed(c.from('profiles').update({ display_name: snap('profiles', PERSON.mem1).display_name }, { count: 'exact' }).eq('id', PERSON.mem1)), allow: ['member_1415'], undo: () => put('profiles', PERSON.mem1) },
    // No delete grant at all; tried on a throwaway 13–15 profile so a broken rule could never remove a seed person.
    delete: { run: (c) => changed(c.from('profiles').delete({ count: 'exact' }).eq('id', x.target.id)), allow: [], undo: () => put('profiles', x.target.id) } },
  { t: 'network_admins',
    select: { run: (c) => seen(c.from('network_admins').select('user_id').eq('user_id', PERSON.admin)), allow: ['admin', 'admin_aal1'] },
    insert: { run: (c) => inserted(c.from('network_admins').insert({ user_id: PERSON.lead1 })), allow: [], undo: drop('network_admins', (t) => t.delete().eq('user_id', PERSON.lead1)) },
    update: { run: (c) => changed(c.from('network_admins').update({ created_at: snap('network_admins', PERSON.admin).created_at }, { count: 'exact' }).eq('user_id', PERSON.admin)), allow: [], undo: () => put('network_admins', PERSON.admin) },
    delete: { run: (c) => changed(c.from('network_admins').delete({ count: 'exact' }).eq('user_id', PERSON.admin)), allow: [], undo: () => put('network_admins', PERSON.admin) } },
  { t: 'advisor_verifications',
    select: { run: (c) => seen(c.from('advisor_verifications').select('id').eq('id', ROW.verification)), allow: ['unverified_adult', 'admin'] },
    insert: { run: (c, self) => inserted(c.from('advisor_verifications').insert({ user_id: self, school_name: `${w.tag} School X`, school_domain: 'rls-test.example.test' })), allow: [], undo: drop('advisor_verifications', (t) => t.delete().like('school_name', `${w.tag}%`)) },
    update: { run: (c) => changed(c.from('advisor_verifications').update({ status: 'approved' }, { count: 'exact' }).eq('id', ROW.verification)), allow: [], undo: () => put('advisor_verifications', ROW.verification) },
    delete: { run: (c) => changed(c.from('advisor_verifications').delete({ count: 'exact' }).eq('id', ROW.verification)), allow: [], undo: () => put('advisor_verifications', ROW.verification) } },
  { t: 'clubs (listed)',
    select: { run: (c) => seen(c.from('clubs').select('id').eq('id', CLUB.budapest)), allow: ALL },
    insert: { run: (c) => inserted(c.from('clubs').insert({ slug: `${w.slug}-new`, name: `${w.tag} new club`, school_name: 'RLS-TEST School', city: 'Vienna', country: 'AT', lat: 48.21, lng: 16.37 })), allow: [], undo: drop('clubs', (t) => t.delete().eq('slug', `${w.slug}-new`)) },
    update: { run: (c) => changed(c.from('clubs').update({ description: `${w.tag} edited` }, { count: 'exact' }).eq('id', w.club)), allow: ['lead', 'advisor', 'admin'], undo: () => put('clubs', w.club) },
    delete: { run: (c) => changed(c.from('clubs').delete({ count: 'exact' }).eq('id', x.D)), allow: [], undo: async () => { await put('clubs', x.D); await put('club_members', ...x.dMembers) } } },
  { t: 'clubs (pending, unlisted)',
    select: { run: (c) => seen(c.from('clubs').select('id').eq('id', CLUB.krakow)), allow: ['unverified_adult', 'admin'] },
    update: { run: (c) => changed(c.from('clubs').update({ description: `${w.tag} edited` }, { count: 'exact' }).eq('id', x.Z)), allow: ['admin'], undo: () => put('clubs', x.Z) } },
  { t: 'club_codes',
    select: { run: (c) => seen(c.from('club_codes').select('club_id').eq('club_id', w.club)), allow: [...STAFF_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('club_codes').insert({ club_id: x.D, code_hash: `rls-test-${w.run}` })), allow: [], undo: drop('club_codes', (t) => t.delete().eq('club_id', x.D)) },
    update: { run: (c) => changed(c.from('club_codes').update({ code_hash: `rls-test-${w.run}-x` }, { count: 'exact' }).eq('club_id', w.club)), allow: [], undo: () => put('club_codes', w.club) },
    delete: { run: (c) => changed(c.from('club_codes').delete({ count: 'exact' }).eq('club_id', w.club)), allow: [], undo: () => put('club_codes', w.club) } },
  { t: 'club_members (an active member)',
    select: { run: (c) => seen(c.from('club_members').select('id').eq('club_id', CLUB.budapest).eq('user_id', PERSON.mem2)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c, self) => inserted(c.from('club_members').insert({ club_id: w.club, user_id: self, role: 'member', status: 'active', joined_via: 'code' })), allow: [], undo: drop('club_members', (t) => t.delete().eq('club_id', w.club).not('id', 'in', `(${Object.values(w.m).join(',')})`)) },
    update: { run: (c) => changed(c.from('club_members').update({ role: 'lead' }, { count: 'exact' }).eq('club_id', w.club).eq('user_id', PERSON.mem2)), allow: [], undo: () => put('club_members', w.m.m17) },
    delete: { run: (c) => changed(c.from('club_members').delete({ count: 'exact' }).eq('club_id', w.club).eq('user_id', PERSON.mem2)), allow: [], undo: () => put('club_members', w.m.m17) } },
  { t: 'club_members (a waiting request)',
    select: { run: (c) => seen(c.from('club_members').select('id').eq('club_id', w.club).eq('user_id', waiting?.id ?? '')), allow: [...STAFF_A, 'admin'] } },
  { t: 'consents',
    select: { run: (c) => seen(c.from('consents').select('id').eq('id', w.K1)), allow: ['member_1415', 'advisor', 'admin'] },
    // Append-only: a row a broken rule let in can't be removed by the secret key; it goes with the twin club.
    insert: { run: (c) => inserted(c.from('consents').insert({ club_id: w.club, scope: 'photos', method: 'self' })), allow: [] },
    update: { run: (c) => changed(c.from('consents').update({ method: 'self' }, { count: 'exact' }).eq('id', w.K1)), allow: [] },
    delete: { run: (c) => changed(c.from('consents').delete({ count: 'exact' }).eq('id', w.K1)), allow: [], undo: () => put('consents', w.K1) } },
  { t: 'invites',
    select: { run: (c) => seen(c.from('invites').select('id').eq('id', w.I1)), allow: ['advisor', 'admin'] },
    insert: { run: (c) => inserted(c.from('invites').insert({ club_id: w.club, token_hash: `rls-test-${w.run}-x`, intended_band: '16-17' })), allow: [], undo: drop('invites', (t) => t.delete().eq('token_hash', `rls-test-${w.run}-x`)) },
    update: { run: (c) => changed(c.from('invites').update({ expires_at: isoIn(90) }, { count: 'exact' }).eq('id', w.I1)), allow: [], undo: () => put('invites', w.I1) },
    delete: { run: (c) => changed(c.from('invites').delete({ count: 'exact' }).eq('id', w.I1)), allow: [], undo: () => put('invites', w.I1) } },
  { t: 'conference_hubs (live)',
    select: { run: (c) => seen(c.from('conference_hubs').select('id').eq('id', x.H1)), allow: ALL } },
  { t: 'conference_hubs (hidden)',
    select: { run: (c) => seen(c.from('conference_hubs').select('id').eq('id', x.H2)), allow: ['advisor', 'admin'] },
    insert: { run: (c) => inserted(c.from('conference_hubs').insert({ year: HUB_YEARS.inserted, title: `${w.tag} hub ${HUB_YEARS.inserted}`, city: 'Kaunas', starts_on: `${HUB_YEARS.inserted}-03-01`, ends_on: `${HUB_YEARS.inserted}-03-03` })), allow: ['admin'], undo: drop('conference_hubs', (t) => t.delete().eq('year', HUB_YEARS.inserted).like('title', `${w.tag}%`)) },
    update: { run: (c) => changed(c.from('conference_hubs').update({ title: `${w.tag} hub edited` }, { count: 'exact' }).eq('id', x.H2)), allow: ['advisor', 'admin'], undo: () => put('conference_hubs', x.H2) },
    delete: { run: (c) => changed(c.from('conference_hubs').delete({ count: 'exact' }).eq('id', x.H2)), allow: ['admin'], undo: () => put('conference_hubs', x.H2) } },
  { t: 'projects (public, approved)',
    select: { run: (c) => seen(c.from('projects').select('id').eq('id', ROW.projectPublic)), allow: ALL } },
  { t: 'projects (club-only)',
    select: { run: (c) => seen(c.from('projects').select('id').eq('id', w.P2)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('projects').insert({ club_id: w.club, title: `${w.tag} new project`, strand: 'nature', status: 'proposed' })), allow: [...MEMBERS_A, 'admin'], undo: drop('projects', (t) => t.delete().eq('title', `${w.tag} new project`)) },
    update: { run: (c) => changed(c.from('projects').update({ title: `${w.tag} edited project` }, { count: 'exact' }).eq('id', w.P2)), allow: ['lead', 'advisor', 'admin'], undo: () => put('projects', w.P2) },
    delete: { run: (c) => changed(c.from('projects').delete({ count: 'exact' }).eq('id', w.P2)), allow: [],
      undo: async () => {
        await put('projects', w.P2) // the owner trigger puts the lead back with a new row id; swap it for the original
        await must(admin.from('project_members').delete().eq('project_id', w.P2), 'undoing a projects write')
        await put('project_members', w.PM2)
        await put('project_tasks', w.PT1)
      } } },
  { t: "projects (a member's draft)",
    select: { run: (c) => seen(c.from('projects').select('id').eq('id', w.P4)), allow: ['member_1415', ...STAFF_A, 'admin'] },
    update: { run: (c) => changed(c.from('projects').update({ title: `${w.tag} edited draft` }, { count: 'exact' }).eq('id', w.P4)), allow: ['member_1415', ...STAFF_A, 'admin'], undo: () => put('projects', w.P4) } },
  { t: 'project_members',
    select: { run: (c) => seen(c.from('project_members').select('id').eq('project_id', w.P2).eq('user_id', PERSON.lead1)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('project_members').insert({ project_id: w.P2, user_id: PERSON.mem2 })), allow: ['lead', 'advisor', 'admin'], undo: drop('project_members', (t) => t.delete().eq('project_id', w.P2).eq('user_id', PERSON.mem2)) },
    update: { run: (c) => changed(c.from('project_members').update({ role: 'member' }, { count: 'exact' }).eq('project_id', w.P2).eq('user_id', PERSON.lead1)), allow: ['lead', 'advisor', 'admin'], undo: () => put('project_members', w.PM2) },
    delete: { run: (c) => changed(c.from('project_members').delete({ count: 'exact' }).eq('project_id', w.P2).eq('user_id', PERSON.lead1)), allow: ['lead', 'advisor', 'admin'], undo: () => put('project_members', w.PM2) } },
  { t: 'project_tasks',
    select: { run: (c) => seen(c.from('project_tasks').select('id').eq('id', w.PT1)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('project_tasks').insert({ project_id: w.P2, title: `${w.tag} new task` })), allow: ['lead', 'advisor', 'admin'], undo: drop('project_tasks', (t) => t.delete().eq('title', `${w.tag} new task`)) },
    update: { run: (c) => changed(c.from('project_tasks').update({ state: 'doing' }, { count: 'exact' }).eq('id', w.PT1)), allow: ['lead', 'advisor', 'admin'], undo: () => put('project_tasks', w.PT1) },
    delete: { run: (c) => changed(c.from('project_tasks').delete({ count: 'exact' }).eq('id', w.PT1)), allow: ['lead', 'advisor', 'admin'], undo: () => put('project_tasks', w.PT1) } },
  { t: 'events (public)',
    select: { run: (c) => seen(c.from('events').select('id').eq('id', ROW.eventPublic)), allow: ALL } },
  { t: 'events (hub, live)',
    select: { run: (c) => seen(c.from('events').select('id').eq('id', x.E5)), allow: ALL } },
  { t: 'events (club-only)',
    select: { run: (c) => seen(c.from('events').select('id').eq('id', ROW.eventClubOnly)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('events').insert({ club_id: w.club, title: `${w.tag} new event`, starts_at: isoIn(7), ends_at: isoIn(7, 2), tz: 'Europe/Budapest', mode: 'in_person', city: 'Budapest', visibility: 'club' })), allow: [...STAFF_A, 'admin'], undo: drop('events', (t) => t.delete().eq('title', `${w.tag} new event`)) },
    update: { run: (c) => changed(c.from('events').update({ title: `${w.tag} edited event` }, { count: 'exact' }).eq('id', w.E2)), allow: [...STAFF_A, 'admin'], undo: () => put('events', w.E2) },
    delete: { run: (c) => changed(c.from('events').delete({ count: 'exact' }).eq('id', w.E2)), allow: [], undo: async () => { await put('events', w.E2); await put('event_links', w.E2); await put('rsvps', w.R1) } } },
  { t: 'events (public, waiting for an advisor)',
    select: { run: (c) => seen(c.from('events').select('id').eq('id', w.E3)), allow: [...STAFF_A, 'admin'] } },
  { t: 'event_links (exact place, online link)',
    select: { run: (c) => seen(c.from('event_links').select('event_id').eq('event_id', ROW.eventClubOnly)), allow: ['member_1617', ...STAFF_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('event_links').insert({ event_id: w.E1, place_detail: `${w.tag} room 4` })), allow: [...STAFF_A, 'admin'], undo: drop('event_links', (t) => t.delete().eq('event_id', w.E1)) },
    update: { run: (c) => changed(c.from('event_links').update({ place_detail: `${w.tag} room 9` }, { count: 'exact' }).eq('event_id', w.E2)), allow: [...STAFF_A, 'admin'], undo: () => put('event_links', w.E2) },
    delete: { run: (c) => changed(c.from('event_links').delete({ count: 'exact' }).eq('event_id', w.E2)), allow: [...STAFF_A, 'admin'], undo: () => put('event_links', w.E2) } },
  { t: 'rsvps',
    select: { run: (c) => seen(c.from('rsvps').select('id').eq('event_id', ROW.eventClubOnly).eq('user_id', PERSON.mem2)), allow: ['member_1617', ...STAFF_A, 'admin'] },
    insert: { run: (c, self) => inserted(c.from('rsvps').insert({ event_id: w.E2, user_id: self })), allow: [], undo: drop('rsvps', (t) => t.delete().eq('event_id', w.E2).neq('id', w.R1)) },
    update: { run: (c) => changed(c.from('rsvps').update({ status: 'cancelled' }, { count: 'exact' }).eq('id', w.R1)), allow: ['member_1617'], undo: () => put('rsvps', w.R1) },
    delete: { run: (c) => changed(c.from('rsvps').delete({ count: 'exact' }).eq('id', w.R1)), allow: [], undo: () => put('rsvps', w.R1) } },
  { t: 'updates (public, approved)',
    select: { run: (c) => seen(c.from('updates').select('id').eq('id', ROW.updatePublic)), allow: ALL } },
  { t: 'updates (club-only)',
    select: { run: (c) => seen(c.from('updates').select('id').eq('id', ROW.updateClub)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('updates').insert({ club_id: w.club, body: `${w.tag} hello club` })), allow: MEMBERS_A, undo: drop('updates', (t) => t.delete().eq('body', `${w.tag} hello club`)) } },
  { t: 'updates (waiting for approval)',
    select: { run: (c) => seen(c.from('updates').select('id').eq('id', ROW.updateWaiting)), allow: ['member_1415', ...STAFF_A, 'admin'] },
    update: { run: (c) => changed(c.from('updates').update({ body: `${w.tag} edited` }, { count: 'exact' }).eq('id', w.U3)), allow: ['member_1415'], undo: () => put('updates', w.U3) },
    delete: { run: (c) => changed(c.from('updates').delete({ count: 'exact' }).eq('id', w.U3)), allow: ['member_1415'], undo: () => put('updates', w.U3) } },
  { t: 'media (approved for public use)',
    select: { run: (c) => seen(c.from('media').select('id').eq('id', w.M2)), allow: ALL } },
  { t: 'media (approved, club-only)',
    select: { run: (c) => seen(c.from('media').select('id').eq('id', w.M1)), allow: [...MEMBERS_A, 'admin'] } },
  { t: 'media (waiting for the advisor)',
    select: { run: (c) => seen(c.from('media').select('id').eq('id', w.M3)), allow: ['member_1617', ...STAFF_A, 'admin'] },
    insert: { run: (c) => { const m = randomUUID(); return inserted(c.from('media').insert({ club_id: w.club, path_large: mediaPath(w.club, m, 'large'), path_small: mediaPath(w.club, m, 'small'), width: 10, height: 10 })) }, allow: [],
      undo: drop('media', (t) => t.delete().eq('club_id', w.club).not('id', 'in', `(${[w.M1, w.M2, w.M3].join(',')})`)) },
    update: { run: (c) => changed(c.from('media').update({ alt: `${w.tag} x` }, { count: 'exact' }).eq('id', w.M3)), allow: [], undo: () => put('media', w.M3) },
    delete: { run: (c) => changed(c.from('media').delete({ count: 'exact' }).eq('id', w.M3)), allow: [...STAFF_A, 'admin'], undo: () => put('media', w.M3) } },
  { t: 'storage: a club photo (approved)',
    select: { run: (c) => storage(c.storage.from(BUCKET).createSignedUrl(w.paths.M1.large, 60), (d) => !!d.signedUrl), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => { lastPath = mediaPath(w.club, randomUUID(), 'large'); return storage(c.storage.from(BUCKET).upload(lastPath, WEBP, { contentType: 'image/webp' }), () => true) }, allow: [],
      undo: () => stored(admin.storage.from(BUCKET).remove([lastPath]), 'removing an upload') },
    update: { run: (c) => { lastPath = mediaPath(w.club, randomUUID(), 'large'); return storage(c.storage.from(BUCKET).move(w.paths.M1.large, lastPath), () => true) }, allow: [],
      undo: () => stored(admin.storage.from(BUCKET).move(lastPath, w.paths.M1.large), 'moving the photo back') },
    delete: { run: (c) => storage(c.storage.from(BUCKET).remove([w.paths.M1.large]), (d) => d.length > 0), allow: [],
      undo: () => stored(admin.storage.from(BUCKET).upload(w.paths.M1.large, WEBP, { contentType: 'image/webp', upsert: true }), 'putting the photo back') } },
  { t: 'storage: a photo waiting for the advisor',
    select: { run: (c) => storage(c.storage.from(BUCKET).createSignedUrl(w.paths.M3.large, 60), (d) => !!d.signedUrl), allow: ['member_1617', ...STAFF_A, 'admin'] } },
  { t: 'threads',
    select: { run: (c) => seen(c.from('threads').select('id').eq('id', ROW.thread)), allow: MEMBERS_A },
    insert: { run: (c) => inserted(c.from('threads').insert({ club_id: w.club, title: `${w.tag} new thread` })), allow: MEMBERS_A, undo: drop('threads', (t) => t.delete().eq('title', `${w.tag} new thread`)) },
    update: { run: (c) => changed(c.from('threads').update({ title: `${w.tag} edited thread` }, { count: 'exact' }).eq('id', w.TH1)), allow: STAFF_A, undo: () => put('threads', w.TH1) },
    delete: { run: (c) => changed(c.from('threads').delete({ count: 'exact' }).eq('id', w.TH1)), allow: [], undo: async () => { await put('threads', w.TH1); await put('thread_posts', w.TP1, w.TP2) } } },
  { t: 'thread_posts (published)',
    select: { run: (c) => seen(c.from('thread_posts').select('id').eq('id', ROW.threadPost)), allow: MEMBERS_A },
    insert: { run: (c) => inserted(c.from('thread_posts').insert({ thread_id: w.TH1, body: `${w.tag} hi all` })), allow: MEMBERS_A, undo: drop('thread_posts', (t) => t.delete().eq('body', `${w.tag} hi all`)) },
    delete: { run: (c) => changed(c.from('thread_posts').delete({ count: 'exact' }).eq('id', w.TP1)), allow: [], undo: () => put('thread_posts', w.TP1) } },
  { t: 'thread_posts (waiting)',
    // An author edits within 15 minutes of posting: the waiting post is made fresh just before its checks.
    prepare: async () => {
      await must(admin.from('thread_posts').update({ created_at: now() }).eq('id', w.TP2), 'refreshing the waiting post')
      await snapshot(admin, w, 'thread_posts', [w.TP2])
    },
    select: { run: (c) => seen(c.from('thread_posts').select('id').eq('id', w.TP2)), allow: ['member_1415', ...STAFF_A] },
    update: { run: (c) => changed(c.from('thread_posts').update({ body: `${w.tag} edited` }, { count: 'exact' }).eq('id', w.TP2)), allow: ['member_1415'], undo: () => put('thread_posts', w.TP2) } },
  { t: 'club_member_names (view)',
    select: { run: (c) => seen(c.from('club_member_names').select('user_id').eq('club_id', CLUB.budapest).eq('user_id', PERSON.mem2)), allow: [...MEMBERS_A, 'admin'] } },
  { t: 'resources (published)',
    select: { run: (c) => seen(c.from('resources').select('id').eq('id', ROW.resource)), allow: ALL } },
  { t: 'resources (draft)',
    select: { run: (c) => seen(c.from('resources').select('id').eq('id', x.RS2)), allow: ['admin'] },
    insert: { run: (c) => inserted(c.from('resources').insert({ strand: 'nature', title: `${w.tag} new guide`, url: 'https://example.test/rls-test-new', source_name: 'RLS-TEST' })), allow: ['admin'], undo: drop('resources', (t) => t.delete().eq('title', `${w.tag} new guide`)) },
    update: { run: (c) => changed(c.from('resources').update({ title: `${w.tag} edited guide` }, { count: 'exact' }).eq('id', x.RS2)), allow: ['admin'], undo: () => put('resources', x.RS2) },
    delete: { run: (c) => changed(c.from('resources').delete({ count: 'exact' }).eq('id', x.RS2)), allow: ['admin'], undo: () => put('resources', x.RS2) } },
  { t: 'reports (about a student)',
    select: { run: (c) => seen(c.from('reports').select('id').eq('id', w.RP1)), allow: ['member_1617', 'advisor', 'admin'] },
    insert: { run: (c) => inserted(c.from('reports').insert({ target_type: 'club', target_id: w.club, reason: 'spam', details: w.tag })), allow: [], undo: drop('reports', (t) => t.delete().eq('target_id', w.club)) },
    update: { run: (c) => changed(c.from('reports').update({ status: 'dismissed' }, { count: 'exact' }).eq('id', w.RP1)), allow: [], undo: () => put('reports', w.RP1) },
    delete: { run: (c) => changed(c.from('reports').delete({ count: 'exact' }).eq('id', w.RP1)), allow: [], undo: () => put('reports', w.RP1) } },
  { t: 'reports (child safety, about the advisor)',
    select: { run: (c) => seen(c.from('reports').select('id').eq('id', w.RP2)), allow: ['member_1415', 'admin'] } },
  { t: 'audit_log',
    select: { run: (c) => seen(c.from('audit_log').select('id').eq('id', ROW.audit)), allow: ['admin'] },
    // Append-only: nothing a broken rule wrote here could be undone, so the writes aim at the suite's own row.
    insert: { run: (c) => inserted(c.from('audit_log').insert({ action: 'rls-test.insert' })), allow: [] },
    update: { run: (c) => changed(c.from('audit_log').update({ action: 'rls-test.x' }, { count: 'exact' }).eq('id', auditRow)), allow: [] },
    delete: { run: (c) => changed(c.from('audit_log').delete({ count: 'exact' }).eq('id', auditRow)), allow: [] } },
  { t: 'notifications',
    select: { run: (c) => seen(c.from('notifications').select('id').eq('id', w.N1)), allow: ['member_1617'] },
    insert: { run: (c, self) => inserted(c.from('notifications').insert({ user_id: self, kind: 'rls-test.insert' })), allow: [], undo: drop('notifications', (t) => t.delete().eq('kind', 'rls-test.insert')) },
    update: { run: (c) => changed(c.from('notifications').update({ read_at: now() }, { count: 'exact' }).eq('id', w.N1)), allow: ['member_1617'], undo: () => put('notifications', w.N1) },
    delete: { run: (c) => changed(c.from('notifications').delete({ count: 'exact' }).eq('id', w.N1)), allow: ['member_1617'], undo: () => put('notifications', w.N1) } },
  { t: 'contact_messages',
    select: { run: (c) => seen(c.from('contact_messages').select('id').eq('id', w.CM1)), allow: ['advisor', 'admin'] },
    insert: { run: (c) => inserted(c.from('contact_messages').insert({ club_id: w.club, sender_name: 'RLS-TEST X', sender_email: 'rls-x@example.test', body: `${w.tag} hi` })), allow: [], undo: drop('contact_messages', (t) => t.delete().eq('body', `${w.tag} hi`)) },
    update: { run: (c) => changed(c.from('contact_messages').update({ status: 'read' }, { count: 'exact' }).eq('id', w.CM1)), allow: ['advisor', 'admin'], undo: () => put('contact_messages', w.CM1) },
    delete: { run: (c) => changed(c.from('contact_messages').delete({ count: 'exact' }).eq('id', w.CM1)), allow: [], undo: () => put('contact_messages', w.CM1) } },
  { t: 'flagged_words',
    select: { run: (c) => seen(c.from('flagged_words').select('word').eq('word', w.flaggedWord)), allow: ['admin'] },
    insert: { run: (c) => inserted(c.from('flagged_words').insert({ word: `${w.flaggedWord}b` })), allow: ['admin'], undo: drop('flagged_words', (t) => t.delete().eq('word', `${w.flaggedWord}b`)) },
    update: { run: (c) => changed(c.from('flagged_words').update({ created_at: now() }, { count: 'exact' }).eq('word', w.flaggedWord)), allow: [], undo: () => put('flagged_words', w.flaggedWord) },
    delete: { run: (c) => changed(c.from('flagged_words').delete({ count: 'exact' }).eq('word', w.flaggedWord)), allow: ['admin'], undo: () => put('flagged_words', w.flaggedWord) } },
  // R1b · 6 (club features, 12 Oct). Reads use the seed's rows where it has one; writes use the twin's (lib/world.ts).
  { t: "project_impacts (a public project's)",
    select: { run: (c) => seen(c.from('project_impacts').select('id').eq('project_id', ROW.projectPublic)), allow: ALL },
    insert: { run: (c) => inserted(c.from('project_impacts').insert({ project_id: w.P1, label: `${w.tag} trees planted`, value: 12 })), allow: ['member_1617', ...STAFF_A, 'admin'],
      undo: async () => { await must(admin.from('project_impacts').delete().eq('project_id', w.P1).neq('id', w.IM1), 'undoing a project_impacts write'); await putBackP1() } },
    update: { run: (c) => changed(c.from('project_impacts').update({ value: 413 }, { count: 'exact' }).eq('id', w.IM1)), allow: ['member_1617', ...STAFF_A, 'admin'],
      undo: async () => { await put('project_impacts', w.IM1); await putBackP1() } },
    delete: { run: (c) => changed(c.from('project_impacts').delete({ count: 'exact' }).eq('id', w.IM1)), allow: ['member_1617', ...STAFF_A, 'admin'],
      undo: async () => { await put('project_impacts', w.IM1); await putBackP1() } } },
  { t: "project_impacts (a club-only project's)",
    select: { run: (c) => seen(c.from('project_impacts').select('id').eq('id', w.IM2)), allow: [...MEMBERS_A, 'admin'] } },
  // The seed's link is on a public project (p1); the local suite's is on a club-only one. The rule is the same: members only.
  { t: 'project_links',
    select: { run: (c) => seen(c.from('project_links').select('id').eq('id', ROW.projectLink)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('project_links').insert({ project_id: w.P2, label: `${w.tag} slides`, url: 'https://slides.example.test/rls-test' })), allow: [...STAFF_A, 'admin'],
      undo: drop('project_links', (t) => t.delete().eq('project_id', w.P2).neq('id', w.LK1)) },
    update: { run: (c) => changed(c.from('project_links').update({ label: `${w.tag} our plan (new)` }, { count: 'exact' }).eq('id', w.LK1)), allow: [...STAFF_A, 'admin'], undo: () => put('project_links', w.LK1) },
    delete: { run: (c) => changed(c.from('project_links').delete({ count: 'exact' }).eq('id', w.LK1)), allow: [...STAFF_A, 'admin'], undo: () => put('project_links', w.LK1) } },
  // u-mem3 (Kaunas) follows the twin of club A. The inserts follow the twin of club B, which nobody follows yet.
  // No update grant on follows or polls: the local matrix leaves update out for both; here every actor must be refused.
  { t: "club_follows (another club's member follows A)",
    select: { run: (c) => seen(c.from('club_follows').select('club_id').eq('user_id', PERSON.mem3).eq('club_id', w.club)), allow: ['other_member'] },
    insert: { run: (c) => inserted(c.from('club_follows').insert({ club_id: x.B })), allow: [...MEMBERS_A, 'other_member', 'unverified_adult', 'admin', 'admin_aal1', 'advisor_aal1'],
      undo: drop('club_follows', (t) => t.delete().eq('club_id', x.B)) },
    update: { run: (c) => changed(c.from('club_follows').update({ created_at: now() }, { count: 'exact' }).eq('user_id', PERSON.mem3).eq('club_id', w.club)), allow: [], undo: () => put('club_follows', w.FW1) },
    delete: { run: (c) => changed(c.from('club_follows').delete({ count: 'exact' }).eq('user_id', PERSON.mem3).eq('club_id', w.club)), allow: ['other_member'], undo: () => put('club_follows', w.FW1) } },
  { t: 'polls',
    select: { run: (c) => seen(c.from('polls').select('id').eq('id', ROW.poll)), allow: [...MEMBERS_A, 'admin'] },
    insert: { run: (c) => inserted(c.from('polls').insert({ thread_id: w.TH1, question: `${w.tag} pizza or pasta?`, options: ['Pizza', 'Pasta'] })), allow: MEMBERS_A,
      undo: drop('polls', (t) => t.delete().eq('thread_id', w.TH1).neq('id', w.PL1)) },
    update: { run: (c) => changed(c.from('polls').update({ question: `${w.tag} edited poll` }, { count: 'exact' }).eq('id', w.PL1)), allow: [], undo: () => put('polls', w.PL1) },
    delete: { run: (c) => changed(c.from('polls').delete({ count: 'exact' }).eq('id', w.PL1)), allow: STAFF_A,
      undo: async () => { await put('polls', w.PL1); await put('poll_votes', w.PV1) } } }, // the vote went with it
  { t: "poll_votes (a member's vote)",
    select: { run: (c) => seen(c.from('poll_votes').select('poll_id').eq('poll_id', ROW.poll).eq('user_id', PERSON.mem2)), allow: ['member_1617'] },
    insert: { run: (c) => voteRefused(inserted(c.from('poll_votes').insert({ poll_id: w.PL1, choice: 0 }))), allow: ['member_1415', 'lead', 'advisor'],
      undo: drop('poll_votes', (t) => t.delete().eq('poll_id', w.PL1).neq('user_id', PERSON.mem2)) },
    update: { run: (c) => changed(c.from('poll_votes').update({ choice: 0 }, { count: 'exact' }).eq('poll_id', w.PL1).eq('user_id', PERSON.mem2)), allow: ['member_1617'], undo: () => put('poll_votes', w.PV1) },
    delete: { run: (c) => changed(c.from('poll_votes').delete({ count: 'exact' }).eq('poll_id', w.PL1).eq('user_id', PERSON.mem2)), allow: ['member_1617'], undo: () => put('poll_votes', w.PV1) } },
  { t: 'app.counters',
    select: { run: (c) => seen(c.schema('app').from('counters').select('name')), allow: [] } },
]

for (const target of T) {
  describe(target.t, () => {
    if (target.prepare) beforeAll(target.prepare, 60_000)
    for (const op of ['select', 'insert', 'update', 'delete'] as const) {
      const spec = target[op]
      if (!spec) continue
      for (const actor of ACTORS) {
        test(`${op} · ${actor}`, async () => {
          const outcome = await spec.run(as[actor], selfOf(actor))
          if (outcome.kind === 'allow' && spec.undo) await spec.undo() // put the row back before the next check
          const msg = verdict(outcome, spec.allow.includes(actor))
          if (msg) throw new Error(msg)
        })
      }
    }
  })
}
