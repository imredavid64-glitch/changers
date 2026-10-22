import type { Metadata } from 'next'
import { Suspense } from 'react'
import { t } from '@/i18n/t'
import { STRANDS } from '@/lib/types'
import { CITIES } from '@/lib/cities'
import { COUNTRY_NAMES } from '@/lib/types'
import { getViewer } from '@/lib/viewer'
import { PageHeader, SignInGate } from '@/components/ui'
import { Form } from '@/components/Form'
import { createClub } from '@/app/actions/club'

export const metadata: Metadata = { title: t('clubNew')('title'), robots: { index: false } }

// Start a club (07 §3; PRD §10 R1 flow step 1). A teacher becomes its advisor, a student aged 16–17 its lead; it stays
// pending, off the public site, until a teacher is verified. Places are city-level only: the club shows at its city's
// centre, never at the school.
export default function NewClubPage() {
  return (
    <div className="container page narrow">
      <PageHeader title={t('clubNew')('title')} lead={t('start')('intro')} />
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}><NewClub /></Suspense>
    </div>
  )
}

async function NewClub() {
  const c = t('clubNew')
  const viewer = await getViewer()
  if (viewer.kind === 'visitor') return <SignInGate next="/start/club" />
  const strandName = t('strands')
  return (
    <Form action={createClub} demoNotice={t('ui')('demoNothingSaved')} className="card form-card stack">
      <div className="field">
        <label htmlFor="club-name">{c('name')}</label>
        <p id="club-name-help" className="help">{c('nameHelp')}</p>
        <input id="club-name" name="name" className="input" required minLength={2} maxLength={80} aria-describedby="club-name-help" />
      </div>
      <div className="field">
        <label htmlFor="club-school">{c('school')}</label>
        <input id="club-school" name="school" className="input" required minLength={2} maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="club-city">{c('city')}</label>
        <p id="club-city-help" className="help">{c('cityHelp')}</p>
        <select id="club-city" name="city" className="select" required defaultValue="" aria-describedby="club-city-help">
          <option value="" disabled> </option>
          {CITIES.map((x) => <option key={x.id} value={x.id}>{x.city}, {COUNTRY_NAMES[x.country] ?? x.country}</option>)}
        </select>
      </div>
      <fieldset className="field">
        <legend>{c('strands')}</legend>
        {STRANDS.map((s) => (
          <label key={s} className="choice"><input type="checkbox" name="strands" value={s} /> {strandName(s)}</label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="club-langs">{c('languages')}</label>
        <p id="club-langs-help" className="help">{c('languagesHelp')}</p>
        <input id="club-langs" name="languages" className="input" defaultValue="English" maxLength={200} aria-describedby="club-langs-help" />
      </div>
      <div className="field">
        <label htmlFor="club-about">{c('description')}</label>
        <textarea id="club-about" name="description" className="textarea" maxLength={1200} />
      </div>
      <button type="submit" className="btn btn-primary btn-block">{c('submit')}</button>
    </Form>
  )
}
