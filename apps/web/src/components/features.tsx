import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, CalendarCheck, Flag, Lightbulb, Trophy, X } from 'lucide-react'
import { t, messages } from '@/i18n/t'
import { STRANDS, type Impact, type Poll, type Strand, type TaskState } from '@/lib/types'
import { getViewer } from '@/lib/viewer'
import { getClubHighlights, isFollowing, type Following, type Milestone, type ProjectTools as Tools } from '@/lib/features'
import { Form } from '@/components/Form'
import { ClubRow, EventRow } from '@/components/cards'
import { addImpact, addLink, addTask, followClub, moveTask, removeImpact, removeLink, startPoll, vote } from '@/app/actions/features'

// The club features brought over from the old site (R1b · 6). Server components; every write is a Form, which stays
// the DEMO form (nothing saved) in review builds.

const f = () => t('features')
const demo = () => t('ui')('demoNothingSaved')
const number = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(n)

/** A project's impact numbers: the number, what it counts, and how it was counted. */
export function ImpactList({ impacts, remove }: { impacts: (Impact & { id?: string })[]; remove?: { projectId: string } }) {
  if (!impacts.length) return null
  return (
    <ul className="impact-list">
      {impacts.map((i, k) => (
        <li key={i.id ?? k} className="impact">
          <p className="impact__value tnum">{number(i.value)}{i.unit ? <span className="impact__unit"> {i.unit}</span> : null}</p>
          <p className="impact__label">{i.label}</p>
          {i.how ? <p className="t-meta">{f()('impactHow', { how: i.how })}</p> : null}
          {remove && i.id ? (
            <Form action={removeImpact} demoNotice={demo()} className="impact__remove" hidden={{ id: i.id, project: remove.projectId }}>
              <button type="submit" className="btn btn-quiet btn-sm" aria-label={f()('removeLabel', { label: i.label })}><X size={18} aria-hidden="true" /> {f()('remove')}</button>
            </Form>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

const COLUMNS: TaskState[] = ['todo', 'doing', 'done']

/** The project's member tools: the task board, its numbers (with a form), and its files. Members of the club only. */
export function ProjectTools({ tools, projectId, isPublic }: { tools: Tools; projectId: string; isPublic: boolean }) {
  const label: Record<TaskState, string> = { todo: f()('todo'), doing: f()('doing'), done: f()('done') }
  return (
    <>
      <section id="board" className="project-section" aria-labelledby="board-h">
        <h2 id="board-h" className="t-h2-app">{f()('boardTitle')}</h2>
        <div className="board">
          {COLUMNS.map((col, ci) => {
            const tasks = tools.tasks.filter((x) => x.state === col)
            return (
              <section key={col} className={`board__col board__col--${col}`} aria-labelledby={`col-${col}`}>
                <h3 id={`col-${col}`} className="board__head">{label[col]} <span className="t-meta tnum">{tasks.length}</span></h3>
                {tasks.length ? (
                  <ul className="board__list">
                    {tasks.map((task) => (
                      <li key={task.id} className="board__task">
                        <span>{task.title}</span>
                        {tools.canEdit ? (
                          <span className="board__moves">
                            {ci > 0 ? (
                              <Form action={moveTask} demoNotice={demo()} className="" hidden={{ task: task.id, project: projectId, state: COLUMNS[ci - 1] }}>
                                <button type="submit" className="board__move" aria-label={f()('moveBack', { task: task.title })}><ArrowLeft size={18} aria-hidden="true" /></button>
                              </Form>
                            ) : null}
                            {ci < COLUMNS.length - 1 ? (
                              <Form action={moveTask} demoNotice={demo()} className="" hidden={{ task: task.id, project: projectId, state: COLUMNS[ci + 1] }}>
                                <button type="submit" className="board__move" aria-label={f()('moveOn', { task: task.title })}><ArrowRight size={18} aria-hidden="true" /></button>
                              </Form>
                            ) : null}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="t-meta board__empty">{f()('emptyColumn')}</p>}
              </section>
            )
          })}
        </div>
        {tools.canEdit ? (
          <Form action={addTask} demoNotice={demo()} className="inline-form" hidden={{ project: projectId }}>
            <label htmlFor="new-task" className="visually-hidden">{f()('taskTitle')}</label>
            <input id="new-task" name="title" className="input" placeholder={f()('taskTitle')} required maxLength={200} />
            <button type="submit" className="btn btn-secondary">{f()('addTask')}</button>
          </Form>
        ) : null}
      </section>

      {!isPublic || tools.canEdit ? (
        <section id="impact" className="project-section" aria-labelledby="impact-h">
          <h2 id="impact-h" className="t-h2-app">{isPublic ? f()('addImpact') : f()('impactTitle')}</h2>
          <p className="t-meta">{f()('impactIntro')}</p>
          {/* On a public project the numbers already show above (cached for everyone); here the team edits them. */}
          {!isPublic ? <ImpactList impacts={tools.impacts} remove={tools.canEdit ? { projectId } : undefined} /> : null}
          {tools.canEdit ? (
            <details className="add-block">
              <summary className="btn btn-secondary">{f()('addImpact')}</summary>
              {isPublic ? <ImpactList impacts={tools.impacts} remove={{ projectId }} /> : null}
              <Form action={addImpact} demoNotice={demo()} className="stack" hidden={{ project: projectId }}>
                <div className="field">
                  <label htmlFor="im-label">{f()('impactLabel')}</label>
                  <p id="im-label-help" className="help">{f()('impactLabelHelp')}</p>
                  <input id="im-label" name="label" className="input" required minLength={2} maxLength={80} aria-describedby="im-label-help" />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="im-value">{f()('impactValue')}</label>
                    <input id="im-value" name="value" className="input" type="number" inputMode="decimal" min={0} step="any" required />
                  </div>
                  <div className="field">
                    <label htmlFor="im-unit">{f()('impactUnit')}</label>
                    <p id="im-unit-help" className="help">{f()('impactUnitHelp')}</p>
                    <input id="im-unit" name="unit" className="input" maxLength={30} aria-describedby="im-unit-help" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="im-how">{f()('impactHowLabel')}</label>
                  <textarea id="im-how" name="how" className="textarea" maxLength={300} />
                </div>
                {isPublic ? <p className="t-meta">{f()('impactHeld')}</p> : null}
                <button type="submit" className="btn btn-primary">{f()('addImpact')}</button>
              </Form>
            </details>
          ) : null}
        </section>
      ) : null}

      <section id="files" className="project-section" aria-labelledby="files-h">
        <h2 id="files-h" className="t-h2-app">{f()('linksTitle')}</h2>
        <p className="t-meta">{f()('linksIntro')}</p>
        {tools.links.length ? (
          <ul className="link-list">
            {tools.links.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="link">{l.label}<ArrowUpRight size={16} aria-hidden="true" /></a>
                {tools.canEdit ? (
                  <Form action={removeLink} demoNotice={demo()} className="" hidden={{ id: l.id, project: projectId }}>
                    <button type="submit" className="btn btn-quiet btn-sm" aria-label={f()('removeLabel', { label: l.label })}><X size={18} aria-hidden="true" /> {f()('remove')}</button>
                  </Form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {tools.canEdit ? (
          <Form action={addLink} demoNotice={demo()} className="inline-form" hidden={{ project: projectId }}>
            <label htmlFor="ln-label" className="visually-hidden">{f()('linkLabel')}</label>
            <input id="ln-label" name="label" className="input" placeholder={f()('linkLabel')} required maxLength={80} />
            <label htmlFor="ln-url" className="visually-hidden">{f()('linkUrl')}</label>
            <input id="ln-url" name="url" className="input" type="url" placeholder={f()('linkUrl')} required pattern="https://.*" maxLength={500} />
            <button type="submit" className="btn btn-secondary">{f()('addLink')}</button>
          </Form>
        ) : null}
      </section>
    </>
  )
}

const MILESTONE_ICON: Record<Milestone['kind'], typeof BadgeCheck> = { verified: BadgeCheck, finished: Flag, hosted: Trophy, active: CalendarCheck }
const milestoneText = (m: Milestone) =>
  m.kind === 'verified' ? f()('verified')
  : m.kind === 'finished' ? (m.n === 1 ? f()('finishedOne') : f()('finishedMany', { n: m.n ?? 0 }))
  : m.kind === 'hosted' ? f()('hosted', { year: m.year ?? '' })
  : f()('active')

/** A club's milestones (worked out from what it did; never points for a person) and its impact so far. */
export async function ClubHighlights({ slug }: { slug: string }) {
  const { milestones, impacts } = await getClubHighlights(slug)
  if (!milestones.length && !impacts.length) return null
  return (
    <>
      {milestones.length ? (
        <section className="section-block" aria-labelledby="ms-h">
          <h2 id="ms-h" className="t-h2-app">{f()('milestonesTitle')}</h2>
          <ul className="milestones">
            {milestones.map((m) => { const Icon = MILESTONE_ICON[m.kind]; return <li key={`${m.kind}${m.year ?? ''}`} className="milestone"><Icon size={20} aria-hidden="true" /> {milestoneText(m)}</li> })}
          </ul>
        </section>
      ) : null}
      {impacts.length ? (
        <section className="section-block" aria-labelledby="ci-h">
          <h2 id="ci-h" className="t-h2-app">{f()('clubImpactTitle')}</h2>
          <ImpactList impacts={impacts.map((i) => ({ ...i, how: '' }))} />
        </section>
      ) : null}
    </>
  )
}

/** Follow a club (never a person). Signed out: the way to sign in. */
export async function FollowButton({ clubId, slug }: { clubId: string; slug: string }) {
  const viewer = await getViewer()
  if (viewer.kind !== 'user') return <Link href={`/sign-in?next=/clubs/${slug}`} className="btn btn-secondary">{f()('followSignIn')}</Link>
  if (viewer.memberships.some((m) => m.clubId === clubId)) return null // members already see everything
  const on = await isFollowing(viewer, clubId)
  return (
    <Form action={followClub} demoNotice={demo()} className="" hidden={{ club: clubId, slug, follow: on ? '0' : '1' }}>
      <button type="submit" className="btn btn-secondary" aria-describedby="follow-help" aria-pressed={on}>{on ? f()('following') : f()('follow')}</button>
      <span id="follow-help" className="visually-hidden">{f()('followHelp')}</span>
    </Form>
  )
}

/** Home: the clubs you follow, and what's coming up at them. */
export function FollowingBlock({ following }: { following: Following }) {
  return (
    <section className="section-block" aria-labelledby="fo-h">
      <h2 id="fo-h" className="t-h2-app">{f()('followedTitle')}</h2>
      {following.clubs.length ? <ul className="club-list">{following.clubs.map((c) => <ClubRow key={c.id} club={c} />)}</ul> : <p className="t-meta">{f()('followedEmpty')}</p>}
      {following.events.length ? (
        <>
          <h3 className="t-row-title follow-events">{f()('followedEvents')}</h3>
          <ul className="event-list">{following.events.map((e) => <EventRow key={e.id} event={e} level={3} />)}</ul>
        </>
      ) : null}
    </section>
  )
}

/** Starter ideas for a strand (people-written, no AI). On the new-project form each one fills the form in. */
export function IdeaStarters({ strand, startHref, nested }: { strand: Strand; startHref?: (index: number) => string; nested?: boolean }) {
  const ideas = messages.ideas[strand] as [string, string][]
  const i = t('ideas')
  const Wrap = nested ? 'div' : 'section'
  return (
    <Wrap className={nested ? 'ideas' : 'section-block ideas'} aria-labelledby={`ideas-${strand}`}>
      {nested
        ? <h2 id={`ideas-${strand}`} className="t-row-title">{t('strands')(strand)}</h2>
        : <h2 id={`ideas-${strand}`} className="t-h2-app"><Lightbulb size={24} aria-hidden="true" /> {i('title')}</h2>}
      <p className="t-meta">{i('intro', { strand: t('strands')(strand) })}</p>
      <ul className="idea-list">
        {ideas.map(([title, line], n) => (
          <li key={title} className="idea">
            <p className="idea__title">{title}</p>
            <p className="t-meta">{line}</p>
            {startHref ? <Link href={startHref(n)} className="link">{i('use')}</Link> : null}
          </li>
        ))}
      </ul>
    </Wrap>
  )
}

/** The idea a new project starts from (?idea=nature-0): its title, its line as the problem, its strand. */
export function ideaFrom(param: string | undefined): { strand: Strand; title: string; line: string } | null {
  const m = /^([a-z]+)-(\d)$/.exec(param ?? '')
  if (!m || !STRANDS.includes(m[1] as Strand)) return null
  const pair = (messages.ideas[m[1] as Strand] as [string, string][])[Number(m[2])]
  return pair ? { strand: m[1] as Strand, title: pair[0], line: pair[1] } : null
}

/** Resources: tools for the project itself (link out, never rebuilt here). */
export function ToolsShelf() {
  const k = t('tools')
  return (
    <section className="section-block" aria-labelledby="tools-h">
      <h2 id="tools-h" className="t-h2-strand">{k('title')}</h2>
      <p className="t-meta">{k('intro')}</p>
      <ul className="tool-list">
        {(messages.tools.list as [string, string, string][]).map(([name, line, url]) => (
          <li key={name} className="tool">
            <a href={url} target="_blank" rel="noopener noreferrer" className="tool__name link">{name}<ArrowUpRight size={16} aria-hidden="true" /></a>
            <p className="t-meta">{line}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A thread's polls: each choice with its count; members vote once and may change their vote. */
export function PollsBlock({ polls, threadId, slug }: { polls: Poll[]; threadId: string; slug: string }) {
  const mine = polls.filter((p) => p.threadId === threadId)
  return (
    <>
      {mine.map((p) => {
        const total = p.votes.reduce((a, b) => a + b, 0)
        const closed = p.closed
        return (
          <div key={p.id} className="poll card">
            <p className="t-row-title">{p.question}</p>
            <ul className="poll__options">
              {p.options.map((o, i) => (
                <li key={o} className={`poll__option${p.myChoice === i ? ' is-mine' : ''}`}>
                  <span className="poll__bar" style={{ width: `${total ? Math.round((p.votes[i] / total) * 100) : 0}%` }} aria-hidden="true" />
                  <span className="poll__text">{o}{p.myChoice === i ? <span className="t-meta"> · {f()('pollYours')}</span> : null}</span>
                  <span className="t-meta tnum">{f()('pollVotes', { count: p.votes[i] })}</span>
                  {!closed && p.myChoice !== i ? (
                    <Form action={vote} demoNotice={demo()} className="" hidden={{ poll: p.id, slug, choice: String(i) }}>
                      <button type="submit" className="btn btn-quiet btn-sm" aria-label={`${f()('pollVote')}: ${o}`}>{f()('pollVote')}</button>
                    </Form>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="t-meta">{closed ? f()('pollClosed') : f()('pollHelp')}</p>
          </div>
        )
      })}
      <details className="add-block">
        <summary className="btn btn-quiet btn-sm">{f()('pollAdd')}</summary>
        <Form action={startPoll} demoNotice={demo()} className="stack" hidden={{ thread: threadId, slug }}>
          <div className="field">
            <label htmlFor={`pq-${threadId}`}>{f()('pollQuestion')}</label>
            <input id={`pq-${threadId}`} name="question" className="input" required minLength={3} maxLength={200} />
          </div>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="field">
              <label htmlFor={`pc${n}-${threadId}`}>{f()('pollChoice', { n })}</label>
              <input id={`pc${n}-${threadId}`} name={`choice${n}`} className="input" maxLength={80} required={n <= 2} />
            </div>
          ))}
          <button type="submit" className="btn btn-secondary">{f()('pollStart')}</button>
        </Form>
      </details>
    </>
  )
}
