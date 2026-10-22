'use client'

import { useSyncExternalStore } from 'react'

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600],
]
const noSubscribe = () => () => {}

/** "Active 3 days ago". The server renders the month (cached pages can't know "now"); the browser refines it. */
export function RelativeTime({ iso, template, fallback }: { iso: string; template: string; fallback: string }) {
  const when = useSyncExternalStore(
    noSubscribe,
    () => {
      const diff = (Date.parse(iso) - Date.now()) / 1000
      const [unit, secs] = UNITS.find(([, s]) => Math.abs(diff) >= s) ?? ['hour', 3600]
      return new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' }).format(Math.round(diff / secs), unit)
    },
    () => fallback,
  )
  return <time dateTime={iso}>{template.replace('{when}', when)}</time>
}
