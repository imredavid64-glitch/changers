import type { Metadata } from 'next'
import { Suspense } from 'react'
import { t } from '@/i18n/t'
import { PageHeader } from '@/components/ui'
import { SignInFlow, SignInFromParams } from '@/components/client/Flows'
import { signInLabels } from '@/components/labels'

export const metadata: Metadata = { title: t('signIn')('title'), robots: { index: false } }

// Code sign-in (PRD §5 route 12; 07 §4). ?step=code&email= opens the code step directly (07 §2).
export default function SignInPage() {
  const labels = signInLabels()
  return (
    <div className="container page narrow">
      <PageHeader title={t('signIn')('title')} />
      <div className="card form-card">
        <Suspense fallback={<SignInFlow labels={labels} />}>
          <SignInFromParams labels={labels} />
        </Suspense>
      </div>
    </div>
  )
}
