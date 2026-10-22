'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { sendCode, verifyCode } from '@/app/actions/auth'

export type SignInLabels = {
  intro: string
  email: string
  send: string
  check: string
  code: string
  submit: string
  resend: string
  resendIn: string
  codeHelp: string
  demo: string | null
  live: boolean // R1b: Supabase is connected, so the form really sends and checks the code
}

type Carry = { band?: string; joinCode?: string; start?: boolean } // answers given before the email (07 §4: age first)

/** Code sign-in (07 §4): email → a 6-digit code. No magic links: school link scanners use them up. */
export function SignInFlow({ labels, initialEmail = '', initialStep = 'email', next, carry }: {
  labels: SignInLabels; initialEmail?: string; initialStep?: 'email' | 'code'; next?: string; carry?: Carry
}) {
  const [step, setStep] = useState<'email' | 'code'>(initialStep)
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const [demoShown, setDemoShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const send = (then?: () => void) => start(async () => {
    setError(null)
    const r = await sendCode(email, carry)
    if (r && !r.ok) { setError(r.message ?? null); return }
    setWait(60)
    then?.()
  })

  if (step === 'email') {
    return (
      <form className="stack" aria-busy={pending} onSubmit={(e) => { e.preventDefault(); if (labels.live) send(() => setStep('code')); else { setStep('code'); setWait(60) } }}>
        <p className="t-meta">{labels.intro}</p>
        <div className="field">
          <label htmlFor="si-email">{labels.email}</label>
          <input id="si-email" className="input" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>{labels.send}</button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    )
  }
  return (
    <form
      className="stack" aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault()
        if (!labels.live) { setDemoShown(true); return }
        start(async () => { setError(null); const r = await verifyCode(email, code, next); if (r && !r.ok) setError(r.message ?? null) })
      }}
    >
      <p className="t-meta">{labels.check}</p>
      <div className="field">
        <label htmlFor="si-code">{labels.code}</label>
        <input
          id="si-code" className="input code-input" name="code" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} required aria-describedby="si-code-help" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <span id="si-code-help" className="visually-hidden">{labels.codeHelp}</span>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>{labels.submit}</button>
      <button type="button" className="btn btn-quiet btn-block" disabled={wait > 0 || pending} aria-disabled={wait > 0} onClick={() => (labels.live ? send() : setWait(60))}>
        {wait > 0 ? labels.resendIn.replace('{s}', String(wait)) : labels.resend}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {demoShown && labels.demo ? <p className="t-meta" role="status">{labels.demo}</p> : null}
    </form>
  )
}

/** Reads ?step=code&email= (07 §2): the code step can be opened directly. Wrapped in <Suspense> by the page. */
export function SignInFromParams({ labels }: { labels: SignInLabels }) {
  const sp = useSearchParams()
  return <SignInFlow labels={labels} initialEmail={sp.get('email') ?? ''} initialStep={sp.get('step') === 'code' ? 'code' : 'email'} next={sp.get('next') ?? undefined} />
}

export type AgeLabels = {
  age: string
  under13: string
  band1315: string
  band1617: string
  adult: string
  under13Stop: string
  band1315Stop: string
  continue: string
  teacherOrStudent: string
  teacher: string
  student: string
  codeLabel: string
  codeSubmit: string
  askInvite: string
}

/**
 * The age screen comes first, before the email (07 §4): neutral, four options, none pre-selected, no hint
 * of which answer passes. Under 13 stops here and stores nothing. 13–15 joins only through an invite.
 */
export function AgeFlow({ mode, labels, signIn }: { mode: 'start' | 'join'; labels: AgeLabels; signIn: SignInLabels }) {
  const [band, setBand] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [codeDone, setCodeDone] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const carry: Carry = { band: band ?? undefined, joinCode: mode === 'join' ? joinCode : undefined, start: mode === 'start' }

  if (!confirmed) {
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (band) setConfirmed(true) }}>
        <fieldset className="field">
          <legend className="t-h2-app">{labels.age}</legend>
          {[['under13', labels.under13], ['13-15', labels.band1315], ['16-17', labels.band1617], ['adult', labels.adult]].map(([v, l]) => (
            <label key={v} className="choice">
              <input type="radio" name="age" value={v} checked={band === v} onChange={() => setBand(v)} required />
              {l}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn btn-primary btn-block">{labels.continue}</button>
      </form>
    )
  }

  if (band === 'under13') return <div className="empty card" role="status"><p>{labels.under13Stop}</p></div>
  if (band === '13-15') {
    return (
      <div className="empty card" role="status">
        <p>{labels.band1315Stop}</p>
        <Link href="/teachers" className="btn btn-secondary">{labels.askInvite}</Link>
      </div>
    )
  }

  if (mode === 'join' && !codeDone) {
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); setCodeDone(true) }}>
        <div className="field">
          <label htmlFor="club-code">{labels.codeLabel}</label>
          <input id="club-code" className="input code-input" name="code" autoComplete="off" required value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-block">{labels.codeSubmit}</button>
      </form>
    )
  }

  if (mode === 'start') {
    return (
      <div className="stack">
        <p className="t-meta">{band === 'adult' ? labels.teacher : labels.student}</p>
        <SignInFlow labels={signIn} carry={carry} />
      </div>
    )
  }
  return <SignInFlow labels={signIn} carry={carry} />
}
