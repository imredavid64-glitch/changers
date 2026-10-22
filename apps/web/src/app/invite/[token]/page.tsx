import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { COUNTRY_NAMES } from '@/lib/types'
import { backend } from '@/lib/backend'
import { getViewer } from '@/lib/viewer'
import { PageHeader } from '@/components/ui'
import { Form } from '@/components/Form'
import { SignInFlow } from '@/components/client/Flows'
import { signInLabels } from '@/components/labels'
import { redeemInvite } from '@/app/actions/invite'

export const metadata: Metadata = { title: t('invite')('pageTitle'), robots: { index: false } }

// An advisor's invite link (07 §4): the only way in under 16. Sign in with a code first; a brand-new account then
// gives its first name and initial, country and the code of conduct here (the age group comes from the invite).
type Props = { params: Promise<{ token: string }> }
export default function InvitePage(props: Props) {
  const i = t('invite')
  return (
    <div className="container page narrow">
      <PageHeader title={i('pageTitle')} lead={i('pageIntro')} />
      <div className="card form-card">
        <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}><Invite {...props} /></Suspense>
      </div>
    </div>
  )
}

async function Invite({ params }: Props) {
  const { token } = await params
  const i = t('invite'), w = t('welcome'), o = t('onboarding')
  if (backend !== 'supabase') return <p className="t-meta">{t('ui')('demoNothingSaved')}</p>
  const viewer = await getViewer()
  if (viewer.kind === 'visitor' && !viewer.needsWelcome) return <SignInFlow labels={signInLabels()} next={`/invite/${token}`} />
  const isNew = viewer.kind === 'visitor'
  return (
    <Form action={redeemInvite} demoNotice={t('ui')('demoNothingSaved')} className="stack" hidden={{ token }}>
      {isNew ? (
        <>
          <div className="field">
            <label htmlFor="name">{w('name')}</label>
            <p id="name-help" className="help">{w('nameHelp')}</p>
            <input id="name" name="name" className="input" required pattern="^\S+ \S\.$" aria-describedby="name-help" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="country">{w('country')}</label>
            <select id="country" name="country" className="select" required defaultValue="">
              <option value="" disabled> </option>
              {Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
          <p><Link className="link" href="/code-of-conduct">{t('legal')('conduct')}</Link></p>
          <label className="choice"><input type="checkbox" name="conduct" required /><span>{o('conduct')}</span></label>
        </>
      ) : null}
      <button type="submit" className="btn btn-primary btn-block">{i('join')}</button>
    </Form>
  )
}
