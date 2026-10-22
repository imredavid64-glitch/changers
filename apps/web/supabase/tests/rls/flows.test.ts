// The flows: each function in 07 §6 with the rules it must hold, end to end through the API. A port of every flow in
// the local suite (supabase/tests/local/rls.mjs: 23 on 11 Oct, and the club-features flow of 12 Oct; its "outsiders"
// flow is the describe block at the end), plus three for the functions those flows never call
// (set_member_role, remove_member, leave_club, hide_content, revoke_invite, suspend_club), so every function is tested,
// and one check per club function called by someone with no part in the club (the local flows only use members).
// The local flows each ran in a transaction that was rolled back; here each one gets a fresh twin of club A
// (lib/world.ts), built before and removed after it. New accounts are throwaway example.test users made by the admin
// client: no seed person is ever deleted, and a seed person's own row is only ever touched by a write the rules refuse
// (restored at once if a rule were broken).
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, inject, test } from 'vitest'
import { createThrowaway, deleteThrowaway, raiseToAal2, signIn } from './lib/auth'
import { actorClient, adminClient } from './lib/clients'
import { describeError, preview } from './lib/outcome'
import { ACTORS, PERSON, emailOf, type ActorName } from './lib/seed'
import { TAG, buildWorld, hashCode, isoIn, mediaPath, must, teardownWorld, type Row, type World } from './lib/world'

const ctx = inject('rls')
const admin = adminClient()
const as = Object.fromEntries(ACTORS.map((a) => [a, actorClient(ctx.actors[a].token)])) as Record<ActorName, SupabaseClient>

// ── Throwaway accounts ────────────────────────────────────────────────────────────────────────────────────────
interface Person { id: string; email: string; c: SupabaseClient }
const made: { id: string; email: string }[] = []
let waiting: { id: string; email: string }
let S1: Person  // a new 16–17 student: signs up, joins with the code
let U13: Person // picks "under 13"
let S3: Person  // a new 13–15 student: joins through an invite
let A1: Person  // a new adult at aal2: asks for verification, gets verified
let D1: Person  // a 13–15 member (made by the admin) who moves up a band, then deletes the account

beforeAll(async () => {
  const user = async (label: string) => { const u = await createThrowaway(admin, ctx.runId, label); made.push(u); return u }
  waiting = await user('fwait')
  const people: Record<string, { id: string; email: string }> = {}
  for (const label of ['s1', 'u13', 's3', 'a1', 'd1']) people[label] = await user(label)
  const now = new Date().toISOString()
  await must(admin.from('profiles').insert([
    { id: waiting.id, display_name: 'Wil W.', age_band: '16-17', country: 'HU', conduct_accepted_at: now },
    { id: people.d1.id, display_name: 'Dan D.', age_band: '13-15', country: 'HU', conduct_accepted_at: now },
  ]), 'throwaway profiles')
  const session = async (label: string): Promise<Person> => { const s = await signIn(admin, people[label].email); return { id: s.userId, email: s.email, c: actorClient(s.token) } }
  S1 = await session('s1')
  U13 = await session('u13')
  S3 = await session('s3')
  D1 = await session('d1')
  const a = await signIn(admin, people.a1.email)
  A1 = { id: a.userId, email: a.email, c: actorClient(await raiseToAal2(a, 'a1', null, false)) } // its factor goes with the account
}, 300_000)

