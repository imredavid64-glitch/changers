#!/usr/bin/env node
// DEV ONLY. Makes the dev accounts listed in supabase/seed.dev.users.json (the DEMO people, all on example.test, with
// fixed ids) through the Supabase admin API, so the DEMO data in seed.dev.sql has accounts to belong to. Nothing is
// emailed: example.test can't receive mail, and these accounts sign in with `npm run dev:code`. Run by
// scripts/setup-supabase.mjs as: node --env-file=.env.local scripts/seed-users.mjs
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be in site/.env.local'); process.exit(1) }
if (process.env.NODE_ENV === 'production') { console.error('✗ dev only'); process.exit(1) }

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const users = JSON.parse(fs.readFileSync(new URL('../supabase/seed.dev.users.json', import.meta.url), 'utf8'))
let made = 0, had = 0
for (const u of users) {
  if (!u.email.endsWith('@example.test')) { console.error(`✗ refused: ${u.email} is not an example.test address`); process.exit(1) }
  const { error } = await admin.auth.admin.createUser({ id: u.id, email: u.email, email_confirm: true, user_metadata: { dev_persona: u.persona } })
  if (!error) made++
  else if (/already|exists|registered/i.test(error.message)) had++
  else { console.error(`✗ ${u.email}: ${error.message}`); process.exit(1) }
}
console.log(`✓ dev accounts: ${made} made, ${had} already there (${users.length} on example.test)`)
