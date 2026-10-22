import { getPublicEvent } from '@/lib/data'

// .ics export (07 §12): times in the event's own zone with TZID and a VTIMEZONE. The VTIMEZONE is built
// from the zone's January and July offsets with the EU switch rule (last Sunday of March and October),
// which covers every European zone the network uses; R3 tests it against the viewer's calendar apps.

function offsetOf(tz: string, iso: string) {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/)
  return m ? `${m[1]}${m[2]}${m[3]}` : '+0000'
}

function localStamp(iso: string, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  )
  return `${parts.year}${parts.month}${parts.day}T${parts.hour === '24' ? '00' : parts.hour}${parts.minute}${parts.second}`
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const e = await getPublicEvent(id)
  if (!e) return new Response('Not found', { status: 404 })
  const year = e.startsAt.slice(0, 4)
  const winter = offsetOf(e.tz, `${year}-01-15T12:00:00Z`)
  const summer = offsetOf(e.tz, `${year}-07-15T12:00:00Z`)
  const vtz = winter === summer
    ? ['BEGIN:VTIMEZONE', `TZID:${e.tz}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', `TZOFFSETFROM:${winter}`, `TZOFFSETTO:${winter}`, 'END:STANDARD', 'END:VTIMEZONE']
    : ['BEGIN:VTIMEZONE', `TZID:${e.tz}`,
        'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', `TZOFFSETFROM:${winter}`, `TZOFFSETTO:${summer}`, 'END:DAYLIGHT',
        'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', `TZOFFSETFROM:${summer}`, `TZOFFSETTO:${winter}`, 'END:STANDARD',
        'END:VTIMEZONE']
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Changemakers Network//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...vtz,
    'BEGIN:VEVENT',
    `UID:${e.id}@changemakers.local`,
    `DTSTAMP:${e.startsAt.replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;TZID=${e.tz}:${localStamp(e.startsAt, e.tz)}`,
    `DTEND;TZID=${e.tz}:${localStamp(e.endsAt, e.tz)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `LOCATION:${esc(e.city)}`, // city only: the exact place is for people who RSVP (brief rule 1)
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  return new Response(ics + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${e.id}.ics"` } })
}
