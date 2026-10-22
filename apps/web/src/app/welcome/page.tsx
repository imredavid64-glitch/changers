import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { t } from '@/i18n/t'
import { COUNTRY_NAMES } from '@/lib/types'
import { backend } from '@/lib/backend'
import { getViewer } from '@/lib/viewer'
import { PageHeader } from '@/components/ui'
import { Form } from '@/components/Form'
import { completeSignup } from '@/app/actions/auth'

export const metadata: Metadata = { title: t('welcome')('title'), robots: { index: false } }

// After the first code sign-in (07 §4): first name and initial, country, the code of conduct. Nothing else. When the
// age group wasn't asked before the email (someone who came straight to /sign-in), it's asked here first, on the same
// neutral terms: no answer chosen for you. Under 13, or 13–15 without an invite, keeps nothing.
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
export default function WelcomePage(props: Props) {
  return (
    <div className="container page narrow">
      <PageHeader title={t('welcome')('title')} />
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Welcome {...props} />
      </Suspense>
    </div>
  )
}

async function Welcome({ searchParams }: Props) {
  const w = t('welcome')
  const o = t('onboarding')
  const sp = await searchParams
  const next = typeof sp.next === 'string' ? sp.next : ''
  const askAge = backend === 'supabase' && !(await cookies()).get('cm_band')
  if (backend === 'supabase') {
    const viewer = await getViewer()
    if (viewer.kind === 'user') return <p><Link className="link" href="/home">{t('nav')('home')}</Link></p>
  }
  return (
    <Form action={completeSignup} demoNotice={t('ui')('demoNothingSaved')} className="card form-card stack" hidden={next ? { next } : undefined}>
      {askAge ? (
        <fieldset className="field">
          <legend className="t-h2-app">{o('age')}</legend>
          {[['under13', o('under13')], ['13-15', o('band1315')], ['16-17', o('band1617')], ['adult', o('adult')]].map(([v, l]) => (
            <label key={v} className="choice">
              <input type="radio" name="band" value={v} required />
              {l}
            </label>
          ))}
        </fieldset>
      ) : null}
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
      {/* The link sits outside the label, so a tap anywhere on the row ticks the box instead of leaving the form. */}
      <p><Link className="link" href="/code-of-conduct">{t('legal')('conduct')}</Link></p>
      <label className="choice">
        <input type="checkbox" name="conduct" required />
        <span>{o('conduct')}</span>
      </label>
      <button type="submit" className="btn btn-primary btn-block">{w('continue')}</button>
    </Form>
  )
}
