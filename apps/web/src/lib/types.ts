// The data model from docs/07-APP-SPEC.md §5, as the screens see it.
// R1b backs these with Supabase (RLS); until then the DEMO fixtures back them in review builds.

export const STRANDS = ['nature', 'economy', 'society', 'wellbeing'] as const
export type Strand = (typeof STRANDS)[number]
export const STRAND_LETTER: Record<Strand, string> = { nature: 'N', economy: 'E', society: 'S', wellbeing: 'W' }

export type AgeBand = '13-15' | '16-17' | 'adult'
export type ClubStatus = 'pending' | 'verified' | 'suspended'
export type MemberRole = 'member' | 'lead' | 'advisor'
export type MemberStatus = 'pending' | 'active' | 'left' | 'removed'
export type ContentStatus = 'draft' | 'pending' | 'published' | 'hidden'
export type ProjectStatus = 'draft' | 'proposed' | 'active' | 'completed'

export type Person = {
  id: string
  displayName: string // first name and initial only
  ageBand: AgeBand
  country: string
  isVerifiedAdult: boolean
  isAdmin?: boolean
}

export type Membership = { userId: string; role: MemberRole; status: MemberStatus }

export type Club = {
  id: string
  slug: string
  name: string
  schoolName: string
  city: string
  country: string // ISO-2
  lat: number // city centroid, 2 dp
  lng: number
  strands: Strand[]
  languages: string[]
  description: string
  status: ClubStatus
  verifiedAt: string | null
  lastActiveAt: string
  createdAt: string
  tz: string
  preApproval: boolean
  members: Membership[]
}

export type Project = {
  id: string
  clubId: string
  title: string
  strand: Strand
  problem: string
  action: string
  evidence: string
  reflection: string
  status: ProjectStatus
  visibility: 'public' | 'club'
  year: number
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
  team: string[]
  tasks: Task[]
  impacts?: Impact[] // R1b · 6: what the project changed, in numbers, and how it was counted
  links?: ProjectLink[] // members only: the project's own files
}

// R1b · 6, from the old site's ideas (Luke, 12 Oct): the task board, impact numbers, links, polls, follows.
export type TaskState = 'todo' | 'doing' | 'done'
export type Task = { id?: string; title: string; done: boolean; state?: TaskState }
export type Impact = { id?: string; label: string; value: number; unit: string; how: string }
export type ProjectLink = { id: string; label: string; url: string }
export type Poll = { id: string; threadId: string; question: string; options: string[]; votes: number[]; closesAt: string | null; closed: boolean; myChoice: number | null }

export type EventMode = 'in_person' | 'online' | 'hybrid'
export type ClubEvent = {
  id: string
  clubId: string
  title: string
  strand: Strand
  startsAt: string // ISO, UTC
  endsAt: string
  tz: string // the event's IANA zone
  mode: EventMode
  city: string // the public place: city-level only
  capacity: number | null
  visibility: 'public' | 'club'
  description: string
  placeDetail: string | null // event_links: shown only after RSVP
  onlineUrl: string | null // event_links: shown only after RSVP
  going: string[]
}

export type Update = {
  id: string
  clubId: string
  projectId: string | null
  authorId: string
  body: string
  hasPhoto: boolean
  visibility: 'club' | 'public'
  status: ContentStatus
  createdAt: string
  approvedBy: string | null
}

export type Thread = { id: string; clubId: string; title: string; posts: { id: string; authorId: string; body: string; createdAt: string }[] }

export type Resource = { id: string; strand: Strand; title: string; url: string; sourceName: string; description: string }

export type Report = {
  id: string
  targetLabel: string
  clubId: string | null
  reason: string
  details?: string // what the reporter wrote (admins and the club's advisor read it)
  priority: 'child_safety' | 'normal'
  status: 'open' | 'triaged' | 'actioned' | 'dismissed'
  aboutAdult: boolean
  createdAt: string
}

export type AuditEntry = { id: string; at: string; actor: string; action: string; target: string }

export type Verification = {
  id: string
  kind: 'advisor' | 'club'
  label: string
  step: 1 | 2 | 3 | 4
  status: 'waiting' | 'ready' | 'done'
  note: string
}

export type Db = {
  people: Person[]
  clubs: Club[]
  projects: Project[]
  events: ClubEvent[]
  updates: Update[]
  threads: Thread[]
  resources: Resource[]
  reports: Report[]
  audit: AuditEntry[]
  verifications: Verification[]
  follows?: { userId: string; clubId: string }[]
  polls?: (Omit<Poll, 'votes' | 'myChoice' | 'closed'> & { votes: { userId: string; choice: number }[] })[]
}

export const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', CH: 'Switzerland', CZ: 'Czechia', DE: 'Germany', HR: 'Croatia', HU: 'Hungary',
  LT: 'Lithuania', NL: 'Netherlands', PL: 'Poland', RO: 'Romania', SK: 'Slovakia', TR: 'Türkiye', US: 'United States',
}
