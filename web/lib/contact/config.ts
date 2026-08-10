export function getContactDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";
}

export function getContactRateLimitMax() {
  const value = process.env.CONTACT_RATE_LIMIT_MAX;
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}
