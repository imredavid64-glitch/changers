import { t } from '@/i18n/t'
import { Button, PageHeader, Todo } from './ui'

// Trust pages (PRD §5 route 17). The texts are 🔴 until the operator is named and an adult approves
// them (05-COPY §Legal texts; 06 #1–2), so each page shows a visible TODO naming its source, never
// a plausible placeholder. legalFinal stays off until then.
export function LegalPage({ title, todo }: { title: string; todo: string }) {
  return (
    <div className="container page narrow">
      <PageHeader title={title} />
      <p><Todo>{todo}</Todo></p>
      <div className="end-of-list"><Button href="/" variant="secondary">{t('ui')('notFoundAction')}</Button></div>
    </div>
  )
}
