// The suite's three Supabase values, read from site/.env.local (07 §2: Luke's setup script writes them there).
// Values are only ever handed to supabase-js; nothing here prints one.
import fs from 'node:fs'
import path from 'node:path'

export const SITE = process.cwd()

export function loadEnv(): void {
  if (process.env.SUPABASE_SECRET_KEY) return
  const file = path.join(SITE, '.env.local')
  if (fs.existsSync(file)) process.loadEnvFile(file)
}

export interface Env { url: string; publishable: string; secret: string }

export function env(): Env {
  loadEnv()
  const pkg = path.join(SITE, 'package.json')
  if (!fs.existsSync(pkg) || !/"name":\s*"changemakers-site"/.test(fs.readFileSync(pkg, 'utf8'))) {
    throw new Error('run the suite from site/ (npm run test:rls)')
  }
  if (process.env.NODE_ENV === 'production') throw new Error('the access-rule suite never runs with NODE_ENV=production')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const secret = process.env.SUPABASE_SECRET_KEY
  const missing = [
    ['NEXT_PUBLIC_SUPABASE_URL', url],
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishable],
    ['SUPABASE_SECRET_KEY', secret],
  ].filter(([, v]) => !v).map(([k]) => k)
  if (missing.length || !url || !publishable || !secret) {
    throw new Error(`not run: site/.env.local has no ${missing.join(', ')} yet. The dev project isn't set up (npm run setup:supabase).`)
  }
  return { url, publishable, secret }
}
