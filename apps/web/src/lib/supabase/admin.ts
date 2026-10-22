import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from './env'

/**
 * The secret key: only for the upload, contact and report routes, the tests and dev:code (BUILD-PROMPT law 2). It
 * bypasses RLS, so it never reads on a person's behalf and never reaches the browser (07 §10; the gate greps the
 * client bundles for it).
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set (site/.env.local)')
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
