import { getDb } from './client.js'

export type Relation = {
  fromTable: string
  fromCol: string
  toTable: string
  toCol: string
  // 'many' means fromTable has many toTable? We store FK direction: child table has FK to parent.
  kind: 'toOne' | 'toMany'
}

let cache: Relation[] | null = null

export async function getRelations(db?: any): Promise<Relation[]> {
  if (cache) return cache
  const q = db ?? (await getDb())
  const rows = await q.query(`
    SELECT
      tc.table_name AS child_table,
      kcu.column_name AS child_col,
      ccu.table_name AS parent_table,
      ccu.column_name AS parent_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `)
  const rels: Relation[] = []
  for (const r of rows) {
    // child has FK to parent: parent to-one (parent row has one? actually many children per parent)
    // Relation from parent to child = toMany; from child to parent = toOne
    rels.push({ fromTable: r.parent_table, fromCol: r.parent_col, toTable: r.child_table, toCol: r.child_col, kind: 'toMany' })
    rels.push({ fromTable: r.child_table, fromCol: r.child_col, toTable: r.parent_table, toCol: r.parent_col, kind: 'toOne' })
  }
  cache = rels
  return rels
}

export function findRelation(rels: Relation[], from: string, to: string): Relation | null {
  return rels.find((r) => r.fromTable === from && r.toTable === to) ?? null
}

export function toOne(rels: Relation[], from: string, to: string): boolean {
  const r = findRelation(rels, from, to)
  return !!r && r.kind === 'toOne'
}
