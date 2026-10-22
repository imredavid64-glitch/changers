import type { Metadata } from 'next'
import { t } from '@/i18n/t'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = { title: t('legal')('terms') }

export default function Page() {
  return <LegalPage title={t('legal')('terms')} todo={t('ui')('legalTodo')} />
}
