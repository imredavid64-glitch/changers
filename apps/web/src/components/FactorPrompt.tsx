import Link from 'next/link'
import { t } from '@/i18n/t'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * For a teacher or admin signed in without the authenticator app (07 §4: no advisor or admin power before aal2): one
 * line and the way on, to set the app up or to use it.
 */
export async function FactorPrompt({ next }: { next: string }) {
  const m = t('mfa')
  const { data } = await (await supabaseServer()).auth.mfa.listFactors()
  const href = data?.totp?.length ? `/sign-in/factor?next=${encodeURIComponent(next)}` : '/account/security'
  return (
    <div className="empty card" role="status">
      <p>{m('needed')}</p>
      <Link href={href} className="btn btn-primary">{data?.totp?.length ? m('signInSubmit') : m('neededLink')}</Link>
    </div>
  )
}
