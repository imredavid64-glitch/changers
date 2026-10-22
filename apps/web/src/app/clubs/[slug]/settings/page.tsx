import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { demoMode } from '@/config/switches'
import { getClubSettings } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { SignInGate } from '@/components/ui'
import { Form } from '@/components/Form'
import { FactorPrompt } from '@/components/FactorPrompt'
import { removeMember, rotateCode, setMemberRole, setPreApproval } from '@/app/actions/club'
import { createInvite } from '@/app/actions/invite'

export const metadata: Metadata = { title: t('settings')('title'), robots: { index: false } }

type Props = { params: Promise<{ slug: string }> }

// Club settings (PRD §5 route 14): the join code, pre-approval, and members. Only the advisor removes
// members or changes roles (07 §3); leads see the list without those controls.
export default function SettingsPage({ params }: Props) {
  return (
    <div className="container page">
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Settings params={params} />
      </Suspense>
    </div>
  )
}

async function Settings({ params }: Props) {
  const [{ slug }, viewer] = await Promise.all([params, getViewer()])
  if (viewer.kind === 'user' && viewer.needsFactor && viewer.memberships.some((m) => m.role === 'advisor')) return <FactorPrompt next={`/clubs/${slug}/settings`} />
  const data = await getClubSettings(viewer, slug)
  if (!data) return <SignInGate next={`/clubs/${slug}/settings`} note={t('ui')('membersOnly')} />
  const s = t('settings')
  const ui = t('ui')
  const demo = ui('demoNothingSaved')
  const iv = t('invite')
  const role = (r: string) => (r === 'advisor' ? s('roleAdvisor') : r === 'lead' ? s('roleLead') : s('roleMember'))
  return (
    <div className="stack">
      <p className="t-meta"><Link className="link" href={`/clubs/${slug}/space`}>{ui('backTo', { name: data.club.name })}</Link></p>
      <h1 className="t-page-h1">{s('title')}</h1>

      <section className="card settings-block stack" aria-labelledby="code-h">
        <h2 id="code-h" className="t-h2-app">{s('joinCode')}</h2>
        <p className="join-code tnum">{demoMode ? ui('joinCodeDemo') : '—'}</p>
        <p className="t-meta">{s('joinCodeHelp')}</p>
        <Form action={rotateCode} demoNotice={demo} hidden={{ club: data.club.id }}><button type="submit" className="btn btn-secondary">{s('rotate')}</button></Form>
      </section>

      <section className="card settings-block stack" aria-labelledby="pre-h">
        <h2 id="pre-h" className="t-h2-app">{s('preApproval')}</h2>
        <Form action={setPreApproval} demoNotice={demo} hidden={{ club: data.club.id }}>
          <label className="choice">
            <input type="checkbox" name="preApproval" defaultChecked={data.preApproval} />
            {s('preApproval')}
          </label>
          <p className="t-meta">{s('preApprovalHelp')}</p>
          <button type="submit" className="btn btn-secondary">{t('accountForm')('save')}</button>
        </Form>
      </section>

      {data.canManageMembers ? (
        <section className="card settings-block stack" aria-labelledby="inv-h">
          <h2 id="inv-h" className="t-h2-app">{iv('title')}</h2>
          <p className="t-meta">{iv('intro')}</p>
          <Form action={createInvite} demoNotice={demo} hidden={{ club: data.club.id }}>
            <fieldset className="field">
              <legend>{iv('band')}</legend>
              <label className="choice"><input type="radio" name="band" value="13-15" required /> {iv('band1315')}</label>
              <label className="choice"><input type="radio" name="band" value="16-17" /> {iv('band1617')}</label>
              <label className="choice"><input type="radio" name="band" value="adult" /> {iv('adult')}</label>
            </fieldset>
            <fieldset className="field">
              <legend>{iv('consent')}</legend>
              <label className="choice"><input type="radio" name="consent" value="school_on_file" /> {t('onboarding')('consentSchool')}</label>
              <label className="choice"><input type="radio" name="consent" value="parent_email" /> {t('onboarding')('consentParent')}</label>
            </fieldset>
            <button type="submit" className="btn btn-secondary">{iv('create')}</button>
          </Form>
        </section>
      ) : null}

      <section className="card settings-block stack" aria-labelledby="mem-h">
        <h2 id="mem-h" className="t-h2-app">{s('members')}</h2>
        <ul className="member-list">
          {data.members.map((m) => (
            <li key={m.id}>
              <span>{m.name} <span className="t-meta">· {role(m.role)}</span></span>
              {data.canManageMembers && m.role !== 'advisor' ? (
                <div className="member-actions">
                  {m.role === 'member' ? (
                    <Form action={setMemberRole} demoNotice={demo} className="" hidden={{ member: m.id, role: 'lead', slug }}>
                      <button type="submit" className="btn btn-secondary btn-sm">{s('makeLead')}</button>
                    </Form>
                  ) : null}
                  <Form action={removeMember} demoNotice={demo} className="" hidden={{ member: m.id, slug }}>
                    <button type="submit" className="btn btn-quiet btn-sm">{s('remove')}</button>
                  </Form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {!data.canManageMembers ? <p className="t-meta">{s('onlyAdvisor')}</p> : null}
      </section>
    </div>
  )
}
