import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { t } from '@/i18n/t'
import { switches } from '@/config/switches'
import { getAdmin } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { dateTime } from '@/lib/format'
import { first } from '@/lib/url'
import { Segmented, SignInGate, StrandChip } from '@/components/ui'
import { DemoForm } from '@/components/client/Dialogs'
import { Form } from '@/components/Form'
import { FactorPrompt } from '@/components/FactorPrompt'
import { verify } from '@/app/actions/club'
import { Swap } from '@/components/Swap'

export const metadata: Metadata = { title: t('admin')('title'), robots: { index: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const TABS = ['verify', 'reports', 'audit', 'hub', 'resources'] as const

// Network admin (PRD §5 route 16; 07 §3, §7): verification, reports (child safety first), the append-only
// audit log, the conference hub and resources. Requires an authenticator (aal2) from R4.
export default function AdminPage({ searchParams }: Props) {
  return (
    <div className="container page">
      <h1 className="t-page-h1">{t('admin')('title')}</h1>
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Admin({ searchParams }: Props) {
  const [sp, viewer] = await Promise.all([searchParams, getViewer()])
  const data = await getAdmin(viewer)
  if (!data) return viewer.kind === 'user' && viewer.needsFactor ? <FactorPrompt next="/admin" /> : <SignInGate next="/admin" />
  const a = t('admin')
  const s = t('safety')
  const demo = t('ui')('demoNothingSaved')
  const tab = TABS.find((x) => x === first(sp.tab)) ?? 'verify'
  const label = { verify: a('tabVerify'), reports: a('tabReports'), audit: a('tabAudit'), hub: a('tabHub'), resources: a('tabResources') }
  return (
    <div className="stack">
      <p className="trust-line t-meta"><ShieldCheck size={20} aria-hidden="true" /> {a('mfa')}</p>
      <Segmented label={a('title')} items={TABS.map((k) => ({ href: k === 'verify' ? '/admin' : `/admin?tab=${k}`, label: label[k], current: tab === k }))} />
      <Swap k={tab} name="admin-tab">
      <div>

      {tab === 'verify' ? (
        <ul className="approval-list">
          {data.verifications.map((v) => (
            <li key={v.id} className="card approval">
              <p className="t-row-title">{v.label}</p>
              <p className="t-meta">{a('step', { n: v.step })} · {v.note}</p>
              <Form action={verify} demoNotice={demo} className="approval__actions" hidden={{ kind: v.kind, id: v.id }}>
                <button type="submit" name="do" value="approve" className="btn btn-primary btn-sm">{s('approve')}</button>
                <button type="submit" name="do" value="hold" className="btn btn-quiet btn-sm">{s('hold')}</button>
              </Form>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'reports' ? (
        <ul className="approval-list">
          {data.reports.map((r) => (
            <li key={r.id} className={`card approval ${r.priority === 'child_safety' ? 'approval--urgent' : ''}`}>
              <p className="t-row-title approval__title">{r.priority === 'child_safety' ? <ShieldAlert size={20} aria-hidden="true" /> : null}{r.priority === 'child_safety' ? a('childSafety') : a('normal')} · {r.reason}</p>
              <p className="t-meta">{r.targetLabel} · {dateTime(r.createdAt)} · {r.status}</p>
              {r.details ? <p>{r.details}</p> : null}
              <DemoForm notice={demo} className="approval__actions">
                <button type="submit" className="btn btn-primary btn-sm">{s('hold')}</button>
                <button type="submit" className="btn btn-secondary btn-sm">{s('sendBack')}</button>
              </DemoForm>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'audit' ? (
        <div className="stack">
          <p className="t-meta">{a('auditNote')}</p>
          <div className="table-wrap">
            <table className="audit-table">
              <thead><tr><th scope="col">{a('when')}</th><th scope="col">{a('who')}</th><th scope="col">{a('what')}</th><th scope="col">{a('item')}</th></tr></thead>
              <tbody>
                {data.audit.map((e) => (
                  <tr key={e.id}><td className="tnum">{dateTime(e.at)}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.target}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'hub' ? <div className="empty card"><p>{a('hubOff')}</p><p className="t-meta">conferenceHub: {String(switches.conferenceHub)}</p></div> : null}

      {tab === 'resources' ? (
        <ul className="club-list">
          {data.resources.map((r) => (
            <li key={r.id} className="list-card club-row">
              <div className="club-row__main"><p className="t-row-title">{r.title}</p><p className="t-meta">{r.sourceName}</p></div>
              <StrandChip strand={r.strand} />
            </li>
          ))}
        </ul>
      ) : null}
      </div>
      </Swap>
    </div>
  )
}
