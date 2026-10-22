import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from './env'

/**
 * Anonymous and cookie-less: the public data behind cached pages ('use cache', 07 §9), the same for every visitor.
 * The anon rules (07 §6) decide what it sees: listed clubs, approved public projects, events and updates.
 */
let client: SupabaseClient | null = null
export function supabasePublic() {
  client ??= createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}
