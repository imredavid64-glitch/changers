import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FactorPrompt } from '@/components/FactorPrompt'
import { FollowingBlock } from '@/components/features'
import { getFollowing } from '@/lib/features'
import { t } from '@/i18n/t'
import { getDashboard } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { eventDay, timeRange } from '@/lib/format'
import { Button, DateCard, EndOfList, SignInGate, StrandChip } from '@/components/ui'

export const metadata: Metadata = { title: t('nav')('home'), robots: { index: false } }

// The dashboard (PRD §5 route 13): my clubs, next events, projects that need me, items awaiting my
// approval. Finite, with no feed, and it ends with "You're all caught up." once nothing waits for the viewer.
// v6.2 (Luke, 11 Oct: "more user-friendly … once they actually sign in"): approvals first when any wait, each club
// offers Post update and Start a project, and a project shows its next task.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function HomePage({ searchParams }: Props) {
  return (
    <div className="container page">
      <h1 className="t-page-h1">{t('nav')('home')}</h1>
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Dashboard({ searchParams }: Props) {
  const [viewer, sp] = await Promise.all([getViewer(), searchParams])
  if (viewer.kind === 'visitor' && viewer.needsWelcome) redirect('/welcome')
  const [data, following] = await Promise.all([getDashboard(viewer), getFollowing(viewer)])
  if (!data) return <SignInGate next="/home" />
  const d = t('dashboard')
  const ui = t('ui')
  return (
    <div className="dashboard">
      {sp.joined ? <p className="card notice" role="status">{t('live')('requestSent')}</p> : null}
      {viewer.kind === 'user' && viewer.needsFactor ? <FactorPrompt next="/home" /> : null}
      {/* Staff: what waits for them comes first, since nothing moves until they act on it. */}
      {data.approvalLinks.length ? (
        <section className="section-block" aria-labelledby="wa-h">
          <h2 id="wa-h" className="t-h2-app">{d('approval')}</h2>
          <ul className="club-list">
            {data.approvalLinks.map((a) => (
              <li key={a.slug}>
                <Link href={`/clubs/${a.slug}/approvals`} className="list-card club-row">
                  <p className="t-row-title">{ui('approvalsLink', { count: a.count, club: a.name })}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section-block" aria-labelledby="mc-h">
        <h2 id="mc-h" className="t-h2-app">{d('myClubs')}</h2>
        {data.clubs.length ? (
          <ul className="club-list">
            {data.clubs.map((c) => (
              <li key={c.id} className="club-entry">
                <Link href={`/clubs/${c.slug}/space`} className="list-card club-row">
                  <div className="club-row__main">
                    <h3 className="t-card-title">{c.name}</h3>
                    <p className="t-meta">{c.schoolName} · {c.city}, {c.countryName}</p>
                  </div>
                  <div className="chips">{c.strands.map((s) => <StrandChip key={s} strand={s} />)}</div>
                </Link>
                <div className="club-entry__actions">
                  <Link href={`/clubs/${c.slug}/space#composer`} className="btn btn-secondary btn-sm">{ui('post')}</Link>
                  <Link href={`/clubs/${c.slug}/projects/new`} className="btn btn-quiet btn-sm">{t('projects')('start')}</Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty card"><p>{ui('noClubs')}</p><Button href="/clubs">{t('nav')('findClub')}</Button></div>
        )}
      </section>

      {following ? <FollowingBlock following={following} /> : null}

      <section className="section-block" aria-labelledby="ne-h">
        <h2 id="ne-h" className="t-h2-app">{d('nextEvents')}</h2>
        {data.nextEvents.length ? (
          <ul className="event-list">
            {data.nextEvents.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="list-card event-row">
                  <DateCard iso={e.startsAt} tz={e.tz} />
                  <div className="event-row__main">
                    <h3 className="t-card-title">{e.title}</h3>
                    <p className="t-meta tnum">{eventDay(e.startsAt, e.tz).long} · {timeRange(e.startsAt, e.endsAt, e.tz)} · {e.city}</p>
                    {e.going ? <span className="status-tag">{ui('youAreGoing')}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="t-meta">{t('club')('noEvents')}</p>}
      </section>

      <section className="section-block" aria-labelledby="nd-h">
        <h2 id="nd-h" className="t-h2-app">{d('needYou')}</h2>
        {data.needYou.length ? (
          <ul className="club-list">
            {data.needYou.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="list-card club-row">
                  <div className="club-row__main">
                    <h3 className="t-card-title">{p.title}</h3>
                    <p className="t-meta">{p.next ? d('nextTask', { task: p.next }) : ui('openTasks', { count: p.open })}</p>
                  </div>
                  <StrandChip strand={p.strand} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="t-meta">{ui('noProjects')}</p>}
      </section>

      <EndOfList text={data.waiting ? '' : d('caughtUp')} action={<Button href="/clubs" variant="secondary">{t('nav')('findClub')}</Button>} />
    </div>
  )
}
