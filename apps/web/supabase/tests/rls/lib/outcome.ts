// One attempt's result: allowed (rows seen or changed), refused by the rules, or an error that is neither.
// "Refused" means: Postgres said no (42501: no grant, a row-level policy, or a guard/function refusing), the Data API
// doesn't expose the schema at all (PGRST106), or the rules filtered every row (0 rows seen or changed).
// Anything else (a broken token, a constraint error, a 500) is an error, so a check can't pass for the wrong reason.
export type Kind = 'allow' | 'refuse' | 'error'
export interface Outcome { kind: Kind; detail: string }

interface ApiError { code?: string; message?: string; status?: number; statusCode?: string }
interface Result { data: unknown; error: ApiError | null; count?: number | null; status?: number }

const REFUSAL = new Set(['42501', 'PGRST106'])
const SECRET_KEYS = /token|secret|otp|code|password|key/i

export function describeError(e: ApiError | null | undefined, status?: number): string {
  if (!e) return ''
  const code = e.code ?? e.statusCode ?? (status ? String(status) : '')
  return `${code} ${e.message ?? ''}`.trim().slice(0, 240)
}

/** A short, secret-free preview of returned data for failure messages. */
export function preview(data: unknown): string {
  return JSON.stringify(data, (k, v) => (k && SECRET_KEYS.test(k) ? '[redacted]' : v))?.slice(0, 200) ?? String(data)
}

export function refusedOrError(e: ApiError, status?: number): Outcome {
  return { kind: REFUSAL.has(e.code ?? '') ? 'refuse' : 'error', detail: describeError(e, status) }
}

/** select: allowed when at least one row comes back. */
export async function seen(q: PromiseLike<Result>): Promise<Outcome> {
  const r = await q
  if (r.error) return refusedOrError(r.error, r.status)
  const n = Array.isArray(r.data) ? r.data.length : r.data ? 1 : 0
  return n > 0 ? { kind: 'allow', detail: `${n} row(s) seen` } : { kind: 'refuse', detail: '0 rows seen' }
}

/** update / delete (with { count: 'exact' }): allowed when at least one row changed. */
export async function changed(q: PromiseLike<Result>): Promise<Outcome> {
  const r = await q
  if (r.error) return refusedOrError(r.error, r.status)
  if (typeof r.count !== 'number') return { kind: 'error', detail: 'the API returned no row count' }
  return r.count > 0 ? { kind: 'allow', detail: `${r.count} row(s) changed` } : { kind: 'refuse', detail: '0 rows changed' }
}

/** insert: allowed when the row went in (an insert either writes its row or fails). */
export async function inserted(q: PromiseLike<Result>): Promise<Outcome> {
  const r = await q
  if (r.error) return refusedOrError(r.error, r.status)
  return { kind: 'allow', detail: 'row inserted' }
}

/** Storage: the API answers 400/401/403/404 when the rules hide or refuse an object. */
export async function storage<T>(p: PromiseLike<{ data: T | null; error: unknown }>, done: (data: T) => boolean): Promise<Outcome> {
  const r = await p
  if (r.error) {
    const e = r.error as ApiError
    const status = Number(e.status ?? e.statusCode)
    return { kind: [400, 401, 403, 404].includes(status) ? 'refuse' : 'error', detail: describeError(e) }
  }
  return r.data !== null && done(r.data) ? { kind: 'allow', detail: 'done' } : { kind: 'refuse', detail: 'nothing done' }
}

/** The verdict for one check: null when the outcome matches the rule, else a message. */
export function verdict(o: Outcome, allowed: boolean): string | null {
  if (allowed) return o.kind === 'allow' ? null : `expected allow, got ${o.kind === 'refuse' ? 'deny' : 'an error'} (${o.detail})`
  if (o.kind === 'refuse') return null
  return o.kind === 'allow' ? `expected deny, got allow (${o.detail})` : `expected deny, got an error that isn't a refusal (${o.detail})`
}
