'use client'

import { useState, useTransition } from 'react'
import { enrollTotp, verifyTotp } from '@/app/actions/mfa'
import { ActionForm } from './ActionForm'

export type TotpLabels = { intro: string; start: string; secret: string; code: string; verify: string }

/** Turning on the authenticator app: a QR code and a key for this person's own screen, then one code to confirm. */
export function TotpSetup({ labels }: { labels: TotpLabels }) {
  const [factor, setFactor] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!factor) {
    return (
      <div className="stack">
        <p>{labels.intro}</p>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
          const r = await enrollTotp()
          if (r.ok) setFactor(r); else setError(r.message)
        })}>{labels.start}</button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    )
  }
  return (
    <ActionForm action={verifyTotp} className="stack" hidden={{ factorId: factor.factorId, next: '/account/security' }}>
      {/* The QR code is an SVG image from Supabase Auth; the key is the same secret, to type in by hand. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={factor.qr} alt="" width={200} height={200} className="totp-qr" />
      <p className="t-meta">{labels.secret} <code className="totp-key">{factor.secret}</code></p>
      <div className="field">
        <label htmlFor="totp-code">{labels.code}</label>
        <input id="totp-code" name="code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
      </div>
      <button type="submit" className="btn btn-primary">{labels.verify}</button>
    </ActionForm>
  )
}
