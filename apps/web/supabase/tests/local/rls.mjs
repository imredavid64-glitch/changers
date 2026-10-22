#!/usr/bin/env node
// The access rules, checked on a real Postgres on this Mac before any hosted database exists.
// PGlite (Postgres compiled to WebAssembly) runs the five migrations on top of stub.sql (Supabase's roles, auth and
// storage), loads world.sql, then:
//   1. the matrix: every actor in docs/07-APP-SPEC.md §6 Tests × every table (and the member-names view and the
//      photo bucket) × select, insert, update and delete, each expected to be allowed or denied as §3 and §6 say;
//   2. the flows: each function in §6 with the rules it must hold (sign-up, clubs, codes, invites, consent,
//      approvals, RSVPs, verification, delete, export, the append-only tables).
// It is the local pre-check. The spec's own suite (npm run test:rls: Vitest + supabase-js against the dev project)
// replaces it once that project exists.
//   node supabase/tests/local/rls.mjs            PGLITE_DIR=<path to @electric-sql/pglite> to use another copy
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const migrations = path.join(here, '../../migrations')
// PGlite 0.3.16 (Apache-2.0) is already on this Mac inside netlify-cli's npx cache; nothing is downloaded.
const PGLITE = process.env.PGLITE_DIR ?? path.join(os.homedir(), '.npm/_npx/da5c1b6ea715e8b4/node_modules/@electric-sql/pglite')
const { PGlite } = await import(path.join(PGLITE, 'dist/index.js'))
const { pgcrypto } = await import(path.join(PGLITE, 'dist/contrib/pgcrypto.js'))
const { pg_trgm } = await import(path.join(PGLITE, 'dist/contrib/pg_trgm.js'))

const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm } })
const load = async (file) => {
  try { await db.exec(fs.readFileSync(file, 'utf8')) } catch (e) { console.error(`✗ ${path.basename(file)}: ${e.message}`); process.exit(1) }
}
await load(path.join(here, 'stub.sql'))
for (const f of fs.readdirSync(migrations).filter((n) => n.endsWith('.sql')).sort()) await load(path.join(migrations, f))
await load(path.join(here, 'world.sql'))
console.log(`✓ migrations applied: ${fs.readdirSync(migrations).filter((n) => n.endsWith('.sql')).length} files, world loaded`)

// ── Actors (07 §6 Tests) ───────────────────────────────────────────────────────────────────────────────────────
const U = (n) => `a0000000-0000-4000-8000-0000000000${n}`
const ID = { advisor: U('01'), lead: U('02'), m1617: U('03'), m1415: U('04'), unverified: U('05'), other: U('06'), admin: U('07'), advisorB: U('08'), waiting: U('09'), newAdult: U('0a'), newStudent: U('0b'), under13: U('0c') }
const A = 'c0000000-0000-4000-8000-000000000001', B = 'c0000000-0000-4000-8000-000000000002', C = 'c0000000-0000-4000-8000-000000000003'
const ACTORS = {
  anon: { role: 'anon' },
  member_1415: { id: ID.m1415, aal: 'aal1' },
  member_1617: { id: ID.m1617, aal: 'aal1' },
  lead: { id: ID.lead, aal: 'aal1' },
  advisor: { id: ID.advisor, aal: 'aal2' },
  advisor_aal1: { id: ID.advisor, aal: 'aal1' },
  unverified_adult: { id: ID.unverified, aal: 'aal2', email: 'unverified@school-c.example.test' },
  other_member: { id: ID.other, aal: 'aal1' },
  admin: { id: ID.admin, aal: 'aal2' },
  admin_aal1: { id: ID.admin, aal: 'aal1' },
}
const NAMES = Object.keys(ACTORS)
const who = (a) => (typeof a === 'string' ? ACTORS[a] : a)

// Run one statement as an actor, inside a savepoint (so a refusal doesn't end the transaction around it).
let sp = 0
async function as(actor, sql, params = [], keep = true) {
  const a = who(actor), name = `s${++sp}`
  await db.exec(`savepoint ${name}`)
  try {
    if (a.role === 'anon') {
      await db.exec('set local role anon')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })])
    } else if (a.role === 'service_role') {
      await db.exec('set local role service_role')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })])
    } else if (a.role === 'root') {
      await db.exec('reset role')
    } else {
      await db.exec('set local role authenticated')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: a.id, role: 'authenticated', aal: a.aal ?? 'aal1', email: a.email ?? `${a.id}@example.test` })])
    }
    const r = await db.query(sql, params)
    await db.exec(keep ? `release savepoint ${name}` : `rollback to savepoint ${name}`)
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? 0 }
  } catch (e) {
    await db.exec(`rollback to savepoint ${name}`)
    return { ok: false, rows: [], affected: 0, error: e.message }
  } finally {
    await db.exec('reset role')
  }
}
const ROOT = { role: 'root' }
const SERVICE = { role: 'service_role' }
async function isolated(fn) { await db.exec('begin'); try { return await fn() } finally { await db.exec('rollback') } }