afterAll(async () => {
  for (const u of made) await deleteThrowaway(admin, u)
}, 300_000)

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────────────────
type Res = { data: unknown; error: { code?: string; message?: string } | null; count?: number | null }
async function ok<T = unknown>(q: PromiseLike<Res>, what: string): Promise<T> {
  const r = await q
  if (r.error) throw new Error(`${what}: expected it to work, got ${describeError(r.error)}`)
  return r.data as T
}
async function fails(q: PromiseLike<Res>, what: string): Promise<void> {
  const r = await q
  if (!r.error) throw new Error(`${what}: expected a refusal, got ${preview(r.data)}`)
}
/** A refusal, or a write the rules filtered down to nothing. */
async function noEffect(q: PromiseLike<Res>, what: string): Promise<void> {
  const r = await q
  if (!r.error && (r.count ?? 0) > 0) throw new Error(`${what}: expected a refusal, but ${r.count} row(s) changed`)
}
async function rowsOf(q: PromiseLike<Res>, what: string): Promise<Row[]> {
  const data = await ok<unknown>(q, what)
  return Array.isArray(data) ? (data as Row[]) : data ? [data as Row] : []
}
async function one(q: PromiseLike<Res>, what: string): Promise<Row> {
  const r = await rowsOf(q, what)
  if (r.length !== 1) throw new Error(`${what}: expected one row, got ${r.length}`)
  return r[0]
}
const count = async (q: PromiseLike<Res>, what = 'count') => (await rowsOf(q, what)).length
async function changedCount(q: PromiseLike<Res>, what: string): Promise<number> {
  const r = await q
  if (r.error) throw new Error(`${what}: expected it to work, got ${describeError(r.error)}`)
  return r.count ?? 0
}
function eq(got: unknown, want: unknown, what: string): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: got ${preview(got)}, want ${preview(want)}`)
}
async function ensureProfile(p: Person, band: string, name: string): Promise<void> {
  if (await count(admin.from('profiles').select('id').eq('id', p.id))) return
  await must(admin.from('profiles').insert({ id: p.id, display_name: name, age_band: band, country: 'HU', conduct_accepted_at: new Date().toISOString() }), 'a profile')
}
/** A seed person's profile is put back if a refused write changed it after all. */
async function guardSeedProfile(id: string, fn: () => Promise<void>): Promise<void> {
  const before = await one(admin.from('profiles').select('*').eq('id', id), 'the seed profile')
  try { await fn() } finally {
    const after = await one(admin.from('profiles').select('*').eq('id', id), 'the seed profile')
    if (JSON.stringify(after) !== JSON.stringify(before)) await must(admin.from('profiles').upsert(before), 'restoring a seed profile')
  }
}

let worlds = 0
/** A fresh twin of club A for one flow, removed afterwards (whether the flow passed or not). */
async function inWorld(fn: (w: World) => Promise<void>): Promise<void> {
  const w = await buildWorld(admin, { run: ctx.runId, n: ++worlds, waiting: waiting.id })
  let failure: unknown
  try { await fn(w) } catch (e) { failure = e }
  try { await teardownWorld(admin, w) } catch (e) { failure ??= e }
  if (failure) throw failure
}
const T = 120_000

// ── The flows ─────────────────────────────────────────────────────────────────────────────────────────────────
test("sign-up: 13–15 can't sign up without an invite; 16–17 and adults can, once", async () => {
  const signup = (p: Person, name: string, band: string, country: string, conduct: boolean) =>
    p.c.rpc('complete_signup', { p_display_name: name, p_age_band: band, p_country: country, p_accept_conduct: conduct })
  await fails(signup(S1, 'Kai K.', '13-15', 'HU', true), '13–15 without an invite')
  await fails(signup(S1, 'Kai K.', '16-17', 'HU', false), 'without the code of conduct')
  await fails(signup(S1, 'Kai Kovacs', '16-17', 'HU', true), 'a full name')
  await ok(signup(S1, 'Kai K.', '16-17', 'hu', true), '16–17 sign-up')
  await fails(signup(S1, 'Kai K.', '16-17', 'HU', true), 'a second sign-up')
  const p = await one(S1.c.from('profiles').select('display_name, age_band, country').eq('id', S1.id), 'the new profile')
  eq([p.display_name, p.age_band, p.country], ['Kai K.', '16-17', 'HU'], 'the new profile')
  await ok(signup(A1, 'Ana A.', 'adult', 'HU', true), 'an adult signing up')
}, T)

test('under 13: the new sign-in is deleted and only a count is kept', async () => {
  await ok(U13.c.rpc('decline_under_13'), 'declining')
  const gone = await admin.auth.admin.getUserById(U13.id)
  if (gone.data?.user) throw new Error('the auth user is still there')
  eq(await count(admin.from('profiles').select('id').eq('id', U13.id)), 0, 'a profile left behind')
  await fails(as.member_1617.rpc('decline_under_13'), 'an existing account')
  // The count lives in app.counters, which the Data API doesn't expose; the local suite reads it directly.
}, T)

test('the age band only moves up', async () => {
  eq(await changedCount(D1.c.from('profiles').update({ age_band: '16-17' }, { count: 'exact' }).eq('id', D1.id), 'up'), 1, 'moving up')
  await guardSeedProfile(PERSON.mem2, async () => {
    await fails(as.member_1617.from('profiles').update({ age_band: '13-15' }).eq('id', PERSON.mem2), 'down')
    await fails(as.member_1617.from('profiles').update({ age_band: 'adult' }).eq('id', PERSON.mem2), 'adult while a student member')
    await noEffect(as.member_1617.from('profiles').update({ is_verified_adult: true }, { count: 'exact' }).eq('id', PERSON.mem2), 'is_verified_adult')
  })
}, T)

test("a club: 13–15 can't start one; a 16–17 student becomes lead; it stays pending and unlisted", async () => {
  const start = (c: SupabaseClient, name: string, city: string, lat: number, lng: number) =>
    c.rpc('create_club', { p_name: `${TAG} ${ctx.runId} ${name}`, p_school_name: 'RLS-TEST School A', p_city: city, p_country: 'HU', p_lat: lat, p_lng: lng })
  await fails(start(as.member_1415, 'Kids Club', 'Pécs', 46.0727, 18.2323), '13–15')
  const c = await one(start(as.member_1617, 'Green Team', 'Budapest', 47.4979, 19.0402), 'a 16–17 student starting a club')
  try {
    if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(c.join_code))) throw new Error('the join code has the wrong shape')
    const club = await one(admin.from('clubs').select('status, lat, lng').eq('id', c.club_id), 'the new club')
    eq([club.status, Number(club.lat), Number(club.lng)], ['pending', 47.5, 19.04], 'pending, at the city centroid (2 dp)')
    const m = await one(admin.from('club_members').select('role, status').eq('club_id', c.club_id).eq('user_id', PERSON.mem2), 'the membership')
    eq([m.role, m.status], ['lead', 'active'], 'the starter')
    eq(await count(as.anon.from('clubs').select('id').eq('id', c.club_id)), 0, 'a pending club seen by a visitor')
    const k = await one(admin.from('club_codes').select('code_hash').eq('club_id', c.club_id), 'the stored code')
    eq([k.code_hash !== c.join_code, k.code_hash === hashCode(String(c.join_code))], [true, true], 'only the hash is stored')
  } finally {
    await must(admin.from('clubs').delete().eq('id', c.club_id), 'removing the new club')
  }
}, T)

test('a club changing its school, city or country goes back to verification', () => inWorld(async (w) => {
  eq(await changedCount(as.lead.from('clubs').update({ city: 'Debrecen', lat: 47.53, lng: 21.63 }, { count: 'exact' }).eq('id', w.club), 'moving the club'), 1, 'moving the club')
  eq((await one(admin.from('clubs').select('status').eq('id', w.club), 'the club')).status, 'pending', 'status after the move')
  await fails(as.lead.from('clubs').update({ pre_approval: false }).eq('id', w.club), 'a lead switching pre-approval')
  await noEffect(as.lead.from('clubs').update({ status: 'verified' }, { count: 'exact' }).eq('id', w.club), 'a lead verifying')
}), T)

test("join with code: 16–17 only, held pending; a lead approves 16–17; members can't", () => inWorld(async (w) => {
  await ensureProfile(S1, '16-17', 'Kai K.')
  await fails(S1.c.rpc('join_with_code', { p_code: 'WRONG-CODE' }), 'a wrong code')
  const j = await one(S1.c.rpc('join_with_code', { p_code: w.code.toLowerCase() }), 'joining')
  eq(j.status, 'pending', 'the request')
  await fails(as.member_1415.rpc('join_with_code', { p_code: w.code }), '13–15 by code')
  await fails(as.advisor.rpc('join_with_code', { p_code: w.code }), 'an adult by code')
  const id = String((await one(admin.from('club_members').select('id').eq('club_id', w.club).eq('user_id', S1.id), 'the request')).id)
  await fails(as.member_1617.rpc('approve_member', { p_member: id }), 'a member approving')
  await fails(as.advisor_aal1.rpc('approve_member', { p_member: id }), 'an advisor without the second factor')
  await ok(as.lead.rpc('approve_member', { p_member: id }), 'the lead approving')
  eq(await count(S1.c.from('notifications').select('id').eq('kind', 'join.approved').eq('payload->>club', w.club)), 1, 'the notification')
}), T)

test('invites: under 16 needs a recorded consent first; the link works once and makes an active member', () => inWorld(async (w) => {
  await fails(as.advisor.rpc('create_invite', { p_club: w.club, p_band: '13-15' }), 'no consent')
  await fails(as.lead.rpc('create_invite', { p_club: w.club, p_band: '16-17' }), 'a lead inviting')
  await fails(as.advisor_aal1.rpc('create_invite', { p_club: w.club, p_band: '16-17' }), 'an advisor without the second factor')
  const inv = await one(as.advisor.rpc('create_invite', { p_club: w.club, p_band: '13-15', p_consent_method: 'parent_email' }), 'the invite')
  const r = await one(S3.c.rpc('redeem_invite', { p_token: inv.token, p_display_name: 'Kai K.', p_country: 'HU', p_accept_conduct: true }), 'redeeming')
  eq(r.club_slug, w.slug, 'the club')
  const p = await one(admin.from('profiles').select('age_band').eq('id', S3.id), 'the new profile')
  const m = await one(admin.from('club_members').select('status, role, joined_via').eq('club_id', w.club).eq('user_id', S3.id), 'the membership')
  const i = await one(admin.from('invites').select('consent_id').eq('id', inv.invite_id), 'the invite')
  const k = await one(admin.from('consents').select('subject_user_id').eq('id', i.consent_id), 'the consent record')
  eq([p.age_band, m.status, m.role, m.joined_via, k.subject_user_id], ['13-15', 'active', 'member', 'invite', S3.id], 'after redeeming')
  await ensureProfile(S1, '16-17', 'Kai K.')
  await fails(S1.c.rpc('redeem_invite', { p_token: inv.token, p_display_name: 'Ola O.', p_country: 'HU', p_accept_conduct: true }), 'the same link twice')
  await must(admin.from('invites').update({ expires_at: isoIn(0, -1) }).eq('id', w.I1), 'expiring the 16–17 invite')
  await fails(S1.c.rpc('redeem_invite', { p_token: w.inviteToken, p_display_name: 'Ola O.', p_country: 'HU', p_accept_conduct: true }), 'an expired link')
}), T)

test('consent: under 16 the advisor records it; from 16 the student; nobody edits or deletes it', () => inWorld(async (w) => {
  const record = (c: SupabaseClient, subject: string, scope: string, method: string) =>
    c.rpc('record_consent', { p_club: w.club, p_subject: subject, p_scope: scope, p_method: method })
  await ok(record(as.advisor, PERSON.mem1, 'public_credit', 'school_on_file'), 'the advisor for a 13–15 member')
  await fails(record(as.member_1415, PERSON.mem1, 'photos', 'self'), '13–15 for themself')
  await fails(record(as.advisor, PERSON.mem2, 'photos', 'parent_email'), 'the advisor for a 16–17 member')
  await ok(record(as.member_1617, PERSON.mem2, 'photos', 'self'), '16–17 for themself')
  await ok(as.member_1415.rpc('revoke_consent', { p_consent: w.K2 }), 'withdrawing')
  eq(await count(admin.from('consents').select('id').eq('revokes', w.K2)), 1, 'the withdrawal row')
  await fails(admin.from('consents').update({ method: 'self' }).eq('id', w.K1), 'the secret key editing consent')
  await fails(admin.from('consents').delete().eq('id', w.K1), 'the secret key deleting consent')
}), T)

test("posts wait for approval: students by default; a link or flagged word always; an advisor's own post doesn't", () => inWorld(async (w) => {
  const post = (c: SupabaseClient, body: string, visibility = 'club') =>
    one(c.from('updates').insert({ club_id: w.club, body: `${w.tag} ${body}`, visibility }).select('status, approved_by, has_link'), `posting "${body}"`)
  const s = await post(as.member_1617, 'plain text')
  eq(s.status, 'pending', "a student's post")
  const v = await post(as.advisor, 'from the advisor', 'public')
  eq([v.status, v.approved_by], ['published', PERSON.adv1], "the advisor's own public post")
  await must(admin.from('clubs').update({ pre_approval: false }).eq('id', w.club), 'switching pre-approval off')
  const f = await post(as.member_1617, 'plain text again')
  const l = await post(as.member_1617, 'see example.com/x')
  const fw = await post(as.member_1617, `what a ${w.flaggedWord}`)
  const p = await post(as.member_1617, 'for everyone', 'public')
  eq([f.status, l.status, l.has_link, fw.status, p.status], ['published', 'pending', true, 'pending', 'pending'], 'with pre-approval off')
  const reply = (c: SupabaseClient, body: string) => one(c.from('thread_posts').insert({ thread_id: w.TH1, body: `${w.tag} ${body}` }).select('status'), `replying "${body}"`)
  eq((await reply(as.member_1617, 'www.example.com')).status, 'pending', 'a reply with a link')
  // Luke, 11 Oct: a plain reply posts at once, even with the club's pre-approval on.
  await must(admin.from('clubs').update({ pre_approval: true }).eq('id', w.club), 'switching pre-approval on')
  eq([(await reply(as.member_1415, 'count me in')).status, (await reply(as.member_1415, `such a ${w.flaggedWord}`)).status], ['published', 'pending'], 'replies')
}), T)

test("approvals: a lead approves members' club-only text, never their own and never anything public; advisors approve the rest", () => inWorld(async (w) => {
  const approve = (c: SupabaseClient, kind: string, id: unknown, alt?: string) => c.rpc('approve_content', { p_kind: kind, p_id: id, ...(alt ? { p_alt: alt } : {}) })
  const own = await one(as.lead.from('updates').insert({ club_id: w.club, body: `${w.tag} from the lead` }).select('id'), "the lead's post")
  await fails(approve(as.lead, 'update', own.id), 'a lead approving their own')
  await fails(approve(as.member_1617, 'update', w.U3), 'a member approving')
  await ok(approve(as.lead, 'update', w.U3), 'a lead approving club text')
  const pub = await one(as.member_1617.from('updates').insert({ club_id: w.club, body: `${w.tag} for everyone`, visibility: 'public' }).select('id'), 'a public post')
  await fails(approve(as.lead, 'update', pub.id), 'a lead approving public')
  await fails(approve(as.advisor_aal1, 'update', pub.id), 'an advisor without the second factor')
  await ok(approve(as.advisor, 'update', pub.id), 'the advisor approving public')
  eq(await count(as.anon.from('updates').select('id').eq('id', pub.id)), 1, 'an approved public update seen by a visitor')
  await ok(approve(as.lead, 'project', w.P3), "a lead approving a member's proposal")
  const leadProp = await one(as.lead.from('projects').insert({ club_id: w.club, title: `${w.tag} lead proposal`, strand: 'nature', status: 'proposed' }).select('id'), "the lead's proposal")
  await fails(approve(as.lead, 'project', leadProp.id), 'a lead approving their own proposal')
  await ok(approve(as.advisor, 'project', leadProp.id), "the advisor approving the lead's proposal")
  await ok(as.advisor.rpc('send_back', { p_kind: 'update', p_id: own.id, p_note: 'Add where you met' }), 'sending back')
  eq((await one(as.lead.from('updates').select('status').eq('id', own.id), 'the sent-back post')).status, 'draft', 'sent back')
  await ok(approve(as.advisor, 'media', w.M3, 'A poster on the wall'), 'a photo with its alt text')
  await ok(approve(as.lead, 'thread_post', w.TP2), "a lead approving a member's thread post")
}), T)

test('projects: students start drafts or proposals; only an advisor makes one public; edits to public text reset approval', () => inWorld(async (w) => {
  await fails(as.member_1617.from('projects').insert({ club_id: w.club, title: `${w.tag} straight to active`, strand: 'nature', status: 'active' }), 'a student starting active')
  await fails(as.member_1617.from('projects').update({ status: 'active' }).eq('id', w.P3), 'a student approving by editing')
  await fails(as.lead.rpc('set_project_visibility', { p_project: w.P2, p_visibility: 'public' }), 'a lead making it public')
  await ok(as.advisor.rpc('set_project_visibility', { p_project: w.P2, p_visibility: 'public' }), 'the advisor making it public')
  const seenPublicly = () => count(as.anon.from('projects').select('id').eq('id', w.P2))
  eq(await seenPublicly(), 1, 'public after the advisor')
  eq(await changedCount(as.lead.from('projects').update({ problem: 'A new problem text' }, { count: 'exact' }).eq('id', w.P2), 'the team editing public text'), 1, 'the edit')
  eq(await seenPublicly(), 0, 'still public after an edit')
  await ok(as.advisor.rpc('approve_content', { p_kind: 'project', p_id: w.P2 }), 're-approval')
  eq(await seenPublicly(), 1, 'public after re-approval')
  await fails(as.member_1617.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', w.P1), 'a member removing a project')
  const mine = await one(as.member_1617.from('projects').insert({ club_id: w.club, title: `${w.tag} my draft`, strand: 'nature' }).select('id'), 'a new draft')
  eq((await one(admin.from('project_members').select('role').eq('project_id', mine.id).eq('user_id', PERSON.mem2), 'the team')).role, 'owner', 'the starter on the team')
}), T)

test("events: a lead's public event waits for an advisor; the exact place shows only after an RSVP", () => inWorld(async (w) => {
  const e = await one(as.lead.from('events').insert({ club_id: w.club, title: `${w.tag} open day`, starts_at: isoIn(3), ends_at: isoIn(3, 1), tz: 'Europe/Budapest', mode: 'in_person', city: 'Budapest', visibility: 'public' }).select('id, status'), "the lead's public event")
  eq(e.status, 'pending', "a lead's public event")
  await fails(as.lead.from('events').update({ status: 'published' }).eq('id', e.id), 'a lead publishing it')
  await ok(as.advisor.rpc('approve_content', { p_kind: 'event', p_id: e.id }), 'the advisor approving')
  const links = () => count(as.member_1415.from('event_links').select('event_id').eq('event_id', w.E2))
  eq(await links(), 0, 'the exact place before an RSVP')
  await ok(as.member_1415.rpc('rsvp', { p_event: w.E2 }), 'RSVP')
  eq(await links(), 1, 'the exact place after an RSVP')
  await fails(as.other_member.rpc('rsvp', { p_event: w.E2 }), "another club's member RSVPing to a club-only event")
  await fails(as.anon.rpc('rsvp', { p_event: w.E1 }), 'a visitor RSVPing')
}), T)

test('RSVP capacity: the third person waits; a cancellation moves them up', () => inWorld(async (w) => {
  // The club event takes 2, and u-mem2 is going already.
  const a = await ok<string>(as.member_1415.rpc('rsvp', { p_event: w.E2 }), 'the second RSVP')
  const b = await ok<string>(as.lead.rpc('rsvp', { p_event: w.E2 }), 'the third RSVP')
  eq([a, b], ['going', 'waitlist'], 'places')
  eq(await changedCount(as.member_1617.from('rsvps').update({ status: 'cancelled' }, { count: 'exact' }).eq('id', w.R1), 'cancelling'), 1, 'the cancellation')
  eq((await one(admin.from('rsvps').select('status').eq('event_id', w.E2).eq('user_id', PERSON.lead1), "the lead's RSVP")).status, 'going', 'the waitlist moving up')
}), T)

test('going counts: a visitor sees how many are going to a public event, never to a club-only one, and never who', () => inWorld(async (w) => {
  await must(admin.from('rsvps').insert({ event_id: w.E1, user_id: PERSON.mem2, status: 'going' }), 'an RSVP to the public event')
  const pub = await rowsOf(as.anon.rpc('going_counts', { p_events: [w.E1, w.E2] }), 'the counts a visitor sees')
  eq(pub.map((r) => [r.event_id, r.going]), [[w.E1, 1]], 'a visitor: the public event only')
  const mem = await rowsOf(as.member_1415.rpc('going_counts', { p_events: [w.E2] }), 'the counts a member sees')
  eq(mem.map((r) => r.going), [1], 'a member: their club-only event')
  await fails(as.anon.from('rsvps').select('id'), 'a visitor reading the list')
}), T)

test("club features: a public project's new numbers wait for the advisor; polls show counts, never who; follows are private", () => inWorld(async (w) => {
  // Impact numbers are a public claim: a team member's new number takes the approved public project off the public site
  // until an advisor approves it again (a lead can't).
  const seenPublicly = () => count(as.anon.from('projects').select('id').eq('id', w.P1))
  eq(await seenPublicly(), 1, 'the public project before the new number')
  await ok(as.member_1617.from('project_impacts').insert({ project_id: w.P1, label: `${w.tag} cans recycled`, value: 50, unit: '' }), 'the team adding a number')
  eq(await seenPublicly(), 0, 'still public after a new number')
  await fails(as.lead.rpc('approve_content', { p_kind: 'project', p_id: w.P1 }), 'a lead putting it back')
  await ok(as.advisor.rpc('approve_content', { p_kind: 'project', p_id: w.P1 }), 're-approval')
  eq(await seenPublicly(), 1, 'public after re-approval')
  eq(await count(as.anon.from('project_impacts').select('id').eq('project_id', w.P1)), 2, 'the numbers a visitor sees')

  // Polls: one vote each, and its voter can change it; poll_results gives the club's members the counts, never who
  // voted what, and gives anyone else nothing; a poll can't carry a link; a closed poll takes no votes.
  const vote = (c: SupabaseClient, choice: number) => c.from('poll_votes').insert({ poll_id: w.PL1, choice })
  const change = (c: SupabaseClient, voter: string, choice: number) => c.from('poll_votes').update({ choice }, { count: 'exact' }).eq('poll_id', w.PL1).eq('user_id', voter)
  const results = async (c: SupabaseClient) => {
    const r = await rowsOf(c.rpc('poll_results', { p_poll: w.PL1 }), 'the counts')
    if (r.some((x) => Object.keys(x).sort().join(',') !== 'choice,votes')) throw new Error(`the counts say more than choice and votes: ${preview(r)}`)
    return r.map((x) => [Number(x.choice), Number(x.votes)]).sort((a, b) => a[0] - b[0])
  }
  await ok(vote(as.member_1415, 0), 'a vote') // u-mem2 voted 1 when the twin was built
  await fails(vote(as.member_1415, 1), 'a second vote')
  eq(await results(as.lead), [[0, 1], [1, 1]], 'the counts the lead sees')
  eq(await changedCount(change(as.member_1415, PERSON.mem1, 1), 'changing the vote'), 1, 'the vote changed')
  eq(await results(as.member_1415), [[1, 2]], 'the counts a member sees after the change')
  await fails(change(as.member_1415, PERSON.mem1, 4), "a choice that doesn't exist")
  eq(await count(as.lead.from('poll_votes').select('user_id').eq('poll_id', w.PL1)), 0, "the votes the lead sees (two people's)")
  eq(await results(as.other_member), [], "the counts another club's member gets")
  await fails(as.anon.rpc('poll_results', { p_poll: w.PL1 }), 'a visitor asking for the counts')
  await fails(vote(as.other_member, 0), "another club's member voting")
  await fails(as.member_1617.from('polls').insert({ thread_id: w.TH1, question: `${w.tag} see example.com?`, options: ['Yes', 'No'] }), 'a poll with a link')
  await must(admin.from('polls').update({ closes_at: isoIn(0, -1) }).eq('id', w.PL1), 'closing the poll')
  await fails(change(as.member_1617, PERSON.mem2, 0), 'changing a vote on a closed poll')
  await fails(vote(as.lead, 0), 'a first vote on a closed poll')

  // Follows: only clubs on the public site; nobody sees who follows a club, not even its staff or an admin.
  const pending = randomUUID()
  await must(admin.from('clubs').insert({ id: pending, slug: `${w.slug}-pending-club`, name: `${w.tag} pending club`, school_name: 'RLS-TEST School C', city: 'Kraków', country: 'PL', lat: 50.06, lng: 19.94, tz: 'Europe/Warsaw', status: 'pending' }), 'a pending club')
  w.clubs.push(pending) // removed with the twin
  await ok(as.member_1617.from('club_follows').insert({ club_id: w.club }), 'following a club on the public site')
  await fails(as.member_1617.from('club_follows').insert({ club_id: pending }), 'following a pending club')
  const followers = async (c: SupabaseClient) => (await rowsOf(c.from('club_follows').select('user_id').eq('club_id', w.club), 'the follows')).map((r) => r.user_id)
  eq([await followers(as.member_1617), await followers(as.other_member)], [[PERSON.mem2], [PERSON.mem3]], 'each follower sees their own follow only')
  eq([await followers(as.lead), await followers(as.advisor), await followers(as.admin)], [[], [], []], "the club's lead and advisor, and an admin")

  // The task board: a task has a state, and "done" follows it (it can't be written itself).
  const t = await one(as.lead.from('project_tasks').update({ state: 'done' }).eq('id', w.PT1).select('state, done'), 'moving a task to Done')
  eq([t.state, t.done], ['done', true], 'the task')
  await fails(as.lead.from('project_tasks').update({ done: false }).eq('id', w.PT1), '"done" written directly')
}), T)

test('verification: only an admin with the second factor verifies; an unverified adult has no powers', async () => {
  // As world.sql's club C: a pending club whose advisor (a new adult, at aal2) has an open verification.
  await ensureProfile(A1, 'adult', 'Ana A.')
  const club = randomUUID()
  await must(admin.from('clubs').insert({ id: club, slug: `rls-test-${ctx.runId}-verify`, name: `${TAG} ${ctx.runId} pending club`, school_name: 'RLS-TEST School C', city: 'Kraków', country: 'PL', lat: 50.06, lng: 19.94, tz: 'Europe/Warsaw', status: 'pending' }), 'the pending club')
  try {
    await must(admin.from('club_members').insert({ club_id: club, user_id: A1.id, role: 'advisor', status: 'active', joined_via: 'creator', approved_at: new Date().toISOString() }), 'its advisor')
    const v = String((await one(admin.from('advisor_verifications').insert({ user_id: A1.id, club_id: club, school_name: `${TAG} ${ctx.runId} School C`, school_domain: 'example.test', second_contact_role: 'Head', second_contact_email: 'head@example.test' }).select('id'), 'the open verification')).id)
    await fails(as.admin_aal1.rpc('verify_advisor', { p_verification: v }), 'an admin without aal2')
    await fails(A1.c.rpc('create_invite', { p_club: club, p_band: '16-17' }), 'an unverified adult inviting')
    await fails(A1.c.rpc('rotate_join_code', { p_club: club }), 'an unverified adult rotating the code')
    await ok(as.admin.rpc('verify_advisor', { p_verification: v }), 'the admin verifying')
    const after = await one(admin.from('advisor_verifications').select('second_contact_email, status').eq('id', v), 'the verification')
    eq([after.second_contact_email, after.status], [null, 'approved'], 'verified, the second contact forgotten')
    await ok(as.admin.rpc('verify_club', { p_club: club }), 'verifying the club')
    await ok(A1.c.rpc('rotate_join_code', { p_club: club }), 'now verified, rotating the code')
    await ok(A1.c.rpc('create_invite', { p_club: club, p_band: '16-17' }), 'now verified, inviting')
  } finally {
    await must(admin.from('advisor_verifications').delete().eq('user_id', A1.id), 'removing the verification')
    await must(admin.from('clubs').delete().eq('id', club), 'removing the club')
  }
}, T)

test("the request route's advisor check: the school email domain must match", async () => {
  await ensureProfile(A1, 'adult', 'Ana A.')
  const request = (school: string, domain: string, second: string) =>
    A1.c.rpc('request_advisor_verification', { p_club: null, p_school_name: `${TAG} ${ctx.runId} ${school}`, p_school_domain: domain, p_second_role: 'Head', p_second_email: second })
  try {
    await fails(request('Other School', 'other.example.test', 'head@other.example.test'), "a domain that isn't theirs")
    await ok(request('Their School', 'example.test', 'head@example.test'), 'their school domain') // the throwaway's address is on example.test
  } finally {
    await must(admin.from('advisor_verifications').delete().eq('user_id', A1.id), 'removing the request')
  }
}, T)

test("reports: the route files them; advisors handle their club's, never about themselves or adults", () => inWorld(async (w) => {
  const file = (reason: string, unverified: boolean) =>
    admin.rpc('file_report', { p_target_type: 'update', p_target_id: w.U2, p_reason: reason, p_details: `${w.tag} report`, p_reporter: null, p_unverified: unverified })
  const id = await ok<string>(file('bullying', true), 'the report route filing')
  w.reports.push(id)
  const r = await one(admin.from('reports').select('club_id, about_user_id, unverified').eq('id', id), 'the report')
  eq([r.club_id, r.about_user_id, r.unverified], [w.club, PERSON.mem2, true], 'the report')
  await fails(as.member_1617.rpc('file_report', { p_target_type: 'club', p_target_id: w.club, p_reason: 'spam', p_details: '', p_reporter: null, p_unverified: false }), 'a person calling the route function')
  await ok(as.advisor.rpc('handle_report', { p_report: id, p_status: 'actioned', p_statement: 'Removed: unkind' }), 'the advisor handling')
  await fails(as.advisor.rpc('handle_report', { p_report: w.RP2, p_status: 'dismissed' }), 'the advisor handling a report about themself')
  const cs = await ok<string>(file('child_safety', false), 'a child-safety report')
  w.reports.push(cs)
  eq(await count(admin.from('notifications').select('id').eq('kind', 'report.child_safety').eq('payload->>report', cs).eq('user_id', PERSON.admin)), 1, 'the admins told at once')
}), T)

test('the audit log: nobody edits or deletes it, not even the secret key', () => inWorld(async (w) => {
  await ok(as.lead.rpc('rotate_join_code', { p_club: w.club }), 'the lead making a new code')
  const log = await rowsOf(admin.from('audit_log').select('id').eq('action', 'club.code_rotate').eq('target_id', w.club), 'the log')
  eq(log.length, 1, 'the rotation logged')
  await fails(admin.from('audit_log').update({ action: 'rls-test.x' }).eq('id', log[0].id), 'the secret key editing it')
  await fails(admin.from('audit_log').delete().eq('id', log[0].id), 'the secret key deleting it')
  await fails(as.admin.from('audit_log').update({ action: 'rls-test.x' }).eq('id', log[0].id), 'an admin editing it')
  // The local suite also tries the database owner; there is no owner connection through the API.
}), T)

test('admins read threads only through the logged function', () => inWorld(async (w) => {
  const t = await ok<unknown>(as.admin.rpc('admin_read_threads', { p_club: w.club }), 'the admin reading')
  eq(Array.isArray(t) ? t.length : -1, 1, 'threads returned')
  eq(await count(admin.from('audit_log').select('id').eq('action', 'admin.read_threads').eq('target_id', w.club)), 1, 'the read logged')
  await fails(as.advisor.rpc('admin_read_threads', { p_club: w.club }), 'an advisor using it')
  await fails(as.admin_aal1.rpc('admin_read_threads', { p_club: w.club }), 'an admin without aal2')
}), T)

test('export my data: everything about me, nothing about others', () => inWorld(async () => {
  const e = await ok<Row>(as.member_1415.rpc('export_my_data'), 'the export')
  const theirs = async (table: string, col: string) => count(admin.from(table).select('id').eq(col, PERSON.mem1))
  const len = (v: unknown) => (Array.isArray(v) ? v.length : -1)
  const want = { memberships: await theirs('club_members', 'user_id'), updates: await theirs('updates', 'author_id'), consents: await theirs('consents', 'subject_user_id') }
  eq([e.email, { memberships: len(e.memberships), updates: len(e.updates), consents: len(e.consents) }], [emailOf('u-mem1'), want], 'the export')
  if (want.consents < 1 || want.memberships < 2) throw new Error(`the twin club's consent records and membership are missing (${preview(want)})`)
  const others = ['u-adv1', 'u-lead1', 'u-mem2', 'u-adv2', 'u-lead2', 'u-mem3', 'u-adv7', 'u-admin'].map(emailOf).filter((m) => JSON.stringify(e).includes(m))
  eq(others, [], "other people's addresses in the export")
}), T)

