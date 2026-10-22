import { getSchema } from '../db/schema.js'
import { getRelations, findRelation } from '../db/relations.js'
import { parseSelectSpec } from './select.js'
import { quoteIdent } from '../util/sql.js'

type Filter = { col: string; op: string; value: string }
type OrderItem = { col: string; asc: boolean; nullsLast?: boolean; table?: string }

function parseOrder(s?: string): OrderItem[] {
  if (!s) return []
  return s.split(',').map((part) => {
    const bits = part.trim().split('.')
    let asc = true
    let nullsLast: boolean | undefined
    let col = bits[0]
    let table: string | undefined
    if (bits.length === 2) {
      asc = bits[1].toLowerCase().startsWith('asc')
      if (bits[1].toLowerCase().includes('nullslast')) nullsLast = true
      if (bits[1].toLowerCase().includes('nullsfirst')) nullsLast = false
    } else if (bits.length === 3) {
      table = bits[0]
      col = bits[1]
      asc = bits[2].toLowerCase().startsWith('asc')
      if (bits[2].toLowerCase().includes('nullslast')) nullsLast = true
      if (bits[2].toLowerCase().includes('nullsfirst')) nullsLast = false
    }
    return { col, asc, nullsLast, table }
  })
}

function pushParam(params: any[], v: any): string {
  params.push(v)
  return `$${params.length}`
}

function simpleFilterSql(tableAlias: string, f: Filter, params: any[]): string {
  const col = `${quoteIdent(tableAlias)}.${quoteIdent(f.col)}`
  const neg = f.op.startsWith('not.')
  const base = neg ? f.op.slice(4) : f.op
  let cond = 'TRUE'
  if (base === 'eq') cond = `${col} = ${pushParam(params, f.value)}`
  else if (base === 'neq') cond = `${col} <> ${pushParam(params, f.value)}`
  else if (base === 'gt') cond = `${col} > ${pushParam(params, f.value)}`
  else if (base === 'gte') cond = `${col} >= ${pushParam(params, f.value)}`
  else if (base === 'lt') cond = `${col} < ${pushParam(params, f.value)}`
  else if (base === 'lte') cond = `${col} <= ${pushParam(params, f.value)}`
  else if (base === 'like') cond = `${col} LIKE ${pushParam(params, f.value)}`
  else if (base === 'ilike') cond = `${col} ILIKE ${pushParam(params, f.value)}`
  else if (base === 'is') {
    if (f.value === 'null') cond = `${col} IS NULL`
    else if (f.value === 'not.null') cond = `${col} IS NOT NULL`
  } else if (base === 'in') {
    let v = f.value
    if (v.startsWith('(') && v.endsWith(')')) v = v.slice(1, -1)
    const items = v.split(',').map((x) => x.replace(/^"|"$/g, ''))
    const ph = items.map((it) => pushParam(params, it)).join(',')
    cond = `${col} IN (${ph})`
  } else if (base === 'cs') {
    let v = f.value
    if (v.startsWith('{') && v.endsWith('}')) v = v.slice(1, -1)
    const items = v ? v.split(',').map((x) => x.replace(/^"|"$/g, '')) : []
    const cast = f.col === 'strands' ? 'strand[]' : 'text[]'
    const arr = `{${items.join(',')}}`
    cond = `${col} @> ${pushParam(params, arr)}::${cast}`
  }
  if (neg) return `NOT (${cond})`
  return cond
}

