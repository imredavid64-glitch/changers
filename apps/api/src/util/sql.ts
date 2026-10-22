import { getSchema, type TableInfo, type Column } from '../db/schema.js'

export function quoteIdent(s: string): string {
  return '"' + s.replace(/"/g, '""') + '"'
}

export function typeCast(col: Column): string {
  return ''
}

export function jsonBuildObject(cols: { alias?: string; expr: string }[]): string {
  const pairs: string[] = []
  for (const c of cols) {
    pairs.push(`'${c.alias ?? ''}', ${c.expr}`)
  }
  return `json_build_object(${pairs.join(', ')})`
}

export async function columnType(db: any, table: string, col: string): Promise<string> {
  const schema = await getSchema(db)
  const t = schema.get(table)
  const c = t?.columns.find((x) => x.name === col)
  return c?.type ?? 'text'
}
