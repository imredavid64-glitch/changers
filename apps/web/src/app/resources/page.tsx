import type { Metadata } from 'next'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { listResources } from '@/lib/data'
import { ToolsShelf } from '@/components/features'
import { STRANDS } from '@/lib/types'
import { ResourceBlock } from '@/components/cards'
import { Button, PageHeader, StrandBadge } from '@/components/ui'

export const metadata: Metadata = { title: t('resources')('title'), description: t('resources')('intro') }

// Resources as channels (PRD §5 route 10; docs/03 §10): one channel per strand; each block keeps its source.
export default async function ResourcesPage() {
  const all = await listResources()
  const s = t('strands')
  const r = t('resources')
  return (
    <div className="container page">
      <PageHeader title={r('title')} lead={r('intro')} />
      {STRANDS.map((st) => {
        const items = all.filter((x) => x.strand === st)
        return (
          <section key={st} className="section-block" aria-labelledby={`r-${st}`}>
            <div className="channel-head">
              <StrandBadge strand={st} size={48} />
              <h2 id={`r-${st}`} className="t-h2-strand"><Link href={`/resources/${st}`}>{s(st)}</Link></h2>
            </div>
            {items.length ? <ul className="grid-resources">{items.map((x) => <ResourceBlock key={x.id} resource={x} />)}</ul> : null}
          </section>
        )
      })}
      <ToolsShelf />
      <div className="end-of-list"><Button href="/clubs">{t('nav')('findClub')}</Button></div>
    </div>
  )
}
