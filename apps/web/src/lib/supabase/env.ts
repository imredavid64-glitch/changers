// The Supabase project this build talks to (site/ENV.md lists the names; the values live in site/.env.local).
// The publishable key is public by design: RLS decides what it can see (07 §6).
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
export const hasSupabase = Boolean(supabaseUrl && supabaseKey)
