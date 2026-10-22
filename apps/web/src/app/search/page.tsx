import type { Metadata } from 'next'
import { Suspense } from 'react'
import { t } from '@/i18n/t'
import { searchPublic } from '@/lib/features'
import { first } from '@/lib/url'
import { Empty, PageHeader } from '@/components/ui'
import { ClubRow, EventRow, ProjectCard } from '@/components/cards'

export const metadata: Metadata = { title: t('features')('searchTitle'), robots: { index: false } }

// Search (R1b · 6, from the old site's Search): clubs, projects and events. Never people (07 §8: no profiles).
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function SearchPage(props: Props) {
  return (
    <div className="container page">
      <PageHeader title={t('features')('searchTitle')} />
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Results {...props} />
      </Suspense>
    </div>
  )
}

async function Results({ searchParams }: Props) {
  const f = t('features')
  const q = (first((await searchParams).q) ?? '').trim()
  const r = q.length >= 2 ? await searchPublic(q) : null
  const none = r && !r.clubs.length && !r.projects.length && !r.events.length
  return (
    <div className="stack">
      <form action="/search" role="search" className="search-page">
        <label htmlFor="search-q" className="visually-hidden">{f('searchLabel')}</label>
        <input id="search-q" name="q" type="search" className="input" defaultValue={q} placeholder={f('searchLabel')} minLength={2} maxLength={60} />
        <button type="submit" className="btn btn-primary">{f('searchSubmit')}</button>
      </form>
      {!r ? (q ? <p className="t-meta">{f('searchShort')}</p> : null) : none ? <Empty text={f('searchNone', { q })} /> : (
        <>
          {r.clubs.length ? (
            <section className="section-block" aria-labelledby="sr-clubs">
              <h2 id="sr-clubs" className="t-h2-app">{f('searchClubs')}</h2>
              <ul className="club-list">{r.clubs.map((c) => <ClubRow key={c.id} club={c} />)}</ul>
            </section>
          ) : null}
          {r.projects.length ? (
            <section className="section-block" aria-labelledby="sr-projects">
              <h2 id="sr-projects" className="t-h2-app">{f('searchProjects')}</h2>
              <ul className="grid-projects">{r.projects.map((p) => <ProjectCard key={p.id} project={p} />)}</ul>
            </section>
          ) : null}
          {r.events.length ? (
            <section className="section-block" aria-labelledby="sr-events">
              <h2 id="sr-events" className="t-h2-app">{f('searchEvents')}</h2>
              <ul className="event-list">{r.events.map((e) => <EventRow key={e.id} event={e} />)}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
