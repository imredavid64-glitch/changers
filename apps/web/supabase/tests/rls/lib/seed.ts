// The dev seed's facts the suite leans on (supabase/seed.dev.sql, made by scripts/seed-dev.mjs from the DEMO fixtures).
// Ids are the seed's own: a fixed UUID made from each fixture id, exactly as scripts/seed-dev.mjs makes them.
import crypto from 'node:crypto'

export const seedId = (fixtureId: string): string => {
  const h = crypto.createHash('sha1').update(`changemakers-demo:${fixtureId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// The DEMO people (seed.dev.users.json). Each one is `${persona}@example.test`.
export const PERSON = {
  adv1: seedId('u-adv1'),   // Demo T., verified adult, advisor of Budapest
  lead1: seedId('u-lead1'), // Demo L., 16–17, lead of Budapest
  mem1: seedId('u-mem1'),   // Demo A., 13–15, Budapest member (joined by invite)
  mem2: seedId('u-mem2'),   // Demo B., 16–17, Budapest member
  adv2: seedId('u-adv2'),   // Demo V., verified adult, advisor of Kaunas
  lead2: seedId('u-lead2'), // Demo K., 16–17, lead of Kaunas
  mem3: seedId('u-mem3'),   // Demo C., 13–15, Kaunas member
  adv7: seedId('u-adv7'),   // Demo Q., adult, NOT verified, advisor of the pending Kraków club
  admin: seedId('u-admin'), // Demo N., verified adult, network admin
} as const
export const emailOf = (persona: string) => `${persona}@example.test`

export const CLUB = {
  budapest: seedId('c1'), // verified, listed: advisor u-adv1, lead u-lead1, members u-mem1 (13–15), u-mem2 (16–17)
  kaunas: seedId('c2'),   // verified, listed: advisor u-adv2, lead u-lead2, member u-mem3 (13–15)
  krakow: seedId('c7'),   // pending: advisor u-adv7 (unverified), with an open advisor verification
  zagreb: seedId('c8'),   // verified but empty: unlisted
} as const

// Rows of the Budapest club the matrix reads (07 §3/§6 expectations depend on these facts).
export const ROW = {
  projectPublic: seedId('p1'),  // public, active, approved by u-adv1
  eventClubOnly: seedId('e5'),  // club-only planning meeting; going: u-lead1, u-mem2; has an exact place
  eventPublic: seedId('e1'),    // public, published, approved
  updateClub: seedId('up1'),    // club-only, published, by u-mem2
  updatePublic: seedId('up3'),  // public, published, approved by u-adv1
  updateWaiting: seedId('up2'), // club-only, pending, by u-mem1
  thread: seedId('t1'),         // "Ideas for November"
  threadPost: seedId('tp1'),    // published, by u-lead1
  resource: seedId('r1'),       // published
  audit: seedId('a3'),          // club.verify by u-admin
  verification: seedId('v1'),   // u-adv7's open advisor verification
  // R1b · 6 (club features, 12 Oct). p1's impact number has no fixed id (the seed gives impacts none): read it by project.
  projectLink: seedId('p1-l1'), // "Our plan" on p1: members only, though p1 itself is public
  poll: seedId('poll1'),        // in t1, three choices; votes: u-lead1 → 1, u-mem2 → 1, u-adv1 → 0
} as const
// The seed's follows: u-mem1 follows Kaunas (c2) and Vienna (c4). The suite's own follows only ever go to its twin clubs.
export const BUDAPEST_EVENTS = [seedId('e5'), seedId('e1')]
export const SEED_EVENTS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map(seedId)

// The ten actors of 07 §6 Tests, in the local suite's order, mapped onto the seed's people.
export const ACTORS = [
  'anon', 'member_1415', 'member_1617', 'lead', 'advisor', 'advisor_aal1',
  'unverified_adult', 'other_member', 'admin', 'admin_aal1',
] as const
export type ActorName = (typeof ACTORS)[number]
export type SignedIn = Exclude<ActorName, 'anon'>

export const ACTOR_PERSON: Record<SignedIn, { persona: keyof typeof PERSON; slug: string; aal: 'aal1' | 'aal2' }> = {
  member_1415: { persona: 'mem1', slug: 'u-mem1', aal: 'aal1' },
  member_1617: { persona: 'mem2', slug: 'u-mem2', aal: 'aal1' },
  lead: { persona: 'lead1', slug: 'u-lead1', aal: 'aal1' },
  // aal2 actors sign in first: a TOTP check ends the same person's aal1 sessions, so the aal1 twin comes after.
  advisor: { persona: 'adv1', slug: 'u-adv1', aal: 'aal2' },
  advisor_aal1: { persona: 'adv1', slug: 'u-adv1', aal: 'aal1' },
  // aal2, as in the local suite: an unverified adult has no powers even with the second factor.
  unverified_adult: { persona: 'adv7', slug: 'u-adv7', aal: 'aal2' },
  other_member: { persona: 'mem3', slug: 'u-mem3', aal: 'aal1' },
  admin: { persona: 'admin', slug: 'u-admin', aal: 'aal2' },
  admin_aal1: { persona: 'admin', slug: 'u-admin', aal: 'aal1' },
}
