'use client'

import Link from 'next/link'
// Its own small file: importing messages/en.json here would ship every string to every page (15 KB).
import copy from '../../messages/en.error.json'

// An unexpected failure inside a page: the header and footer stay, and the reader gets a way on.
// Copy: docs/05-COPY.md "Design-pass strings" (🟡). Reporting to Sentry arrives with R4 (site/ENV.md).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container page narrow">
      <header className="page-header">
        <h1 className="t-page-h1">{copy.title}</h1>
        <p className="t-meta page-header__lead">{copy.text}</p>
      </header>
      <div className="end-of-list">
        <button type="button" className="btn btn-primary" onClick={reset}>{copy.retry}</button>
        <Link href="/" className="btn btn-secondary">{copy.home}</Link>
      </div>
    </div>
  )
}
