"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, publicReadOwnerWritePermissions } from "@/lib/appwrite/bridge";

const cellStyle = { border: "1px solid rgba(16,24,32,0.12)", padding: 0, background: "white" };
const inputStyle = { border: "none", background: "transparent", padding: "8px 12px", width: 120, outline: "none", fontSize: "0.9rem" };

function resizeGrid(grid: string[][], newRows: number, newCols: number) {
  return Array.from({ length: newRows }, (_, ri) =>
    Array.from({ length: newCols }, (_, ci) => grid[ri]?.[ci] ?? ""),
  );
}

export default function NewTablePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [data, setData] = useState<string[][]>(() => resizeGrid([], 5, 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setCell(ri: number, ci: number, value: string) {
    setData(data.map((row, i) => (i === ri ? row.map((cell, j) => (j === ci ? value : cell)) : row)));
  }

  function changeRows(newRows: number) {
    setRows(newRows);
    setData(resizeGrid(data, newRows, cols));
  }

  function changeCols(newCols: number) {
    setCols(newCols);
    setData(resizeGrid(data, rows, newCols));
  }

  async function handleSave() {
    if (!title.trim() || !user) return;
    setSaving(true);
    setError("");

    try {
      const now = Date.now();
      await createDocument(
        COLLECTIONS.tables,
        {
          user_id: user.$id,
          title: title.trim(),
          data_json: JSON.stringify(data),
          rows,
          cols,
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadOwnerWritePermissions(user.$id),
      );

      router.push("/tools/tables");
    } catch (e) {
      setError("Failed to save table. Please try again.");
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New table</h1>
          <p className="muted">Sign in to create spreadsheets.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving..." : "Save table"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--coral)", fontSize: "0.85rem" }}>{error}</p>}

      <input
        type="text"
        placeholder="Table title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
