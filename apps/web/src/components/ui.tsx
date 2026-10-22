import Link from 'next/link'
import type { ReactNode } from 'react'
import { BadgeCheck } from 'lucide-react'
import { t } from '@/i18n/t'
import { STRAND_LETTER, type Strand } from '@/lib/types'
import { eventDay, monthYear } from '@/lib/format'
import { Kinetic } from './Kinetic'

type ButtonProps = {
  href?: string
  variant?: 'primary' | 'secondary' | 'quiet'
  size?: 'lg' | 'md' | 'sm'
  block?: boolean
  type?: 'button' | 'submit'
  className?: string
  children: ReactNode
}
export function Button({ href, variant = 'primary', size = 'md', block, type = 'button', className = '', children }: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, size === 'lg' && 'btn-lg', size === 'sm' && 'btn-sm', block && 'btn-block', className].filter(Boolean).join(' ')
  // The label sits in a "roll" (v3: the text rolls up on hover, Cuberto's .8s cubic-bezier(.16,1,.3,1)).
  const label = typeof children === 'string' ? <span className="roll"><span>{children}</span></span> : children
  return href ? <Link href={href} className={cls}>{label}</Link> : <button type={type} className={cls}>{label}</button>
}

export function StrandChip({ strand }: { strand: Strand }) {
  const s = t('strands')
  return (
    <span className={`chip fill-${strand}`}>
      <b aria-hidden="true">{STRAND_LETTER[strand]}</b>
      {s(strand)}
    </span>
  )
}

export function StrandBadge({ strand, size = 48 }: { strand: Strand; size?: number }) {
  return (
    <span className={`strand-badge fill-${strand}`} style={{ width: size, height: size }} aria-hidden="true">
      {STRAND_LETTER[strand]}
    </span>
  )
}

/** The signature move (PRD §4): only verified clubs are listed, and each says when its advisor was confirmed. */
export function TrustLine({ verifiedAt }: { verifiedAt: string | null }) {
  if (!verifiedAt) return null
  return (
    <p className="trust-line t-meta">
      <BadgeCheck size={20} strokeWidth={2} aria-hidden="true" />
      {t('directory')('verified', { date: monthYear(verifiedAt) })}
    </p>
  )
}

export function DateCard({ iso, tz }: { iso: string; tz: string }) {
  const d = eventDay(iso, tz)
  return (
    <div className="date-card" aria-hidden="true">
      <span className="date-card__month">{d.month}</span>
      <span className="date-card__day">{d.day}</span>
    </div>
  )
}

/** A visible marker for missing copy or data (law 2). Never a plausible placeholder. */
export function Todo({ children }: { children: ReactNode }) {
  return <span className="todo">TODO: {children}</span>
}

export function EndOfList({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="end-of-list">
      {text ? <p className="t-meta">{text}</p> : null}
      {action}
    </div>
  )
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty card">
      <p>{text}</p>
      {action}
    </div>
  )
}

export function SignInGate({ next, note }: { next: string; note?: string }) {
  const ui = t('ui')
  const nav = t('nav')
  return (
    <div className="empty card">
      <p>{note ?? ui('signInToSee')}</p>
      <Button href={`/sign-in?next=${encodeURIComponent(next)}`}>{nav('signIn')}</Button>
    </div>
  )
}

export function Segmented({ items, label }: { items: { href: string; label: string; current: boolean }[]; label: string }) {
  return (
    <nav aria-label={label}>
      <div className="segmented">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={i.current ? 'page' : undefined} scroll={false}>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function PageHeader({ title, lead, actions, eyebrow, titleClass = 't-page-h1' }: { title: ReactNode; lead?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; titleClass?: string }) {
  return (
    <header className="page-header">
      {eyebrow}
      {typeof title === 'string' ? <Kinetic text={title} className={titleClass} /> : <h1 className={titleClass}>{title}</h1>}
      {lead ? <p className="t-meta page-header__lead">{lead}</p> : null}
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
