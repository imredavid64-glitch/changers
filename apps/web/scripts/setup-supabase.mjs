#!/usr/bin/env node
// One-time setup of the Changemakers dev project on Supabase (docs/07-APP-SPEC.md §2; Luke, 11 Oct: "create the
// supabase project"). Luke runs it in the Terminal panel: it asks only for what only Luke can give.
//   1. the Supabase sign-in, in his browser (skipped when already signed in);
//   2. a database password: pasted from his password manager, never shown, never written to disk, kept only in this
//      process while it runs (the CLI needs it to create the project and to push the migrations).
// Everything else it does itself: creates changemakers-dev in Central EU (Frankfurt), writes the URL and keys into
// site/.env.local without printing them, pushes the auth settings (6-digit code, the sign-in email), links, pushes the
// five migrations, makes the example.test dev accounts and loads the DEMO data. Safe to run again.
//   npm run setup:supabase
import fs from 'node:fs'
import readline from 'node:readline'
import { execFileSync, spawnSync } from 'node:child_process'

const site = new URL('..', import.meta.url).pathname
const SB = `${site}node_modules/.bin/supabase`
const NAME = 'changemakers-dev'
const REGION = 'eu-central-1' // Central EU (Frankfurt)
const ENV_FILE = `${site}.env.local`
process.chdir(site)

const bold = (s) => `\x1b[1m${s}\x1b[0m`
const step = (n, s) => console.log(`\n${bold(`${n}/7 · ${s}`)}`)
// Quiet: output captured (it may hold keys), never echoed. Errors show the CLI's stderr only.
const quiet = (args, env = {}) => {
  try { return execFileSync(SB, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } }) }
  catch (e) { throw new Error(`supabase ${args.slice(0, 2).join(' ')} failed: ${String(e.stderr ?? '').trim().slice(0, 400)}`) }
}
const json = (args, env) => JSON.parse(quiet([...args, '-o', 'json'], env))
// Live: the CLI talks to Luke directly (sign-in, progress).
const live = (args, env = {}) => {
  const r = spawnSync(SB, args, { stdio: 'inherit', env: { ...process.env, ...env } })
  if (r.status !== 0) throw new Error(`supabase ${args.slice(0, 2).join(' ')} failed (exit ${r.status})`)
}
const ask = (q, hidden = false) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(q) }
  rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()) })
})
const refOf = (p) => p.ref ?? p.id
const signedIn = () => { try { json(['projects', 'list']); return true } catch { return false } }

try {
  step(1, 'Supabase sign-in')
  if (signedIn()) console.log('Already signed in.')
  else {
    console.log('Your browser opens. Sign in to Supabase and approve the CLI; if it shows a code, paste it here.')
    live(['login'])
    if (!signedIn()) throw new Error('still not signed in')
  }

  step(2, `The project "${NAME}" (Central EU, Frankfurt)`)
  let project = json(['projects', 'list']).find((p) => p.name === NAME)
  const password = await ask(`Database password for ${NAME} (paste it from your password manager; it stays hidden): `, true)
  if (password.length < 16) throw new Error('use a password of at least 16 characters (07 §2: a strong one)')
  if (!project) {
    const orgs = json(['orgs', 'list'])
    if (!orgs.length) throw new Error('this Supabase account has no organisation yet: make one at supabase.com/dashboard, then run this again')
    let org = orgs[0]
    if (orgs.length > 1) {
      orgs.forEach((o, i) => console.log(`  ${i + 1}. ${o.name}`))
      org = orgs[Number(await ask(`Which organisation (1–${orgs.length})? `)) - 1] ?? orgs[0]
    }
    quiet(['projects', 'create', NAME, '--org-id', org.id, '--region', REGION, '--db-password', password])
    project = json(['projects', 'list']).find((p) => p.name === NAME)
    if (!project) throw new Error('the project was created but doesn\'t show in the list yet; run this again in a minute')
    console.log(`Created ${NAME} (${refOf(project)}) in ${org.name}.`)
  } else console.log(`Found ${NAME} (${refOf(project)}).`)
  const ref = refOf(project)

  step(3, 'Waiting for the database to start (usually 1–2 minutes)')
  for (let i = 0; ; i++) {
    const p = json(['projects', 'list']).find((x) => refOf(x) === ref)
    if (p?.status === 'ACTIVE_HEALTHY') break
    if (i > 72) throw new Error(`still ${p?.status} after 6 minutes; run this again later`)
    process.stdout.write(i ? '.' : `status ${p?.status} `)
    await new Promise((r) => setTimeout(r, 5000))
  }
  console.log(' ready.')

  step(4, 'The URL and keys into site/.env.local (not shown)')
  const keys = json(['projects', 'api-keys', '--project-ref', ref, '--reveal'])
  const pick = (type, legacy) => keys.find((k) => k.type === type)?.api_key ?? keys.find((k) => k.name === legacy)?.api_key
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick('publishable', 'anon'),
    SUPABASE_SECRET_KEY: pick('secret', 'service_role'),
  }
  if (!values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !values.SUPABASE_SECRET_KEY || /[·*]{4}/.test(values.SUPABASE_SECRET_KEY)) throw new Error('the CLI didn\'t return the keys in full')
  const kept = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter((l) => l && !Object.keys(values).some((k) => l.startsWith(`${k}=`))) : []
  fs.writeFileSync(ENV_FILE, [...kept, ...Object.entries(values).map(([k, v]) => `${k}=${v}`)].join('\n') + '\n', { mode: 0o600 })
  fs.chmodSync(ENV_FILE, 0o600)
  console.log(`Wrote ${Object.keys(values).join(', ')} (${values.SUPABASE_SECRET_KEY.startsWith('sb_secret_') ? 'new-style keys' : 'legacy keys'}).`)

  const withPassword = { SUPABASE_DB_PASSWORD: password }
  step(5, 'Link, and the auth settings (6-digit code, 1 hour, 60 s between codes, the sign-in email, authenticator apps)')
  live(['link', '--project-ref', ref], withPassword)
  try { live(['config', 'push', '--project-ref', ref, '--yes'], withPassword) }
  catch (e) { console.log(`! ${e.message}. Set the sign-in email by hand: 05-COPY.md §Sign-in email.`) }

  step(6, 'The five migrations')
  live(['db', 'push', '--linked', '--yes'], withPassword)

  step(7, 'Dev accounts (example.test) and the DEMO data')
  const users = spawnSync(process.execPath, ['--env-file=.env.local', 'scripts/seed-users.mjs'], { stdio: 'inherit' })
  if (users.status !== 0) throw new Error('making the dev accounts failed')
  live(['db', 'push', '--linked', '--include-seed', '--yes'], withPassword)

  console.log(`\n${bold('Done.')} ${NAME} is ready: https://supabase.com/dashboard/project/${ref}`)
  console.log('Next, in this chat: the access-rule tests against it (npm run test:rls).')
} catch (e) {
  console.error(`\n✗ ${e.message}`)
  process.exit(1)
}