test('delete my account: projects stay with the club, reports stay, consent records stay; the rest goes', () => inWorld(async (w) => {
  // What the deleted member has, as in world.sql: a membership, three photos, a project they started, a report they
  // filed, an update, an RSVP, and a consent record.
  const D = D1.id
  const now = new Date().toISOString()
  await must(admin.from('club_members').insert({ club_id: w.club, user_id: D, role: 'member', status: 'active', joined_via: 'code', approved_at: now }), 'the membership')
  const photos = [randomUUID(), randomUUID(), randomUUID()]
  await must(admin.from('media').insert(photos.map((m) => ({ id: m, club_id: w.club, uploader_id: D, path_large: mediaPath(w.club, m, 'large'), path_small: mediaPath(w.club, m, 'small'), width: 10, height: 10, alt: `${w.tag} photo`, status: 'approved', approved_by: PERSON.adv1, is_public: false }))), 'the photos')
  const project = randomUUID()
  await must(admin.from('projects').insert({ id: project, club_id: w.club, title: `${w.tag} their project`, strand: 'nature', status: 'active', visibility: 'public', approved_by: PERSON.adv1, approved_at: now, created_by: D }), 'the project')
  const report = randomUUID()
  await must(admin.from('reports').insert({ id: report, reporter_id: D, target_type: 'update', target_id: w.U3, about_user_id: PERSON.mem1, club_id: w.club, reason: 'bullying', details: w.tag }), 'the report')
  w.reports.push(report)
  await must(admin.from('updates').insert({ club_id: w.club, author_id: D, body: `${w.tag} their update`, visibility: 'club', status: 'pending' }), 'the update')
  await must(admin.from('rsvps').insert({ event_id: w.E1, user_id: D, status: 'going' }), 'the RSVP')
  const consent = randomUUID()
  await must(admin.from('consents').insert({ id: consent, subject_user_id: D, club_id: w.club, scope: 'photos', method: 'self', recorded_by: D }), 'the consent record')
  await noEffect(D1.c.from('profiles').delete({ count: 'exact' }).eq('id', D), 'deleting the profile row directly')
  const paths = await ok<unknown>(D1.c.rpc('delete_my_account'), 'delete my account')
  eq(Array.isArray(paths) ? paths.length : -1, 6, 'photo paths handed back for the bucket')
  if ((await admin.auth.admin.getUserById(D)).data?.user) throw new Error('the auth user is still there')
  const left = {
    profiles: await count(admin.from('profiles').select('id').eq('id', D)),
    memberships: await count(admin.from('club_members').select('id').eq('user_id', D)),
    updates: await count(admin.from('updates').select('id').eq('author_id', D)),
    rsvps: await count(admin.from('rsvps').select('id').eq('user_id', D)),
    photos: await count(admin.from('media').select('id').in('id', photos)),
  }
  eq(left, { profiles: 0, memberships: 0, updates: 0, rsvps: 0, photos: 0 }, 'what goes')
  const p = await one(admin.from('projects').select('created_by').eq('id', project), 'the project')
  const r = await one(admin.from('reports').select('reporter_id').eq('id', report), 'the report')
  const k = await one(admin.from('consents').select('subject_user_id').eq('id', consent), 'the consent record')
  eq([p.created_by, r.reporter_id, k.subject_user_id], [null, null, null], 'what stays, no longer linked to the person')
}), T)

