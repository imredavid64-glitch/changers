import { backend } from '@/lib/backend'
import { supabaseServer } from '@/lib/supabase/server'

// Download my data (07 §4): JSON of everything about the signed-in person, made by export_my_data() under their own
// session. Rate limits (3 a day) join in R4 with Upstash.
export async function GET() {
  if (backend !== 'supabase') return new Response('Not available in this build', { status: 404 })
  const sb = await supabaseServer()
  const { data, error } = await sb.rpc('export_my_data')
  if (error || !data) return new Response('Sign in first', { status: 401 })
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="changemakers-my-data.json"',
      'cache-control': 'no-store',
    },
  })
}