// ── 1 · The matrix ────────────────────────────────────────────────────────────────────────────────────────────
// Each row: a target in the world, and for each operation the actors that may do it (everyone else must be refused).
// "self" in a statement becomes the actor's own id. Sources: 07 §3 (who may) and §6 (how it's enforced).
const MEMBERS_A = ['member_1415', 'member_1617', 'lead', 'advisor']
const STAFF_A = ['lead', 'advisor']
const ALL = NAMES
const T = [
  { t: 'profiles (a 13–15 member)', sel: `public.profiles where id = '${ID.m1415}'`, select: ['member_1415', 'admin'],
    insert: [`insert into public.profiles (id, display_name, age_band, country, conduct_accepted_at) values (self, 'Zed Z.', '16-17', 'HU', now())`, []],
    update: [`update public.profiles set display_name = 'Nina N.' where id = '${ID.m1415}'`, ['member_1415']],
    delete: [`delete from public.profiles where id = '${ID.m1415}'`, []] },
  { t: 'network_admins', sel: `public.network_admins where user_id = '${ID.admin}'`, select: ['admin', 'admin_aal1'],
    insert: [`insert into public.network_admins (user_id) values ('${ID.lead}')`, []],
    update: [`update public.network_admins set created_at = now() where user_id = '${ID.admin}'`, []],
    delete: [`delete from public.network_admins where user_id = '${ID.admin}'`, []] },
  { t: 'advisor_verifications', sel: `public.advisor_verifications where user_id = '${ID.unverified}'`, select: ['unverified_adult', 'admin'],
    insert: [`insert into public.advisor_verifications (user_id, school_name, school_domain) values (self, 'X School', 'x.example.test')`, []],
    update: [`update public.advisor_verifications set status = 'approved' where user_id = '${ID.unverified}'`, []],
    delete: [`delete from public.advisor_verifications where user_id = '${ID.unverified}'`, []] },
  { t: 'clubs (listed)', sel: `public.clubs where id = '${A}'`, select: ALL,
    insert: [`insert into public.clubs (slug, name, school_name, city, country, lat, lng) values ('x-club', 'X Club', 'X School', 'Vienna', 'AT', 48.21, 16.37)`, []],
    update: [`update public.clubs set description = 'Edited' where id = '${A}'`, ['lead', 'advisor', 'admin']],
    delete: [`delete from public.clubs where id = '${A}'`, []] },
  { t: 'clubs (pending, unlisted)', sel: `public.clubs where id = '${C}'`, select: ['unverified_adult', 'admin'],
    update: [`update public.clubs set description = 'Edited' where id = '${C}'`, ['admin']] },
  { t: 'club_codes', sel: `public.club_codes where club_id = '${A}'`, select: [...STAFF_A, 'admin'],
    insert: [`insert into public.club_codes (club_id, code_hash) values ('${B}', 'x')`, []],
    update: [`update public.club_codes set code_hash = 'x' where club_id = '${A}'`, []],
    delete: [`delete from public.club_codes where club_id = '${A}'`, []] },
  { t: 'club_members (an active member)', sel: `public.club_members where club_id = '${A}' and user_id = '${ID.m1617}'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.club_members (club_id, user_id, role, status, joined_via) values ('${A}', self, 'member', 'active', 'code')`, []],
    update: [`update public.club_members set role = 'lead' where club_id = '${A}' and user_id = '${ID.m1617}'`, []],
    delete: [`delete from public.club_members where club_id = '${A}' and user_id = '${ID.m1617}'`, []] },
  { t: 'club_members (a waiting request)', sel: `public.club_members where club_id = '${A}' and user_id = '${ID.waiting}'`, select: [...STAFF_A, 'admin'] },
  { t: 'consents', sel: `public.consents where id = '18000000-0000-4000-8000-000000000001'`, select: ['member_1415', 'advisor', 'admin'],
    insert: [`insert into public.consents (club_id, scope, method) values ('${A}', 'photos', 'self')`, []],
    update: [`update public.consents set method = 'self' where id = '18000000-0000-4000-8000-000000000001'`, []],
    delete: [`delete from public.consents where id = '18000000-0000-4000-8000-000000000001'`, []] },
  { t: 'invites', sel: `public.invites where id = '19000000-0000-4000-8000-000000000001'`, select: ['advisor', 'admin'],
    insert: [`insert into public.invites (club_id, token_hash, intended_band) values ('${A}', 'x', '16-17')`, []],
    update: [`update public.invites set expires_at = now() + interval '90 days' where id = '19000000-0000-4000-8000-000000000001'`, []],
    delete: [`delete from public.invites where id = '19000000-0000-4000-8000-000000000001'`, []] },
  { t: 'conference_hubs (live)', sel: `public.conference_hubs where id = '16000000-0000-4000-8000-000000000001'`, select: ALL },
  { t: 'conference_hubs (hidden)', sel: `public.conference_hubs where id = '16000000-0000-4000-8000-000000000002'`, select: ['advisor', 'admin'],
    insert: [`insert into public.conference_hubs (year, title, city, starts_on, ends_on) values (2031, 'Test hub 2031', 'Kaunas', '2031-03-01', '2031-03-03')`, ['admin']],
    update: [`update public.conference_hubs set title = 'Edited hub' where id = '16000000-0000-4000-8000-000000000002'`, ['advisor', 'admin']],
    delete: [`delete from public.conference_hubs where id = '16000000-0000-4000-8000-000000000002'`, ['admin']] },
  { t: 'projects (public, approved)', sel: `public.projects where id = 'b0000000-0000-4000-8000-000000000001'`, select: ALL },
  { t: 'projects (club-only)', sel: `public.projects where id = 'b0000000-0000-4000-8000-000000000002'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.projects (club_id, title, strand, status) values ('${A}', 'New project', 'nature', 'proposed')`, [...MEMBERS_A, 'admin']],
    update: [`update public.projects set title = 'Edited project' where id = 'b0000000-0000-4000-8000-000000000002'`, ['lead', 'advisor', 'admin']],
    delete: [`delete from public.projects where id = 'b0000000-0000-4000-8000-000000000002'`, []] },
  { t: "projects (a member's draft)", sel: `public.projects where id = 'b0000000-0000-4000-8000-000000000004'`, select: ['member_1415', ...STAFF_A, 'admin'],
    update: [`update public.projects set title = 'Edited draft' where id = 'b0000000-0000-4000-8000-000000000004'`, ['member_1415', ...STAFF_A, 'admin']] },
  { t: 'project_members', sel: `public.project_members where project_id = 'b0000000-0000-4000-8000-000000000002' and user_id = '${ID.lead}'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.project_members (project_id, user_id) values ('b0000000-0000-4000-8000-000000000002', '${ID.m1617}')`, ['lead', 'advisor', 'admin']],
    update: [`update public.project_members set role = 'member' where project_id = 'b0000000-0000-4000-8000-000000000002' and user_id = '${ID.lead}'`, ['lead', 'advisor', 'admin']],
    delete: [`delete from public.project_members where project_id = 'b0000000-0000-4000-8000-000000000002' and user_id = '${ID.lead}'`, ['lead', 'advisor', 'admin']] },
  { t: 'project_tasks', sel: `public.project_tasks where id = '22000000-0000-4000-8000-000000000001'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.project_tasks (project_id, title) values ('b0000000-0000-4000-8000-000000000002', 'New task')`, ['lead', 'advisor', 'admin']],
    update: [`update public.project_tasks set state = 'doing' where id = '22000000-0000-4000-8000-000000000001'`, ['lead', 'advisor', 'admin']],
    delete: [`delete from public.project_tasks where id = '22000000-0000-4000-8000-000000000001'`, ['lead', 'advisor', 'admin']] },
  { t: 'events (public)', sel: `public.events where id = 'e0000000-0000-4000-8000-000000000001'`, select: ALL },
  { t: 'events (hub, live)', sel: `public.events where id = 'e0000000-0000-4000-8000-000000000005'`, select: ALL },
  { t: 'events (club-only)', sel: `public.events where id = 'e0000000-0000-4000-8000-000000000002'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.events (club_id, title, starts_at, ends_at, tz, mode, city, visibility) values ('${A}', 'New event', now() + interval '7 days', now() + interval '7 days 2 hours', 'Europe/Budapest', 'in_person', 'Budapest', 'club')`, [...STAFF_A, 'admin']],
    update: [`update public.events set title = 'Edited event' where id = 'e0000000-0000-4000-8000-000000000002'`, [...STAFF_A, 'admin']],
    delete: [`delete from public.events where id = 'e0000000-0000-4000-8000-000000000002'`, []] },
  { t: 'events (public, waiting for an advisor)', sel: `public.events where id = 'e0000000-0000-4000-8000-000000000003'`, select: [...STAFF_A, 'admin'] },
  { t: 'event_links (exact place, online link)', sel: `public.event_links where event_id = 'e0000000-0000-4000-8000-000000000002'`, select: ['member_1617', ...STAFF_A, 'admin'],
    insert: [`insert into public.event_links (event_id, place_detail) values ('e0000000-0000-4000-8000-000000000001', 'Room 4')`, [...STAFF_A, 'admin']],
    update: [`update public.event_links set place_detail = 'Room 9' where event_id = 'e0000000-0000-4000-8000-000000000002'`, [...STAFF_A, 'admin']],
    delete: [`delete from public.event_links where event_id = 'e0000000-0000-4000-8000-000000000002'`, [...STAFF_A, 'admin']] },
  { t: 'rsvps', sel: `public.rsvps where id = '23000000-0000-4000-8000-000000000001'`, select: ['member_1617', ...STAFF_A, 'admin'],
    insert: [`insert into public.rsvps (event_id, user_id) values ('e0000000-0000-4000-8000-000000000002', self)`, []],
    update: [`update public.rsvps set status = 'cancelled' where id = '23000000-0000-4000-8000-000000000001'`, ['member_1617']],
    delete: [`delete from public.rsvps where id = '23000000-0000-4000-8000-000000000001'`, []] },
  { t: 'updates (public, approved)', sel: `public.updates where id = 'd0000000-0000-4000-8000-000000000001'`, select: ALL },
  { t: 'updates (club-only)', sel: `public.updates where id = 'd0000000-0000-4000-8000-000000000002'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.updates (club_id, body) values ('${A}', 'Hello club')`, MEMBERS_A] },
  { t: 'updates (waiting for approval)', sel: `public.updates where id = 'd0000000-0000-4000-8000-000000000003'`, select: ['member_1415', ...STAFF_A, 'admin'],
    update: [`update public.updates set body = 'Edited' where id = 'd0000000-0000-4000-8000-000000000003'`, ['member_1415']],
    delete: [`delete from public.updates where id = 'd0000000-0000-4000-8000-000000000003'`, ['member_1415']] },
  { t: 'media (approved for public use)', sel: `public.media where id = 'f0000000-0000-4000-8000-000000000002'`, select: ALL },
  { t: 'media (approved, club-only)', sel: `public.media where id = 'f0000000-0000-4000-8000-000000000001'`, select: [...MEMBERS_A, 'admin'] },
  { t: 'media (waiting for the advisor)', sel: `public.media where id = 'f0000000-0000-4000-8000-000000000003'`, select: ['member_1617', ...STAFF_A, 'admin'],
    insert: [`insert into public.media (club_id, path_large, path_small, width, height) values ('${A}', 'clubs/${A}/f0000000-0000-4000-8000-0000000000ff-large.webp', 'clubs/${A}/f0000000-0000-4000-8000-0000000000ff-small.webp', 10, 10)`, []],
    update: [`update public.media set alt = 'x' where id = 'f0000000-0000-4000-8000-000000000003'`, []],
    delete: [`delete from public.media where id = 'f0000000-0000-4000-8000-000000000003'`, [...STAFF_A, 'admin']] },
  { t: 'storage: a club photo (approved)', sel: `storage.objects where name like '%f0000000-0000-4000-8000-000000000001-large.webp'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into storage.objects (bucket_id, name) values ('club-media', 'clubs/${A}/x-large.webp')`, []],
    update: [`update storage.objects set name = 'x' where name like '%f0000000-0000-4000-8000-000000000001-large.webp'`, []],
    delete: [`delete from storage.objects where name like '%f0000000-0000-4000-8000-000000000001-large.webp'`, []] },
  { t: 'storage: a photo waiting for the advisor', sel: `storage.objects where name like '%f0000000-0000-4000-8000-000000000003-large.webp'`, select: ['member_1617', ...STAFF_A, 'admin'] },
  { t: 'threads', sel: `public.threads where id = '10000000-0000-4000-8000-000000000001'`, select: MEMBERS_A,
    insert: [`insert into public.threads (club_id, title) values ('${A}', 'New thread')`, MEMBERS_A],
    update: [`update public.threads set title = 'Edited thread' where id = '10000000-0000-4000-8000-000000000001'`, STAFF_A],
    delete: [`delete from public.threads where id = '10000000-0000-4000-8000-000000000001'`, []] },
  { t: 'thread_posts (published)', sel: `public.thread_posts where id = '11000000-0000-4000-8000-000000000001'`, select: MEMBERS_A,
    insert: [`insert into public.thread_posts (thread_id, body) values ('10000000-0000-4000-8000-000000000001', 'Hi all')`, MEMBERS_A],
    delete: [`delete from public.thread_posts where id = '11000000-0000-4000-8000-000000000001'`, []] },
  { t: 'thread_posts (waiting)', sel: `public.thread_posts where id = '11000000-0000-4000-8000-000000000002'`, select: ['member_1415', ...STAFF_A],
    update: [`update public.thread_posts set body = 'Edited' where id = '11000000-0000-4000-8000-000000000002'`, ['member_1415']] },
  { t: 'club_member_names (view)', sel: `public.club_member_names where club_id = '${A}' and user_id = '${ID.m1617}'`, select: [...MEMBERS_A, 'admin'] },
  { t: 'resources (published)', sel: `public.resources where id = '12000000-0000-4000-8000-000000000001'`, select: ALL },
  { t: 'resources (draft)', sel: `public.resources where id = '12000000-0000-4000-8000-000000000002'`, select: ['admin'],
    insert: [`insert into public.resources (strand, title, url, source_name) values ('nature', 'New guide', 'https://example.test/new', 'Example')`, ['admin']],
    update: [`update public.resources set title = 'Edited guide' where id = '12000000-0000-4000-8000-000000000002'`, ['admin']],
    delete: [`delete from public.resources where id = '12000000-0000-4000-8000-000000000002'`, ['admin']] },
  { t: 'reports (about a student)', sel: `public.reports where id = '13000000-0000-4000-8000-000000000001'`, select: ['member_1617', 'advisor', 'admin'],
    insert: [`insert into public.reports (target_type, target_id, reason) values ('club', '${A}', 'spam')`, []],
    update: [`update public.reports set status = 'dismissed' where id = '13000000-0000-4000-8000-000000000001'`, []],
    delete: [`delete from public.reports where id = '13000000-0000-4000-8000-000000000001'`, []] },
  { t: 'reports (child safety, about the advisor)', sel: `public.reports where id = '13000000-0000-4000-8000-000000000002'`, select: ['member_1415', 'admin'] },
  { t: 'audit_log', sel: `public.audit_log where id = '14000000-0000-4000-8000-000000000001'`, select: ['admin'],
    insert: [`insert into public.audit_log (action) values ('x.y')`, []],
    update: [`update public.audit_log set action = 'x.y' where id = '14000000-0000-4000-8000-000000000001'`, []],
    delete: [`delete from public.audit_log where id = '14000000-0000-4000-8000-000000000001'`, []] },
  { t: 'notifications', sel: `public.notifications where id = '15000000-0000-4000-8000-000000000001'`, select: ['member_1617'],
    insert: [`insert into public.notifications (user_id, kind) values (self, 'x.y')`, []],
    update: [`update public.notifications set read_at = now() where id = '15000000-0000-4000-8000-000000000001'`, ['member_1617']],
    delete: [`delete from public.notifications where id = '15000000-0000-4000-8000-000000000001'`, ['member_1617']] },
  { t: 'contact_messages', sel: `public.contact_messages where id = '17000000-0000-4000-8000-000000000001'`, select: ['advisor', 'admin'],
    insert: [`insert into public.contact_messages (club_id, sender_name, sender_email, body) values ('${A}', 'X', 'x@example.test', 'Hi')`, []],
    update: [`update public.contact_messages set status = 'read' where id = '17000000-0000-4000-8000-000000000001'`, ['advisor', 'admin']],
    delete: [`delete from public.contact_messages where id = '17000000-0000-4000-8000-000000000001'`, []] },
  { t: 'flagged_words', sel: `public.flagged_words where word = 'badword'`, select: ['admin'],
    insert: [`insert into public.flagged_words (word) values ('worseword')`, ['admin']],
    update: [`update public.flagged_words set created_at = now() where word = 'badword'`, []],
    delete: [`delete from public.flagged_words where word = 'badword'`, ['admin']] },
  // R1b · 6 (club features)
  { t: 'project_impacts (a public project\'s)', sel: `public.project_impacts where id = '25000000-0000-4000-8000-000000000001'`, select: ALL,
    insert: [`insert into public.project_impacts (project_id, label, value) values ('b0000000-0000-4000-8000-000000000001', 'trees planted', 12)`, ['member_1617', ...STAFF_A, 'admin']],
    update: [`update public.project_impacts set value = 413 where id = '25000000-0000-4000-8000-000000000001'`, ['member_1617', ...STAFF_A, 'admin']],
    delete: [`delete from public.project_impacts where id = '25000000-0000-4000-8000-000000000001'`, ['member_1617', ...STAFF_A, 'admin']] },
  { t: 'project_impacts (a club-only project\'s)', sel: `public.project_impacts where id = '25000000-0000-4000-8000-000000000002'`, select: [...MEMBERS_A, 'admin'] },
  { t: 'project_links', sel: `public.project_links where id = '26000000-0000-4000-8000-000000000001'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.project_links (project_id, label, url) values ('b0000000-0000-4000-8000-000000000002', 'Slides', 'https://slides.example.test/x')`, [...STAFF_A, 'admin']],
    update: [`update public.project_links set label = 'Our plan (new)' where id = '26000000-0000-4000-8000-000000000001'`, [...STAFF_A, 'admin']],
    delete: [`delete from public.project_links where id = '26000000-0000-4000-8000-000000000001'`, [...STAFF_A, 'admin']] },
  { t: 'club_follows (another club\'s member follows A)', sel: `public.club_follows where user_id = '${ID.other}'`, select: ['other_member'],
    insert: [`insert into public.club_follows (club_id) values ('${B}')`, MEMBERS_A.concat(['other_member', 'unverified_adult', 'admin', 'admin_aal1', 'advisor_aal1'])],
    delete: [`delete from public.club_follows where user_id = '${ID.other}'`, ['other_member']] },
  { t: 'polls', sel: `public.polls where id = '27000000-0000-4000-8000-000000000001'`, select: [...MEMBERS_A, 'admin'],
    insert: [`insert into public.polls (thread_id, question, options) values ('10000000-0000-4000-8000-000000000001', 'Pizza or pasta?', array['Pizza', 'Pasta'])`, MEMBERS_A],
    delete: [`delete from public.polls where id = '27000000-0000-4000-8000-000000000001'`, STAFF_A] },
  { t: 'poll_votes (a member\'s vote)', sel: `public.poll_votes where poll_id = '27000000-0000-4000-8000-000000000001' and user_id = '${ID.m1617}'`, select: ['member_1617'],
    insert: [`insert into public.poll_votes (poll_id, choice) values ('27000000-0000-4000-8000-000000000001', 0)`, ['member_1415', 'lead', 'advisor']],
    update: [`update public.poll_votes set choice = 0 where poll_id = '27000000-0000-4000-8000-000000000001' and user_id = '${ID.m1617}'`, ['member_1617']],
    delete: [`delete from public.poll_votes where poll_id = '27000000-0000-4000-8000-000000000001' and user_id = '${ID.m1617}'`, ['member_1617']] },
  { t: 'app.counters', sel: `app.counters`, select: [] },
]

