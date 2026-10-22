import type { Metadata } from 'next'
import { t } from '@/i18n/t'
import { PageHeader } from '@/components/ui'
import { AgeFlow } from '@/components/client/Flows'
import { ageLabels, signInLabels } from '@/components/labels'

export const metadata: Metadata = { title: t('start')('title'), description: t('start')('intro') }

// Start a club: the age screen first (07 §4). A teacher becomes the advisor; a student aged 16–17 becomes
// the lead and invites a teacher. Either way the club is listed only after verification.
export default function StartPage() {
  return (
    <div className="container page narrow">
      <PageHeader title={t('start')('title')} lead={t('start')('intro')} />
      <div className="card form-card">
        <AgeFlow mode="start" labels={ageLabels()} signIn={signInLabels()} />
      </div>
    </div>
  )
}
