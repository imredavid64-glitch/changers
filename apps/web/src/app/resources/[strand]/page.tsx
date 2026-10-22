import type { Metadata } from 'next'
import { Kinetic } from '@/components/Kinetic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { listResources } from '@/lib/data'
import { STRANDS, STRAND_LETTER, type Strand } from '@/lib/types'
import { ResourceBlock } from '@/components/cards'
import { Button } from '@/components/ui'

type Props = { params: Promise<{ strand: string }> }

export function generateStaticParams() {
  return STRANDS.map((strand) => ({ strand }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { strand } = await params
  return STRANDS.includes(strand as Strand) ? { title: `${t('resources')('title')} · ${t('strands')(strand as Strand)}` } : {}
}

export default async function StrandResourcesPage({ params }: Props) {
  const { strand } = await params
  if (!STRANDS.includes(strand as Strand)) notFound()
  const st = strand as Strand
  const items = await listResources(st)
  const s = t('strands')
  const r = t('resources')
  return (
    <>
    <header className={`strand-hero fill-${st} tile-${STRAND_LETTER[st].toLowerCase()}`}>
      <span className="strand-hero__letter tile__letter" aria-hidden="true">{STRAND_LETTER[st]}</span>
      <div className="container">
        <p className="t-meta" style={{ color: 'var(--ink)' }}><Link className="link" href="/resources">{r('title')}</Link></p>
        <Kinetic text={s(st)} className="t-strand-h1" />
        <p>{r('intro')}</p>
      </div>
    </header>
    <div className="container page">
      <ul className="grid-resources">{items.map((x) => <ResourceBlock key={x.id} resource={x} level={2} />)}</ul>
      <div className="end-of-list"><Button href={`/strands/${st}`} variant="secondary">{s(st)}</Button></div>
    </div>
    </>
  )
}
