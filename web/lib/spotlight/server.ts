import { Pool } from "pg";
import { getContactDatabaseUrl } from "@/lib/contact/config";

/**
 * Changer Spotlight data layer (Postgres). Mirrors the contact-messages
 * pattern: a lazy singleton pool + ensure-schema, so pages degrade gracefully
 * when DATABASE_URL is unset.
 */

export interface SpotlightRecord {
  id: string;
  title: string;
  blurb: string;
  profileUrl: string | null;
  projectUrl: string | null;
  strand: string | null;
  active: boolean;
  featuredBy: string;
  createdAt: string;
}

interface SpotlightDbRow {
  id: string;
  title: string;
  blurb: string;
  profile_url: string | null;
  project_url: string | null;
  strand: string | null;
  active: boolean;
  featured_by: string;
  created_at: string | Date;
}

const SPOTLIGHT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS spotlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  blurb TEXT NOT NULL,
  profile_url TEXT,
  project_url TEXT,
  strand TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  featured_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spotlights_active ON spotlights (active, created_at DESC);
`;

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = getContactDatabaseUrl();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to store spotlights.");
    }
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

export function ensureSpotlightSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool().query(SPOTLIGHT_SCHEMA_SQL).then(() => undefined);
  }
  return schemaReady;
}

function toRecord(row: SpotlightDbRow): SpotlightRecord {
  return {
    id: row.id,
    title: row.title,
    blurb: row.blurb,
    profileUrl: row.profile_url,
    projectUrl: row.project_url,
    strand: row.strand,
    active: row.active,
    featuredBy: row.featured_by,
    createdAt: String(row.created_at),
  };
}

export async function listSpotlights(): Promise<SpotlightRecord[]> {
  await ensureSpotlightSchema();
  const result = await getPool().query<SpotlightDbRow>(
    `SELECT * FROM spotlights ORDER BY created_at DESC`,
  );
  return result.rows.map(toRecord);
}

export async function getActiveSpotlight(): Promise<SpotlightRecord | null> {
  await ensureSpotlightSchema();
  const result = await getPool().query<SpotlightDbRow>(
    `SELECT * FROM spotlights WHERE active = true ORDER BY created_at DESC LIMIT 1`,
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export interface SpotlightInput {
  id?: string;
  title: string;
  blurb: string;
  profileUrl?: string | null;
  projectUrl?: string | null;
  strand?: string | null;
  active?: boolean;
}

/** Creates a new spotlight, or updates an existing one when `id` is given. */
export async function upsertSpotlight(
  input: SpotlightInput,
  featuredBy: string,
): Promise<SpotlightRecord> {
  await ensureSpotlightSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (input.active) {
      await client.query(`UPDATE spotlights SET active = false WHERE active = true`);
    }
    const result = input.id
      ? await client.query<SpotlightDbRow>(
          `UPDATE spotlights
             SET title = $1, blurb = $2, profile_url = $3, project_url = $4,
                 strand = $5, active = $6, featured_by = $7, updated_at = now()
           WHERE id = $8
           RETURNING *`,
          [
            input.title,
            input.blurb,
            input.profileUrl ?? null,
            input.projectUrl ?? null,
            input.strand ?? null,
            input.active ?? false,
            featuredBy,
            input.id,
          ],
        )
      : await client.query<SpotlightDbRow>(
          `INSERT INTO spotlights
             (title, blurb, profile_url, project_url, strand, active, featured_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            input.title,
            input.blurb,
            input.profileUrl ?? null,
            input.projectUrl ?? null,
            input.strand ?? null,
            input.active ?? false,
            featuredBy,
          ],
        );
    await client.query("COMMIT");
    if (!result.rows[0]) throw new Error("Spotlight not found.");
    return toRecord(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSpotlight(id: string): Promise<boolean> {
  await ensureSpotlightSchema();
  const result = await getPool().query(`DELETE FROM spotlights WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