export async function buildSelectSql(opts: {
  db: any
  table: string
  select: string
  filters: Record<string, string>
  order?: string
  limit?: number
  offset?: number
  extra: Record<string, string>
  range?: { from?: number; to?: number }
}): Promise<{ sql: string; params: any[] }> {
  const params: any[] = []
  const schema = await getSchema(opts.db)
  const rels = await getRelations(opts.db)
  const tableInfo = schema.get(opts.table)
  if (!tableInfo) throw new Error(`unknown table ${opts.table}`)

  const spec = parseSelectSpec(opts.select || '*')

  // referenced table params
  const refParams: Record<string, Record<string, string>> = {}
  for (const [k, v] of Object.entries(opts.extra)) {
    const m = k.match(/^(\w+)\.(.+)$/)
    if (m) {
      refParams[m[1]] = refParams[m[1]] || {}
      refParams[m[1]][m[2]] = v
    }
  }

  const embedNames = new Set(spec.embeds.map((e) => e.table))

  // parse top-level filters
  const topFilters: Filter[] = []
  const embedFilters: Record<string, Filter[]> = {}
  let orConditions: { col: string; op: string; value: string }[] = []
  function parseOpValue(v: string): { op: string; value: string } {
    const ops = ['eq','neq','gt','gte','lt','lte','like','ilike','is','in','cs']
    let neg = ''
    let rest = v
    if (rest.startsWith('not.')) { neg = 'not.'; rest = rest.slice(4) }
    for (const o of ops) {
      if (rest.startsWith(o + '.')) {
        return { op: neg + o, value: rest.slice(o.length + 1) }
      }
    }
    // handle 'is.null' etc already covered
    return { op: neg ? neg.slice(0,-1) : 'eq', value: rest }
  }
  for (const [k, v] of Object.entries(opts.filters || {})) {
    if (k === 'or') {
      const inner = v.startsWith('(') && v.endsWith(')') ? v.slice(1, -1) : v
      const conds: string[] = []
      let depth = 0
      let cur = ''
      for (const ch of inner) {
        if (ch === '(') { depth++; cur += ch }
        else if (ch === ')') { depth--; cur += ch }
        else if (ch === ',' && depth === 0) { conds.push(cur); cur = '' }
        else cur += ch
      }
      if (cur) conds.push(cur)
      for (const c of conds) {
        const m = c.match(/^(\w+)\.(\w+)\.(.*)$/)
        if (m) orConditions.push({ col: m[1], op: m[2], value: m[3] })
      }
      continue
    }
    const { op, value } = parseOpValue(v)
    const bits = k.split('.')
    if (bits.length >= 3 && embedNames.has(bits[0])) {
      const embedName = bits[0]
      const col = bits[1]
      embedFilters[embedName] = embedFilters[embedName] || []
      embedFilters[embedName].push({ col, op, value })
    } else if (bits.length === 2 && embedNames.has(bits[0])) {
      const embedName = bits[0]
      embedFilters[embedName] = embedFilters[embedName] || []
      embedFilters[embedName].push({ col: bits[1], op, value })
    } else if (bits.length === 2) {
      topFilters.push({ col: bits[0], op, value })
    } else if (bits.length === 1) {
      topFilters.push({ col: bits[0], op, value })
    }
  }

  const topOrder = parseOrder(opts.order)

  // build embed expr
  async function buildEmbedExpr(embed: any): Promise<string> {
    const rel = findRelation(rels, opts.table, embed.table)
    const parentCol = rel ? rel.fromCol : ((tableInfo as any).pk[0] || 'id')
    const childFk = rel ? rel.toCol : null
    const childSchema = schema.get(embed.table)
    if (!childSchema) return 'null'

    const rawInner = (embed as any)._raw || embed.columns.join(',')
    const innerSpec = parseSelectSpec(rawInner === '*' ? '*' : rawInner)

    let childCols = innerSpec.columns
    if (childCols.length === 1 && childCols[0] === '*') {
      childCols = childSchema.columns.map((c) => c.name)
    }
    const nestedEmbeds = innerSpec.embeds

    const pairs: string[] = []
    for (const c of childCols) {
      pairs.push(`'${c}', c.${quoteIdent(c)}`)
    }
    for (const ne of nestedEmbeds) {
      const nrel = findRelation(rels, embed.table, ne.table)
      const nparentCol = nrel ? nrel.fromCol : (childSchema.pk[0] || 'id')
      const nchildFk = nrel ? nrel.toCol : null
      const nchildSchema = schema.get(ne.table)
      if (!nchildSchema) { pairs.push(`'${ne.table}', null`); continue }
      let nCols = ne.columns
      if (nCols.length === 1 && nCols[0] === '*') nCols = nchildSchema.columns.map((c) => c.name)
      const nPairs = nCols.map((c) => `'${c}', n.${quoteIdent(c)}`).join(', ')
      const isToMany = nrel ? nrel.kind === 'toMany' : true
      if (nchildFk) {
        if (isToMany) {
          const sub = `(SELECT COALESCE(json_agg(json_build_object(${nPairs})),'[]'::json) FROM ${quoteIdent(ne.table)} n WHERE n.${quoteIdent(nchildFk)} = c.${quoteIdent(nparentCol)})`
          pairs.push(`'${ne.table}', ${sub}`)
        } else {
          const sub = `(SELECT json_build_object(${nPairs}) FROM ${quoteIdent(ne.table)} n WHERE n.${quoteIdent(nchildFk)} = c.${quoteIdent(nparentCol)} LIMIT 1)`
          pairs.push(`'${ne.table}', ${sub}`)
        }
      } else {
        pairs.push(`'${ne.table}', null`)
      }
    }

    const jsonObj = `json_build_object(${pairs.join(', ')})`
    const ef = embedFilters[embed.table] || []
    const ref = refParams[embed.table] || {}
    const embedOrder = parseOrder(ref.order)
    const limitStr = ref.limit

    const isToMany = rel ? rel.kind === 'toMany' : true

    if (isToMany) {
      const whereParts = [`c.${quoteIdent(childFk!)} = t.${quoteIdent(parentCol)}`]
      for (const f of ef) whereParts.push(simpleFilterSql('c', f, params))
      const whereSql = whereParts.join(' AND ')
      let orderBy = ''
      if (embedOrder.length) orderBy = 'ORDER BY ' + embedOrder.map((o) => `c.${quoteIdent(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ')
      let limitClause = ''
      if (limitStr) limitClause = `LIMIT ${Number(limitStr)}`
      const agg = `(SELECT COALESCE(json_agg(z.j),'[]'::json) FROM (SELECT ${jsonObj} AS j FROM ${quoteIdent(embed.table)} c WHERE ${whereSql} ${orderBy} ${limitClause}) z)`
      return agg
    } else {
      const whereParts = [`c.${quoteIdent(childFk!)} = t.${quoteIdent(parentCol)}`]
      for (const f of ef) whereParts.push(simpleFilterSql('c', f, params))
      const whereSql = whereParts.join(' AND ')
      const sub = `(SELECT ${jsonObj} FROM ${quoteIdent(embed.table)} c WHERE ${whereSql} LIMIT 1)`
      return sub
    }
  }

  // top-level columns
  const pk = tableInfo.pk[0] || 'id'
  let selectCols: string[] = spec.columns
  if (selectCols.length === 1 && selectCols[0] === '*') {
    selectCols = tableInfo.columns.map((c) => c.name)
  }

  const colExprs: string[] = []
  for (const c of selectCols) {
    colExprs.push(`t.${quoteIdent(c)}`)
  }
  for (const embed of spec.embeds) {
    const expr = await buildEmbedExpr(embed)
    const alias = embed.alias || embed.table
    colExprs.push(`${expr} AS ${quoteIdent(alias)}`)
  }
  const selectClause = colExprs.length ? colExprs.join(', ') : '*'

  // WHERE
  const whereClauses: string[] = []
  for (const f of topFilters) {
    whereClauses.push(simpleFilterSql('t', f, params))
  }
  if (orConditions.length) {
    const orParts: string[] = []
    for (const c of orConditions) {
      const col = `t.${quoteIdent(c.col)}`
      if (c.op === 'eq') orParts.push(`${col} = ${pushParam(params, c.value)}`)
      else if (c.op === 'ilike') orParts.push(`${col} ILIKE ${pushParam(params, c.value)}`)
      else if (c.op === 'gt') orParts.push(`${col} > ${pushParam(params, c.value)}`)
      else if (c.op === 'lt') orParts.push(`${col} < ${pushParam(params, c.value)}`)
      else if (c.op === 'gte') orParts.push(`${col} >= ${pushParam(params, c.value)}`)
      else if (c.op === 'lte') orParts.push(`${col} <= ${pushParam(params, c.value)}`)
      else if (c.op === 'neq') orParts.push(`${col} <> ${pushParam(params, c.value)}`)
      else if (c.op === 'in') {
        let v = c.value
        if (v.startsWith('(') && v.endsWith(')')) v = v.slice(1, -1)
        const items = v.split(',').map((x) => x.replace(/^"|"$/g, ''))
        const ph = items.map((it) => pushParam(params, it)).join(',')
        orParts.push(`${col} IN (${ph})`)
      }
    }
    if (orParts.length) whereClauses.push(`(${orParts.join(' OR ')})`)
  }
  // inner embeds exists
  for (const embed of spec.embeds) {
    if (!embed.inner) continue
    const rel = findRelation(rels, opts.table, embed.table)
    const parentCol = rel ? rel.fromCol : pk
    const childFk = rel ? rel.toCol : null
    const ef = embedFilters[embed.table] || []
    const eWhere: string[] = [`c.${quoteIdent(childFk!)} = t.${quoteIdent(parentCol)}`]
    for (const f of ef) eWhere.push(simpleFilterSql('c', f, params))
    whereClauses.push(`EXISTS (SELECT 1 FROM ${quoteIdent(embed.table)} c WHERE ${eWhere.join(' AND ')})`)
  }

  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''

  // ORDER BY
  let orderSql = ''
  if (topOrder.length) {
    const items = topOrder.filter((o) => !o.table)
    if (items.length) {
      orderSql = 'ORDER BY ' + items.map((o) => `t.${quoteIdent(o.col)} ${o.asc ? 'ASC' : 'DESC'}${o.nullsLast === true ? ' NULLS LAST' : o.nullsLast === false ? ' NULLS FIRST' : ''}`).join(', ')
    }
  }

  // LIMIT/OFFSET
  let limitSql = ''
  if (opts.limit != null) limitSql += ` LIMIT ${Number(opts.limit)}`
  if (opts.offset != null) limitSql += ` OFFSET ${Number(opts.offset)}`
  if (opts.range) {
    const from = opts.range.from ?? 0
    const to = opts.range.to ?? from
    limitSql = ` LIMIT ${to - from + 1} OFFSET ${from}`
  }

  const sql = `SELECT ${selectClause} FROM ${quoteIdent(opts.table)} t ${whereSql} ${orderSql} ${limitSql}`.trim()
  return { sql, params }
}
