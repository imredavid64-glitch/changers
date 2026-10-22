import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ImageIcon } from 'lucide-react'
import { t } from '@/i18n/t'
import { getApprovals } from '@/lib/data'
import { getViewer } from '@/lib/viewer'
import { shortDate } from '@/lib/format'
import { EndOfList, SignInGate, StrandChip } from '@/components/ui'
import { Form } from '@/components/Form'
import { FactorPrompt } from '@/components/FactorPrompt'
import { decide } from '@/app/actions/club'

export const metadata: Metadata = { title: t('approvals')('title'), robots: { index: false } }

type Props = { params: Promise<{ slug: string }> }

// The approval queue (PRD §5 route 14; 07 §3): leads approve club-only text and members' club-only
// proposals; the advisor approves anything public, every photo and leads' own proposals; nobody
// approves their own item.
export default function ApprovalsPage({ params }: Props) {
  return (
    <div className="container page">
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Approvals params={params} />
      </Suspense>
    </div>
  )
}

async function Approvals({ params }: Props) {
  const [{ slug }, viewer] = await Promise.all([params, getViewer()])
  if (viewer.kind === 'user' && viewer.needsFactor && viewer.memberships.some((m) => m.role === 'advisor')) return <FactorPrompt next={`/clubs/${slug}/approvals`} />
  const data = await getApprovals(viewer, slug)
  if (!data) return <SignInGate next={`/clubs/${slug}/approvals`} note={t('ui')('membersOnly')} />
  const a = t('approvals')
  const s = t('safety')
  const ui = t('ui')
  const empty = !data.updates.length && !data.projects.length && !data.joins.length
  // One form per item (R1b): Approve, Send back with a note (join requests have no note), or Hold. The database
  // decides who may approve what (07 §3), so a refusal comes back as "You can't do that here".
  const actions = (kind: 'member' | 'update' | 'project', id: string) => (
    <Form action={decide} demoNotice={ui('demoNothingSaved')} className="approval__actions" hidden={{ kind, id, slug }}>
      <button type="submit" name="do" value="approve" className="btn btn-primary btn-sm">{s('approve')}</button>
      {kind !== 'member' ? (
        <details className="approval__note">
          <summary className="btn btn-secondary btn-sm">{s('sendBack')}</summary>
          <label className="visually-hidden" htmlFor={`note-${id}`}>{s('sendBack')}</label>
          <textarea id={`note-${id}`} name="note" className="textarea" maxLength={500} />
          <button type="submit" name="do" value="sendBack" className="btn btn-secondary btn-sm">{s('sendBack')}</button>
        </details>
      ) : null}
      <button type="submit" name="do" value="hold" className="btn btn-quiet btn-sm">{s('hold')}</button>
    </Form>
  )
  return (
    <>
      <p className="t-meta"><Link className="link" href={`/clubs/${slug}/space`}>{ui('backTo', { name: data.club.name })}</Link></p>
      <h1 className="t-page-h1">{a('title')}</h1>
      <ul className="approval-list">
        {data.joins.map((j) => (
          <li key={j.id} className="card approval">
            <p className="t-row-title">{a('join', { name: j.name })}</p>
            {actions('member', j.id)}
          </li>
        ))}
        {data.projects.map((p) => (
          <li key={p.id} className="card approval">
            <p className="t-row-title">{a('proposal', { name: p.author })}</p>
            <p><Link className="link" href={`/projects/${p.id}`}>{p.title}</Link></p>
            <div className="chips"><StrandChip strand={p.strand} /><span className="status-tag">{p.visibility === 'public' ? a('forEveryone') : a('forClub')}</span></div>
            {actions('project', p.id)}
          </li>
        ))}
        {data.updates.map((u) => (
          <li key={u.id} className="card approval">
            <p className="t-row-title">{a('update', { name: u.author })}</p>
            <p className="t-meta">{shortDate(u.createdAt)}{u.hasPhoto ? ` · ${a('hasPhoto')}` : ''}</p>
            <p>{u.body}</p>
            {u.hasPhoto ? <p className="t-meta approval__photo"><ImageIcon size={20} aria-hidden="true" /> {a('hasPhoto')}</p> : null}
            <div className="chips"><span className="status-tag">{u.visibility === 'public' ? a('forEveryone') : a('forClub')}</span></div>
            {actions('update', u.id)}
          </li>
        ))}
      </ul>
      {empty ? <EndOfList text={t('dashboard')('caughtUp')} action={<Link href={`/clubs/${slug}/space`} className="btn btn-secondary">{ui('openSpace')}</Link>} /> : null}
    </>
  )
}
