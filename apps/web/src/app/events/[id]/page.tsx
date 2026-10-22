import type { Metadata } from 'next'
import { Kinetic } from '@/components/Kinetic'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Video } from 'lucide-react'
import { t } from '@/i18n/t'
import { getEventForViewer, getPublicEvent, listPublicEvents, type PublicEvent } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { eventDay, timeRange } from '@/lib/format'
import { modeLabel } from '@/components/cards'
import { DateCard, StrandChip, TrustLine } from '@/components/ui'
import { LocalTime } from '@/components/client/LocalTime'
import { RsvpCard } from '@/components/client/RsvpCard'
import { ReportButton } from '@/components/client/Dialogs'
import { reportLabels, rsvpLabels } from '@/components/labels'

type Props = { params: Promise<{ id: string }> }

export async function generateStaticParams() {
  const events = await listPublicEvents()
  return events.length ? events.map((e) => ({ id: e.id })) : [{ id: 'none' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const e = await getPublicEvent(id)
  return e ? { title: e.title, description: e.description } : { robots: { index: false } }
}

// An event (PRD §5 route 7; docs/03 §7): Luma's anatomy. The public part is cached; the RSVP state, the
// exact place and the online link depend on the viewer and stream in behind <Suspense>.
export default function EventPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="container page" aria-busy="true" />}>
      <Event params={params} />
    </Suspense>
  )
}

async function Event({ params }: Props) {
  const { id } = await params
  const e = await getPublicEvent(id)
  if (!e) notFound()
  const day = eventDay(e.startsAt, e.tz)
  const hostText = timeRange(e.startsAt, e.endsAt, e.tz)
  const ui = t('ui')
  return (
    <article className="container page event-layout">
      <Kinetic text={e.title} className="t-event-h1 event-title" />
      <aside className="event-aside">
        <p className="t-row-title"><Link className="link" href={`/clubs/${e.club.slug}`}>{ui('hostedBy', { club: e.club.name })}</Link></p>
        <TrustLine verifiedAt={e.club.verifiedAt} />
      </aside>
      <div className="event-main">
        <div className="icon-row">
          <DateCard iso={e.startsAt} tz={e.tz} />
          <div>
            <p className="t-row-title">{day.long}</p>
            <p className="t-meta">
              <LocalTime startIso={e.startsAt} endIso={e.endsAt} tz={e.tz} hostText={hostText} city={e.city} template={t('events').raw('time') as string} />
            </p>
          </div>
        </div>
        <div className="icon-row">
          <span className="icon-box">{e.mode === 'online' ? <Video size={24} aria-hidden="true" /> : <MapPin size={24} aria-hidden="true" />}</span>
          <div>
            <p className="t-row-title">{e.mode === 'online' ? modeLabel(e.mode) : e.city}</p>
            <p className="t-meta">{e.mode === 'online' ? e.club.city : modeLabel(e.mode)}</p>
          </div>
        </div>
        <Suspense fallback={<Rsvp event={e} signedIn={false} going={false} canRsvp={false} links={null} />}>
          <ViewerRsvp event={e} />
        </Suspense>
        <p className="prose">{e.description}</p>
        <div className="chips"><StrandChip strand={e.strand} /></div>
        <div className="end-of-list">
          <Link href={`/clubs/${e.club.slug}`} className="btn btn-secondary">{ui('seeClub')}</Link>
          <ReportButton labels={reportLabels()} subject={e.title} />
        </div>
      </div>
    </article>
  )
}

async function ViewerRsvp({ event }: { event: PublicEvent }) {
  const viewer = await getViewer()
  const v = await getEventForViewer(viewer, event.id)
  if (!v.signedIn) return <Rsvp event={event} signedIn={false} going={false} canRsvp={false} links={null} />
  return <Rsvp event={event} signedIn going={v.going} canRsvp={v.canRsvp} links={v.links} />
}

function Rsvp({ event, signedIn, going, canRsvp, links }: { event: PublicEvent; signedIn: boolean; going: boolean; canRsvp: boolean; links: { placeDetail: string | null; onlineUrl: string | null } | null }) {
  return (
    <RsvpCard
      labels={rsvpLabels()}
      state={event.isPast ? 'ended' : event.isFull ? 'full' : 'open'}
      signedIn={signedIn}
      canRsvp={canRsvp}
      initiallyGoing={going}
      links={links}
      mode={event.mode}
      icsHref={`/events/${event.id}/ics`}
      signInHref={`/sign-in?next=${encodeURIComponent(`/events/${event.id}`)}`}
    />
  )
}
