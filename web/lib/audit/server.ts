import { getContactPool } from "@/lib/contact/server";

export interface AdminActionRecord {
  id: string;
  adminUserId: string;
  targetUserId: string;
  action: "erase" | "anonymize";
  deletedCount: number;
  anonymizedCount: number;
  errorCount: number;
  createdAt: string;
}

interface AdminActionDbRow {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  action: "erase" | "anonymize";
  deleted_count: string | number;
  anonymized_count: string | number;
  error_count: string | number;
  created_at: string | Date;
}

const AUDIT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('erase', 'anonymize')),
    deleted_count INTEGER NOT NULL DEFAULT 0,
    anonymized_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions (created_at DESC);
`;

let schemaReady: Promise<void> | null = null;

export async function ensureAuditSchema() {
  if (!schemaReady) {
    schemaReady = getContactPool().query(AUDIT_SCHEMA_SQL).then(() => undefined);
  }
  return schemaReady;
}

function mapRow(row: AdminActionDbRow): AdminActionRecord {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    targetUserId: row.target_user_id,
    action: row.action,
    deletedCount: Number(row.deleted_count),
    anonymizedCount: Number(row.anonymized_count),
    errorCount: Number(row.error_count),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/**
 * Records an admin erase/anonymize action. Best-effort: callers should not
 * fail the user-facing operation when auditing is unavailable.
 */
export async function recordAdminAction(entry: {
  id: string;
  adminUserId: string;
  targetUserId: string;
  action: "erase" | "anonymize";
  deletedCount: number;
  anonymizedCount: number;
  errorCount: number;
}) {
  await ensureAuditSchema();
  await getContactPool().query(
    `
      INSERT INTO admin_actions (
        id, admin_user_id, target_user_id, action,
        deleted_count, anonymized_count, error_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      entry.id,
      entry.adminUserId,
      entry.targetUserId,
      entry.action,
      entry.deletedCount,
      entry.anonymizedCount,
      entry.errorCount,
    ],
  );
}

export async function listAdminActions(limit = 100): Promise<AdminActionRecord[]> {
  await ensureAuditSchema();
  const { rows } = await getContactPool().query<AdminActionDbRow>(
    `
      SELECT id, admin_user_id, target_user_id, action,
             deleted_count, anonymized_count, error_count, created_at
      FROM admin_actions
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );
  return rows.map(mapRow);
}
