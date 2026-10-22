import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseKey, supabaseUrl } from './env'

/**
 * The RLS-bound client for this request: the publishable key and the visitor's own session (07 §6; BUILD-PROMPT
 * law 2: "screens read and write through the RLS-bound client"). Reads the request, so callers sit behind <Suspense>.
 */
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server Components can't set cookies; Server Actions and route handlers can. proxy.ts keeps the session fresh.
        try { for (const { name, value, options } of list) store.set(name, value, options) } catch { /* see above */ }
      },
    },
  })
}
