import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { t } from '@/i18n/t'
import { getClubProjectForViewer } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { shortDate } from '@/lib/format'
import { SignInGate } from '@/components/ui'
import { PrintButton } from '@/components/client/PrintButton'

export const metadata: Metadata = { title: t('projects')('print'), robots: { index: false } }

type Props = { params: Promise<{ id: string }> }

// The printable export usable as IB CAS evidence (PRD §5 route 6): members of the project's club and its
// advisor. The advisor line appears only once the advisor has approved the project.
export default function PrintPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="container page" aria-busy="true" />}>
      <Print params={params} />
    </Suspense>
  )
}

async function Print({ params }: Props) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()])
  if (viewer.kind === 'visitor') return <div className="container page"><SignInGate next={`/projects/${id}/print`} /></div>
  const p = await getClubProjectForViewer(viewer, id)
  if (!p) notFound()
  const pr = t('projects')
  const sections = [[pr('problem'), p.problem], [pr('action'), p.action], [pr('evidence'), p.evidence], [pr('reflection'), p.reflection]] as const
  return (
    <article className="container page narrow print-page">
      <div className="no-print end-of-list"><PrintButton label={pr('print')} /></div>
      <p className="t-meta">{p.club.name} · {p.club.schoolName} · {p.club.city}, {p.club.countryName}</p>
      <h1 className="t-page-h1">{pr('printHeader', { title: p.title })}</h1>
      <p className="t-meta tnum">{shortDate(p.createdAt)} · {pr('team')}: {p.teamNames.join(', ')}</p>
      {sections.map(([label, body]) => (
        <section key={label} className="project-section">
          <h2 className="t-h2-app">{label}</h2>
          <p className="prose">{body}</p>
        </section>
      ))}
      {p.approvedAt ? <p className="t-meta print-footer">{pr('printFooter', { date: shortDate(p.approvedAt) })}</p> : null}
    </article>
  )
}
