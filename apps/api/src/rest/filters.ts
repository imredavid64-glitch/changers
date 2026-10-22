export function applyFilter(qb: any, key: string, value: string) {
  // key like col, op like eq
  const [col, op] = key.split('.')
  if (!col || !op) return
  if (op === 'eq') { qb.where(`${col} = ?`, [value]); return }
  if (op === 'neq') { qb.where(`${col} != ?`, [value]); return }
  if (op === 'gt') { qb.where(`${col} > ?`, [value]); return }
  if (op === 'gte') { qb.where(`${col} >= ?`, [value]); return }
  if (op === 'lt') { qb.where(`${col} < ?`, [value]); return }
  if (op === 'lte') { qb.where(`${col} <= ?`, [value]); return }
  if (op === 'like') { qb.where(`${col} LIKE ?`, [value]); return }
  if (op === 'ilike') { qb.where(`${col} ILIKE ?`, [value]); return }
  if (op === 'is') {
    if (value === 'null') { qb.where(`${col} IS NULL`); return }
    if (value === 'not.null') { qb.where(`${col} IS NOT NULL`); return }
  }
  if (op === 'in') {
    // in.("a","b") or in.(a,b)
    let v = value
    if (v.startsWith('(') && v.endsWith(')')) v = v.slice(1, -1)
    const items = v.split(',').map((x) => x.replace(/^"|"$/g, ''))
    qb.where(`${col} IN (${items.map(() => '?').join(',')})`, items)
    return
  }
  if (op === 'cs') {
    // contains array {a,b}
    let v = value
    if (v.startsWith('{') && v.endsWith('}')) v = v.slice(1, -1)
    const items = v ? v.split(',').map((x) => x.replace(/^"|"$/g, '')) : []
    qb.where(`${col} @> ?::jsonb`, [JSON.stringify(items)])
    return
  }
}
