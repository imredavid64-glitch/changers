import { Hono } from 'hono'
import { getDb, withRls, type Role } from '../db/client.js'
import { buildSelectSql } from './builder.js'
import { mapError } from './errors.js'
import { getSchema } from '../db/schema.js'
import { getRelations } from '../db/relations.js'

function roleFromReq(req: Request, apiKey: string | undefined, jwt: any): Role {
  // service key bypass
  if (apiKey && (apiKey === process.env.API_SERVICE_KEY || apiKey === 'sb_secret_changemakers_dev')) return 'service_role'
  // jwt role claim
  if (jwt && (jwt.role === 'service_role' || jwt.role === 'authenticated')) {
    return jwt.role as Role
  }
  if (jwt && jwt.sub) return 'authenticated'
  return 'anon'
}

async function parseJwt(token: string | null): Promise<any> {
  if (!token) return null
  const { jwtVerify } = await import('jose')
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'changemakers-dev-secret-do-not-use-in-production')
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return payload
  } catch {
    return null
  }
}

function isServiceKey(key: string | null | undefined): boolean {
  const sk = process.env.API_SERVICE_KEY ?? 'sb_secret_changemakers_dev'
  return !!key && key === sk
}

export const restRouter = new Hono()

// Generic table read
restRouter.get('/rest/v1/:table', async (c) => {
  const db = await getDb()
  const table = c.req.param('table')
  const schema = await getSchema(db)
  if (!schema.has(table)) {
    // maybe a view
  }
  const url = new URL(c.req.url)
  const params = url.searchParams

  const apiKey = c.req.header('apikey') || c.req.header('x-api-key') || undefined
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '') || null
  // if apikey is service key, treat as service
  let jwt: any = null
  if (token && token !== apiKey) jwt = await parseJwt(token)
  if (isServiceKey(apiKey) || isServiceKey(token)) {
    // service role: no jwt needed
    jwt = { role: 'service_role' }
  }

  const role: Role = (jwt && jwt.role === 'service_role') || isServiceKey(apiKey) || isServiceKey(token)
    ? 'service_role'
    : (jwt && jwt.sub ? 'authenticated' : 'anon')

  const jwtClaims = (role === 'service_role') ? { role: 'service_role' } : (jwt ? { ...jwt, role: 'authenticated' } : { role: 'anon' })

  // build filters
  const filters: Record<string, string> = {}
  let select = params.get('select') || '*'
  let order = params.get('order') || undefined
  let limit = params.get('limit') ? Number(params.get('limit')) : undefined
  let offset = params.get('offset') ? Number(params.get('offset')) : undefined
  const extra: Record<string, string> = {}
  for (const [k, v] of params.entries()) {
    if (k === 'select' || k === 'order' || k === 'limit' || k === 'offset') continue
    // referenced table params
    if (k.includes('.')) {
      const parts = k.split('.')
      // if second part is a known modifier
      if (['order', 'limit', 'offset'].includes(parts[parts.length - 1])) {
        extra[k] = v
        continue
      }
    }
    filters[k] = v
  }

  // Range header
  const rangeHeader = c.req.header('range')
  let range: { from: number; to: number } | undefined
  if (rangeHeader) {
    const m = rangeHeader.match(/items=(\d+)-(\d+)/)
    if (m) range = { from: Number(m[1]), to: Number(m[2]) }
  }

  // Prefer count
  const prefer = c.req.header('prefer') || ''
  const countExact = prefer.includes('count=exact')

  try {
    const { sql, params: sqlParams } = await buildSelectSql({
      db, table, select, filters, order, limit, offset, extra, range,
    })

    const rows = await withRls(db, role, jwtClaims, async (q) => {
      return q.query(sql, sqlParams)
    })

    // count
    let count: number | null = null
    if (countExact) {
      // simple count without limit
      const { sql: csql, params: cparams } = await buildSelectSql({
        db, table, select: 'id', filters, order: undefined, limit: undefined, offset: undefined, extra, range: undefined,
      })
      const cntSql = `SELECT count(*)::int AS c FROM (${csql.replace(/SELECT .* FROM/, 'SELECT 1 FROM')}) x`
      // fallback: just count rows
      try {
        const r = await withRls(db, role, jwtClaims, async (q) => q.query(`SELECT count(*)::int AS c FROM ${table} t WHERE 1=1`, []))
        count = (r as any)[0]?.c ?? rows.length
      } catch { count = rows.length }
    }

    const accept = c.req.header('accept') || ''
    const single = accept.includes('vnd.pgrst.object+json')

    if (single) {
      if (rows.length === 0) {
        return c.json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: '', hint: '' }, 406)
      }
      if (rows.length > 1) {
        return c.json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: '', hint: '' }, 406)
      }
      return c.json(rows[0])
    }

    // Content-Range header for pagination
    if (range) {
      const total = count ?? rows.length
      c.header('Content-Range', `items ${range.from}-${range.from + rows.length - 1}/${total}`)
    }
    return c.json(rows)
  } catch (e: any) {
    const { status, body } = mapError(e)
    // try to extract pg error code
    if (e.code && !body.code) body.code = e.code
    if (e.code) body.code = e.code
    return c.json(body, status as any)
  }
})

