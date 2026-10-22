import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// apps/api/src -> apps/api
export const packageRoot = path.resolve(here, '..')

const env = process.env

/** Where the SQL lives: the API's own copy, or the web package's (the source of truth). */
export function migrationsDir(): string {
  const candidates = [
    env.DB_MIGRATIONS_DIR,
    path.join(packageRoot, 'db', 'migrations'),
    path.join(packageRoot, '..', 'web', 'supabase', 'migrations'),
  ].filter(Boolean) as string[]
  for (const dir of candidates) if (existsSafe(dir)) return path.resolve(dir)
  return path.resolve(candidates[1]!)
}

export function stubFile(): string {
  const candidates = [
    env.DB_STUB_FILE,
    path.join(packageRoot, 'db', 'stub.sql'),
    path.join(packageRoot, '..', 'web', 'supabase', 'tests', 'local', 'stub.sql'),
  ].filter(Boolean) as string[]
  for (const file of candidates) if (existsSafe(file)) return path.resolve(file)
  return path.resolve(candidates[1]!)
}

function existsSafe(p: string): boolean {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

export const config = {
  /** The API's own port. The web app talks to it over http://127.0.0.1:<port>. */
  port: Number(env.PORT ?? 8788),
  host: env.HOST ?? '127.0.0.1',

  /**
   * A real Postgres connection string (production). When it is empty the API runs on PGlite — the same Postgres
   * compiled to WebAssembly — so the whole stack works on a machine with no Docker and no server.
   */
  databaseUrl: env.DATABASE_URL ?? '',
  /** Where PGlite keeps its files. Empty means memory (nothing is kept between restarts). */
  pgliteDir: env.PGLITE_DIR ?? path.join(packageRoot, '.data', 'pglite'),

  /** The signing secret for the session tokens (HS256). */
  jwtSecret: env.JWT_SECRET ?? 'changemakers-dev-secret-do-not-use-in-production',
  /** The publishable key the browser and the server send. It decides nothing: the session does. */
  anonKey: env.API_ANON_KEY ?? 'sb_publishable_changemakers_dev',
  /** The secret key: the upload, contact and report routes, the tests and dev:code. It bypasses the access rules. */
  serviceKey: env.API_SERVICE_KEY ?? 'sb_secret_changemakers_dev',

  /** How long a session lasts, and how long a sign-in code is good for. */
  sessionTtlSeconds: Number(env.SESSION_TTL ?? 60 * 60),
  refreshTtlSeconds: Number(env.REFRESH_TTL ?? 60 * 60 * 24 * 30),
  codeTtlSeconds: Number(env.CODE_TTL ?? 10 * 60),

  /** Development conveniences: the sign-in code is written to the log and to the outbox table. */
  devMode: env.NODE_ENV !== 'production',
  /** Set to false to stop handing the sign-in code out over HTTP (it is always written to the log). */
  exposeCodes: env.EXPOSE_CODES !== 'false',

  /** The public address of the web app (used in invite links). */
  appBaseUrl: env.APP_BASE_URL ?? 'http://127.0.0.1:4400',

  /** Max rows a single read may return (07 §9: no request returns more than 50 rows). */
  maxRows: Number(env.MAX_ROWS ?? 500),
} as const

export type Config = typeof config
