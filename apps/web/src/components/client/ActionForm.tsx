'use client'

import { useActionState, type ReactNode } from 'react'
import Link from 'next/link'
import type { ActionResult } from '@/lib/action-result'

/**
 * A form that runs a Server Action (R1b), the live twin of DemoForm. The action answers with a short message: a
 * status when it worked, an alert when it didn't. On success most actions redirect instead.
 */
export function ActionForm({ action, children, className = 'stack', hidden }: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>
  children: ReactNode
  className?: string
  hidden?: Record<string, string>
}) {
  const [state, run, pending] = useActionState(action, null)
  return (
    <form action={run} className={className} aria-busy={pending}>
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      {children}
      {state?.message ? <p className={state.ok ? 't-meta' : 'form-error'} role={state.ok ? 'status' : 'alert'}>{state.message}</p> : null}
      {state?.href && state.linkText ? <p><Link className="btn btn-secondary" href={state.href}>{state.linkText}</Link></p> : null}
    </form>
  )
}
