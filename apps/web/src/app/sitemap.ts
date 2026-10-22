import type { MetadataRoute } from 'next'
import { listListedSlugs, listPublicEvents, listPublicProjectIds } from '@/lib/data'
import { STRANDS } from '@/lib/types'

// Public pages only: listed clubs, public projects and events, strands and resources (PRD §4: the
// sitemap reads through the same listing rule, so an unlisted club never appears here either).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:4401'
  const [slugs, projects, events] = await Promise.all([listListedSlugs(), listPublicProjectIds(), listPublicEvents()])
  const paths = [
    '/', '/clubs', '/events', '/resources', '/teachers', '/start', '/join',
    '/privacy', '/privacy/adults', '/terms', '/code-of-conduct', '/safeguarding', '/about',
    ...STRANDS.map((s) => `/strands/${s}`), ...STRANDS.map((s) => `/resources/${s}`),
    ...slugs.map((s) => `/clubs/${s}`), ...projects.map((id) => `/projects/${id}`), ...events.map((e) => `/events/${e.id}`),
  ]
  return paths.map((p) => ({ url: `${base}${p}` }))
}