// RPC
restRouter.post('/rest/v1/rpc/:fn', async (c) => {
  const db = await getDb()
  const fn = c.req.param('fn')
  const body = await c.req.json().catch(() => ({}))
  const apiKey = c.req.header('apikey') || undefined
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '') || null
  let jwt: any = null
  if (token && token !== apiKey) jwt = await parseJwt(token)
  if (isServiceKey(apiKey) || isServiceKey(token)) jwt = { role: 'service_role' }
  const role: Role = (jwt && jwt.role === 'service_role') || isServiceKey(apiKey) || isServiceKey(token)
    ? 'service_role' : (jwt && jwt.sub ? 'authenticated' : 'anon')
  const jwtClaims = (role === 'service_role') ? { role: 'service_role' } : (jwt ? { ...jwt, role: 'authenticated' } : { role: 'anon' })

  try {
    // build call: select * from fn(args)
    const args = body || {}
    const keys = Object.keys(args)
    const placeholders = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
    const vals = keys.map((k) => args[k])
    const sql = keys.length ? `SELECT * FROM ${fn}(${placeholders})` : `SELECT * FROM ${fn}()`
    // For scalar returns, SELECT * returns a column; supabase-js expects the value? 
    const rows = await withRls(db, role, jwtClaims, async (q) => q.query(sql, vals))
    // Detect scalar: if rows have a single column, return array of that column? Supabase returns array of objects for table funcs.
    // For functions returning scalar, PostgREST returns the scalar directly. We'll heuristic: if fn in known scalars.
    if (rows.length === 0) return c.json(null)
    const rowKeys = Object.keys(rows[0] || {})
    if (rowKeys.length === 1 && (fn === 'rotate_join_code' || fn === 'export_my_data' || fn === 'decline_under_13')) {
      return c.json((rows[0] as any)[rowKeys[0]])
    }
    if (fn === 'complete_signup' || fn === 'decline_signup' || fn === 'delete_my_account' || fn === 'rsvp' || fn === 'approve_member' || fn === 'approve_content' || fn === 'send_back' || fn === 'hide_content' || fn === 'handle_report' || fn === 'verify_advisor' || fn === 'verify_club' || fn === 'suspend_club' || fn === 'remove_member' || fn === 'set_member_role' || fn === 'set_project_visibility' || fn === 'revoke_consent' || fn === 'revoke_invite' || fn === 'leave_club' || fn === 'request_advisor_verification' || fn === 'record_consent' || fn === 'join_with_code' || fn === 'file_report') {
      return c.json(null)
    }
    return c.json(rows)
  } catch (e: any) {
    const { status, body } = mapError(e)
    if (e.code) body.code = e.code
    return c.json(body, status as any)
  }
})

