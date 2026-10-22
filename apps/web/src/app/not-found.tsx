import { t } from '@/i18n/t'
import { Button, PageHeader } from '@/components/ui'

export default function NotFound() {
  const ui = t('ui')
  return (
    <div className="container page narrow">
      <PageHeader title={ui('notFound')} />
      <div className="end-of-list">
        <Button href="/">{ui('notFoundAction')}</Button>
        <Button href="/clubs" variant="secondary">{t('nav')('findClub')}</Button>
      </div>
    </div>
  )
}
