import Link from 'next/link'
import { Suspense } from 'react'
import { Menu, Search, X } from 'lucide-react'
import { t } from '@/i18n/t'
import { demoMode, switches } from '@/config/switches'
import { cookies } from 'next/headers'
import { getViewer, MOTION_COOKIE } from '@/lib/viewer'
import { NavLinks, type NavItem } from './client/NavLink'

// Header (v2, docs/03 v2): paper with B's 3 px ink rule; the four-strand mark and wordmark, the links and a
// search pill from 1100 px, and A's ink pill. Phones: wordmark, menu and the primary, each ≥44 high.

/** The four strands as a tilted 2×2 of dots: the network's mark (our own, from the strand fills). */
export function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i className="fill-nature" /><i className="fill-economy" /><i className="fill-society" /><i className="fill-wellbeing" />
    </span>
  )
}

function SignedOut() {
  const n = t('nav')
  return (
    <>
      <Link href="/sign-in" className="btn btn-quiet btn-sm when-wide">{n('signIn')}</Link>
      <Link href="/start" className="btn btn-primary btn-sm header-primary">{n('startClub')}</Link>
    </>
  )
}

async function HeaderAuth() {
  const viewer = await getViewer()
  if (viewer.kind === 'visitor') return <SignedOut />
  const n = t('nav')
  return (
    <>
      <Link href="/home" className="btn btn-quiet btn-sm when-wide">{n('home')}</Link>
      <Link href="/account" className="btn btn-secondary btn-sm header-primary">{n('account')}</Link>
    </>
  )
}

async function MenuAuth() {
  const viewer = await getViewer()
  const n = t('nav')
  return viewer.kind === 'visitor' ? (
    <>
      <Link href="/sign-in">{n('signIn')}</Link>
      <Link href="/start">{n('startClub')}</Link>
    </>
  ) : (
    <>
      <Link href="/home">{n('home')}</Link>
      <Link href="/account">{n('account')}</Link>
    </>
  )
}

export function SiteHeader() {
  const n = t('nav')
  const m = t('meta')
  const items: NavItem[] = [
    { href: '/clubs', label: n('findClub') },
    { href: '/events', label: n('events') },
    { href: '/resources', label: n('resources') },
    { href: '/whats-new', label: t('features')('feedLink') },
  ]
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="header-left">
          <Link href="/" className="wordmark"><Mark />{m('wordmark')}</Link>
          <nav className="nav-links" aria-label={n('mainLabel')}>
            <Suspense fallback={items.map((i) => <Link key={i.href} href={i.href} className="nav-link">{i.label}</Link>)}>
              <NavLinks items={items} />
            </Suspense>
          </nav>
        </div>
        <div className="search-wrap">
          <form action="/search" role="search" className="search-pill">
            <Search size={20} strokeWidth={2} aria-hidden="true" />
            <label htmlFor="site-search" className="visually-hidden">{n('searchPlaceholder')}</label>
            <input id="site-search" name="q" type="search" placeholder={n('searchPlaceholder')} />
          </form>
        </div>
        <div className="header-actions">
          <Suspense fallback={<SignedOut />}>
            <HeaderAuth />
          </Suspense>
          <button type="button" className="btn btn-secondary btn-sm menu-button" popoverTarget="site-menu" aria-label={n('menu')}>
            <Menu size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div id="site-menu" popover="auto" className="menu-sheet">
        <div className="menu-sheet__head">
          <span className="wordmark"><Mark />{m('wordmark')}</span>
          <button type="button" className="btn btn-secondary btn-sm" popoverTarget="site-menu" popoverTargetAction="hide" aria-label={n('close')}>
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={n('menu')}>
          <Link href="/clubs">{n('findClub')}</Link>
          <Link href="/events">{n('events')}</Link>
          <Link href="/resources">{n('resources')}</Link>
          <Link href="/teachers">{n('teachers')}</Link>
          <hr className="divider" />
          <Suspense fallback={<><Link href="/sign-in">{n('signIn')}</Link><Link href="/start">{n('startClub')}</Link></>}>
            <MenuAuth />
          </Suspense>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  const f = t('footer')
  return (
    <footer className="site-footer on-ink">
      <div className="container">
        <Link href="/" className="wordmark"><Mark />{t('meta')('wordmark')}</Link>
        <nav aria-label={t('nav')('footerLabel')}>
          <Link href="/about">{f('about')}</Link>
          <Link href="/teachers">{f('teachers')}</Link>
          <Link href="/privacy">{f('privacy')}</Link>
          <Link href="/terms">{f('terms')}</Link>
          <Link href="/code-of-conduct">{f('conduct')}</Link>
          <Link href="/safeguarding">{f('safety')}</Link>
        </nav>
        <p className="t-meta" style={{ marginTop: 16 }}>{f('maker')}</p>
        {switches.compassWording ? <p className="t-meta">Compass Visual &amp; thinking: Compass Education | Used with permission.</p> : null}
      </div>
    </footer>
  )
}

const PERSONAS = ['visitor', 'member', 'lead', 'advisor', 'admin'] as const

async function DemoPersonas() {
  const viewer = await getViewer()
  const current = viewer.kind === 'visitor' ? 'visitor' : viewer.persona ?? 'visitor'
  const ui = t('ui')
  const label = { visitor: ui('demoVisitor'), member: ui('demoMember'), lead: ui('demoLead'), advisor: ui('demoAdvisor'), admin: ui('demoAdmin') }
  return (
    <>
      {PERSONAS.map((p) => (
        <a key={p} href={`/demo?as=${p}`} aria-current={p === current ? 'true' : undefined}>
          {label[p]}
        </a>
      ))}
    </>
  )
}

async function DemoMotion() {
  const on = (await cookies()).get(MOTION_COOKIE)?.value !== 'off'
  const ui = t('ui')
  return (
    <a href={`/demo?motion=${on ? 'off' : 'on'}`} className="demo-pill__motion" aria-current={on ? 'true' : undefined}>
      {on ? ui('demoMotionOn') : ui('demoMotionOff')}
    </a>
  )
}

async function DemoCurrent() {
  const viewer = await getViewer()
  const ui = t('ui')
  const label = { visitor: ui('demoVisitor'), member: ui('demoMember'), lead: ui('demoLead'), advisor: ui('demoAdvisor'), admin: ui('demoAdmin') }
  return <>{label[viewer.kind === 'visitor' ? 'visitor' : viewer.persona ?? 'visitor']}</>
}

/** Review builds only: a small floating pill says the data is DEMO and switches the viewer persona. */
export function DemoBar() {
  if (!demoMode) return null
  const ui = t('ui')
  return (
    <aside className="demo-pill" aria-label="DEMO">
      <button type="button" className="demo-pill__button" popoverTarget="demo-menu">
        DEMO · {ui('demoViewingAs')}: <Suspense fallback={ui('demoVisitor')}><DemoCurrent /></Suspense>
      </button>
      <div id="demo-menu" popover="auto" className="demo-pill__menu">
        <p><strong>{ui('demoNotice')}</strong></p>
        <nav aria-label={ui('demoViewingAs')}>
          <Suspense fallback={<span>{ui('demoVisitor')}</span>}>
            <DemoPersonas />
          </Suspense>
        </nav>
        <p className="demo-pill__sub">{ui('demoMotionLabel')}</p>
        <nav aria-label={ui('demoMotionLabel')}>
          <Suspense fallback={null}>
            <DemoMotion />
          </Suspense>
        </nav>
      </div>
    </aside>
  )
}
