import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { switches } from '@/config/switches'
import { t } from '@/i18n/t'
import { PageHeader, Todo } from '@/components/ui'

export const metadata: Metadata = { title: t('conference')('title') }

// The conference hub (PRD §5 route 8) ships hidden until the host team registers or gives written
// permission (06 #10; rule 4: a school is named only with its consent). Built in R4.
export default function ConferencePage() {
  if (!switches.conferenceHub) notFound()
  return (
    <div className="container page">
      <PageHeader title={t('conference')('title')} />
      <Todo>COPY §Events — the conference hub, from the host team (06 #10)</Todo>
    </div>
  )
}
