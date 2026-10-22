import type { Metadata } from 'next'
import { Kinetic } from '@/components/Kinetic'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { getPublicClub, listListedSlugs, roleIn } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { EventRow, ProjectCard } from '@/components/cards'
import { Button, Empty, StrandChip, TrustLine } from '@/components/ui'
import { ContactAdvisor, ReportButton } from '@/components/client/Dialogs'
import { ClubHighlights, FollowButton } from '@/components/features'
import { contactLabels, reportLabels } from '@/components/labels'

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const slugs = await listListedSlugs()
  // Cache Components needs at least one param; with no listed clubs (the launch state) the sentinel 404s.
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: 'none' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublicClub(slug)
  return data ? { title: data.club.name, description: data.club.description } : {}
}

// A club's public page (PRD §5 route 3; docs/03 §6): Luma's calendar anatomy. Public data is cached;
// the join button depends on who is looking, so it streams in behind <Suspense>.
export default function ClubPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="container page" aria-busy="true" />}>
      <Club params={params} />
    </Suspense>
  )
}

async function Club({ params }: Props) {
  const { slug } = await params
  const data = await getPublicClub(slug)
  if (!data) notFound()
  const { club, projects, upcoming, past } = data
  const c = t('club')
  return (
    <div className="container page">
      <header className="club-head">
        <div className="strand-strip" aria-hidden="true">{club.strands.map((st) => <span key={st} className={`fill-${st}`} />)}</div>
        <Kinetic text={club.name} className="t-club-h1" />
        <p className="t-meta">{club.schoolName} · {club.city}, {club.countryName}</p>
        <div className="chips">{club.strands.map((s) => <StrandChip key={s} strand={s} />)}</div>
        <TrustLine verifiedAt={club.verifiedAt} />
        <p className="prose">{club.description}</p>
        <div className="club-head__actions">
          <Suspense fallback={<Button href="/join">{c('join')}</Button>}>
            <ClubAction clubId={club.id} slug={club.slug} />
          </Suspense>
          <Suspense fallback={null}>
            <FollowButton clubId={club.id} slug={club.slug} />
          </Suspense>
          <ContactAdvisor labels={contactLabels()} />
          <ReportButton labels={reportLabels()} subject={club.name} />
        </div>
      </header>

      <ClubHighlights slug={club.slug} />

      <section className="section-block" aria-labelledby="up-h">
        <h2 id="up-h" className="t-h2-app">{c('upcoming')}</h2>
        {upcoming.length ? (
          <ul className="event-list">{upcoming.map((e) => <EventRow key={e.id} event={e} showClub={false} />)}</ul>
        ) : (
          <Empty text={c('noEvents')} />
        )}
      </section>

      <section className="section-block" aria-labelledby="pr-h">
        <h2 id="pr-h" className="t-h2-app">{c('projects')}</h2>
        {projects.length ? (
          <ul className="grid-projects">{projects.map((p) => <ProjectCard key={p.id} project={p} />)}</ul>
        ) : (
          <Empty text={t('ui')('noProjects')} />
        )}
      </section>

      {past.length ? (
        <section className="section-block" aria-labelledby="past-h">
          <h2 id="past-h" className="t-h2-app">{c('past')}</h2>
          <ul className="event-list">{past.map((e) => <EventRow key={e.id} event={e} showClub={false} />)}</ul>
        </section>
      ) : null}

      <div className="end-of-list">
        <Suspense fallback={<Button href="/join">{c('join')}</Button>}>
          <ClubAction clubId={club.id} slug={club.slug} />
        </Suspense>
      </div>
    </div>
  )
}

/** One action per viewer: join, or open the club space; staff also see their approval queue. */
async function ClubAction({ clubId, slug }: { clubId: string; slug: string }) {
  const viewer = await getViewer()
  const role = roleIn(viewer, clubId)
  const c = t('club')
  const ui = t('ui')
  if (!role) return <Button href="/join">{c('join')}</Button>
  return (
    <>
      <Button href={`/clubs/${slug}/space`}>{ui('openSpace')}</Button>
      {role !== 'member' ? <Link href={`/clubs/${slug}/approvals`} className="btn btn-secondary">{ui('approvals')}</Link> : null}
    </>
  )
}