test('the roster: staff see the members and requests; only advisors and admins see age bands', () => inWorld(async (w) => {
  const roster = (c: SupabaseClient) => rowsOf(c.rpc('club_roster', { p_club: w.club }), 'the roster')
  const adv = await roster(as.advisor)
  eq([adv.length, adv.every((r) => r.age_band !== null)], [5, true], "the advisor's roster (with age bands)")
  const lead = await roster(as.lead)
  eq([lead.length, lead.every((r) => r.age_band === null && r.country === null)], [5, true], "the lead's roster (without)")
  eq([(await roster(as.member_1617)).length, (await roster(as.advisor_aal1)).length], [0, 0], 'a member, and an advisor without aal2')
}), T)

test('names: co-members see first name and initial only; nobody else sees a profile', () => inWorld(async (w) => {
  const names = await rowsOf(as.member_1415.from('club_member_names').select('*').eq('club_id', w.club), 'the names')
  eq(Object.keys(names[0] ?? {}).join(','), 'club_id,user_id,display_name,role', 'the columns')
  eq(await count(as.other_member.from('club_member_names').select('user_id').eq('club_id', w.club)), 0, "another club's member")
  await fails(as.anon.from('club_member_names').select('user_id'), 'a visitor')
  eq(await count(as.lead.from('profiles').select('id')), 1, 'the profiles a lead sees')
}), T)

