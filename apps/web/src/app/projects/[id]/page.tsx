import type { Metadata } from 'next'
import { Kinetic } from '@/components/Kinetic'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { t } from '@/i18n/t'
import { getClubProjectForViewer, getPublicProject, listPublicProjectIds } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { StrandChip } from '@/components/ui'
import { ReportButton } from '@/components/client/Dialogs'
import { reportLabels } from '@/components/labels'
import type { Impact, Project } from '@/lib/types'
import { getProjectTools, getPublicImpacts } from '@/lib/features'
import { ImpactList, ProjectTools } from '@/components/features'

type Props = { params: Promise<{ id: string }> }

export async function generateStaticParams() {
  const ids = await listPublicProjectIds()
  return ids.length ? ids.map((id) => ({ id })) : [{ id: 'none' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await getPublicProject(id)
  return p ? { title: p.title, description: p.problem } : { robots: { index: false } }
}

// A project (PRD §5 route 5): problem → action → evidence → reflection. Public, approved projects are
// cached and never show members' names ("the {club} team"). Club-only ones stream in for members only.
export default function ProjectPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="container page" aria-busy="true" />}>
      <ProjectResolver params={params} />
    </Suspense>
  )
}

async function ProjectResolver({ params }: Props) {
  const { id } = await params
  const pub = await getPublicProject(id)
  if (pub) {
    // The public page is cached; the club's own members also get their tools (board, numbers, files), streamed in.
    const impacts = await getPublicImpacts(id)
    return (
      <ProjectView project={pub} clubName={pub.club.name} clubSlug={pub.club.slug} place={`${pub.club.city}, ${pub.club.countryName}`} team={pub.teamCredit} isPublic
        impacts={impacts} tools={<Suspense fallback={null}><MemberTools id={id} isPublic /></Suspense>} />
    )
  }
  return (
    <Suspense fallback={<div className="container page" aria-busy="true" />}>
      <MemberProject id={id} />
    </Suspense>
  )
}

async function MemberProject({ id }: { id: string }) {
  const viewer = await getViewer()
  const p = await getClubProjectForViewer(viewer, id)
  if (!p) notFound()
  const tools = await getProjectTools(viewer, id)
  return (
    <ProjectView project={p} clubName={p.club.name} clubSlug={p.club.slug} place={`${p.club.city}, ${p.club.countryName}`} team={p.teamNames.join(', ')} isPublic={false}
      impacts={[]} tools={tools ? <ProjectTools tools={tools} projectId={id} isPublic={false} /> : null} />
  )
}

/** The club's members on a public project: the board, numbers and files (nothing for anyone else). */
async function MemberTools({ id, isPublic }: { id: string; isPublic: boolean }) {
  const tools = await getProjectTools(await getViewer(), id)
  return tools ? <ProjectTools tools={tools} projectId={id} isPublic={isPublic} /> : null
}

function ProjectView({ project, clubName, clubSlug, place, team, isPublic, impacts, tools }: {
  project: Project; clubName: string; clubSlug: string; place: string; team: string; isPublic: boolean; impacts: Impact[]; tools: ReactNode
}) {
  const p = t('projects')
  const ui = t('ui')
  const status = project.status === 'proposed' ? p('statusProposed') : project.status === 'completed' ? p('statusCompleted') : project.status === 'draft' ? p('statusDraft') : p('statusActive')
  const sections = [
    ['problem', p('problem'), project.problem],
    ['action', p('action'), project.action],
    ['evidence', p('evidence'), project.evidence],
    ['reflection', p('reflection'), project.reflection],
  ] as const
  return (
    <article className="container page">
      <p className="t-meta"><Link className="link" href={`/clubs/${clubSlug}`}>{clubName}</Link></p>
      <Kinetic text={project.title} className="t-page-h1" />
      <div className="chips">
        <StrandChip strand={project.strand} />
        <span className="status-tag">{status}</span>
      </div>
      <p className="t-meta tnum">{place} · {project.year}</p>

      <div className="project-sections">
        {sections.map(([key, label, body]) => (
          <section key={key} className="project-section" aria-labelledby={`${key}-h`}>
            <h2 id={`${key}-h`} className="project-section__label">{label}</h2>
            <p className="prose">{body}</p>
          </section>
        ))}
      </div>

      {impacts.length ? (
        <section id="impact-public" className="project-section" aria-labelledby="impact-public-h">
          <h2 id="impact-public-h" className="t-h2-app">{t('features')('impactTitle')}</h2>
          <ImpactList impacts={impacts} />
        </section>
      ) : null}

      {tools}

      <section className="project-section" aria-labelledby="team-h">
        <h2 id="team-h" className="t-h2-app">{p('team')}</h2>
        <p>{team}</p>
      </section>

      <div className="end-of-list">
        {isPublic ? (
          <Link href={`/clubs/${clubSlug}`} className="btn btn-primary">{ui('seeClub')}</Link>
        ) : (
          <Link href={`/projects/${project.id}/print`} className="btn btn-primary"><Printer size={20} aria-hidden="true" /> {p('print')}</Link>
        )}
        <ReportButton labels={reportLabels()} subject={project.title} />
      </div>
    </article>
  )
}
