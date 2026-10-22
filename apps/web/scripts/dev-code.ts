// DEV ONLY (docs/07-APP-SPEC.md §2; BUILD-PROMPT §0.3): a sign-in code for an example.test account, without email.
//   npm run dev:code -- u-mem1@example.test
// The admin API's generateLink({ type: 'magiclink' }) makes the 6-digit code and sends nothing (an address that has no
// account yet gets one, as a code sign-in would make it). Printing that one code is the documented dev flow; nothing
// else secret is ever printed. Never imported by app code.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

async function main(): Promise<number> {
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ refused: dev:code never runs with NODE_ENV=production')
    return 1
  }
  const email = (process.argv[2] ?? '').trim().toLowerCase()
  if (!/^[a-z0-9._%+-]+@example\.test$/.test(email)) {
    console.error(`✗ refused: ${email || '(no address)'} is not an @example.test address. Usage: npm run dev:code -- someone@example.test`)
    return 1
  }
  const envFile = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envFile)) {
    console.error('✗ site/.env.local is missing: run it from site/ once the dev project is set up (npm run setup:supabase)')
    return 1
  }
  process.loadEnvFile(envFile)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) {
    console.error('✗ site/.env.local has no NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY yet (npm run setup:supabase)')
    return 1
  }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const code = data?.properties?.email_otp
  if (error || !code) {
    console.error(`✗ no code for ${email}: ${error?.message ?? 'empty response'}`)
    return 1
  }
  console.log(`Sign-in code for ${email}: ${code} (valid for 1 hour; DEV ONLY)`)
  console.log(`Open http://127.0.0.1:4401/sign-in?step=code&email=${encodeURIComponent(email)} and enter it.`)
  return 0
}

main().then((status) => { process.exitCode = status }, (e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`)
  process.exitCode = 1
})
