"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { normalizeTable, formatRelativeTime } from "@/lib/social/utils";
import { AppTable } from "@/lib/social/types";

export default function TablesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tables, setTables] = useState<AppTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const queries = [Query.equal("user_id", user.$id), Query.orderDesc("updated_at_ms")];
    const unsub = watchDocuments(
      COLLECTIONS.tables,
      queries,
      (doc) => normalizeTable(doc.$id, doc as unknown as Record<string, unknown>),
      (docs) => {
        setTables(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsub;
  }, [user]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Tables</h1>
          <p className="muted">Sign in to create and manage your spreadsheets.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Spreadsheet editor</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Tables</h1>
        </div>
        <Link href="/tools/tables/new" className="primary" style={{ padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}>
          + New table
        </Link>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <p className="muted">Loading tables...</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📊</div>
          <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 8 }}>No tables yet</h3>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
            Create your first spreadsheet with the table editor.
          </p>
          <Link href="/tools/tables/new" className="primary" style={{ padding: "10px 24px", borderRadius: 999, textDecoration: "none", display: "inline-block" }}>
            Create your first table
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/tools/tables/${t.id}`)}
              className="card hover-lift"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", cursor: "pointer", textAlign: "left", border: "none", width: "100%", fontFamily: "inherit", fontSize: "inherit" }}
            >
              <div>
                <div className="collab-title" style={{ marginBottom: 4 }}>{t.title}</div>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  {t.rows} rows × {t.cols} cols · Updated {formatRelativeTime(t.updated_at)}
                </p>
              </div>
              <span style={{ fontSize: "0.85rem", color: "var(--moss)", fontWeight: 600 }}>Edit →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