// ── The functions the local flows don't call ──────────────────────────────────────────────────────────────────
test('members: only an advisor changes a role or removes someone; a member leaves by themself', () => inWorld(async (w) => {
  const role = (c: SupabaseClient, member: string, r: string) => c.rpc('set_member_role', { p_member: member, p_role: r })
  await fails(role(as.lead, w.m.m17, 'lead'), 'a lead promoting')
  await fails(role(as.advisor_aal1, w.m.m17, 'lead'), 'an advisor without the second factor')
  await ok(role(as.advisor, w.m.m17, 'lead'), 'the advisor promoting')
  eq((await one(admin.from('club_members').select('role').eq('id', w.m.m17), 'the membership')).role, 'lead', 'the new role')
  await fails(role(as.advisor, w.m.adv, 'member'), 'an advisor changing their own role')
  await fails(role(as.advisor, w.m.m15, 'advisor'), 'a student made an advisor')
  await fails(as.lead.rpc('remove_member', { p_member: w.m.m15 }), 'a lead removing a member')
  await ok(as.advisor.rpc('remove_member', { p_member: w.m.m15 }), 'the advisor removing a member')
  await ok(as.member_1617.rpc('leave_club', { p_club: w.club }), 'leaving')
  const st = await rowsOf(admin.from('club_members').select('id, status').in('id', [w.m.m15, w.m.m17]), 'the memberships')
  const status = (id: string) => st.find((m) => m.id === id)?.status
  eq([status(w.m.m15), status(w.m.m17)], ['removed', 'left'], 'the removed member, and the one who left')
  await fails(as.member_1617.rpc('leave_club', { p_club: w.club }), 'leaving twice')
}), T)

