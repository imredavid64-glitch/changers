// supabase-js clients for the suite. The admin client uses the secret key (it bypasses the rules: fixtures and
// clean-up only). Every actor client carries exactly one session token, or none for the visitor, so each request
// reaches the database as that person would.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

const NO_SESSION_STORAGE = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

export function adminClient(): SupabaseClient {
  const e = env()
  return createClient(e.url, e.secret, NO_SESSION_STORAGE)
}

/** A client for the sign-in calls (verifyOtp, MFA): it keeps its session in memory only. */
export function authClient(): SupabaseClient {
  const e = env()
  return createClient(e.url, e.publishable, NO_SESSION_STORAGE)
}

/** Requests as one person: their access token, or the publishable key alone for a visitor (token null). */
export function actorClient(token: string | null): SupabaseClient {
  const e = env()
  return createClient(e.url, e.publishable, { accessToken: async () => token })
}
