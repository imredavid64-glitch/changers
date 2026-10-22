import type { Metadata } from 'next'
import { Suspense } from 'react'
import { t } from '@/i18n/t'
import { PageHeader } from '@/components/ui'
import { Form } from '@/components/Form'
import { verifyTotp } from '@/app/actions/mfa'

export const metadata: Metadata = { title: t('mfa')('signInTitle'), robots: { index: false } }

// The second step for teachers and admins (07 §4: aal2 before any advisor or admin power works).
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function FactorPage(props: Props) {
  const m = t('mfa')
  return (
    <div className="container page narrow">
      <PageHeader title={m('signInTitle')} lead={m('signInIntro')} />
      <Suspense fallback={null}><FactorForm {...props} /></Suspense>
    </div>
  )
}

async function FactorForm({ searchParams }: Props) {
  const m = t('mfa')
  const next = (await searchParams).next
  return (
    <Form action={verifyTotp} demoNotice={t('ui')('demoNothingSaved')} className="card form-card stack" hidden={{ next: typeof next === 'string' ? next : '/home' }}>
      <div className="field">
        <label htmlFor="totp">{m('code')}</label>
        <input id="totp" name="code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
      </div>
      <button type="submit" className="btn btn-primary btn-block">{m('signInSubmit')}</button>
    </Form>
  )
}
