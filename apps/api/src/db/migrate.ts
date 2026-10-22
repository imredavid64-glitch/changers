import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getDb } from './client.js'
import { config, migrationsDir, stubFile } from '../config.js'

function read(p: string) {
  return readFileSync(p, 'utf8')
}

export async function migrate() {
  const db = await getDb()
  const stub = stubFile()
  const migDir = migrationsDir()
  try {
    await db.exec(read(stub))
  } catch (e: any) {
    console.warn('stub apply warn:', e?.message)
  }
  const migrations = [
    '20261011120000_schema.sql',
    '20261011120100_helpers.sql',
    '20261011120200_functions.sql',
    '20261011120300_access.sql',
    '20261011120400_storage.sql',
    '20261012120000_club_features.sql',
  ]
  for (const m of migrations) {
    const p = path.join(migDir, m)
    try {
      const sql = read(p)
      await db.exec(sql)
      console.log('migrated', m)
    } catch (e: any) {
      console.warn('migrate', m, e?.message)
    }
  }
  // auth tables for our GoTrue-compatible layer
  try {
    await db.query(`CREATE SCHEMA IF NOT EXISTS auth`)
    await db.query(`CREATE TABLE IF NOT EXISTS auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, factor_type text not null, friendly_name text, secret text not null, status text not null default 'unverified', created_at timestamptz not null default now())`)
    await db.query(`CREATE TABLE IF NOT EXISTS auth.refresh_tokens (token text primary key, user_id uuid not null, expires_at timestamptz not null)`)
    await db.query(`CREATE TABLE IF NOT EXISTS auth.otp_codes (email text not null, code text not null, expires_at timestamptz not null, user_id uuid)`)
  } catch (e: any) { console.warn('auth tables', e?.message) }

  // ensure roles exist/granted as the stub expects; PGlite roles may need creation
  try {
    await db.query(`DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN null; END $$;`)
    await db.query(`DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN null; END $$;`)
    await db.query(`DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN null; END $$;`)
    await db.query(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`)
    await db.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role`)
    await db.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role`)
  } catch {}
}
