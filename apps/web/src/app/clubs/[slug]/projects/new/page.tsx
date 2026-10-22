import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { getSpace } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { STRANDS, STRAND_LETTER } from '@/lib/types'
import { SignInGate } from '@/components/ui'
import { Form } from '@/components/Form'
import { createProject } from '@/app/actions/content'
import { IdeaStarters, ideaFrom } from '@/components/features'
import { ProposalChecklist } from '@/components/client/ProposalChecklist'
import { first } from '@/lib/url'

export const metadata: Metadata = { title: t('projects')('start'), robots: { index: false } }

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

// Start a project: one shape, problem → action → evidence → reflection (brief). A student's project is a
// proposal until a lead (members' club-only proposals) or the advisor approves it (07 §3, question 4).
export default function NewProjectPage({ params, searchParams }: Props) {
  return (
    <div className="container page narrow">
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <NewProject params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function NewProject({ params, searchParams }: Props) {
  const [{ slug }, viewer, sp] = await Promise.all([params, getViewer(), searchParams])
  const idea = ideaFrom(first(sp.idea))
  const space = await getSpace(viewer, slug)
  if (!space) return <SignInGate next={`/clubs/${slug}/projects/new`} note={t('ui')('membersOnly')} />
  const p = t('projects')
  const s = t('strands')
  const ui = t('ui')
  const areas = [
    ['problem', p('problem'), p('problemHelp')],
    ['action', p('action'), p('actionHelp')],
    ['evidence', p('evidence'), p('evidenceHelp')],
    ['reflection', p('reflection'), p('reflectionHelp')],
  ] as const
  return (
    <>
      <p className="t-meta"><Link className="link" href={`/clubs/${slug}/space?tab=projects`}>{ui('backTo', { name: space.club.name })}</Link></p>
      <h1 className="t-page-h1">{p('start')}</h1>
      {/* Starter ideas for the club's strands (R1b · 6): one tap fills the form in. */}
      <details className="add-block ideas-picker" open={!idea}>
        <summary className="btn btn-secondary">{t('ideas')('title')}</summary>
        {space.club.strands.map((st) => <IdeaStarters key={st} strand={st} nested startHref={(n) => `/clubs/${slug}/projects/new?idea=${st}-${n}#title`} />)}
      </details>
      <ProposalChecklist labels={{ title: t('proposal')('title'), titleShort: t('proposal')('titleShort'), problemNumber: t('proposal')('problemNumber'), actionWho: t('proposal')('actionWho'), evidenceHow: t('proposal')('evidenceHow') }} />
      <Form action={createProject} demoNotice={ui('demoNothingSaved')} hidden={{ club: space.club.id, slug }}>
        <div className="field">
          <label htmlFor="title">{p('title')}</label>
          <input id="title" name="title" className="input" required maxLength={80} defaultValue={idea?.title} />
        </div>
        <fieldset className="field">
          <legend className="label">{p('strand')}</legend>
          <div className="choice-grid">
            {STRANDS.map((st) => (
              <label key={st} className="choice">
                <input type="radio" name="strand" value={st} required defaultChecked={idea?.strand === st} />
                <span className={`chip fill-${st}`}><b aria-hidden="true">{STRAND_LETTER[st]}</b>{s(st)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {areas.map(([name, label, help]) => (
          <div key={name} className="field">
            <label htmlFor={name}>{label}</label>
            <p id={`${name}-help`} className="help">{help}</p>
            <textarea id={name} name={name} className="textarea" aria-describedby={`${name}-help`} required={name === 'problem' || name === 'action'} defaultValue={name === 'problem' ? idea?.line : undefined} />
          </div>
        ))}
        <fieldset className="field">
          <legend className="label">{t('eventNew')('visibility')}</legend>
          <label className="choice"><input type="radio" name="visibility" value="club" defaultChecked /> {p('visClub')}</label>
          <label className="choice"><input type="radio" name="visibility" value="public" /> {p('visPublic')}</label>
        </fieldset>
        <p className="t-meta">{t('projectNew')('helper')}</p>
        <button type="submit" className="btn btn-primary btn-block">{t('projectNew')('submit')}</button>
      </Form>
    </>
  )
}
