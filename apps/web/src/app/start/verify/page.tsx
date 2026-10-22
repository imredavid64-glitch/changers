import type { Metadata } from 'next'
import { Suspense } from 'react'
import { t } from '@/i18n/t'
import { getViewer } from '@/lib/viewer'
import { PageHeader, SignInGate } from '@/components/ui'
import { Form } from '@/components/Form'
import { requestVerification } from '@/app/actions/club'

export const metadata: Metadata = { title: t('verify')('title'), robots: { index: false } }

// A teacher asks to be verified (07 §4 steps 1–2): school email domain, and a second contact at the school. An admin
// approves (step 3); then the teacher turns on an authenticator app (step 4).
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function VerifyPage(props: Props) {
  const v = t('verify')
  return (
    <div className="container page narrow">
      <PageHeader title={v('title')} lead={v('intro')} />
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}><Verify {...props} /></Suspense>
    </div>
  )
}

async function Verify({ searchParams }: Props) {
  const v = t('verify')
  const [viewer, sp] = await Promise.all([getViewer(), searchParams])
  if (viewer.kind === 'visitor') return <SignInGate next="/start/verify" />
  const club = typeof sp.club === 'string' ? sp.club : ''
  return (
    <Form action={requestVerification} demoNotice={t('ui')('demoNothingSaved')} className="card form-card stack" hidden={club ? { club } : undefined}>
      <div className="field">
        <label htmlFor="v-school">{v('school')}</label>
        <input id="v-school" name="school" className="input" required minLength={2} maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="v-domain">{v('domain')}</label>
        <p id="v-domain-help" className="help">{v('domainHelp')}</p>
        <input id="v-domain" name="domain" className="input" required pattern="[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" aria-describedby="v-domain-help" autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="v-role">{v('role')}</label>
        <input id="v-role" name="role" className="input" required minLength={2} maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="v-email">{v('email')}</label>
        <input id="v-email" name="email" type="email" className="input" required maxLength={254} autoComplete="off" />
      </div>
      <button type="submit" className="btn btn-primary btn-block">{v('submit')}</button>
    </Form>
  )
}
