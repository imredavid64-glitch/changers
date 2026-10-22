'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import { Flag, Mail, X } from 'lucide-react'

function DialogShell({ dialogRef, title, closeLabel, children }: { dialogRef: React.RefObject<HTMLDialogElement | null>; title: string; closeLabel: string; children: ReactNode }) {
  return (
    <dialog ref={dialogRef} className="dialog" aria-label={title}>
      <div className="dialog__head">
        <h2 className="t-h2-app">{title}</h2>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => dialogRef.current?.close()} aria-label={closeLabel}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  )
}

export type ReportLabels = {
  report: string
  reasons: string[]
  details: string
  send: string
  urgent: string
  sentTodo: string
  close: string
  demo: string | null
}

/** A Report control on every item (07 §7). R4 wires it to the report route; it never fails closed. */
export function ReportButton({ labels, subject }: { labels: ReportLabels; subject: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const detailsId = useId() // a page can hold several Report buttons, so the field's id must be unique
  const [sent, setSent] = useState(false)
  return (
    <>
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setSent(false); ref.current?.showModal() }}>
        <Flag size={20} strokeWidth={2} aria-hidden="true" />
        {labels.report}
        <span className="visually-hidden">: {subject.length > 60 ? subject.slice(0, 57) + '…' : subject}</span>
      </button>
      <DialogShell dialogRef={ref} title={labels.report} closeLabel={labels.close}>
        {!sent ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
            <fieldset className="field">
              <legend className="label">{subject}</legend>
              {labels.reasons.map((r, i) => (
                <label key={r} className="choice">
                  <input type="radio" name="reason" value={r} required={i === 0} />
                  {r}
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor={detailsId}>{labels.details}</label>
              <textarea id={detailsId} className="textarea" name="details" />
            </div>
            <p className="t-meta">{labels.urgent}</p>
            <button type="submit" className="btn btn-primary btn-block">{labels.send}</button>
          </form>
        ) : (
          <div className="stack" role="status">
            <p><span className="todo">TODO: {labels.sentTodo}</span></p>
            <p className="t-meta">{labels.urgent}</p>
            {labels.demo ? <p className="t-meta">{labels.demo}</p> : null}
            <button type="button" className="btn btn-secondary btn-block" onClick={() => ref.current?.close()}>{labels.close}</button>
          </div>
        )}
      </DialogShell>
    </>
  )
}

export type ContactLabels = { title: string; helper: string; name: string; email: string; message: string; send: string; sent: string; close: string; demo: string | null }

/** "Contact the advisor": it reaches the advisor only, never a student, and never shows the advisor's address. */
export function ContactAdvisor({ labels }: { labels: ContactLabels }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [sent, setSent] = useState(false)
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => { setSent(false); ref.current?.showModal() }}>
        <Mail size={20} strokeWidth={2} aria-hidden="true" />
        {labels.title}
      </button>
      <DialogShell dialogRef={ref} title={labels.title} closeLabel={labels.close}>
        {!sent ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
            <p className="t-meta">{labels.helper}</p>
            <div className="field">
              <label htmlFor="c-name">{labels.name}</label>
              <input id="c-name" className="input" name="name" autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="c-email">{labels.email}</label>
              <input id="c-email" className="input" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="c-msg">{labels.message}</label>
              <textarea id="c-msg" className="textarea" name="message" required />
            </div>
            <button type="submit" className="btn btn-primary btn-block">{labels.send}</button>
          </form>
        ) : (
          <div className="stack" role="status">
            <p>{labels.sent}</p>
            {labels.demo ? <p className="t-meta">{labels.demo}</p> : null}
            <button type="button" className="btn btn-secondary btn-block" onClick={() => ref.current?.close()}>{labels.close}</button>
          </div>
        )}
      </DialogShell>
    </>
  )
}

/** A form that shows the DEMO notice instead of saving (review builds, until R1b). */
export function DemoForm({ children, notice, className = 'stack' }: { children: ReactNode; notice: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); setDone(true) }}>
      {children}
      {done ? <p className="t-meta" role="status">{notice}</p> : null}
    </form>
  )
}