test("hiding: the club's staff hide its content with a reason, an admin anywhere; members can't", () => inWorld(async (w) => {
  const hide = (c: SupabaseClient, kind: string, id: string, reason: string) => c.rpc('hide_content', { p_kind: kind, p_id: id, p_reason: reason })
  await fails(hide(as.member_1617, 'update', w.U2, 'Off-topic'), 'a member hiding')
  await fails(hide(as.lead, 'update', w.U2, ''), 'hiding without a reason')
  await ok(hide(as.lead, 'update', w.U2, 'Off-topic'), 'the lead hiding')
  eq((await one(admin.from('updates').select('status').eq('id', w.U2), 'the update')).status, 'hidden', 'the update')
  eq(await count(admin.from('notifications').select('id').eq('user_id', PERSON.mem2).eq('kind', 'content.hidden').eq('payload->>id', w.U2)), 1, 'the statement of reasons to the author')
  await fails(hide(as.other_member, 'thread_post', w.TP1, 'Off-topic'), "another club's member")
  await fails(hide(as.admin_aal1, 'thread', w.TH1, 'Closed'), 'an admin without aal2')
  await ok(hide(as.admin, 'thread', w.TH1, 'Closed'), 'an admin hiding a thread')
  const th = await one(admin.from('threads').select('deleted_at').eq('id', w.TH1), 'the thread')
  if (!th.deleted_at) throw new Error('the thread is still there')
}), T)

