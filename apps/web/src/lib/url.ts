export type Params = Record<string, string | undefined>

/** Builds a same-page URL from the current query plus a patch; empty values are dropped. */
export function withParams(base: string, current: Params, patch: Params) {
  const next = { ...current, ...patch }
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v)
  const s = qs.toString()
  return s ? `${base}?${s}` : base
}

export function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}
