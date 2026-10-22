import type { ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { t } from '@/i18n/t'
import type { ClubSummary, PublicEvent, PublicProject } from '@/lib/data'
import type { Resource } from '@/lib/types'
import { eventDay, monthYear, timeRange } from '@/lib/format'
import { DateCard, StrandChip, TrustLine } from './ui'
import { RelativeTime } from './client/RelativeTime'

/** A directory row: Roots & Shoots' fields in Luma's list-card geometry (docs/03 §5). The whole row is one link. */
export function ClubRow({ club, level = 3 }: { club: ClubSummary; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3'
  const d = t('directory')
  return (
    <li>
      <Link href={`/clubs/${club.slug}`} className="list-card club-row">
        <div className="club-row__main">
          <H className="t-card-title">{club.name}</H>
          <p className="t-meta">
            {club.schoolName} · {club.city}, {club.countryName}
          </p>
          <div className="chips">
            {club.strands.map((s) => (
              <StrandChip key={s} strand={s} />
            ))}
          </div>
        </div>
        <div className="club-row__side">
          <TrustLine verifiedAt={club.verifiedAt} />
          <p className="t-meta">
            <RelativeTime iso={club.lastActiveAt} template={d.raw('active') as string} fallback={monthYear(club.lastActiveAt)} />
          </p>
        </div>
      </Link>
    </li>
  )
}

export function modeLabel(mode: PublicEvent['mode']) {
  const ui = t('ui')
  return mode === 'online' ? ui('online') : mode === 'hybrid' ? ui('hybrid') : ui('inPerson')
}

/** An event row: Luma's timeline card with our 56×56 date card (docs/03 §6–7). */
export function EventRow({ event, showClub = true, level = 3 }: { event: PublicEvent; showClub?: boolean; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3'
  const ev = t('events')
  const day = eventDay(event.startsAt, event.tz)
  return (
    <li>
      <Link href={`/events/${event.id}`} className="list-card event-row">
        <DateCard iso={event.startsAt} tz={event.tz} />
        <div className="event-row__main">
          <H className="t-card-title">{event.title}</H>
          <p className="t-meta tnum">
            {day.long} · {timeRange(event.startsAt, event.endsAt, event.tz)}
          </p>
          <p className="t-meta">
            {showClub ? `${event.club.name} · ` : ''}
            {event.city} · {modeLabel(event.mode)}
          </p>
          <div className="chips">
            <StrandChip strand={event.strand} />
            {event.isPast ? <span className="status-tag">{ev('ended')}</span> : event.isFull ? <span className="status-tag">{ev('full')}</span> : null}
          </div>
        </div>
      </Link>
    </li>
  )
}

/** Iceberg's project card fields: name · mission · category (our strand) · city, country · year (docs/03 §9). */
export function ProjectCard({ project, eyebrow }: { project: Pick<PublicProject, 'id' | 'title' | 'problem' | 'strand' | 'year' | 'club'>; eyebrow?: ReactNode }) {
  return (
    <li className={eyebrow ? 'feed__item' : undefined}>
      {eyebrow}
      <Link href={`/projects/${project.id}`} className="card project-card">
        <h3 className="t-project-title">{project.title}</h3>
        <p className="t-meta clamp-2">{project.problem}</p>
        <div className="chips">
          <StrandChip strand={project.strand} />
        </div>
        <p className="t-meta tnum">
          {project.club.city}, {project.club.countryName} · {project.year}
        </p>
      </Link>
    </li>
  )
}

/** Are.na's channel block: each resource keeps its source (docs/03 §10). */
export function ResourceBlock({ resource, level = 3 }: { resource: Resource; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3'
  const r = t('resources')
  return (
    <li>
      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="card resource-block">
        <div>
          <H className="t-row-title">{resource.title}</H>
          <p className="t-meta clamp-3">{resource.description}</p>
        </div>
        <p className="t-meta resource-block__source">
          {r('from', { source: resource.sourceName })}
          <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
        </p>
      </a>
    </li>
  )
}
