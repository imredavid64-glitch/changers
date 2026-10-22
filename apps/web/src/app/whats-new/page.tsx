import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { STRANDS, type Strand } from '@/lib/types'
import { getFeed } from '@/lib/features'
import { shortDate } from '@/lib/format'
import { first } from '@/lib/url'
import { Button, EndOfList, Empty, PageHeader, Segmented, StrandChip } from '@/components/ui'
import { ProjectCard } from '@/components/cards'

export const metadata: Metadata = { title: t('features')('feedTitle'), description: t('features')('feedIntro') }

// What's new (R1b · 6, from the old site's Home Feed): approved public projects and news from clubs, newest first,
// by strand. Chronological, no algorithm, and it ends (the old site's "no infinite scroll").
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function WhatsNewPage(props: Props) {
  const f = t('features')
  return (
    <div className="container page">
      <PageHeader title={f('feedTitle')} lead={f('feedIntro')} />
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Feed {...props} />
      </Suspense>
    </div>
  )
}

async function Feed({ searchParams }: Props) {
  const f = t('features')
  const s = t('strands')
  const sp = await searchParams
  const pick = first(sp.strand)
  const strand = STRANDS.includes(pick as Strand) ? (pick as Strand) : undefined
  const items = await getFeed(strand)
  return (
    <div className="stack">
      <Segmented label={f('feedTitle')} items={[
        { href: '/whats-new', label: f('feedAll'), current: !strand },
        ...STRANDS.map((st) => ({ href: `/whats-new?strand=${st}`, label: s(st), current: st === strand })),
      ]} />
      {/* The list's own heading (the cards' titles are h3): which strand it shows. */}
      <h2 className="visually-hidden">{strand ? s(strand) : f('feedAll')}</h2>
      {items.length ? (
        <ul className="feed">
          {items.map((item) => item.kind === 'project' ? (
            <ProjectCard key={`p-${item.project.id}`} project={item.project} eyebrow={<p className="t-meta">{f('feedProject')} · {shortDate(item.at)}</p>} />
          ) : (
            <li key={`u-${item.update.id}`} className="feed__item">
              <p className="t-meta">{f('feedUpdate')} · {shortDate(item.at)}</p>
              <article className="card feed__update">
                <p className="t-row-title"><Link className="link" href={`/clubs/${item.update.club.slug}`}>{item.update.club.name}</Link></p>
                <p>{item.update.body}</p>
                {item.update.strand ? <div className="chips"><StrandChip strand={item.update.strand} />{item.update.projectTitle ? <span className="t-meta">{item.update.projectTitle}</span> : null}</div> : null}
              </article>
            </li>
          ))}
        </ul>
      ) : <Empty text={f('feedEmpty')} />}
      <EndOfList text={items.length ? f('feedEnd') : ''} action={<Button href="/clubs" variant="secondary">{t('nav')('findClub')}</Button>} />
    </div>
  )
}
