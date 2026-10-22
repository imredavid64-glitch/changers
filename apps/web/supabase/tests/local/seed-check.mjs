#!/usr/bin/env node
// The dev seed (supabase/seed.dev.sql, from the DEMO fixtures) on the R1b schema, read back through the access rules:
// what a visitor, a member, a lead and an advisor see must match what the DEMO screens show today (src/lib/data.ts).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const here = path.dirname(new URL(import.meta.url).pathname)
const PGLITE = process.env.PGLITE_DIR ?? path.join(os.homedir(), '.npm/_npx/da5c1b6ea715e8b4/node_modules/@electric-sql/pglite')
const { PGlite } = await import(path.join(PGLITE, 'dist/index.js'))
const { pgcrypto } = await import(path.join(PGLITE, 'dist/contrib/pgcrypto.js'))
const { pg_trgm } = await import(path.join(PGLITE, 'dist/contrib/pg_trgm.js'))
const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm } })
const migrations = path.join(here, '../../migrations')
await db.exec(fs.readFileSync(path.join(here, 'stub.sql'), 'utf8'))
for (const f of fs.readdirSync(migrations).filter((n) => n.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(migrations, f), 'utf8'))
const users = JSON.parse(fs.readFileSync(path.join(here, '../../seed.dev.users.json'), 'utf8'))
for (const u of users) await db.query('insert into auth.users (id, email) values ($1, $2)', [u.id, u.email])
try { await db.exec(fs.readFileSync(path.join(here, '../../seed.dev.sql'), 'utf8')) } catch (e) { console.error(`✗ seed: ${e.message}`); process.exit(1) }

const uuid = (id) => { const h = crypto.createHash('sha1').update(`changemakers-demo:${id}`).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}` }
async function as(who, sql) {
  await db.exec('begin')
  try {
    if (who === 'anon') { await db.exec('set local role anon') }
    else { await db.exec('set local role authenticated'); await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uuid(who.id), role: 'authenticated', aal: who.aal })]) }
    return (await db.query(sql)).rows
  } catch (e) { return [{ v: /permission denied/.test(e.message) ? 'refused' : `error: ${e.message}` }] } finally { await db.exec('rollback') }
}
const MEMBER = { id: 'u-mem1', aal: 'aal1' }, LEAD = { id: 'u-lead1', aal: 'aal1' }, ADVISOR = { id: 'u-adv1', aal: 'aal2' }
const C1 = uuid('c1')
const checks = [
  ['visitor: listed clubs (data.ts getDirectory: c1–c6; Kraków pending and Zagreb empty stay hidden)', 'anon', `select string_agg(slug, ',' order by slug) as v from public.clubs`, 'demo-bucharest,demo-budapest,demo-dusseldorf,demo-kaunas,demo-prague,demo-vienna'],
  ['visitor: public projects (approved, public, listed club)', 'anon', `select count(*)::int as v from public.projects`, 6],
  ['visitor: public events (the club-only planning meeting stays hidden)', 'anon', `select count(*)::int as v from public.events`, 5],
  ['visitor: public updates', 'anon', `select count(*)::int as v from public.updates`, 1],
  ['visitor: no exact place or online link (no grant at all)', 'anon', `select count(*)::int as v from public.event_links`, 'refused'],
  ['member 13–15: Budapest updates (2 published + own 2 waiting)', MEMBER, `select count(*)::int as v from public.updates where club_id = '${C1}'`, 4],
  ['member 13–15: Budapest projects (no one else\'s drafts)', MEMBER, `select count(*)::int as v from public.projects where club_id = '${C1}'`, 4],
  ['member 13–15: Budapest names (4 members)', MEMBER, `select count(*)::int as v from public.club_member_names where club_id = '${C1}'`, 4],
  ['member 13–15: sees no age bands but their own', MEMBER, `select count(*)::int as v from public.profiles`, 1],
  ['member 13–15: thread posts', MEMBER, `select count(*)::int as v from public.thread_posts`, 3],
  ['lead: roster without age bands', LEAD, `select count(*) filter (where age_band is null)::int as v from public.club_roster('${C1}')`, 4],
  ['advisor: roster with age bands', ADVISOR, `select count(*) filter (where age_band is not null)::int as v from public.club_roster('${C1}')`, 4],
  ['advisor: the swap-table event link (host)', ADVISOR, `select count(*)::int as v from public.event_links l join public.events e on e.id = l.event_id where e.club_id = '${C1}'`, 2],
  ['member 13–15: event links only where going (none)', MEMBER, `select count(*)::int as v from public.event_links`, 0],
]
let pass = 0
for (const [label, who, sql, want] of checks) {
  const got = (await as(who, sql))[0]?.v
  const ok = got === want
  if (ok) pass++
  console.log(`${ok ? '✓' : '✗'} ${label}: ${got}${ok ? '' : ` (want ${want})`}`)
}
console.log(`${pass === checks.length ? '✓ PASS' : '✗ FAIL'}: ${pass}/${checks.length}`)
process.exit(pass === checks.length ? 0 : 1)
