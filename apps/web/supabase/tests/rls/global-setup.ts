// Once per run (07 §6 Tests, "sessions are created once per suite"): sign each actor in through
// generateLink → verifyOtp, raise the advisor, the unverified adult and the admin to aal2 with the suite's TOTP factor,
// and hand the tokens to the test files. Before that it removes anything an earlier run left behind; after the run it
// checks again. Nothing secret is printed.
import { randomBytes } from 'node:crypto'
import type { TestProject } from 'vitest/node'
import { claims, prepareFactor, raiseToAal2, signIn } from './lib/auth'
import { actorClient, adminClient } from './lib/clients'
import type { RlsContext } from './lib/context'
import { env } from './lib/env'
import { ACTOR_PERSON, CLUB, PERSON, emailOf, type SignedIn } from './lib/seed'
import { must, sweep, type Row } from './lib/world'

async function checkSeed(admin: ReturnType<typeof adminClient>): Promise<void> {
  for (const { persona, slug } of Object.values(ACTOR_PERSON)) {
    const { data, error } = await admin.auth.admin.getUserById(PERSON[persona])
    if (error || data.user?.email !== emailOf(slug)) {
      throw new Error(`the dev seed isn't on this project: ${emailOf(slug)} is missing (npm run setup:supabase, step 7)`)
    }
  }
  const clubs = await must<Row[]>(admin.from('clubs').select('id').in('id', [CLUB.budapest, CLUB.kaunas, CLUB.krakow]), 'the seed clubs')
  if (clubs.length !== 3) throw new Error("the dev seed isn't on this project: the DEMO clubs are missing (npm run setup:supabase, step 7)")
}

export default async function setup(project: TestProject) {
  env() // "not run: …" when site/.env.local isn't there yet
  const admin = adminClient()
  const runId = `${Date.now().toString(36).slice(-4)}${randomBytes(2).toString('hex')}`
  const left = await sweep(admin)
  if (left.clubs || left.users) console.log(`RLS suite: removed what an earlier run left (${left.clubs} club(s), ${left.users} account(s))`)
  await checkSeed(admin)

  // Factors first: replacing a stale one signs that person out everywhere, so it must happen before any sign-in.
  const prepared = new Map<string, Awaited<ReturnType<typeof prepareFactor>>>()
  for (const a of Object.values(ACTOR_PERSON)) {
    if (a.aal === 'aal2' && !prepared.has(a.slug)) prepared.set(a.slug, await prepareFactor(admin, PERSON[a.persona], a.slug))
  }

  const actors = { anon: { id: null, email: null, token: null, aal: null } } as RlsContext['actors']
  for (const [name, a] of Object.entries(ACTOR_PERSON) as [SignedIn, (typeof ACTOR_PERSON)[SignedIn]][]) {
    const session = await signIn(admin, emailOf(a.slug))
    const token = a.aal === 'aal2' ? await raiseToAal2(session, a.slug, prepared.get(a.slug) ?? null) : session.token
    const c = claims(token)
    if (c.sub !== PERSON[a.persona] || c.aal !== a.aal) throw new Error(`${name}: expected an ${a.aal} session for ${a.slug}, got ${String(c.aal)}`)
    const own = await actorClient(token).from('profiles').select('id').eq('id', PERSON[a.persona])
    if (own.error || own.data?.length !== 1) throw new Error(`${name}: the new session can't read its own profile (${own.error?.message ?? 'no row'})`)
    actors[name] = { id: PERSON[a.persona], email: emailOf(a.slug), token, aal: a.aal }
  }
  const visitor = await actorClient(null).from('clubs').select('id').eq('id', CLUB.budapest)
  if (visitor.error || visitor.data?.length !== 1) throw new Error(`a visitor can't read the listed Budapest club (${visitor.error?.message ?? 'no row'})`)

  project.provide('rls', { runId, actors })
  const aal2 = Object.values(actors).filter((a) => a.aal === 'aal2').length
  console.log(`RLS suite: run ${runId}, ${Object.keys(ACTOR_PERSON).length} sessions made once (${aal2} at aal2), plus the visitor`)

  return async () => {
    const after = await sweep(admin)
    if (after.clubs || after.users) console.log(`RLS suite: final clean-up removed ${after.clubs} club(s) and ${after.users} account(s) a file left behind`)
  }
}
