import 'server-only'
import { cacheLife } from 'next/cache'
import { demoMode, switches } from '@/config/switches'
import { getDirectory } from './data'
import { RESEARCH } from './network-research'

// The places on the landing map, one per city, at the city's centre (2 dp): never a school's address (07 §privacy). Review builds (DEMO) and switches.conferenceSchools show the research
// layer: Changemaker Conference editions and the schools their public pages list. Otherwise the globe shows only
// listed clubs (getDirectory applies the listing rules), so nothing unconfirmed is named at launch.

export type Fact = { text: string; source: string }
export type MapSchool = {
  name: string; href: string | null; years: number[]
  website: string | null
  /** About the school; what its students do; what it did at the conference. Every fact has its source. */
  profile: Fact[]; doing: Fact[]; atConference: (Fact & { year: number | null })[]
}
export type MapConference = { year: number; dates: string; host: string; url: string; next: boolean; highlights: Fact[] }
export type MapPlace = {
  id: string; city: string; country: string; lat: number; lng: number
  kind: 'next' | 'host' | 'school'; schools: MapSchool[]; conferences: MapConference[]
}
export type NetworkMap = {
  places: MapPlace[]
  /** The conference's journey, one arc per year to the next host. */
  route: { from: [number, number]; to: [number, number]; next: boolean }[]
  checked: string | null
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

export async function getNetworkMap(): Promise<NetworkMap> {
  'use cache'
  cacheLife('hours')
  if (demoMode || switches.conferenceSchools) return researchMap()
  const { clubs } = await getDirectory()
  const byCity = new Map<string, MapPlace>()
  for (const c of clubs) {
    const id = slug(`${c.city}-${c.country}`)
    const place = byCity.get(id) ?? { id, city: c.city, country: c.countryName, lat: c.lat, lng: c.lng, kind: 'school' as const, schools: [], conferences: [] }
    place.schools.push({ name: c.schoolName, href: `/clubs/${c.slug}`, years: [], website: null, profile: [], doing: [], atConference: [] })
    byCity.set(id, place)
  }
  return { places: [...byCity.values()], route: [], checked: null }
}

function researchMap(): NetworkMap {
  const now = new Date().toISOString().slice(0, 10)
  const conferences = [...RESEARCH.conferences].sort((a, b) => a.year - b.year)
  // The next conference: the first one that hasn't ended yet (Kaunas stays "next" until 13 Mar 2027).
  const nextYear = conferences.find((c) => c.ends >= now)?.year ?? null
  const byCity = new Map<string, MapPlace>()
  const place = (city: string, country: string, lat: number, lng: number) => {
    const id = slug(`${city}-${country}`)
    if (!byCity.has(id)) byCity.set(id, { id, city, country, lat, lng, kind: 'school', schools: [], conferences: [] })
    return byCity.get(id)!
  }
  for (const s of RESEARCH.schools) {
    // What students do: the first pass's facts, then the detail pass's, without repeats.
    const doing = [...s.facts, ...s.changemaking].filter((f, i, all) => all.findIndex((g) => g.text === f.text) === i)
    place(s.city, s.country, s.lat, s.lng).schools.push({
      name: s.name, href: null, years: s.years.map((y) => y.year).sort(),
      website: s.website, profile: s.profile, doing, atConference: s.conference,
    })
  }
  for (const c of conferences) {
    const p = place(c.city, c.country, c.lat, c.lng)
    const next = c.year === nextYear
    p.conferences.push({ year: c.year, dates: c.dates, host: c.host, url: c.url, next, highlights: c.highlights })
    p.kind = next ? 'next' : p.kind === 'next' ? 'next' : 'host'
  }
  // One arc per move to a new host city (Frankfurt ran both 2022 and 2023, so that leg has no arc).
  const route = conferences.slice(1).map((c, i) => ({
    from: [conferences[i].lat, conferences[i].lng] as [number, number], to: [c.lat, c.lng] as [number, number], next: c.year === nextYear,
  })).filter((a) => a.from[0] !== a.to[0] || a.from[1] !== a.to[1])
  return { places: [...byCity.values()], route, checked: RESEARCH.checked }
}