test('cancelling an invite and suspending a club: the advisor cancels; only an admin with aal2 suspends', () => inWorld(async (w) => {
  await ensureProfile(S1, '16-17', 'Kai K.')
  await fails(as.lead.rpc('revoke_invite', { p_invite: w.I1 }), 'a lead cancelling an invite')
  await ok(as.advisor.rpc('revoke_invite', { p_invite: w.I1 }), 'the advisor cancelling it')
  await fails(S1.c.rpc('redeem_invite', { p_token: w.inviteToken, p_display_name: 'Kai K.', p_country: 'HU', p_accept_conduct: true }), 'a cancelled link')
  await fails(as.admin_aal1.rpc('suspend_club', { p_club: w.club, p_reason: `${w.tag} check` }), 'an admin without aal2')
  await fails(as.advisor.rpc('suspend_club', { p_club: w.club, p_reason: `${w.tag} check` }), 'the advisor')
  await ok(as.admin.rpc('suspend_club', { p_club: w.club, p_reason: `${w.tag} check` }), 'the admin suspending')
  eq(await count(as.anon.from('clubs').select('id').eq('id', w.club)), 0, 'a suspended club seen by a visitor')
  await fails(S1.c.rpc('join_with_code', { p_code: w.code }), "a suspended club's code")
}), T)

