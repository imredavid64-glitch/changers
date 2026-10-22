import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { t } from '@/i18n/t'
import { getSpace } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { STRANDS } from '@/lib/types'
import { SignInGate } from '@/components/ui'
import { DemoForm } from '@/components/client/Dialogs'

export const metadata: Metadata = { title: t('eventNew')('title'), robots: { index: false } }

type Props = { params: Promise<{ slug: string }> }

// Host an event (leads and advisors, 07 §3). Times are stored with the event's IANA zone; the exact
// place and the online link go to event_links and show only after an RSVP (brief rule 1, 07 §5).
export default function NewEventPage({ params }: Props) {
  return (
    <div className="container page narrow">
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <NewEvent params={params} />
      </Suspense>
    </div>
  )
}

async function NewEvent({ params }: Props) {
  const [{ slug }, viewer] = await Promise.all([params, getViewer()])
  const space = await getSpace(viewer, slug)
  if (!space || !space.staff) return <SignInGate next={`/clubs/${slug}/events/new`} note={t('ui')('membersOnly')} />
  const e = t('eventNew')
  const s = t('strands')
  const ui = t('ui')
  const p = t('projects')
  return (
    <>
      <p className="t-meta"><Link className="link" href={`/clubs/${slug}/space?tab=events`}>{ui('backTo', { name: space.club.name })}</Link></p>
      <h1 className="t-page-h1">{e('title')}</h1>
      <DemoForm notice={ui('demoNothingSaved')}>
        <div className="field"><label htmlFor="title">{p('title')}</label><input id="title" name="title" className="input" required maxLength={80} /></div>
        <div className="field">
          <label htmlFor="strand">{p('strand')}</label>
          <select id="strand" name="strand" className="select" required defaultValue="">
            <option value="" disabled> </option>
            {STRANDS.map((st) => <option key={st} value={st}>{s(st)}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="date">{e('date')}</label><input id="date" name="date" type="date" className="input" required /></div>
          <div className="field"><label htmlFor="starts">{e('starts')}</label><input id="starts" name="starts" type="time" className="input" required /></div>
          <div className="field"><label htmlFor="ends">{e('ends')}</label><input id="ends" name="ends" type="time" className="input" required /></div>
        </div>
        <div className="field"><label htmlFor="tz">{e('tz')}</label><input id="tz" name="tz" className="input" defaultValue={space.club.tz} required /></div>
        <fieldset className="field">
          <legend className="label">{e('mode')}</legend>
          <label className="choice"><input type="radio" name="mode" value="in_person" defaultChecked /> {ui('inPerson')}</label>
          <label className="choice"><input type="radio" name="mode" value="online" /> {ui('online')}</label>
          <label className="choice"><input type="radio" name="mode" value="hybrid" /> {ui('hybrid')}</label>
        </fieldset>
        <div className="field"><label htmlFor="city">{e('city')}</label><input id="city" name="city" className="input" defaultValue={space.club.city} required /></div>
        <div className="field"><label htmlFor="place">{e('place')}</label><p id="place-help" className="help">{e('placeHelp')}</p><input id="place" name="place" className="input" aria-describedby="place-help" /></div>
        <div className="field"><label htmlFor="link">{e('link')}</label><p id="link-help" className="help">{e('linkHelp')}</p><input id="link" name="link" type="url" className="input" aria-describedby="link-help" /></div>
        <div className="field"><label htmlFor="capacity">{e('capacity')}</label><input id="capacity" name="capacity" type="number" min={1} inputMode="numeric" className="input" /></div>
        <fieldset className="field">
          <legend className="label">{e('visibility')}</legend>
          <label className="choice"><input type="radio" name="visibility" value="club" defaultChecked /> {p('visClub')}</label>
          <label className="choice"><input type="radio" name="visibility" value="public" /> {p('visPublic')}</label>
        </fieldset>
        <button type="submit" className="btn btn-primary btn-block">{e('save')}</button>
      </DemoForm>
    </>
  )
}
