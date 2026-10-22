import type React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { t } from '@/i18n/t'
import { Button, DateCard, StrandChip, TrustLine } from '@/components/ui'
import { modeLabel } from '@/components/cards'
import { Kinetic } from '@/components/Kinetic'
import { NetworkMap } from '@/components/client/NetworkMap'
import { getShowcase, type PublicEvent, type PublicProject, type ClubSummary } from '@/lib/data'
import { getNetworkMap } from '@/lib/network'
import { eventDay } from '@/lib/format'
import { STRANDS, STRAND_LETTER, type Strand } from '@/lib/types'

// The landing, v4 (Luke, 2 Oct: "a mixed version of the original with some of these animations"): v2's page and
// look (A + B: the sticker wall around a big friendly headline, the events strip, the strand tiles, the yellow
// how-it-works band, the ruled principles) with v3's motion layered on (motion.css). v5 (4 Oct) adds the network map
// before the final call: the globe zooms in on Europe and each city opens its schools and conferences
// (lib/network.ts decides what may be named). The wall shows real listed items only (getShowcase applies the listing
// rules). No photos: landingPhotos stays off. Backups: work/backups/site-v2-2026-10-01, site-v3-2026-10-02.

export default async function LandingPage() {
  const l = t('landing')
  const s = t('strands')
  const m = t('map')
  const [show, map] = await Promise.all([getShowcase(), getNetworkMap()])
  const [e1, e2] = show.events
  const nextPlace = map.places.find((p) => p.kind === 'next') ?? null
  const nextConf = nextPlace?.conferences.find((c) => c.next) ?? null
  const schoolCount = map.places.reduce((n, p) => n + p.schools.length, 0)
  const countries = [...new Set(map.places.map((p) => p.country))].sort().map((country) => [
    country,
    map.places.filter((p) => p.country === country).flatMap((p) => p.schools.map((s) => ({ ...s, city: p.city }))).sort((a, b) => a.name.localeCompare(b.name)),
  ] as const)
  const learn = [
    { href: '/start', title: l('learnStart'), body: l('learnStartBody') },
    { href: '/join', title: l('learnJoin'), body: l('learnJoinBody') },
    { href: '/teachers', title: l('learnTeachers'), body: l('learnTeachersBody') },
    { href: '/safeguarding', title: l('learnSafety'), body: l('learnSafetyBody') },
  ]
  return (
    <>
      <div className="intro" aria-hidden="true">
        <span className="intro__dots"><i className="fill-nature" /><i className="fill-economy" /><i className="fill-society" /><i className="fill-wellbeing" /></span>
        <span className="intro__word">{t('meta')('wordmark')}</span>
      </div>

      <section className="hero" aria-labelledby="hero-h">
        <div className="hero__inner">
          <Kinetic id="hero-h" text={l('h1')} className="t-h1" after={['change', <Squiggle key="sq" />]} />
          <p className="t-lead">{l('sub')}</p>
          <div className="hero__doors">
            <Button href="/start" size="lg">{l('doorStart')}</Button>
            <Button href="/clubs" size="lg" variant="secondary">{l('doorFind')}</Button>
          </div>
          <Link href="/teachers" className="link">{l('teacherLink')}</Link>
        </div>

        {/* Desktop: two tilted stacks either side of the headline. */}
        <div className="hero__collage">
          {e1 ? <EventSticker event={e1} className="c1" /> : null}
          <Stickers strands={['nature', 'economy']} className="c2" />
          {show.club ? <ClubSticker club={show.club} className="c3" /> : null}
          {show.project ? <ProjectSticker project={show.project} className="c4" /> : null}
          {e2 ? <EventSticker event={e2} className="c5" /> : null}
          <Stickers strands={['society', 'wellbeing']} className="c6" />
        </div>
        {/* Phones and tablets: the same wall, stacked under the doors. */}
        <div className="hero__phone-cards">
          {show.project ? <ProjectSticker project={show.project} /> : null}
          {e1 ? <EventSticker event={e1} /> : null}
          <Stickers strands={['nature', 'economy', 'society', 'wellbeing']} />
        </div>
      </section>

      {show.events.length ? (
        <section className="ticker on-ink" aria-labelledby="ticker-h">
          <div className="ticker__inner">
            <h2 id="ticker-h" className="ticker__label">{t('ui')('upcomingEvents')}</h2>
            <div className="ticker__viewport">
              <div className="ticker__track">
                <TickerList events={show.events} />
                {/* The animated version scrolls the strip as a loop; this copy only fills the loop. */}
                <TickerList events={show.events} copy />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="strands-h">
        <div className="strands-head">
          <div className="container">
            <Kinetic id="strands-h" as="h2" text={l('strandsHeading')} className="t-h2" />
          </div>
        </div>
        <ul className="tiles">
          {STRANDS.map((st, i) => (
            <li key={st} style={{ display: 'grid' }}>
              <Link href={`/strands/${st}`} className={`tile tile-${STRAND_LETTER[st].toLowerCase()} fill-${st}`}>
                <span className="tile__num" aria-hidden="true">0{i + 1}</span>
                <span className="tile__letter" aria-hidden="true">{STRAND_LETTER[st]}</span>
                <span>
                  <span className="tile__name">{s(st)}</span>
                  <span className="tile__line">{s(`${st}Line`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="how" aria-labelledby="how-h">
        <div className="how__grid">
          <Kinetic id="how-h" as="h2" text={l('howHeading')} className="t-h2" />
          <ol className="how__steps">
            {[l('how1'), l('how2'), l('how3')].map((step, i) => (
              <li key={step}><b aria-hidden="true">{i + 1}</b>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      <ul className="principles" aria-label={l('principle1')}>
        {[
          [l('principle1'), l('principle1Body')],
          [l('principle2'), l('principle2Body')],
          [l('principle3'), l('principle3Body')],
        ].map(([h, b]) => (
          <li key={h}>
            <h2>{h}</h2>
            <p className="t-meta">{b}</p>
          </li>
        ))}
      </ul>

      <section className="section container" aria-labelledby="learn-h">
        <Kinetic id="learn-h" as="h2" text={l('learnHeading')} className="t-h2 section__title" />
        <ul className="grid-learn">
          {learn.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="card learn-card">
                <span>
                  <span className="learn-card__title">{c.title}</span>
                  <span className="t-meta learn-card__body">{c.body}</span>
                </span>
                <ArrowRight size={28} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* The network map (Luke, 4 Oct): a real, zoomable map (MapLibre + self-hosted OpenStreetMap tiles) that flies in to Europe;
          each city flies in to its streets and schools and opens a card. */}
      <section className="network on-ink" aria-labelledby="network-h">
        <div className="container">
          <div className="network__head">
            <Kinetic id="network-h" as="h2" text={m('heading')} className="t-h2" />
            <p className="t-lead">{map.checked ? m('lead') : m('clubsLead')}</p>
            {map.checked ? (
              <p className="t-meta network__note">
                {m('checked', { date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(map.checked)) })}
              </p>
            ) : null}
          </div>
          {schoolCount ? (
            <details className="network__list">
              <summary>{m('listSummary', { n: schoolCount })}</summary>
              <div>
                {countries.map(([country, schools]) => (
                  <div key={country} className="network__country">
                    <h3>{country}</h3>
                    <ul>{schools.map((s) => <li key={s.name}>{s.href ? <Link href={s.href} className="link">{s.name}</Link> : s.name} · {s.city}</li>)}</ul>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {/* Without JavaScript the map can't draw: hide its empty box (the list above names every school). */}
          <noscript><style>{'.gmap{display:none}'}</style></noscript>
          <NetworkMap
            map={map}
            nextPlaceId={nextPlace?.id ?? null}
            strings={{
              back: m('back'), close: m('close'), nextBadge: m('nextBadge'), nextTag: m('nextTag'),
              nextChip: nextPlace && nextConf ? m('nextChip', { city: nextPlace.city, dates: nextConf.dates }) : null,
              hosted: m.raw('hosted'), schoolOne: m('schoolOne'), schoolMany: m.raw('schoolMany'), attended: m.raw('attended'),
              about: m('about'), doing: m('doing'), atConference: m('atConference'), noFacts: m('noFacts'),
              source: m('source'), site: m('site'), website: m('website'), club: m('club'), cities: m('cities'),
              zoomIn: m('zoomIn'), zoomOut: m('zoomOut'), more: m.raw('more'), moreLabel: m.raw('moreLabel'),
              mapLabel: m('mapLabel'), noMap: m('noMap'), journeyPrev: m.raw('journeyPrev'), journeyNext: m.raw('journeyNext'),
              explore: m('explore'), exploreClose: m('exploreClose'), prevCity: m.raw('prevCity'), nextCity: m.raw('nextCity'),
              helpMac: m('helpMac'), helpWindows: m('helpWindows'), helpMobile: m('helpMobile'),
            }}
          />
        </div>
      </section>

      <section className="final" aria-labelledby="final-h">
        <div className="container">
          <Kinetic id="final-h" as="h2" text={l('finalLine')} className="t-h2" />
          <div className="hero__doors" style={{ justifyContent: 'flex-start' }}>
            <Button href="/start" size="lg">{l('doorStart')}</Button>
            <Button href="/clubs" size="lg" variant="secondary">{l('doorFind')}</Button>
          </div>
        </div>
      </section>
    </>
  )
}

function Squiggle() {
  return (
    <svg viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true">
      <path pathLength={1} d="M3 15 C 40 4, 70 20, 105 11 S 170 4, 205 13 S 265 19, 297 7" fill="none" stroke="var(--nature)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

function TickerList({ events, copy = false }: { events: PublicEvent[]; copy?: boolean }) {
  return (
    <ul className={copy ? 'ticker__list ticker__dup' : 'ticker__list'} aria-hidden={copy || undefined} inert={copy || undefined}>
      {events.map((e) => {
        const day = eventDay(e.startsAt, e.tz)
        return (
          <li key={e.id}>
            <Link href={`/events/${e.id}`} tabIndex={copy ? -1 : undefined}>
              <span className={`ticker__dot fill-${e.strand}`} aria-hidden="true" />
              <span>
                <span className="ticker__date">{day.day} {day.month}</span>{' '}
                <span className="ticker__title">{e.title}</span>{' '}
                <span className="ticker__where">· {e.city}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Stickers({ strands, className = '' }: { strands: Strand[]; className?: string }) {
  return (
    <div className={`sticker-row ${className}`} aria-hidden="true">
      {strands.map((st, i) => (
        <span key={st} className={`sticker fill-${st}`} style={{ transform: `rotate(${[-8, 10, -5, 7][i % 4]}deg)` }}>{STRAND_LETTER[st]}</span>
      ))}
    </div>
  )
}

function EventSticker({ event, className = '' }: { event: PublicEvent; className?: string }) {
  return (
    <Link href={`/events/${event.id}`} className={`sticker-card ${className}`}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <DateCard iso={event.startsAt} tz={event.tz} />
        <div style={{ display: 'grid', gap: 2 }}>
          <span className="t-row-title">{event.title}</span>
          <span className="t-meta">{event.city} · {modeLabel(event.mode)}</span>
        </div>
      </div>
      <div className="chips" style={{ marginTop: 12 }}><StrandChip strand={event.strand} /></div>
    </Link>
  )
}

function ProjectSticker({ project, className = '' }: { project: PublicProject; className?: string }) {
  const p = t('projects')
  return (
    <Link href={`/projects/${project.id}`} className={`sticker-card ${className}`}>
      <div className="t-row-title">{project.title}</div>
      <div className="t-meta">{project.club.name} · {project.year}</div>
      <div className="sticker-card__steps">
        <p><span className="sticker-card__label">{p('problem')}</span><span className="clamp-2">{project.problem}</span></p>
        <p><span className="sticker-card__label">{p('action')}</span><span className="clamp-2">{project.action}</span></p>
      </div>
      <div className="chips" style={{ marginTop: 12 }}><StrandChip strand={project.strand} /></div>
    </Link>
  )
}

function ClubSticker({ club, className = '' }: { club: ClubSummary; className?: string }) {
  return (
    <Link href={`/clubs/${club.slug}`} className={`sticker-card ${className}`}>
      <div className="t-row-title">{club.name}</div>
      <div className="t-meta">{club.schoolName} · {club.city}, {club.countryName}</div>
      <TrustLine verifiedAt={club.verifiedAt} />
    </Link>
  )
}
