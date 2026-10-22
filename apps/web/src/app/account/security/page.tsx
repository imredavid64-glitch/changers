import type { Metadata } from 'next'
import { Suspense } from 'react'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import { getViewer } from '@/lib/viewer'
import { supabaseServer } from '@/lib/supabase/server'
import { PageHeader, SignInGate } from '@/components/ui'
import { TotpSetup } from '@/components/client/TotpSetup'

export const metadata: Metadata = { title: t('mfa')('title'), robots: { index: false } }

// Teachers and admins turn on an authenticator app here (07 §4; advisor and admin powers need aal2).
export default function SecurityPage() {
  return (
    <div className="container page narrow">
      <PageHeader title={t('mfa')('title')} />
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}><Security /></Suspense>
    </div>
  )
}

async function Security() {
  const m = t('mfa')
  const viewer = await getViewer()
  if (viewer.kind === 'visitor') return <SignInGate next="/account/security" />
  if (backend !== 'supabase') return <p className="t-meta">{t('ui')('demoNothingSaved')}</p>
  const { data } = await (await supabaseServer()).auth.mfa.listFactors()
  if (data?.totp?.length) return <div className="card form-card"><p role="status">{m('on')}</p></div>
  return (
    <div className="card form-card">
      <TotpSetup labels={{ intro: m('intro'), start: m('start'), secret: m('secret'), code: m('code'), verify: m('verify') }} />
    </div>
  )
}