// Insert
restRouter.post('/rest/v1/:table', async (c) => {
  const db = await getDb()
  const table = c.req.param('table')
  const body = await c.req.json().catch(() => ({}))
  const apiKey = c.req.header('apikey') || undefined
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '') || null
  let jwt: any = null
  if (token && token !== apiKey) jwt = await parseJwt(token)
  if (isServiceKey(apiKey) || isServiceKey(token)) jwt = { role: 'service_role' }
  const role: Role = (jwt && jwt.role === 'service_role') || isServiceKey(apiKey) || isServiceKey(token)
    ? 'service_role' : (jwt && jwt.sub ? 'authenticated' : 'anon')
  const jwtClaims = (role === 'service_role') ? { role: 'service_role' } : (jwt ? { ...jwt, role: 'authenticated' } : { role: 'anon' })

  const prefer = c.req.header('prefer') || ''
  const returnRep = prefer.includes('return=representation')

  try {
    const rows = Array.isArray(body) ? body : [body]
    const inserted: any[] = []
    await withRls(db, role, jwtClaims, async (q) => {
      for (const r of rows) {
        const cols = Object.keys(r)
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
        const colNames = cols.map((c) => `"${c}"`).join(', ')
        const vals = cols.map((c) => r[c])
        const sql = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ${returnRep ? 'RETURNING *' : ''}`
        const res = await q.query(sql, vals)
        if (returnRep) inserted.push(...res)
      }
      return null
    })
    if (returnRep) return c.json(inserted.length === 1 && !Array.isArray(body) ? inserted[0] : inserted)
    return c.json(null, 201)
  } catch (e: any) {
    const { status, body: b } = mapError(e)
    if (e.code) b.code = e.code
    return c.json(b, status as any)
  }
})

// Update
restRouter.patch('/rest/v1/:table', async (c) => {
  const db = await getDb()
  const table = c.req.param('table')
  const body = await c.req.json().catch(() => ({}))
  const url = new URL(c.req.url)
  const params = url.searchParams
  const apiKey = c.req.header('apikey') || undefined
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '') || null
  let jwt: any = null
  if (token && token !== apiKey) jwt = await parseJwt(token)
  if (isServiceKey(apiKey) || isServiceKey(token)) jwt = { role: 'service_role' }
  const role: Role = (jwt && jwt.role === 'service_role') || isServiceKey(apiKey) || isServiceKey(token)
    ? 'service_role' : (jwt && jwt.sub ? 'authenticated' : 'anon')
  const jwtClaims = (role === 'service_role') ? { role: 'service_role' } : (jwt ? { ...jwt, role: 'authenticated' } : { role: 'anon' })

  const prefer = c.req.header('prefer') || ''
  const returnRep = prefer.includes('return=representation')

  // filters from query
  const filters: Record<string, string> = {}
  for (const [k, v] of params.entries()) {
    if (k === 'select') continue
    filters[k] = v
  }

  try {
    const cols = Object.keys(body)
    // build where from filters (simple)
    const whereParts: string[] = []
    const vals: any[] = []
    // We'll do a simpler approach: build update set
    const setClause = cols.map((col, i) => `"${col}" = $${i + 1}`).join(', ')
    vals.push(...cols.map((col) => body[col]))
    // filters -> where
    let idx = vals.length
    const whereClauses: string[] = []
    for (const [k, v] of Object.entries(filters)) {
      const bits = k.split('.')
      const col = bits[0]
      // parse op from value (PostgREST: col=op.value)
      let op = bits[1] || 'eq'
      let val = v
      const m = v.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs)\.(.*)$/s)
      if (m && !bits[1]) { op = m[1]; val = m[2] }
      if (op === 'eq') { vals.push(val); whereClauses.push(`"${col}" = $${vals.length}`) }
      else if (op === 'in') {
        let x = val
        if (x.startsWith('(') && x.endsWith(')')) x = x.slice(1, -1)
        const items = x.split(',').map((s) => s.replace(/^"|"$/g, ''))
        const ph = items.map((it) => { vals.push(it); return `$${vals.length}` }).join(',')
        whereClauses.push(`"${col}" IN (${ph})`)
      }
    }
    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''
    const sql = `UPDATE "${table}" SET ${setClause} ${whereSql} ${returnRep ? 'RETURNING *' : ''}`
    const res = await withRls(db, role, jwtClaims, async (q) => q.query(sql, vals))
    if (returnRep) return c.json(res)
    return c.json(null)
  } catch (e: any) {
    const { status, body: b } = mapError(e)
    if (e.code) b.code = e.code
    return c.json(b, status as any)
  }
})

// Delete
restRouter.delete('/rest/v1/:table', async (c) => {
  const db = await getDb()
  const table = c.req.param('table')
  const url = new URL(c.req.url)
  const params = url.searchParams
  const apiKey = c.req.header('apikey') || undefined
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '') || null
  let jwt: any = null
  if (token && token !== apiKey) jwt = await parseJwt(token)
  if (isServiceKey(apiKey) || isServiceKey(token)) jwt = { role: 'service_role' }
  const role: Role = (jwt && jwt.role === 'service_role') || isServiceKey(apiKey) || isServiceKey(token)
    ? 'service_role' : (jwt && jwt.sub ? 'authenticated' : 'anon')
  const jwtClaims = (role === 'service_role') ? { role: 'service_role' } : (jwt ? { ...jwt, role: 'authenticated' } : { role: 'anon' })

  const filters: Record<string, string> = {}
  for (const [k, v] of params.entries()) filters[k] = v

  try {
    const vals: any[] = []
    const whereClauses: string[] = []
    for (const [k, v] of Object.entries(filters)) {
      const bits = k.split('.')
      const col = bits[0]
      let op = bits[1] || 'eq'
      let val = v
      const m = v.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs)\.(.*)$/s)
      if (m && !bits[1]) { op = m[1]; val = m[2] }
      if (op === 'eq') { vals.push(val); whereClauses.push(`"${col}" = $${vals.length}`) }
      else if (op === 'in') {
        let x = val
        if (x.startsWith('(') && x.endsWith(')')) x = x.slice(1, -1)
        const items = x.split(',').map((s) => s.replace(/^"|"$/g, ''))
        const ph = items.map((it) => { vals.push(it); return `$${vals.length}` }).join(',')
        whereClauses.push(`"${col}" IN (${ph})`)
      }
    }
    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''
    const sql = `DELETE FROM "${table}" ${whereSql}`
    await withRls(db, role, jwtClaims, async (q) => q.query(sql, vals))
    return c.body(null, 204)
  } catch (e: any) {
    const { status, body: b } = mapError(e)
    if (e.code) b.code = e.code
    return c.json(b, status as any)
  }
})