let pass = 0
const fails = []
const check = (label, ok, detail) => { if (ok) pass++; else fails.push(`${label}${detail ? ` → ${detail}` : ''}`) }

await isolated(async () => {
  await as(ROOT, `insert into app.counters (name, n) values ('probe', 1)`)
  for (const row of T) {
    for (const name of NAMES) {
      const actor = ACTORS[name]
      const self = actor.id ? `'${actor.id}'` : 'gen_random_uuid()'
      // select: can this actor see the target?
      const s = await as(actor, `select count(*)::int as n from ${row.sel}`, [], false)
      const seen = s.ok && s.rows[0]?.n > 0
      check(`${row.t} · select · ${name}`, seen === row.select.includes(name), `expected ${row.select.includes(name) ? 'allow' : 'deny'}, got ${seen ? 'allow' : 'deny'}${s.ok ? '' : ` (${s.error})`}`)
      for (const op of ['insert', 'update', 'delete']) {
        if (!row[op]) continue
        const [sql, allowed] = row[op]
        const r = await as(actor, sql.replaceAll('self', self), [], false)
        const did = r.ok && r.affected > 0
        check(`${row.t} · ${op} · ${name}`, did === allowed.includes(name), `expected ${allowed.includes(name) ? 'allow' : 'deny'}, got ${did ? 'allow' : 'deny'}${r.ok ? '' : ` (${r.error})`}`)
      }
    }
  }
})
const matrixCount = pass + fails.length
console.log(`${fails.length ? '✗' : '✓'} matrix: ${pass}/${matrixCount} checks (${T.length} targets × ${NAMES.length} actors × the operations each target has)`)

