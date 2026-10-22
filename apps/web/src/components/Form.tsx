import type { ReactNode } from 'react'
import { backend } from '@/lib/backend'
import type { ActionResult } from '@/lib/action-result'
import { DemoForm } from '@/components/client/Dialogs'
import { ActionForm } from '@/components/client/ActionForm'

/** Review builds keep the DEMO form (nothing saved); with Supabase the same form runs its Server Action. */
export function Form({ action, demoNotice, className, hidden, children }: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>
  demoNotice: string
  className?: string
  hidden?: Record<string, string>
  children: ReactNode
}) {
  if (backend === 'demo') return <DemoForm notice={demoNotice} className={className}>{children}</DemoForm>
  return <ActionForm action={action} className={className} hidden={hidden}>{children}</ActionForm>
}
