// Runs in each test worker before its file: the Supabase values come from site/.env.local (Node 24's loader).
import { loadEnv } from './lib/env'

loadEnv()
