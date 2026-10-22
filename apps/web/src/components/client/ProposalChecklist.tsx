'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, Circle } from 'lucide-react'

export type ChecklistLabels = { title: string; titleShort: string; problemNumber: string; actionWho: string; evidenceHow: string }

/**
 * "Before you send it" (R1b · 6, from the old site's AI Writing Coach, rule-based like theirs and nothing sent
 * anywhere): four plain checks on the project form that tick as the student writes.
 */
export function ProposalChecklist({ labels }: { labels: ChecklistLabels }) {
  const [done, setDone] = useState({ title: false, problem: false, action: false, evidence: false })
  useEffect(() => {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() ?? ''
    const check = () => setDone({
      title: val('title').length > 0 && val('title').length <= 80,
      problem: /\d/.test(val('problem')),
      action: val('action').split(/\s+/).filter(Boolean).length >= 8,
      evidence: val('evidence').split(/\s+/).filter(Boolean).length >= 5,
    })
    check()
    const form = document.getElementById('title')?.closest('form')
    form?.addEventListener('input', check)
    return () => form?.removeEventListener('input', check)
  }, [])
  const items = [[done.title, labels.titleShort], [done.problem, labels.problemNumber], [done.action, labels.actionWho], [done.evidence, labels.evidenceHow]] as const
  return (
    <aside className="checklist card" aria-labelledby="checklist-h">
      <h2 id="checklist-h" className="t-row-title">{labels.title}</h2>
      <ul>
        {items.map(([ok, text]) => (
          <li key={text} className={ok ? 'is-done' : undefined}>
            {ok ? <CircleCheck size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
