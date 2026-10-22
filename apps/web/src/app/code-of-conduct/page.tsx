import type { Metadata } from 'next'
import { t } from '@/i18n/t'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = { title: t('legal')('conduct') }

export default function Page() {
  return <LegalPage title={t('legal')('conduct')} todo={t('ui')('legalTodo')} />
}
