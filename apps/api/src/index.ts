import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getDb } from './db/client.js'
import { migrate } from './db/migrate.js'
import { getSchema } from './db/schema.js'
import { getRelations } from './db/relations.js'
import { restRouter } from './rest/router.js'
import { authRouter } from './auth/router.js'
import { config } from './config.js'

const app = new Hono()

app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-api-key', 'Prefer', 'Range', 'Accept', 'X-Client-Info'],
  exposeHeaders: ['Content-Range', 'X-Total-Count'],
  credentials: false,
}))

app.use('*', logger())

app.get('/health', (c) => c.json({ ok: true }))

// mount routers (they include full paths)
app.route('/', restRouter)
app.route('/', authRouter)

const start = async () => {
  await migrate()
  const db = await getDb()
  await getSchema(db)
  await getRelations(db)
  console.log('schema loaded')
  const http = await import('node:http')
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
      else if (v) headers.set(k, v)
    }
    const chunks: Buffer[] = []
    for await (const ch of req) chunks.push(ch as Buffer)
    const body = Buffer.concat(chunks)
    const request = new Request(url.toString(), { method: req.method, headers, body: body.length ? body : undefined })
    const response = await app.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    const buf = Buffer.from(await response.arrayBuffer())
    res.end(buf)
  })
  server.listen(config.port, config.host, () => {
    console.log(`API listening on http://${config.host}:${config.port}`)
  })
}

start().catch((e) => { console.error(e); process.exit(1) })