// ── 2 · The flows ─────────────────────────────────────────────────────────────────────────────────────────────
const flows = []
const flow = (name, fn) => flows.push({ name, fn })
const expectOk = (r, what) => { if (!r.ok) throw new Error(`${what}: ${r.error}`) }
const expectDenied = (r, what) => { if (r.ok && (r.affected > 0 || r.rows.length > 0) && !r.rows.every((x) => Object.values(x).every((v) => v === null))) throw new Error(`${what}: expected a refusal, got ${JSON.stringify(r.rows).slice(0, 160)}`) }
const expectErr = (r, what) => { if (r.ok) throw new Error(`${what}: expected an error, got ${JSON.stringify(r.rows).slice(0, 160)}`) }
const one = async (actor, sql) => { const r = await as(actor, sql); expectOk(r, sql.slice(0, 60)); return r.rows[0] }
const NEW_ADULT = { id: ID.newAdult, aal: 'aal1', email: 'new-adult@school-a.example.test' }
const NEW_STUDENT = { id: ID.newStudent, aal: 'aal1', email: 'new-student@example.test' }
const UNDER13 = { id: ID.under13, aal: 'aal1' }

flow('sign-up: 13–15 can\'t sign up without an invite; 16–17 and adults can, once', async () => {
  expectErr(await as(NEW_STUDENT, `select public.complete_signup('Kai K.', '13-15', 'HU', true)`), '13–15 without invite')
  expectErr(await as(NEW_STUDENT, `select public.complete_signup('Kai K.', '16-17', 'HU', false)`), 'without the code of conduct')
  expectErr(await as(NEW_STUDENT, `select public.complete_signup('Kai Kovacs', '16-17', 'HU', true)`), 'a full name')
  expectOk(await as(NEW_STUDENT, `select public.complete_signup('Kai K.', '16-17', 'hu', true)`), '16–17 sign-up')
  expectErr(await as(NEW_STUDENT, `select public.complete_signup('Kai K.', '16-17', 'HU', true)`), 'a second sign-up')
  const p = await one(NEW_STUDENT, `select display_name, age_band, country from public.profiles where id = '${ID.newStudent}'`)
  if (p.country !== 'HU' || p.age_band !== '16-17') throw new Error(`profile ${JSON.stringify(p)}`)
})
flow('under 13: the new sign-in is deleted and only a count is kept', async () => {
  expectOk(await as(UNDER13, `select public.decline_under_13()`), 'decline')
  const u = await one(ROOT, `select count(*)::int as n from auth.users where id = '${ID.under13}'`)
  const c = await one(ROOT, `select n from app.counters where name = 'under_13_declined'`)
  if (u.n !== 0 || c.n !== 1) throw new Error(`users ${u.n}, count ${c?.n}`)
  expectErr(await as('member_1617', `select public.decline_under_13()`), 'an existing account')
  expectOk(await as(NEW_STUDENT, `select public.decline_signup('under_16_no_invite')`), '13–15 without an invite')
  const s = await one(ROOT, `select (select count(*) from auth.users where id = '${ID.newStudent}')::int as users, (select n from app.counters where name = 'signup_declined_under_16_no_invite')::int as n`)
  if (s.users !== 0 || s.n !== 1) throw new Error(`13–15 decline: users ${s.users}, count ${s.n}`)
  expectErr(await as('member_1617', `select public.decline_signup('under_13')`), 'an existing account (decline_signup)')
})
flow('the age band only moves up', async () => {
  expectOk(await as('member_1415', `update public.profiles set age_band = '16-17' where id = '${ID.m1415}'`), 'up')
  expectErr(await as('member_1617', `update public.profiles set age_band = '13-15' where id = '${ID.m1617}'`), 'down')
  expectErr(await as('member_1617', `update public.profiles set age_band = 'adult' where id = '${ID.m1617}'`), 'adult while a student member')
  expectDenied(await as('member_1617', `update public.profiles set is_verified_adult = true where id = '${ID.m1617}'`), 'is_verified_adult')
})
flow('a club: 13–15 can\'t start one; a 16–17 student becomes lead; it stays pending and unlisted', async () => {
  expectErr(await as('member_1415', `select * from public.create_club('Kids Club', 'X School', 'Pécs', 'HU', 46.0727, 18.2323)`), '13–15')
  const c = await one('member_1617', `select * from public.create_club('Green Team', 'Test School A', 'Budapest', 'HU', 47.4979, 19.0402)`)
  if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c.join_code)) throw new Error(`code ${c.join_code}`)
  const club = await one(ROOT, `select status, lat::text, lng::text, slug from public.clubs where id = '${c.club_id}'`)
  if (club.status !== 'pending' || club.lat !== '47.50' || club.lng !== '19.04') throw new Error(`club ${JSON.stringify(club)}`)
  const m = await one(ROOT, `select role, status from public.club_members where club_id = '${c.club_id}' and user_id = '${ID.m1617}'`)
  if (m.role !== 'lead' || m.status !== 'active') throw new Error(`membership ${JSON.stringify(m)}`)
  const seen = await one('anon', `select count(*)::int as n from public.clubs where id = '${c.club_id}'`)
  if (seen.n !== 0) throw new Error('a pending club is visible to visitors')
  const hash = await one(ROOT, `select code_hash from public.club_codes where club_id = '${c.club_id}'`)
  if (hash.code_hash === c.join_code) throw new Error('the code is stored in clear')
})
flow('a club changing its school, city or country goes back to verification', async () => {
  expectOk(await as('lead', `update public.clubs set city = 'Debrecen', lat = 47.53, lng = 21.63 where id = '${A}'`), 'move')
  const c = await one(ROOT, `select status from public.clubs where id = '${A}'`)
  if (c.status !== 'pending') throw new Error(`status ${c.status}`)
  expectErr(await as('lead', `update public.clubs set pre_approval = false where id = '${A}'`), 'a lead switching pre-approval')
  expectDenied(await as('lead', `update public.clubs set status = 'verified' where id = '${A}'`), 'a lead verifying')
})
flow('join with code: 16–17 only, held pending; a lead approves 16–17; members can\'t', async () => {
  const W = { id: ID.newStudent, aal: 'aal1' }
  await one(W, `select public.complete_signup('Kai K.', '16-17', 'HU', true)`)
  expectErr(await as(W, `select * from public.join_with_code('WRONG-CODE')`), 'a wrong code')
  const j = await one(W, `select * from public.join_with_code('test-aaaa')`)
  if (j.status !== 'pending') throw new Error(`status ${j.status}`)
  expectErr(await as('member_1415', `select * from public.join_with_code('TEST-AAAA')`), '13–15 by code')
  expectErr(await as('advisor', `select * from public.join_with_code('TEST-CCCC')`), 'an adult by code')
  const id = (await one(ROOT, `select id from public.club_members where club_id = '${A}' and user_id = '${ID.newStudent}'`)).id
  expectErr(await as('member_1617', `select public.approve_member('${id}')`), 'a member approving')
  expectErr(await as('advisor_aal1', `select public.approve_member('${id}')`), 'an advisor without the second factor')
  expectOk(await as('lead', `select public.approve_member('${id}')`), 'the lead approving')
  const n = await one(W, `select count(*)::int as n from public.notifications where user_id = '${ID.newStudent}' and kind = 'join.approved'`)
  if (n.n !== 1) throw new Error('no notification')
})
flow('invites: under 16 needs a recorded consent first; the link works once and makes an active member', async () => {
  expectErr(await as('advisor', `select * from public.create_invite('${A}', '13-15')`), 'no consent')
  expectErr(await as('lead', `select * from public.create_invite('${A}', '16-17')`), 'a lead inviting')
  expectErr(await as('advisor_aal1', `select * from public.create_invite('${A}', '16-17')`), 'aal1 inviting')
  const inv = await one('advisor', `select * from public.create_invite('${A}', '13-15', 'parent_email')`)
  const r = await one(NEW_STUDENT, `select * from public.redeem_invite('${inv.token}', 'Kai K.', 'HU', true)`)
  if (r.club_slug !== 'test-club-a') throw new Error(`slug ${r.club_slug}`)
  const p = await one(ROOT, `select age_band from public.profiles where id = '${ID.newStudent}'`)
  const m = await one(ROOT, `select status, role, joined_via from public.club_members where club_id = '${A}' and user_id = '${ID.newStudent}'`)
  const k = await one(ROOT, `select subject_user_id from public.consents where id = (select consent_id from public.invites where id = '${inv.invite_id}')`)
  if (p.age_band !== '13-15' || m.status !== 'active' || m.role !== 'member' || k.subject_user_id !== ID.newStudent) throw new Error(`${JSON.stringify({ p, m, k })}`)
  expectErr(await as(NEW_ADULT, `select * from public.redeem_invite('${inv.token}', 'Ola O.', 'HU', true)`), 'the same link twice')
  await as(ROOT, `update public.invites set expires_at = now() - interval '1 minute' where id = '19000000-0000-4000-8000-000000000001'`)
  expectErr(await as(NEW_ADULT, `select * from public.redeem_invite('test-token-1617', 'Ola O.', 'HU', true)`), 'an expired link')
})
flow('consent: under 16 the advisor records it; from 16 the student; nobody edits or deletes it', async () => {
  expectOk(await as('advisor', `select public.record_consent('${A}', '${ID.m1415}', 'public_credit', 'school_on_file')`), 'advisor for 13–15')
  expectErr(await as('member_1415', `select public.record_consent('${A}', '${ID.m1415}', 'photos', 'self')`), '13–15 for themself')
  expectErr(await as('advisor', `select public.record_consent('${A}', '${ID.m1617}', 'photos', 'parent_email')`), 'advisor for 16–17')
  expectOk(await as('member_1617', `select public.record_consent('${A}', '${ID.m1617}', 'photos', 'self')`), '16–17 for themself')
  expectOk(await as('member_1415', `select public.revoke_consent('18000000-0000-4000-8000-000000000002')`), 'withdrawing')
  const n = await one(ROOT, `select count(*)::int as n from public.consents where revokes = '18000000-0000-4000-8000-000000000002'`)
  if (n.n !== 1) throw new Error('no withdrawal row')
  expectErr(await as(SERVICE, `update public.consents set method = 'self' where id = '18000000-0000-4000-8000-000000000001'`), 'the secret key editing consent')
  expectErr(await as(SERVICE, `delete from public.consents where id = '18000000-0000-4000-8000-000000000001'`), 'the secret key deleting consent')
})
flow('posts wait for approval: students by default; a link or flagged word always; an advisor\'s own post doesn\'t', async () => {
  const s = await one('member_1617', `insert into public.updates (club_id, body) values ('${A}', 'Plain text') returning status, approved_by`)
  if (s.status !== 'pending') throw new Error(`student post ${s.status}`)
  const v = await one('advisor', `insert into public.updates (club_id, body, visibility) values ('${A}', 'From the advisor', 'public') returning status, approved_by`)
  if (v.status !== 'published' || v.approved_by !== ID.advisor) throw new Error(`advisor post ${JSON.stringify(v)}`)
  await as(ROOT, `update public.clubs set pre_approval = false where id = '${A}'`)
  const f = await one('member_1617', `insert into public.updates (club_id, body) values ('${A}', 'Plain text again') returning status`)
  const l = await one('member_1617', `insert into public.updates (club_id, body) values ('${A}', 'see example.com/x') returning status, has_link`)
  const w = await one('member_1617', `insert into public.updates (club_id, body) values ('${A}', 'what a badword') returning status`)
  const p = await one('member_1617', `insert into public.updates (club_id, body, visibility) values ('${A}', 'For everyone', 'public') returning status`)
  if (f.status !== 'published' || l.status !== 'pending' || !l.has_link || w.status !== 'pending' || p.status !== 'pending') throw new Error(JSON.stringify({ f, l, w, p }))
  const t = await one('member_1617', `insert into public.thread_posts (thread_id, body) values ('10000000-0000-4000-8000-000000000001', 'www.example.com') returning status`)
  if (t.status !== 'pending') throw new Error(`thread post with a link ${t.status}`)
  // Luke, 11 Oct: a plain reply posts at once, even with the club's pre-approval on.
  await as(ROOT, `update public.clubs set pre_approval = true where id = '${A}'`)
  const r = await one('member_1415', `insert into public.thread_posts (thread_id, body) values ('10000000-0000-4000-8000-000000000001', 'Count me in') returning status`)
  const b = await one('member_1415', `insert into public.thread_posts (thread_id, body) values ('10000000-0000-4000-8000-000000000001', 'such a badword') returning status`)
  if (r.status !== 'published' || b.status !== 'pending') throw new Error(`plain reply ${r.status}, flagged reply ${b.status}`)
})
flow('approvals: a lead approves members\' club-only text, never their own and never anything public; advisors approve the rest', async () => {
  const own = await one('lead', `insert into public.updates (club_id, body) values ('${A}', 'From the lead') returning id`)
  expectErr(await as('lead', `select public.approve_content('update', '${own.id}')`), 'a lead approving their own')
  expectErr(await as('member_1617', `select public.approve_content('update', 'd0000000-0000-4000-8000-000000000003')`), 'a member approving')
  expectOk(await as('lead', `select public.approve_content('update', 'd0000000-0000-4000-8000-000000000003')`), 'a lead approving club text')
  const pub = await one('member_1617', `insert into public.updates (club_id, body, visibility) values ('${A}', 'For everyone', 'public') returning id`)
  expectErr(await as('lead', `select public.approve_content('update', '${pub.id}')`), 'a lead approving public')
  expectErr(await as('advisor_aal1', `select public.approve_content('update', '${pub.id}')`), 'an advisor without the second factor')
  expectOk(await as('advisor', `select public.approve_content('update', '${pub.id}')`), 'the advisor approving public')
  const seen = await one('anon', `select count(*)::int as n from public.updates where id = '${pub.id}'`)
  if (seen.n !== 1) throw new Error('an approved public update is not public')
  expectOk(await as('lead', `select public.approve_content('project', 'b0000000-0000-4000-8000-000000000003')`), 'a lead approving a member\'s proposal')
  const leadProp = await one('lead', `insert into public.projects (club_id, title, strand, status) values ('${A}', 'Lead proposal', 'nature', 'proposed') returning id`)
  expectErr(await as('lead', `select public.approve_content('project', '${leadProp.id}')`), 'a lead approving their own proposal')
  expectOk(await as('advisor', `select public.approve_content('project', '${leadProp.id}')`), 'the advisor approving the lead\'s proposal')
  expectOk(await as('advisor', `select public.send_back('update', '${own.id}', 'Add where you met')`), 'send back')
  const back = await one('lead', `select status from public.updates where id = '${own.id}'`)
  if (back.status !== 'draft') throw new Error(`sent back ${back.status}`)
  expectOk(await as('advisor', `select public.approve_content('media', 'f0000000-0000-4000-8000-000000000003', 'A poster on the wall')`), 'a photo with its alt text')
  expectOk(await as('lead', `select public.approve_content('thread_post', '11000000-0000-4000-8000-000000000002')`), 'a lead approving a member\'s thread post')
})
flow('projects: students start drafts or proposals; only an advisor makes one public; edits to public text reset approval', async () => {
  expectErr(await as('member_1617', `insert into public.projects (club_id, title, strand, status) values ('${A}', 'Straight to active', 'nature', 'active')`), 'a student starting active')
  expectErr(await as('member_1617', `update public.projects set status = 'active' where id = 'b0000000-0000-4000-8000-000000000003'`), 'a student approving by editing')
  expectErr(await as('lead', `select public.set_project_visibility('b0000000-0000-4000-8000-000000000002', 'public')`), 'a lead making it public')
  expectOk(await as('advisor', `select public.set_project_visibility('b0000000-0000-4000-8000-000000000002', 'public')`), 'the advisor making it public')
  let seen = await one('anon', `select count(*)::int as n from public.projects where id = 'b0000000-0000-4000-8000-000000000002'`)
  if (seen.n !== 1) throw new Error('not public after the advisor')
  expectOk(await as('lead', `update public.projects set problem = 'A new problem text' where id = 'b0000000-0000-4000-8000-000000000002'`), 'the team editing public text')
  seen = await one('anon', `select count(*)::int as n from public.projects where id = 'b0000000-0000-4000-8000-000000000002'`)
  if (seen.n !== 0) throw new Error('still public after an edit')
  expectOk(await as('advisor', `select public.approve_content('project', 'b0000000-0000-4000-8000-000000000002')`), 're-approval')
  seen = await one('anon', `select count(*)::int as n from public.projects where id = 'b0000000-0000-4000-8000-000000000002'`)
  if (seen.n !== 1) throw new Error('not public after re-approval')
  expectErr(await as('member_1617', `update public.projects set deleted_at = now() where id = 'b0000000-0000-4000-8000-000000000001'`), 'a member removing a project')
  const team = await one('member_1617', `insert into public.projects (club_id, title, strand) values ('${A}', 'My draft', 'nature') returning id`)
  const owner = await one(ROOT, `select role from public.project_members where project_id = '${team.id}' and user_id = '${ID.m1617}'`)
  if (owner?.role !== 'owner') throw new Error('the starter isn\'t its owner')
})
flow('events: a lead\'s public event waits for an advisor; the exact place shows only after an RSVP', async () => {
  const e = await one('lead', `insert into public.events (club_id, title, starts_at, ends_at, tz, mode, city, visibility) values ('${A}', 'Open day', now() + interval '3 days', now() + interval '3 days 1 hour', 'Europe/Budapest', 'in_person', 'Budapest', 'public') returning id, status`)
  if (e.status !== 'pending') throw new Error(`lead's public event ${e.status}`)
  expectErr(await as('lead', `update public.events set status = 'published' where id = '${e.id}'`), 'a lead publishing it')
  expectOk(await as('advisor', `select public.approve_content('event', '${e.id}')`), 'the advisor approving')
  const before = await one('member_1415', `select count(*)::int as n from public.event_links where event_id = 'e0000000-0000-4000-8000-000000000002'`)
  expectOk(await as('member_1415', `select public.rsvp('e0000000-0000-4000-8000-000000000002')`), 'RSVP')
  const after = await one('member_1415', `select count(*)::int as n from public.event_links where event_id = 'e0000000-0000-4000-8000-000000000002'`)
  if (before.n !== 0 || after.n !== 1) throw new Error(`links before ${before.n}, after ${after.n}`)
  expectErr(await as('other_member', `select public.rsvp('e0000000-0000-4000-8000-000000000002')`), 'another club\'s member RSVPing to a club-only event')
  expectErr(await as('anon', `select public.rsvp('e0000000-0000-4000-8000-000000000001')`), 'a visitor RSVPing')
})
flow('RSVP capacity: the third person waits; a cancellation moves them up', async () => {
  // Club event capacity 2: member_1617 is going already.
  const a = await one('member_1415', `select public.rsvp('e0000000-0000-4000-8000-000000000002') as s`)
  const b = await one('lead', `select public.rsvp('e0000000-0000-4000-8000-000000000002') as s`)
  if (a.s !== 'going' || b.s !== 'waitlist') throw new Error(`${a.s}, ${b.s}`)
  expectOk(await as('member_1617', `update public.rsvps set status = 'cancelled' where id = '23000000-0000-4000-8000-000000000001'`), 'cancel')
  const c = await one(ROOT, `select status from public.rsvps where event_id = 'e0000000-0000-4000-8000-000000000002' and user_id = '${ID.lead}'`)
  if (c.status !== 'going') throw new Error(`waitlist ${c.status}`)
})
flow('going counts: a visitor sees how many are going to a public event, never to a club-only one, and never who', async () => {
  await as(ROOT, `insert into public.rsvps (event_id, user_id, status) values ('e0000000-0000-4000-8000-000000000001', '${ID.m1617}', 'going')`)
  const pub = await as('anon', `select * from public.going_counts(array['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002']::uuid[])`)
  expectOk(pub, 'visitor counts')
  if (pub.rows.length !== 1 || pub.rows[0].going !== 1) throw new Error(`visitor sees ${JSON.stringify(pub.rows)}`)
  const mem = await one('member_1415', `select going from public.going_counts(array['e0000000-0000-4000-8000-000000000002']::uuid[])`)
  if (mem?.going !== 1) throw new Error(`member sees ${JSON.stringify(mem)}`)
  expectErr(await as('anon', `select count(*) from public.rsvps`), 'a visitor reading the list')
})
flow('outsiders: another club\'s member gets "no" from every club function (no NULL slips through)', async () => {
  const X = 'other_member'
  const tries = [
    [`select public.rotate_join_code('${A}')`, 'rotate the code'],
    [`select public.approve_member('24000000-0000-4000-8000-000000000005')`, 'approve a request'],
    [`select public.approve_content('update', 'd0000000-0000-4000-8000-000000000003')`, 'approve club text'],
    [`select public.approve_content('thread_post', '11000000-0000-4000-8000-000000000002')`, 'approve a thread post'],
    [`select public.approve_content('project', 'b0000000-0000-4000-8000-000000000003')`, 'approve a proposal'],
    [`select public.send_back('update', 'd0000000-0000-4000-8000-000000000003', 'no')`, 'send back'],
    [`select public.hide_content('update', 'd0000000-0000-4000-8000-000000000002', 'no')`, 'hide'],
    [`select public.set_project_visibility('b0000000-0000-4000-8000-000000000001', 'club')`, 'change visibility'],
    [`select public.set_member_role('24000000-0000-4000-8000-000000000003', 'lead')`, 'change a role'],
    [`select public.remove_member('24000000-0000-4000-8000-000000000003')`, 'remove a member'],
    [`select * from public.create_invite('${A}', '16-17')`, 'invite'],
    [`select public.revoke_invite('19000000-0000-4000-8000-000000000001')`, 'cancel an invite'],
    [`select public.handle_report('13000000-0000-4000-8000-000000000001', 'dismissed')`, 'handle a report'],
  ]
  for (const [sql, what] of tries) expectErr(await as(X, sql), `an outsider: ${what}`)
  // A consent record with no student yet (subject NULL): only the club's advisor or an admin may withdraw it.
  await as(ROOT, `insert into public.consents (id, club_id, scope, method, recorded_by) values ('18000000-0000-4000-8000-0000000000ff', '${A}', 'join', 'school_on_file', '${ID.advisor}')`)
  expectErr(await as(X, `select public.revoke_consent('18000000-0000-4000-8000-0000000000ff')`), 'an outsider withdrawing a subject-less consent')
  // A 16–17 student can't approve their own waiting request.
  expectErr(await as({ id: ID.waiting, aal: 'aal1' }, `select public.approve_member('24000000-0000-4000-8000-000000000005')`), 'approving one\'s own request')
  // A team member who isn't staff can't remove (soft-delete) the project.
  expectErr(await as('member_1617', `update public.projects set deleted_at = now() where id = 'b0000000-0000-4000-8000-000000000001'`), 'a team member removing a project')
})
flow('club features: a public project\'s new numbers wait for the advisor; polls show counts, never who; follows are private', async () => {
  // Impact numbers are a public claim: the team adds one, the project leaves the public site until re-approved.
  expectOk(await as('member_1617', `insert into public.project_impacts (project_id, label, value, unit) values ('b0000000-0000-4000-8000-000000000001', 'cans recycled', 50, '')`), 'the team adds a number')
  let seen = await one('anon', `select count(*)::int as n from public.projects where id = 'b0000000-0000-4000-8000-000000000001'`)
  if (seen.n !== 0) throw new Error('still public after a new number')
  expectOk(await as('advisor', `select public.approve_content('project', 'b0000000-0000-4000-8000-000000000001')`), 're-approval')
  seen = await one('anon', `select count(*)::int as n from public.project_impacts where project_id = 'b0000000-0000-4000-8000-000000000001'`)
  if (seen.n !== 2) throw new Error(`a visitor sees ${seen.n} numbers`)
  // Polls: one vote each, changeable; the counts for members; no link or flagged word; locked threads refuse.
  expectOk(await as('member_1415', `insert into public.poll_votes (poll_id, choice) values ('27000000-0000-4000-8000-000000000001', 0)`), 'a vote')
  expectErr(await as('member_1415', `insert into public.poll_votes (poll_id, choice) values ('27000000-0000-4000-8000-000000000001', 1)`), 'a second vote')
  expectErr(await as('member_1415', `update public.poll_votes set choice = 4 where poll_id = '27000000-0000-4000-8000-000000000001'`), 'a choice that doesn\'t exist')
  const r = await as('lead', `select choice, votes from public.poll_results('27000000-0000-4000-8000-000000000001') order by choice`)
  expectOk(r, 'results')
  if (JSON.stringify(r.rows) !== JSON.stringify([{ choice: 0, votes: 1 }, { choice: 1, votes: 1 }])) throw new Error(`results ${JSON.stringify(r.rows)}`)
  const outsider = await as('other_member', `select * from public.poll_results('27000000-0000-4000-8000-000000000001')`)
  if (outsider.rows.length) throw new Error('an outsider sees the results')
  // An outsider is refused by the rules themselves ("not allowed"), not by a missing choice.
  const ov = await as('other_member', `insert into public.poll_votes (poll_id, choice) values ('27000000-0000-4000-8000-000000000001', 0)`)
  if (ov.ok || !/row-level security/.test(ov.error)) throw new Error(`an outsider's vote: ${ov.error ?? 'allowed'}`)
  expectErr(await as('member_1617', `insert into public.polls (thread_id, question, options) values ('10000000-0000-4000-8000-000000000001', 'See example.com?', array['Yes', 'No'])`), 'a poll with a link')
  await as(ROOT, `update public.polls set closes_at = now() - interval '1 minute' where id = '27000000-0000-4000-8000-000000000001'`)
  expectErr(await as('member_1617', `update public.poll_votes set choice = 0 where poll_id = '27000000-0000-4000-8000-000000000001'`), 'voting on a closed poll')
  // A poll with a flagged word, and one in a locked thread, are refused too.
  expectErr(await as('member_1617', `insert into public.polls (thread_id, question, options) values ('10000000-0000-4000-8000-000000000001', 'Is this a badword?', array['Yes', 'No'])`), 'a poll with a flagged word')
  await as(ROOT, `update public.threads set locked = true where id = '10000000-0000-4000-8000-000000000001'`)
  expectErr(await as('member_1617', `insert into public.polls (thread_id, question, options) values ('10000000-0000-4000-8000-000000000001', 'Pizza or pasta?', array['Pizza', 'Pasta'])`), 'a poll in a locked thread')
  // My data includes the clubs I follow and my votes.
  const ex = await one('other_member', `select public.export_my_data() as j`)
  if (ex.j.follows.length !== 1 || !Array.isArray(ex.j.poll_votes)) throw new Error(`export ${JSON.stringify({ follows: ex.j.follows, votes: ex.j.poll_votes })}`)
  const vx = await one('member_1617', `select public.export_my_data() as j`)
  if (vx.j.poll_votes.length !== 1 || vx.j.poll_votes[0].choice !== 'Wednesday') throw new Error(`votes in the export ${JSON.stringify(vx.j.poll_votes)}`)
  // Follows: only listed clubs; nobody else sees them.
  expectErr(await as('member_1617', `insert into public.club_follows (club_id) values ('${C}')`), 'following a pending club')
  const others = await one('lead', `select count(*)::int as n from public.club_follows`)
  if (others.n !== 0) throw new Error('a lead sees who follows the club')
  // The task board: a state, and "done" follows it.
  const t = await one('lead', `update public.project_tasks set state = 'done' where id = '22000000-0000-4000-8000-000000000001' returning done`)
  if (t.done !== true) throw new Error('done doesn\'t follow the state')
})
flow('verification: only an admin with the second factor verifies; an unverified adult has no powers', async () => {
  expectErr(await as('admin_aal1', `select public.verify_advisor('20000000-0000-4000-8000-000000000001')`), 'admin without aal2')
  expectErr(await as('unverified_adult', `select * from public.create_invite('${C}', '16-17')`), 'an unverified adult inviting')
  expectErr(await as('unverified_adult', `select public.rotate_join_code('${C}')`), 'an unverified adult rotating the code')
  expectOk(await as('admin', `select public.verify_advisor('20000000-0000-4000-8000-000000000001')`), 'admin verifying')
  const v = await one(ROOT, `select second_contact_email, status from public.advisor_verifications where id = '20000000-0000-4000-8000-000000000001'`)
  if (v.second_contact_email !== null || v.status !== 'approved') throw new Error(JSON.stringify(v))
  expectOk(await as('admin', `select public.verify_club('${C}')`), 'verifying the club')
  expectOk(await as('unverified_adult', `select public.rotate_join_code('${C}')`), 'now verified, rotating the code')
  expectOk(await as('unverified_adult', `select * from public.create_invite('${C}', '16-17')`), 'now verified, inviting')
})
flow('the request route\'s advisor check: the school email domain must match', async () => {
  await as(ROOT, `insert into public.profiles (id, display_name, age_band, country, conduct_accepted_at) values ('${ID.newAdult}', 'Ola O.', 'adult', 'HU', now())`)
  expectErr(await as(NEW_ADULT, `select public.request_advisor_verification(null, 'Other School', 'other.example.test', 'Head', 'head@other.example.test')`), 'a domain that isn\'t theirs')
  expectOk(await as(NEW_ADULT, `select public.request_advisor_verification(null, 'Test School A', 'school-a.example.test', 'Head', 'head@school-a.example.test')`), 'their school domain')
})
flow('reports: the route files them; advisors handle their club\'s, never about themselves or adults', async () => {
  const id = (await one(SERVICE, `select public.file_report('update', 'd0000000-0000-4000-8000-000000000002', 'bullying', 'mean', null, true) as id`)).id
  const r = await one(ROOT, `select club_id, about_user_id, unverified from public.reports where id = '${id}'`)
  if (r.club_id !== A || r.about_user_id !== ID.m1617 || !r.unverified) throw new Error(JSON.stringify(r))
  expectErr(await as('member_1617', `select public.file_report('club', '${A}', 'spam', '', null, false)`), 'a person calling the route function')
  expectOk(await as('advisor', `select public.handle_report('${id}', 'actioned', 'Removed: unkind')`), 'the advisor handling')
  expectErr(await as('advisor', `select public.handle_report('13000000-0000-4000-8000-000000000002', 'dismissed')`), 'the advisor handling a report about themself')
  const cs = (await one(SERVICE, `select public.file_report('update', 'd0000000-0000-4000-8000-000000000002', 'child_safety', '', null, false) as id`)).id
  const n = await one(ROOT, `select count(*)::int as n from public.notifications where kind = 'report.child_safety' and payload->>'report' = '${cs}' and user_id = '${ID.admin}'`)
  if (n.n !== 1) throw new Error('child safety report didn\'t reach the admin')
})
flow('the audit log: nobody edits or deletes it, not even the secret key', async () => {
  expectErr(await as(SERVICE, `update public.audit_log set action = 'x.y' where id = '14000000-0000-4000-8000-000000000001'`), 'secret key update')
  expectErr(await as(SERVICE, `delete from public.audit_log where id = '14000000-0000-4000-8000-000000000001'`), 'secret key delete')
  expectErr(await as(ROOT, `update public.audit_log set action = 'x.y' where id = '14000000-0000-4000-8000-000000000001'`), 'owner update')
  const before = await one(ROOT, `select count(*)::int as n from public.audit_log`)
  await one('lead', `select public.rotate_join_code('${A}') as code`)
  const after = await one(ROOT, `select count(*)::int as n from public.audit_log where action = 'club.code_rotate'`)
  if (after.n !== 1 || before.n < 1) throw new Error('rotation not logged')
})
flow('admins read threads only through the logged function', async () => {
  const t = await one('admin', `select public.admin_read_threads('${A}') as j`)
  if (!Array.isArray(t.j) || t.j.length !== 1) throw new Error(`threads ${JSON.stringify(t.j).slice(0, 80)}`)
  const l = await one(ROOT, `select count(*)::int as n from public.audit_log where action = 'admin.read_threads'`)
  if (l.n !== 1) throw new Error('the read wasn\'t logged')
  expectErr(await as('advisor', `select public.admin_read_threads('${A}')`), 'an advisor using it')
})
flow('export my data: everything about me, nothing about others', async () => {
  const e = await one('member_1415', `select public.export_my_data() as j`)
  const j = e.j
  if (j.email !== 'member1415@example.test' || j.memberships.length !== 1 || j.updates.length !== 1 || j.consents.length < 1) throw new Error(JSON.stringify(j).slice(0, 200))
  if (JSON.stringify(j).includes('member1617@example.test')) throw new Error('another person\'s email in the export')
})
flow('delete my account: projects stay with the club, reports stay, consent records stay; the rest goes', async () => {
  const paths = await as('member_1617', `select * from public.delete_my_account()`)
  expectOk(paths, 'delete')
  if (paths.rows.length !== 6) throw new Error(`photo paths ${paths.rows.length}`)
  const left = await one(ROOT, `select
    (select count(*) from auth.users where id = '${ID.m1617}')::int as users,
    (select count(*) from public.profiles where id = '${ID.m1617}')::int as profiles,
    (select count(*) from public.club_members where user_id = '${ID.m1617}')::int as members,
    (select count(*) from public.updates where author_id = '${ID.m1617}')::int as updates,
    (select count(*) from public.rsvps where user_id = '${ID.m1617}')::int as rsvps,
    (select created_by::text from public.projects where id = 'b0000000-0000-4000-8000-000000000001') as project_owner,
    (select count(*) from public.projects where id = 'b0000000-0000-4000-8000-000000000001')::int as project,
    (select reporter_id::text from public.reports where id = '13000000-0000-4000-8000-000000000001') as reporter,
    (select count(*) from public.reports where id = '13000000-0000-4000-8000-000000000001')::int as report`)
  if (left.users || left.profiles || left.members || left.updates || left.rsvps || left.project !== 1 || left.project_owner !== null || left.report !== 1 || left.reporter !== null) throw new Error(JSON.stringify(left))
})
flow('the roster: staff see the members and requests; only advisors and admins see age bands', async () => {
  const adv = await as('advisor', `select * from public.club_roster('${A}')`)
  expectOk(adv, 'advisor roster')
  if (adv.rows.length !== 5 || adv.rows.some((r) => !r.age_band)) throw new Error(`advisor sees ${adv.rows.length} rows, bands ${adv.rows.map((r) => r.age_band)}`)
  const lead = await as('lead', `select * from public.club_roster('${A}')`)
  if (lead.rows.length !== 5 || lead.rows.some((r) => r.age_band !== null || r.country !== null)) throw new Error('a lead sees age bands')
  const mem = await as('member_1617', `select * from public.club_roster('${A}')`)
  const aal1 = await as('advisor_aal1', `select * from public.club_roster('${A}')`)
  if (mem.rows.length || aal1.rows.length) throw new Error(`member ${mem.rows.length}, advisor without aal2 ${aal1.rows.length}`)
})
flow('names: co-members see first name and initial only; nobody else sees a profile', async () => {
  const n = await as('member_1415', `select * from public.club_member_names where club_id = '${A}'`)
  expectOk(n, 'names')
  const cols = Object.keys(n.rows[0] ?? {})
  if (cols.join(',') !== 'club_id,user_id,display_name,role') throw new Error(`columns ${cols}`)
  const other = await one('other_member', `select count(*)::int as n from public.club_member_names where club_id = '${A}'`)
  if (other.n !== 0) throw new Error('another club\'s member sees names')
  expectErr(await as('anon', `select count(*) from public.club_member_names`), 'a visitor')
  const p = await one('lead', `select count(*)::int as n from public.profiles`)
  if (p.n !== 1) throw new Error(`a lead sees ${p.n} profiles`)
})

let flowPass = 0
const flowFails = []
for (const f of flows) {
  try { await isolated(f.fn); flowPass++ } catch (e) { flowFails.push(`${f.name} → ${e.message}`) }
}
console.log(`${flowFails.length ? '✗' : '✓'} flows: ${flowPass}/${flows.length}`)
for (const f of [...fails, ...flowFails]) console.log(`  ✗ ${f}`)
const total = matrixCount + flows.length
console.log(`${fails.length + flowFails.length ? '✗ FAIL' : '✓ PASS'}: ${pass + flowPass}/${total} (matrix ${pass}/${matrixCount}, flows ${flowPass}/${flows.length})`)
process.exit(fails.length + flowFails.length ? 1 : 0)
