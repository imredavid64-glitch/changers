import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { hasSupabase, supabaseKey, supabaseUrl } from '@/lib/supabase/env'

// Keeps the Supabase session fresh (07 §4: a short-lived access token and a rotating refresh token, "refreshed in
// proxy.ts"; Next.js 16 renamed middleware to proxy). Review builds (DEMO) and builds without Supabase pass straight
// through. Rate limits join here in R4.
export async function proxy(request: NextRequest) {
  if (process.env.DEMO_MODE === '1' || !hasSupabase) return NextResponse.next()
  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
      },
    },
  })
  // Refreshes a session that's about to expire. Nothing may run between creating the client and this call.
  await supabase.auth.getClaims()
  return response
}

export const config = {
  // Pages and actions only: not Next's own files, the map tiles and fonts, vendored scripts or images.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|map/|vendor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|pbf|pmtiles|txt|xml|json)$).*)'],
}
