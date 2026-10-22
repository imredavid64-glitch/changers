import type { Metadata } from 'next'
import { Kinetic } from '@/components/Kinetic'
import { notFound } from 'next/navigation'
import { t } from '@/i18n/t'
import { getStrand } from '@/lib/data'
import { IdeaStarters } from '@/components/features'
import { STRANDS, STRAND_LETTER, type Strand } from '@/lib/types'
import { ClubRow, EventRow, ProjectCard, ResourceBlock } from '@/components/cards'
import { Button, Empty } from '@/components/ui'

type Props = { params: Promise<{ strand: string }> }

export function generateStaticParams() {
  return STRANDS.map((strand) => ({ strand }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { strand } = await params
  if (!STRANDS.includes(strand as Strand)) return {}
  const s = t('strands')
  return { title: s(strand as Strand), description: s(`${strand as Strand}Line`) }
}

// A strand page (PRD §5 route 9; docs/03 §8): Luma's category anatomy with the strand's fill and letter.
// No counters until the numbers are real (networkCounters off).
export default async function StrandPage({ params }: Props) {
  const { strand } = await params
  if (!STRANDS.includes(strand as Strand)) notFound()
  const st = strand as Strand
  const data = await getStrand(st)
  const s = t('strands')
  const ui = t('ui')
  const c = t('club')
  return (
    <>
    <header className={`strand-hero fill-${st} tile-${STRAND_LETTER[st].toLowerCase()}`}>
      <span className="strand-hero__letter tile__letter" aria-hidden="true">{STRAND_LETTER[st]}</span>
      <div className="container">
        <Kinetic text={s(st)} className="t-strand-h1" />
        <p>{s(`${st}Line`)}</p>
      </div>
    </header>
    <div className="container page">

      <section className="section-block" aria-labelledby="sc-h">
        <h2 id="sc-h" className="t-h2-strand">{ui('clubsWorking')}</h2>
        {data.clubs.length ? <ul className="club-list">{data.clubs.map((cl) => <ClubRow key={cl.id} club={cl} />)}</ul> : <Empty text={t('directory')('empty')} action={<Button href="/start">{t('nav')('startClub')}</Button>} />}
      </section>

      <section className="section-block" aria-labelledby="se-h">
        <h2 id="se-h" className="t-h2-strand">{ui('upcomingEvents')}</h2>
        {data.events.length ? <ul className="event-list">{data.events.map((e) => <EventRow key={e.id} event={e} />)}</ul> : <Empty text={c('noEvents')} />}
      </section>

      <section className="section-block" aria-labelledby="sp-h">
        <h2 id="sp-h" className="t-h2-strand">{c('projects')}</h2>
        {data.projects.length ? <ul className="grid-projects">{data.projects.map((p) => <ProjectCard key={p.id} project={p} />)}</ul> : <Empty text={ui('noProjects')} />}
      </section>

      <IdeaStarters strand={st} />

      <section className="section-block" aria-labelledby="sr-h">
        <h2 id="sr-h" className="t-h2-strand">{t('resources')('title')}</h2>
        {data.resources.length ? <ul className="grid-resources">{data.resources.map((r) => <ResourceBlock key={r.id} resource={r} />)}</ul> : null}
      </section>

      <div className="end-of-list">
        <Button href={`/clubs?strand=${st}`}>{t('nav')('findClub')}</Button>
        <Button href={`/whats-new?strand=${st}`} variant="secondary">{t('features')('feedLink')}</Button>
      </div>
    </div>
    </>
  )
}
