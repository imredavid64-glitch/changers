import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ImagePlus } from 'lucide-react'
import { t } from '@/i18n/t'
import { getSpace } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { eventDay, shortDate, timeRange } from '@/lib/format'
import { first } from '@/lib/url'
import { DateCard, Empty, Segmented, SignInGate, StrandChip } from '@/components/ui'
import { ReportButton } from '@/components/client/Dialogs'
import { Form } from '@/components/Form'
import { FactorPrompt } from '@/components/FactorPrompt'
import { PollsBlock } from '@/components/features'
import { getPolls } from '@/lib/features'
import { postUpdate, replyThread, startThread } from '@/app/actions/content'
import { reportLabels } from '@/components/labels'
import { Swap } from '@/components/Swap'

export const metadata: Metadata = { title: t('ui')('clubSpace'), robots: { index: false } }

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }
const TABS = ['updates', 'projects', 'events', 'threads', 'members'] as const
type Tab = (typeof TABS)[number]

// The members' area (PRD §5 route 4): club-only content, members of this club only (07 §6). Request time.
export default function SpacePage(props: Props) {
  return (
    <div className="container page">
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Space {...props} />
      </Suspense>
    </div>
  )
}

async function Space({ params, searchParams }: Props) {
  const [{ slug }, sp, viewer] = await Promise.all([params, searchParams, getViewer()])
  // A teacher signed in without the authenticator app can't read the club yet (07 §4): say how, instead of a gate.
  if (viewer.kind === 'user' && viewer.needsFactor && viewer.memberships.some((m) => m.role === 'advisor')) return <FactorPrompt next={`/clubs/${slug}/space`} />
  const space = await getSpace(viewer, slug)
  const polls = space && first(sp.tab) === 'threads' ? await getPolls(viewer, space.club.id) : []
  if (!space) return <SignInGate next={`/clubs/${slug}/space`} note={t('ui')('membersOnly')} />
  const c = t('club')
  const ui = t('ui')
  const tab: Tab = TABS.find((x) => x === first(sp.tab)) ?? 'updates'
  const tabs = [
    ['updates', c('tabUpdates')], ['projects', c('tabProjects')], ['events', c('tabEvents')], ['threads', c('tabThreads')], ['members', c('tabMembers')],
  ] as const
  const demo = ui('demoNothingSaved')

  return (
    <>
      <header className="space-head">
        <p className="t-meta"><Link className="link" href={`/clubs/${slug}`}>{c('seePublic')}</Link></p>
        <h1 className="t-page-h1">{space.club.name}</h1>
        <div className="space-head__row">
          <Segmented label={space.club.name} items={tabs.map(([k, label]) => ({ href: `/clubs/${slug}/space${k === 'updates' ? '' : `?tab=${k}`}`, label, current: tab === k }))} />
          {space.staff ? (
            <div className="space-head__staff">
              <Link href={`/clubs/${slug}/approvals`} className="btn btn-secondary btn-sm">{ui('approvals')}</Link>
              <Link href={`/clubs/${slug}/settings`} className="btn btn-quiet btn-sm">{ui('settings')}</Link>
            </div>
          ) : null}
        </div>
      </header>

      <Swap k={tab} name="space-tab">
      <div>
      <h2 className="visually-hidden">{tabs.find(([k]) => k === tab)?.[1]}</h2>
      {tab === 'updates' ? (
        <section className="stack">
          <Form action={postUpdate} demoNotice={demo} className="card composer stack" hidden={{ club: space.club.id, slug }}>
            <label htmlFor="composer" className="t-row-title">{c('composer')}</label>
            <textarea id="composer" className="textarea" name="body" required />
            <div className="composer__row">
              <label className="btn btn-quiet btn-sm">
                <ImagePlus size={20} aria-hidden="true" /> {c('addPhotos')}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="visually-hidden" />
              </label>
              <button type="submit" className="btn btn-primary">{ui('post')}</button>
            </div>
            <p className="t-meta">{c('heldNote')}</p>
          </Form>
          {space.updates.length ? (
            <ul className="update-list">
              {space.updates.map((u) => (
                <li key={u.id} className="card update-item">
                  <p className="t-meta">{ui('byline', { name: u.author, date: shortDate(u.createdAt) })}{u.status === 'pending' ? ` · ${ui('waiting')}` : ''}</p>
                  <p>{u.body}</p>
                  {/* Reporting your own post makes no sense; everyone else's has the button. */}
                  {viewer.kind === 'user' && u.authorId === viewer.person.id ? null : <ReportButton labels={reportLabels()} subject={u.body} />}
                </li>
              ))}
            </ul>
          ) : <Empty text={ui('noUpdates')} />}
        </section>
      ) : null}

      {tab === 'projects' ? (
        <section className="stack">
          <div><Link href={`/clubs/${slug}/projects/new`} className="btn btn-primary">{t('projects')('start')}</Link></div>
          {space.projects.length ? (
            <ul className="grid-projects">
              {space.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="card project-card">
                    <h3 className="t-project-title">{p.title}</h3>
                    <p className="t-meta clamp-2">{p.problem}</p>
                    <div className="chips"><StrandChip strand={p.strand} /><span className="status-tag">{statusLabel(p.status)}</span></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty text={ui('noProjects')} />}
        </section>
      ) : null}

      {tab === 'events' ? (
        <section className="stack">
          {space.staff ? <div><Link href={`/clubs/${slug}/events/new`} className="btn btn-primary">{ui('hostEvent')}</Link></div> : null}
          {space.events.length ? (
            <ul className="event-list">
              {space.events.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="list-card event-row">
                    <DateCard iso={e.startsAt} tz={e.tz} />
                    <div className="event-row__main">
                      <h3 className="t-card-title">{e.title}</h3>
                      <p className="t-meta tnum">{eventDay(e.startsAt, e.tz).long} · {timeRange(e.startsAt, e.endsAt, e.tz)}</p>
                      <div className="chips"><StrandChip strand={e.strand} />{e.isGoing ? <span className="status-tag">{ui('youAreGoing')}</span> : null}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty text={space.staff ? c('noEventsStaff') : c('noEvents')} action={space.staff ? <Link href={`/clubs/${slug}/events/new`} className="btn btn-primary">{ui('hostEvent')}</Link> : undefined} />}
        </section>
      ) : null}

      {tab === 'threads' ? (
        <section className="stack">
          {space.threads.length ? space.threads.map((th) => (
            <article key={th.id} className="card thread">
              <h2 className="t-card-title">{th.title}</h2>
              <ul className="thread__posts">
                {th.posts.map((p) => (
                  <li key={p.id}>
                    <p className="t-meta">{ui('byline', { name: p.author, date: shortDate(p.createdAt) })}</p>
                    <p>{p.body}</p>
                  </li>
                ))}
              </ul>
              <PollsBlock polls={polls} threadId={th.id} slug={slug} />
              <Form action={replyThread} demoNotice={demo} className="thread__reply" hidden={{ thread: th.id, slug }}>
                <label htmlFor={`reply-${th.id}`} className="visually-hidden">{ui('threadReply')}</label>
                <textarea id={`reply-${th.id}`} className="textarea" name="body" required />
                <button type="submit" className="btn btn-secondary">{ui('threadReply')}</button>
              </Form>
            </article>
          )) : <Empty text={ui('noThreads')} />}
          <Form action={startThread} demoNotice={demo} className="card composer stack" hidden={{ club: space.club.id, slug }}>
            <label htmlFor="new-thread" className="t-row-title">{ui('newThread')}</label>
            <input id="new-thread" className="input" name="title" required minLength={3} maxLength={120} />
            <button type="submit" className="btn btn-primary">{ui('newThread')}</button>
          </Form>
        </section>
      ) : null}

      {tab === 'members' ? (
        <section className="stack">
          <ul className="member-list card">
            {space.members.map((m) => (
              <li key={m.name}><span>{m.name}</span><span className="t-meta">{roleLabel(m.role)}</span></li>
            ))}
          </ul>
          {space.staff ? <div><Link href={`/clubs/${slug}/settings`} className="btn btn-secondary">{ui('settings')}</Link></div> : null}
        </section>
      ) : null}
      </div>
      </Swap>
    </>
  )
}

function statusLabel(s: string) {
  const p = t('projects')
  return s === 'draft' ? p('statusDraft') : s === 'proposed' ? p('statusProposed') : s === 'completed' ? p('statusCompleted') : p('statusActive')
}
function roleLabel(r: string) {
  const s = t('settings')
  return r === 'advisor' ? s('roleAdvisor') : r === 'lead' ? s('roleLead') : s('roleMember')
}
