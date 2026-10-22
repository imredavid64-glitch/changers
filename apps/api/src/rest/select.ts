import { parseSelect } from '../util/parse.js'
import { getSchema } from '../db/schema.js'
import { getRelations, findRelation } from '../db/relations.js'
import { quoteIdent } from '../util/sql.js'

export type EmbedSpec = {
  table: string // embedded table name
  alias?: string // alias used in output json (defaults to table)
  columns: string[] // column names or nested embeds
  inner: boolean
  filters: { key: string; value: string }[] // filters scoped to this embed
  order?: { col: string; asc: boolean; nullsLast?: boolean }[]
  limit?: number
  offset?: number
}

export type SelectSpec = {
  columns: string[] // simple column names
  embeds: EmbedSpec[]
  raw: string
}

export function parseSelectSpec(select: string): SelectSpec {
  const parts = parseSelect(select || '*')
  const columns: string[] = []
  const embeds: EmbedSpec[] = []
  for (const p of parts) {
    const m = p.match(/^(\w+)(!inner)?\((.*)\)$/)
    if (m) {
      const table = m[1]
      const inner = !!m[2]
      const innerStr = m[3].trim()
      const sub = parseSelectSpec(innerStr === '*' ? '*' : innerStr)
      // flatten simple columns
      const cols = sub.columns.length ? sub.columns : ['*']
      embeds.push({
        table,
        alias: table,
        columns: cols,
        inner,
        filters: [],
        // nested embeds stored separately? We'll handle one level + recursion via columns as strings with parens already parsed? Simpler: store raw inner and re-parse at build time.
        order: undefined,
        limit: undefined,
      })
      // stash raw inner in a side channel by overloading columns with raw tokens (we'll re-parse)
      ;(embeds[embeds.length - 1] as any)._raw = innerStr
    } else {
      // could be col or col->json
      columns.push(p.trim())
    }
  }
  if (columns.length === 0 && embeds.length === 0) columns.push('*')
  return { columns, embeds, raw: select }
}

export async function expandEmbedColumns(spec: SelectSpec) {
  // no-op placeholder; columns already parsed
  return spec
}
