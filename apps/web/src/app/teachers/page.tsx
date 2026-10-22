import type { Metadata } from 'next'
import { t } from '@/i18n/t'
import { Button, PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: t('teachers')('title'), description: t('teachers')('intro') }

// The teacher path (PRD §5 route 11): how advisor verification works (07 §4) and what advisors see.
export default function TeachersPage() {
  const x = t('teachers')
  return (
    <div className="container page narrow">
      <PageHeader title={x('title')} lead={x('intro')} />
      <ol className="steps steps--stacked">
        {[x('step1'), x('step2'), x('step3'), x('step4')].map((s, i) => (
          <li key={s} className="steps__item">
            <span className="steps__n tnum" aria-hidden="true">{i + 1}</span>
            <p>{s}</p>
          </li>
        ))}
      </ol>
      <section className="section-block" aria-labelledby="see-h">
        <h2 id="see-h" className="t-h2-app">{x('seeTitle')}</h2>
        <p className="prose">{x('seeBody')}</p>
      </section>
      <section className="section-block" aria-labelledby="safe-h">
        <h2 id="safe-h" className="t-h2-app">{x('safeTitle')}</h2>
        <p className="prose">{x('safeBody')}</p>
      </section>
      <div className="end-of-list"><Button href="/start" size="lg">{x('cta')}</Button></div>
    </div>
  )
}
