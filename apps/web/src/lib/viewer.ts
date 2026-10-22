import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { DEMO_PERSONAS, type DemoPersona } from './demo/fixtures'
import type { AgeBand, MemberRole, Person } from './types'
import { loadDb } from './data'
import { backend } from './backend'
import { supabaseServer } from './supabase/server'

export type Viewer =
  | { kind: 'visitor'; needsWelcome?: boolean } // needsWelcome: signed in with a code, but /welcome isn't done yet
  | {
      kind: 'user'; persona?: DemoPersona; person: Person; isAdmin: boolean; aal2: boolean
      needsFactor: boolean // an admin or advisor on a session without the authenticator app: no powers yet (07 §4)
      memberships: { clubId: string; role: MemberRole }[]
    }

export const DEMO_COOKIE = 'cm_demo_as'
export const MOTION_COOKIE = 'cm_motion' // review builds: 'off' turns the v3 animations off in this browser

/**
 * Who is looking. Reads the request, so every caller sits behind <Suspense>. Once per request (React cache).
 * - Supabase (R1b): the session's verified claims, then the person's own profile, memberships and admin row, read
 *   through RLS (each of those is visible to its owner only). Admin powers need the second factor (aal2, 07 §4).
 * - Review builds: the DEMO persona cookie set from the DEMO bar.
 * - A launch build without a project: always a visitor.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (backend === 'supabase') return supabaseViewer()
  if (backend !== 'demo') return { kind: 'visitor' }
  const as = (await cookies()).get(DEMO_COOKIE)?.value as DemoPersona | undefined
  const personId = as ? DEMO_PERSONAS[as] : null
  if (!as || !personId) return { kind: 'visitor' }
  const db = await loadDb()
  const person = db.people.find((p) => p.id === personId)
  if (!person) return { kind: 'visitor' }
  const memberships = db.clubs.flatMap((c) =>
    c.members.filter((m) => m.userId === person.id && m.status === 'active').map((m) => ({ clubId: c.id, role: m.role })),
  )
  return { kind: 'user', persona: as, person, isAdmin: !!person.isAdmin, aal2: true, needsFactor: false, memberships }
})

async function supabaseViewer(): Promise<Viewer> {
  const sb = await supabaseServer()
  const { data } = await sb.auth.getClaims()
  const me = data?.claims?.sub
  if (!me) return { kind: 'visitor' }
  const aal2 = data?.claims?.aal === 'aal2'
  const [{ data: profile }, { data: rows }, { data: admin }] = await Promise.all([
    sb.from('profiles').select('display_name, age_band, country, is_verified_adult').eq('id', me).maybeSingle(),
    sb.from('club_members').select('club_id, role').eq('user_id', me).eq('status', 'active'),
    sb.from('network_admins').select('user_id').eq('user_id', me).maybeSingle(),
  ])
  if (!profile) return { kind: 'visitor', needsWelcome: true }
  const isAdmin = !!admin && aal2
  const person: Person = {
    id: me, displayName: profile.display_name, ageBand: profile.age_band as AgeBand, country: profile.country,
    isVerifiedAdult: profile.is_verified_adult, isAdmin,
  }
  const memberships = (rows ?? []).map((m) => ({ clubId: m.club_id as string, role: m.role as MemberRole }))
  const needsFactor = !aal2 && (!!admin || memberships.some((m) => m.role === 'advisor'))
  return { kind: 'user', person, isAdmin, aal2, needsFactor, memberships }
}
