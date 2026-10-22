// The dev seed read back through the access rules, as each DEMO screen would read it (port of
// supabase/tests/local/seed-check.mjs). The suite's own RLS-TEST rows are left out of every count.
import { describe, inject, test } from 'vitest'
import { actorClient } from './lib/clients'
import { describeError, preview } from './lib/outcome'
import { BUDAPEST_EVENTS, CLUB, ROW, SEED_EVENTS } from './lib/seed'

const { actors } = inject('rls')
const visitor = actorClient(null)
const member1415 = actorClient(actors.member_1415.token)
const lead = actorClient(actors.lead.token)
const advisor = actorClient(actors.advisor.token)

type Res = { data: unknown; error: { code?: string; message?: string } | null }
const rows = async (q: PromiseLike<Res>): Promise<unknown[] | 'refused'> => {
  const r = await q
  if (r.error) {
    if (r.error.code === '42501') return 'refused'
    throw new Error(describeError(r.error))
  }
  return (r.data as unknown[]) ?? []
}
const n = async (q: PromiseLike<Res>) => { const r = await rows(q); return r === 'refused' ? r : r.length }

const checks: [string, () => Promise<unknown>, unknown][] = [
  ['visitor: the listed clubs (Kraków pending and Zagreb empty stay hidden)',
    async () => { const r = await rows(visitor.from('clubs').select('slug').not('slug', 'like', 'rls-test-%').order('slug')); return r === 'refused' ? r : r.map((c) => (c as { slug: string }).slug).join(',') },
    'demo-bucharest,demo-budapest,demo-dusseldorf,demo-kaunas,demo-prague,demo-vienna'],
  ['visitor: public projects (approved, public, of a listed club)', () => n(visitor.from('projects').select('id').not('title', 'like', 'RLS-TEST%')), 6],
  ['visitor: public events (the club-only planning meeting stays hidden)', () => n(visitor.from('events').select('id').not('title', 'like', 'RLS-TEST%')), 5],
  ['visitor: public updates', () => n(visitor.from('updates').select('id').not('body', 'like', 'RLS-TEST%')), 1],
  ['visitor: no exact place or online link (no grant at all)', () => n(visitor.from('event_links').select('event_id')), 'refused'],
  ['member 13–15: Budapest updates (2 published + own 2 waiting)', () => n(member1415.from('updates').select('id').eq('club_id', CLUB.budapest)), 4],
  ["member 13–15: Budapest projects (no one else's drafts)", () => n(member1415.from('projects').select('id').eq('club_id', CLUB.budapest)), 4],
  ['member 13–15: Budapest names (4 members)', () => n(member1415.from('club_member_names').select('user_id').eq('club_id', CLUB.budapest)), 4],
  ['member 13–15: sees no profile but their own', () => n(member1415.from('profiles').select('id')), 1],
  ['member 13–15: the Budapest thread posts', () => n(member1415.from('thread_posts').select('id').eq('thread_id', ROW.thread)), 3],
  ['lead: the roster, without age bands',
    async () => { const r = await rows(lead.rpc('club_roster', { p_club: CLUB.budapest })); return r === 'refused' ? r : r.filter((m) => (m as { age_band: unknown }).age_band === null).length },
    4],
  ['advisor: the roster, with age bands',
    async () => { const r = await rows(advisor.rpc('club_roster', { p_club: CLUB.budapest })); return r === 'refused' ? r : r.filter((m) => (m as { age_band: unknown }).age_band !== null).length },
    4],
  ["advisor: the Budapest events' exact places (as host)", () => n(advisor.from('event_links').select('event_id').in('event_id', BUDAPEST_EVENTS)), 2],
  ['member 13–15: exact places only where going (none)', () => n(member1415.from('event_links').select('event_id').in('event_id', SEED_EVENTS)), 0],
]

describe('the DEMO seed through the rules', () => {
  for (const [label, read, want] of checks) {
    test(label, async () => {
      const got = await read()
      if (got !== want) throw new Error(`got ${preview(got)}, want ${preview(want)}`)
    })
  }
})
