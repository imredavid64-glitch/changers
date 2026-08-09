"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocument, updateDocument, deleteDocument } from "@/lib/appwrite/bridge";
import { normalizeTable, formatRelativeTime } from "@/lib/social/utils";
import { AppTable } from "@/lib/social/types";

const cellStyle = { border: "1px solid rgba(16,24,32,0.12)", padding: 0, background: "white" };
const inputStyle = { border: "none", background: "transparent", padding: "8px 12px", width: 120, outline: "none", fontSize: "0.9rem" };

function resizeGrid(grid: string[][], newRows: number, newCols: number) {
  return Array.from({ length: newRows }, (_, ri) =>
    Array.from({ length: newCols }, (_, ci) => grid[ri]?.[ci] ?? ""),
  );
}

function escapeCsvCell(cell: string): string {
  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function toCsv(data: string[][]): string {
  return data.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export default function TableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [table, setTable] = useState<AppTable | null>(null);
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [data, setData] = useState<string[][]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const unsub = watchDocument(
      COLLECTIONS.tables,
      id,
      (doc) => normalizeTable(doc.$id, doc as unknown as Record<string, unknown>),
      (t) => {
        if (t) {
          setTable(t);
          setTitle(t.title);
          setRows(t.rows);
          setCols(t.cols);
          setData(resizeGrid(t.data, t.rows, t.cols));
        }
      },
    );

    return unsub;
  }, [user, id]);

  function setCell(ri: number, ci: number, value: string) {
    setData(data.map((row, i) => (i === ri ? row.map((cell, j) => (j === ci ? value : cell)) : row)));
    setDirty(true);
  }

  function changeRows(newRows: number) {
    setRows(newRows);
    setData(resizeGrid(data, newRows, cols));
    setDirty(true);
  }

  function changeCols(newCols: number) {
    setCols(newCols);
    setData(resizeGrid(data, rows, newCols));
    setDirty(true);
  }

  function handleDownload() {
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "table"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    if (!table || !user || !title.trim()) return;
    setSaving(true);

    try {
      await updateDocument(
        COLLECTIONS.tables,
        table.id,
        {
          title: title.trim(),
          data_json: JSON.stringify(data),
          rows,
          cols,
          updated_at_ms: Date.now(),
        },
      );
      setDirty(false);
    } catch (e) {
      console.error("Failed to save table", e);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!table) return;
    if (!window.confirm("Delete this table? This cannot be undone.")) return;
    setDeleting(true);

    try {
      await deleteDocument(COLLECTIONS.tables, table.id);
      router.push("/tools/tables");
    } catch (e) {
      console.error("Failed to delete table", e);
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Table</h1>
          <p className="muted">Sign in to view and edit spreadsheets.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Loading table...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Spreadsheet editor</p>
          <Link href="/tools/tables" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to tables
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {table.updated_at && (
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Updated {formatRelativeTime(table.updated_at)}
            </span>
          )}
          {dirty && (
            <button className="primary" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button className="ghost" onClick={handleDownload}>Download CSV</button>
          <button className="ghost" onClick={handleDelete} disabled={deleting} style={{ color: "var(--coral)" }}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
        style={{
          width: "100%", border: "none", background: "transparent",
          fontSize: "1.5rem", fontWeight: 700, padding: "0 0 12px 0", outline: "none",
          fontFamily: "var(--font-head)",
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="ghost" onClick={() => changeRows(Math.min(20, rows + 1))}>+ Row</button>
        <button className="ghost" onClick={() => changeRows(Math.max(1, rows - 1))}>− Row</button>
        <button className="ghost" onClick={() => changeCols(Math.min(20, cols + 1))}>+ Col</button>
        <button className="ghost" onClick={() => changeCols(Math.max(1, cols - 1))}>− Col</button>
        <span className="muted" style={{ fontSize: "0.85rem", alignSelf: "center" }}>
          {rows} × {cols}
        </span>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {Array.from({ length: cols }, (_, ci) => (
                  <th key={ci} style={cellStyle}>
                    <input style={inputStyle} value={data[0]?.[ci] || ""} onChange={(e) => setCell(0, ci, e.target.value)} placeholder={`Col ${ci + 1}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows - 1 }, (_, ri) => (
                <tr key={ri}>
                  {Array.from({ length: cols }, (_, ci) => (
                    <td key={ci} style={cellStyle}>
                      <input style={inputStyle} value={data[ri + 1]?.[ci] || ""} onChange={(e) => setCell(ri + 1, ci, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
