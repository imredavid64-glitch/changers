import { demoMode } from '@/config/switches'
import { hasSupabase } from './supabase/env'

/**
 * Where the data comes from: the DEMO fixtures (review builds: npm run dev / preview), the Supabase project (R1b:
 * site/.env.local has its URL and key), or nothing (a launch build with no project: every page shows its empty state).
 */
export const backend: 'demo' | 'supabase' | 'none' = demoMode ? 'demo' : hasSupabase ? 'supabase' : 'none'
