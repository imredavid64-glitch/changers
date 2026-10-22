import { getDb, type Db } from './client.js'

export type Column = { name: string; type: string; nullable: boolean; isEnum: boolean }
export type TableInfo = { name: string; columns: Column[]; pk: string[] }

let cache: Map<string, TableInfo> | null = null

export async function getSchema(db?: Db): Promise<Map<string, TableInfo>> {
  if (cache) return cache
  const q = db ?? (await getDb())
  const tables = await q.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type IN ('BASE TABLE', 'VIEW')
  `)
  const map = new Map<string, TableInfo>()
  for (const t of tables) {
    const cols = await q.query<{ column_name: string; data_type: string; is_nullable: string }>(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t.table_name])
    const pkRows = await q.query<{ column_name: string }>(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1
      ORDER BY kcu.ordinal_position
    `, [t.table_name])
    map.set(t.table_name, {
      name: t.table_name,
      columns: cols.map((c) => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable === 'YES', isEnum: false })),
      pk: pkRows.map((r) => r.column_name),
    })
  }
  cache = map
  return map
}

export function getTable(map: Map<string, TableInfo>, name: string) {
  return map.get(name) ?? null
}
