import type { Metadata } from 'next'
import { t } from '@/i18n/t'
import { listPublicEvents, PAGE_SIZE } from '@/lib/data'
import { EventRow } from '@/components/cards'
import { Button, Empty, EndOfList, PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: t('nav')('events'), description: t('events')('intro') }

// Upcoming public events of listed clubs (PRD §5 route 7): a timeline, finite, 20 per page.
export default async function EventsPage() {
  const all = await listPublicEvents()
  const upcoming = all.filter((e) => !e.isPast).slice(0, PAGE_SIZE)
  const ev = t('events')
  const ui = t('ui')
  const c = t('club')
  return (
    <div className="container page">
      <PageHeader title={t('nav')('events')} lead={ev('intro')} />
      {upcoming.length ? (
        <>
          <ul className="event-list">{upcoming.map((e) => <EventRow key={e.id} event={e} level={2} />)}</ul>
          <EndOfList text={ui('eventsEnd')} action={<Button href="/clubs" variant="secondary">{t('nav')('findClub')}</Button>} />
        </>
      ) : (
        <Empty text={c('noEvents')} action={<Button href="/clubs">{t('nav')('findClub')}</Button>} />
      )}
    </div>
  )
}