// ── People with no part in the club ───────────────────────────────────────────────────────────────────────────
// 07 §3: every club power belongs to that club's own staff ("own club" = an active membership). The local flows
// call these functions only as members of the club; here each one is called by another club's member (u-mem3), and
// once by a student whose own request is still waiting. Every row each check aims at is its own, so no check
// depends on another's result; the code rotation goes last.
describe('functions refuse people with no part in the club', () => {
  let w: World | undefined
  let secondWaiting = '' // a second waiting update, for send_back
  let inviteConsent = '' // the consent record of an under-16 invite nobody has redeemed yet (no subject)
  const world = () => { if (!w) throw new Error('the twin club was not built'); return w }
  const outsider = () => as.other_member
  beforeAll(async () => {
    w = await buildWorld(admin, { run: ctx.runId, n: ++worlds, waiting: waiting.id })
    secondWaiting = String((await one(admin.from('updates').insert({ club_id: w.club, author_id: PERSON.mem1, body: `${w.tag} another waiting update`, visibility: 'club', status: 'pending' }).select('id'), 'a second waiting update')).id)
    const inv = await one(as.advisor.rpc('create_invite', { p_club: w.club, p_band: '13-15', p_consent_method: 'school_on_file' }), 'an under-16 invite')
    inviteConsent = String((await one(admin.from('invites').select('consent_id').eq('id', inv.invite_id), 'the invite')).consent_id)
  }, 300_000)
  afterAll(() => teardownWorld(admin, w), 300_000)

  test('approve_member: a 16–17 student approving their own waiting request', async () => {
    await ensureProfile(S1, '16-17', 'Kai K.')
    await ok(S1.c.rpc('join_with_code', { p_code: world().code }), 'asking to join')
    const id = String((await one(admin.from('club_members').select('id').eq('club_id', world().club).eq('user_id', S1.id), 'the request')).id)
    await fails(S1.c.rpc('approve_member', { p_member: id }), 'a student approving their own request')
  }, T)
  test("approve_member: another club's member approving a 16–17 request", () =>
    fails(outsider().rpc('approve_member', { p_member: world().m.wait }), "another club's member approving a request"), T)
  test("approve_content: another club's member approving club-only text", () =>
    fails(outsider().rpc('approve_content', { p_kind: 'update', p_id: world().U3 }), "another club's member approving an update"), T)
  test("approve_content: another club's member approving a thread post", () =>
    fails(outsider().rpc('approve_content', { p_kind: 'thread_post', p_id: world().TP2 }), "another club's member approving a thread post"), T)
  test("approve_content: another club's member approving a member's club-only proposal", () =>
    fails(outsider().rpc('approve_content', { p_kind: 'project', p_id: world().P3 }), "another club's member approving a proposal"), T)
  test("send_back: another club's member sending a post back", () =>
    fails(outsider().rpc('send_back', { p_kind: 'update', p_id: secondWaiting, p_note: 'Add where you met' }), "another club's member sending back"), T)
  test("hide_content: another club's member hiding a post", () =>
    fails(outsider().rpc('hide_content', { p_kind: 'update', p_id: world().U2, p_reason: 'Off-topic' }), "another club's member hiding an update"), T)
  test("set_project_visibility: another club's member taking a project off the public site", () =>
    fails(outsider().rpc('set_project_visibility', { p_project: world().P1, p_visibility: 'club' }), "another club's member changing a project's visibility"), T)
  test("revoke_consent: another club's member withdrawing a consent record that has no student yet", () =>
    fails(outsider().rpc('revoke_consent', { p_consent: inviteConsent }), "another club's member withdrawing consent"), T)
  test("create_invite: another club's member inviting", () =>
    fails(outsider().rpc('create_invite', { p_club: world().club, p_band: '16-17' }), "another club's member inviting"), T)
  test("revoke_invite: another club's member cancelling an invite", () =>
    fails(outsider().rpc('revoke_invite', { p_invite: world().I1 }), "another club's member cancelling an invite"), T)
  test("set_member_role: another club's member promoting someone", () =>
    fails(outsider().rpc('set_member_role', { p_member: world().m.m17, p_role: 'lead' }), "another club's member changing a role"), T)
  test("remove_member: another club's member removing someone", () =>
    fails(outsider().rpc('remove_member', { p_member: world().m.m15 }), "another club's member removing a member"), T)
  test("record_consent: another club's member recording consent for a student", () =>
    fails(outsider().rpc('record_consent', { p_club: world().club, p_subject: PERSON.mem1, p_scope: 'photos', p_method: 'school_on_file' }), "another club's member recording consent"), T)
  test("handle_report: another club's member handling a report", () =>
    fails(outsider().rpc('handle_report', { p_report: world().RP1, p_status: 'dismissed' }), "another club's member handling a report"), T)
  test("club_roster: another club's member gets no roster", async () =>
    eq((await rowsOf(outsider().rpc('club_roster', { p_club: world().club }), 'the roster')).length, 0, "the roster another club's member sees"), T)
  test("going_counts: another club's member gets no count for a club-only event", async () =>
    eq((await rowsOf(outsider().rpc('going_counts', { p_events: [world().E2] }), 'the counts')).length, 0, "the counts another club's member sees"), T)
  test("rotate_join_code: another club's member making a new join code", () =>
    fails(outsider().rpc('rotate_join_code', { p_club: world().club }), "another club's member making a new join code"), T)
})
