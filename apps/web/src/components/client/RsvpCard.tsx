'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarPlus, CircleCheck, Clock, Link2, MapPin } from 'lucide-react'

export type RsvpLabels = {
  rsvp: string
  going: string
  cancel: string
  full: string
  ended: string
  onlineLink: string
  exactPlace: string
  calendar: string
  signIn: string
  demo: string | null
}

/**
 * The RSVP card: Luma's order (label → state → message → button), with Cosmos's ink pill at full width,
 * 48 high (docs/03 §7). The exact place and the online link come from event_links and are sent by the
 * server only after an RSVP, so this component never holds them before that.
 */
export function RsvpCard(props: {
  labels: RsvpLabels
  state: 'open' | 'full' | 'ended'
  signedIn: boolean
  canRsvp: boolean
  initiallyGoing: boolean
  links: { placeDetail: string | null; onlineUrl: string | null } | null
  mode: 'in_person' | 'online' | 'hybrid'
  icsHref: string
  signInHref: string
}) {
  const { labels, state, signedIn, canRsvp, initiallyGoing, links, mode, icsHref, signInHref } = props
  const [going, setGoing] = useState(initiallyGoing)
  const [touched, setTouched] = useState(false)
  const toggle = () => { setGoing((g) => !g); setTouched(true) }

  if (state === 'ended') {
    return (
      <div className="rsvp card">
        <p className="rsvp__status"><Clock size={20} aria-hidden="true" /> <span className="t-row-title">{labels.ended}</span></p>
      </div>
    )
  }

  return (
    <div className="rsvp card">
      {going ? (
        <p className="rsvp__status"><CircleCheck size={20} aria-hidden="true" /> <span className="t-row-title">{labels.going}</span></p>
      ) : state === 'full' ? (
        <p className="rsvp__status"><Clock size={20} aria-hidden="true" /> <span className="t-row-title">{labels.full}</span></p>
      ) : null}

      {going && links ? (
        <ul className="rsvp__links">
          {links.placeDetail ? <li><MapPin size={20} aria-hidden="true" /> {links.placeDetail}</li> : null}
          {links.onlineUrl ? <li><Link2 size={20} aria-hidden="true" /> <a className="link" href={links.onlineUrl} target="_blank" rel="noopener noreferrer">{links.onlineUrl}</a></li> : null}
        </ul>
      ) : (
        <p className="t-meta">{mode === 'online' ? labels.onlineLink : labels.exactPlace}</p>
      )}

      {!signedIn ? (
        state === 'full' ? null : <Link href={signInHref} className="btn btn-primary btn-block">{labels.rsvp}</Link>
      ) : going ? (
        <div className="rsvp__actions">
          <a href={icsHref} className="btn btn-secondary btn-block"><CalendarPlus size={20} aria-hidden="true" /> {labels.calendar}</a>
          <button type="button" className="btn btn-quiet btn-block" onClick={toggle}>{labels.cancel}</button>
        </div>
      ) : state === 'full' ? null : (
        <button type="button" className="btn btn-primary btn-block" onClick={toggle} aria-disabled={!canRsvp} disabled={!canRsvp}>{labels.rsvp}</button>
      )}

      {touched && labels.demo ? <p className="t-meta" role="status">{labels.demo}</p> : null}
    </div>
  )
}
