import type { Metadata, Viewport } from 'next'
import { Atkinson_Hyperlegible_Next, Big_Shoulders, Caprasimo } from 'next/font/google'
import { t } from '@/i18n/t'
import { DemoBar, SiteFooter, SiteHeader } from '@/components/layout'
import { Suspense } from 'react'
import { Fx } from '@/components/client/Fx'
import './globals.css'
import './motion.css'

// Text: Atkinson Hyperlegible Next (Luke, 28 Sep). Display: Caprasimo, the friendly serif voice of direction A
// (Hack Club's 90 px display serif, docs/03 v2). Poster: Big Shoulders for B's numerals, dates and labels
// (Global Goals' condensed bold). All self-hosted at build time, latin + latin-ext (ő ű).
const text = Atkinson_Hyperlegible_Next({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-text' })
const display = Caprasimo({ weight: '400', subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-display' })
const poster = Big_Shoulders({ subsets: ['latin', 'latin-ext'], axes: ['opsz'], display: 'swap', variable: '--font-poster' })

// v3: animations are on unless the DEMO pill turned them off (cookie) or the system asks for reduced motion.
// The landing's intro plays once per browser session.
const MOTION_BOOT = "try{var d=document.documentElement,off=/(?:^|; )cm_motion=off(?:;|$)/.test(document.cookie),rm=matchMedia('(prefers-reduced-motion: reduce)').matches;d.setAttribute('data-motion',off||rm?'off':'on');if(!off&&!rm&&location.pathname==='/'&&!sessionStorage.getItem('cm_intro')){d.setAttribute('data-intro','1');sessionStorage.setItem('cm_intro','1')}}catch(e){}"

const m = t('meta')
export const metadata: Metadata = {
  title: { default: m('siteName'), template: `%s · ${m('siteName')}` },
  description: m('description'),
  openGraph: { title: m('siteName'), description: m('description'), type: 'website', siteName: m('siteName') },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const n = t('nav')
  return (
    <html lang="en" className={`${text.variable} ${display.variable} ${poster.variable}`} suppressHydrationWarning>
      <head>
        {/* v3 motion: decided before first paint (see MOTION_BOOT). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">{n('skip')}</a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>{children}</main>
        <SiteFooter />
        <DemoBar />
        <Suspense fallback={null}><Fx /></Suspense>
      </body>
    </html>
  )
}
