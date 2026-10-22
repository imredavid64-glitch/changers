import type { Metadata } from 'next'
import { Suspense } from 'react'
import { t } from '@/i18n/t'
import { backend } from '@/lib/backend'
import { getViewer } from '@/lib/viewer'
import { PageHeader } from '@/components/ui'
import { AgeFlow } from '@/components/client/Flows'
import { Form } from '@/components/Form'
import { joinWithCode } from '@/app/actions/club'
import { ageLabels, signInLabels } from '@/components/labels'

export const metadata: Metadata = { title: t('join')('title'), description: t('join')('intro') }

// Join a club: the age screen first; 16–17 join with the club code (held for approval); under 16 only
// through the advisor's invite link, with consent recorded (07 §4). Someone already signed in just types the code.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function JoinPage(props: Props) {
  return (
    <div className="container page narrow">
      <PageHeader title={t('join')('title')} lead={t('join')('intro')} />
      <div className="card form-card">
        <Suspense fallback={<AgeFlow mode="join" labels={ageLabels()} signIn={signInLabels()} />}>
          <Join {...props} />
        </Suspense>
      </div>
    </div>
  )
}

async function Join({ searchParams }: Props) {
  const j = t('join')
  const [viewer, sp] = await Promise.all([getViewer(), searchParams])
  if (backend !== 'supabase' || viewer.kind !== 'user') return <AgeFlow mode="join" labels={ageLabels()} signIn={signInLabels()} />
  return (
    <Form action={joinWithCode} demoNotice={t('ui')('demoNothingSaved')} className="stack">
      {sp.code === 'wrong' ? <p className="form-error" role="alert">{t('live')('errorJoinCode')}</p> : null}
      <div className="field">
        <label htmlFor="club-code">{j('codeLabel')}</label>
        <input id="club-code" className="input code-input" name="code" autoComplete="off" required maxLength={20} />
      </div>
      <button type="submit" className="btn btn-primary btn-block">{j('submit')}</button>
    </Form>
  )
}
