import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Download, LogOut, Trash2 } from 'lucide-react'
import { t } from '@/i18n/t'
import { getViewer } from '@/lib/viewer'
import { SignInGate } from '@/components/ui'
import { DemoForm } from '@/components/client/Dialogs'
import { Form } from '@/components/Form'
import { backend } from '@/lib/backend'
import { signOutEverywhere, signOutHere } from '@/app/actions/auth'
import { deleteMyAccount } from '@/app/actions/content'

export const metadata: Metadata = { title: t('nav')('account'), robots: { index: false } }

// Account (PRD §5 route 15; 07 §4): name, age band (up only), language, the digest (off; consent-based),
// download my data, sign out everywhere, delete my account. Advisors and admins enrol an authenticator here (R4).
export default function AccountPage() {
  return (
    <div className="container page narrow">
      <h1 className="t-page-h1">{t('nav')('account')}</h1>
      <Suspense fallback={<p className="t-meta" aria-busy="true">{t('ui')('loading')}</p>}>
        <Account />
      </Suspense>
    </div>
  )
}

async function Account() {
  const viewer = await getViewer()
  if (viewer.kind === 'visitor') return <SignInGate next="/account" />
  const a = t('account')
  const f = t('accountForm')
  const o = t('onboarding')
  const demo = t('ui')('demoNothingSaved')
  const bands = [['13-15', o('band1315')], ['16-17', o('band1617')], ['adult', o('adult')]] as const
  const order = ['13-15', '16-17', 'adult']
  return (
    <div className="stack">
      <DemoForm notice={demo} className="card form-card stack">
        <div className="field">
          <label htmlFor="name">{f('name')}</label>
          <input id="name" name="name" className="input" defaultValue={viewer.person.displayName} required />
        </div>
        <div className="field">
          <label htmlFor="band">{f('band')}</label>
          <p id="band-help" className="help">{f('bandHelp')}</p>
          <select id="band" name="band" className="select" defaultValue={viewer.person.ageBand} aria-describedby="band-help">
            {bands.map(([v, l]) => <option key={v} value={v} disabled={order.indexOf(v) < order.indexOf(viewer.person.ageBand)}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lang">{f('language')}</label>
          <select id="lang" name="lang" className="select" defaultValue="en"><option value="en">{f('english')}</option></select>
        </div>
        <label className="choice">
          <input type="checkbox" name="digest" />
          <span>{a('digest')}<br /><span className="t-meta">{a('digestNote')}</span></span>
        </label>
        <button type="submit" className="btn btn-primary">{f('save')}</button>
      </DemoForm>

      <section className="card form-card stack" aria-labelledby="data-h">
        <h2 id="data-h" className="t-h2-app">{a('heading')}</h2>
        {backend === 'supabase' ? (
          <a href="/account/export" className="btn btn-secondary btn-block" download><Download size={20} aria-hidden="true" /> {a('download')}</a>
        ) : (
          <DemoForm notice={demo} className="stack">
            <button type="submit" className="btn btn-secondary btn-block"><Download size={20} aria-hidden="true" /> {a('download')}</button>
          </DemoForm>
        )}
        {/* 07 §4: sign out here; "sign out everywhere" is signOut({ scope: 'global' }). */}
        <Form action={signOutHere} demoNotice={demo} className="stack">
          <button type="submit" className="btn btn-secondary btn-block"><LogOut size={20} aria-hidden="true" /> {t('nav')('signOut')}</button>
        </Form>
        <Form action={signOutEverywhere} demoNotice={demo} className="stack">
          <p className="t-meta">{a('signOutEverywhereHelp')}</p>
          <button type="submit" className="btn btn-secondary btn-block"><LogOut size={20} aria-hidden="true" /> {a('signOutEverywhere')}</button>
        </Form>
        <Form action={deleteMyAccount} demoNotice={demo} className="stack">
          <p className="t-meta">{a('deleteConfirm')}</p>
          <button type="submit" className="btn btn-quiet btn-block"><Trash2 size={20} aria-hidden="true" /> {a('delete')}</button>
        </Form>
      </section>
    </div>
  )
}
