'use client'

import { useSyncExternalStore } from 'react'

const noSubscribe = () => () => {}

/**
 * Event times (07 §12): the server renders the host's time in the event's zone; the browser adds the
 * viewer's own time beside it when the zones differ: "{local} your time · {host} in {city}".
 */
export function LocalTime({ startIso, endIso, tz, hostText, city, template }: { startIso: string; endIso: string; tz: string; hostText: string; city: string; template: string }) {
  const hostOnly = `${hostText} in ${city}`
  const text = useSyncExternalStore(
    noSubscribe,
    () => {
      const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!viewerTz || viewerTz === tz) return hostOnly
      const f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
      const local = `${f.format(new Date(startIso))}–${f.format(new Date(endIso))}`
      return template.replace('{local}', local).replace('{host}', hostText).replace('{city}', city)
    },
    () => hostOnly,
  )
  return <span className="tnum">{text}</span>
}
