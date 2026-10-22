'use client'

import { Printer } from 'lucide-react'

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <Printer size={20} aria-hidden="true" /> {label}
    </button>
  )
}
