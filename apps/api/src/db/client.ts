import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import postgres from 'postgres'
import { config } from '../config.js'

export type Role = 'anon' | 'authenticated' | 'service_role'
export type QueryRow = Record<string, unknown>

export interface Db {
  query<T extends QueryRow = QueryRow>(sql: string, params?: unknown[]): Promise<T[]>
  exec(sql: string): Promise<void>
  tx<T>(fn: (q: Db) => Promise<T>): Promise<T>
  end(): Promise<void>
}

class PgliteDb implements Db {
  private client: PGlite
  private mutex: Promise<void> = Promise.resolve()

  constructor(client: PGlite) {
    this.client = client
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.mutex
    let release!: () => void
    this.mutex = new Promise((r) => (release = r))
    await prev
    try {
      return await fn()
    } finally {
      release()
    }
  }

  async query<T extends QueryRow = QueryRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.withLock(async () => {
      const res = await this.client.query(sql, params as any[])
      return (res.rows as T[]) ?? []
    })
  }

  async exec(sql: string): Promise<void> {
    await this.withLock(async () => {
      await (this.client as any).exec(sql)
    })
  }

  async tx<T>(fn: (q: Db) => Promise<T>): Promise<T> {
    return this.withLock(async () => {
      await this.client.query('BEGIN')
      try {
        const txDb: Db = {
          query: async <U extends QueryRow = QueryRow>(sql2: string, params2: unknown[] = []) => {
            const res = await this.client.query(sql2, params2 as any[])
            return (res.rows as U[]) ?? []
          },
          exec: async (sql2: string) => { await this.client.exec(sql2) },
          tx: (fn2) => fn2(txDb),
          end: async () => {},
        }
        const out = await fn(txDb)
        await this.client.query('COMMIT')
        return out
      } catch (e) {
        await this.client.query('ROLLBACK').catch(() => {})
        throw e
      }
    })
  }

  async end() {
    await this.client.close()
  }
}

class PostgresDb implements Db {
  private sql: ReturnType<typeof postgres>

  constructor(url: string) {
    this.sql = postgres(url)
  }

  async query<T extends QueryRow = QueryRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const rows = await this.sql.unsafe(sql, params as any[])
    return rows as unknown as T[]
  }

  async exec(sql: string): Promise<void> {
    await this.sql.unsafe(sql)
  }

  async tx<T>(fn: (q: Db) => Promise<T>): Promise<T> {
    return this.sql.begin(async (tx: any) => {
      const txDb: Db = {
        query: async <U extends QueryRow = QueryRow>(sql2: string, params2: unknown[] = []) => {
          const rows = await tx.unsafe(sql2, params2 as any[])
          return rows as unknown as U[]
        },
        exec: async (sql2: string) => { await tx.unsafe(sql2) },
        tx: (fn2) => fn2(txDb),
        end: async () => {},
      }
      return fn(txDb)
    }) as Promise<T>
  }

  async end() {
    await this.sql.end({ timeout: 1 })
  }
}

let _db: Db | null = null

export async function getDb(): Promise<Db> {
  if (_db) return _db
  if (config.databaseUrl) {
    _db = new PostgresDb(config.databaseUrl)
    return _db
  }
  if (config.pgliteDir) {
    try {
      mkdirSync(config.pgliteDir, { recursive: true })
    } catch {}
  }
  const client = new PGlite(config.pgliteDir || undefined, {
    extensions: { pgcrypto, pg_trgm },
  } as any)
  _db = new PgliteDb(client)
  return _db
}

export async function withRls<T>(db: Db, role: Role, jwtClaims: Record<string, unknown> | null, fn: (q: Db) => Promise<T>): Promise<T> {
  return db.tx(async (q) => {
    await q.query(`SET LOCAL ROLE ${role}`)
    const claims = jwtClaims ? JSON.stringify(jwtClaims) : ''
    // set_config with third arg true sets locally
    await q.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims])
    return fn(q)
  })
}
