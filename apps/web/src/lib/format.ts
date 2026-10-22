// Dates are formatted with Intl, never hand-built (07 §12). The server renders the event's own zone;
// the viewer's zone is added in the browser (components/client/LocalTime).

const LOCALE = 'en-GB'

export function monthYear(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

export function eventDay(iso: string, tz: string) {
  const d = new Date(iso)
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { ...o, timeZone: tz }).format(d)
  return {
    month: part({ month: 'short' }).toUpperCase(),
    day: part({ day: 'numeric' }),
    long: part({ weekday: 'long', day: 'numeric', month: 'long' }),
    short: part({ weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

export function timeRange(startIso: string, endIso: string, tz: string) {
  const f = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
  const offset = new Intl.DateTimeFormat(LOCALE, { timeZoneName: 'shortOffset', timeZone: tz }).formatToParts(new Date(startIso)).find((p) => p.type === 'timeZoneName')?.value ?? ''
  return `${f.format(new Date(startIso))}–${f.format(new Date(endIso))} ${offset}`.trim()
}

export function shortDate(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

export function dateTime(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(iso)) + ' UTC'
}
