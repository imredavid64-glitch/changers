import { Pool } from "pg";
import { CONTACT_SCHEMA_SQL } from "./schema";
import { getContactDatabaseUrl } from "./config";

export interface ContactMessageRecord {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  subject: string | null;
  message: string;
  userId: string | null;
  consentGiven: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  pagePath: string | null;
  createdAt: string;
  readAt: string | null;
  repliedAt: string | null;
}

interface ContactMessageDbRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  subject: string | null;
  message: string;
  user_id: string | null;
  consent_given: boolean;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  page_path: string | null;
  created_at: string | Date;
  read_at: string | Date | null;
  replied_at: string | Date | null;
}

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function getContactPool() {
  if (!pool) {
    const connectionString = getContactDatabaseUrl();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to store contact messages.");
    }

    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }

  return pool;
}

export async function ensureContactSchema() {
  if (!schemaReady) {
    schemaReady = getContactPool().query(CONTACT_SCHEMA_SQL).then(() => undefined);
  }

  return schemaReady;
}

function mapContactMessageRow(row: ContactMessageDbRow): ContactMessageRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    organization: row.organization,
    subject: row.subject,
    message: row.message,
    userId: row.user_id,
    consentGiven: row.consent_given,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    referrer: row.referrer,
    pagePath: row.page_path,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    readAt: row.read_at
      ? row.read_at instanceof Date
        ? row.read_at.toISOString()
        : String(row.read_at)
      : null,
    repliedAt: row.replied_at
      ? row.replied_at instanceof Date
        ? row.replied_at.toISOString()
        : String(row.replied_at)
      : null,
  };
}

export async function insertContactMessage(record: {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  subject: string | null;
  message: string;
  userId: string | null;
  consentGiven: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  pagePath: string | null;
}) {
  const { rows } = await getContactPool().query<ContactMessageDbRow>(
    `
      INSERT INTO contact_messages (
        id,
        name,
        email,
        organization,
        subject,
        message,
        user_id,
        consent_given,
        ip_address,
        user_agent,
        referrer,
        page_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      record.id,
      record.name,
      record.email,
      record.organization,
      record.subject,
      record.message,
      record.userId,
      record.consentGiven,
      record.ipAddress,
      record.userAgent,
      record.referrer,
      record.pagePath,
    ],
  );

  return mapContactMessageRow(rows[0]);
}

export async function listContactMessages(limit = 200) {
  const { rows } = await getContactPool().query<ContactMessageDbRow>(
    `
      SELECT *
      FROM contact_messages
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return rows.map(mapContactMessageRow);
}

export async function updateContactMessageStatus(
  id: string,
  changes: { read?: boolean; replied?: boolean },
) {
  const { rows } = await getContactPool().query<ContactMessageDbRow>(
    `
      UPDATE contact_messages
      SET
        read_at = CASE WHEN $2 THEN COALESCE(read_at, now()) ELSE NULL END,
        replied_at = CASE WHEN $3 THEN COALESCE(replied_at, now()) ELSE NULL END
      WHERE id = $1
      RETURNING *
    `,
    [id, changes.read === true, changes.replied === true],
  );

  return rows[0] ? mapContactMessageRow(rows[0]) : null;
}
