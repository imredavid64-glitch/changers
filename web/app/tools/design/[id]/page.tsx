"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocument, updateDocument, deleteDocument } from "@/lib/appwrite/bridge";
import { normalizeDesign, formatRelativeTime } from "@/lib/social/utils";
import { AppDesign, DesignElement } from "@/lib/social/types";

const inputStyle = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(16,24,32,0.15)",
  fontSize: "0.85rem",
  marginTop: 2,
  background: "var(--surface-card-solid)",
};

export default function DesignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [design, setDesign] = useState<AppDesign | null>(null);
  const [title, setTitle] = useState("");
  const [elements, setElements] = useState<DesignElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const unsub = watchDocument(
      COLLECTIONS.designs,
      id,
      (doc) => normalizeDesign(doc.$id, doc as unknown as Record<string, unknown>),
      (doc) => {
        if (doc) {
          setDesign(doc);
          setTitle(doc.title);
          setElements(doc.elements);
          setSelected(null);
        }
      },
    );

    return unsub;
  }, [user, id]);

  function addElement(type: DesignElement["type"]) {
    const el: DesignElement = {
      id: Math.random().toString(36).slice(2, 9),
      type,
      x: 50 + elements.length * 20,
      y: 50 + elements.length * 20,
      width: type === "text" ? 200 : type === "line" ? 150 : 100,
      height: type === "text" ? 40 : type === "line" ? 2 : 100,
      color: type === "text" ? "#111" : type === "line" ? "#111" : "#4c8c82",
      content: type === "text" ? "Double click to edit" : "",
      font_size: 16,
    };
    setElements([...elements, el]);
    setSelected(el.id);
    setDirty(true);
  }

  function updateElement(id: string, updates: Partial<DesignElement>) {
    setElements(elements.map((el) => (el.id === id ? { ...el, ...updates } : el)));
    setDirty(true);
  }

  function removeElement(id: string) {
    setElements(elements.filter((el) => el.id !== id));
    setSelected(null);
    setDirty(true);
  }

  async function handleSave() {
    if (!design || !user) return;
    setSaving(true);

    try {
      await updateDocument(
        COLLECTIONS.designs,
        design.id,
        {
          title: title.trim(),
          elements_json: JSON.stringify(elements),
          updated_at_ms: Date.now(),
        },
      );
      setDirty(false);
    } catch (e) {
      console.error("Failed to save design", e);
    }
    setSaving(false);
  }

  function handleExportJson() {
    if (!design) return;
    const json = JSON.stringify({ title, elements, canvas_width: design.canvas_width, canvas_height: design.canvas_height }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${title || "design"}.json`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!design) return;
    if (!window.confirm("Delete this design? This cannot be undone.")) return;
    setDeleting(true);

    try {
      await deleteDocument(COLLECTIONS.designs, design.id);
      router.push("/tools/design");
    } catch (e) {
      console.error("Failed to delete design", e);
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Design</h1>
          <p className="muted">Sign in to view and edit designs.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Loading design...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Designer</p>
          <Link href="/tools/design" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to designs
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {design.updated_at && (
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Updated {formatRelativeTime(design.updated_at)}
            </span>
          )}
          {dirty && (
            <button className="primary" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button className="ghost" onClick={handleExportJson}>Export JSON</button>
          <button className="ghost" onClick={handleDelete} disabled={deleting} style={{ color: "var(--coral)" }}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          style={{
            flex: 1,
            minWidth: 200,
            border: "none",
            background: "transparent",
            fontSize: "1.5rem",
            fontWeight: 700,
            padding: "0 0 12px 0",
            fontFamily: "var(--font-head)",
            outline: "none",
          }}
        />
        <button className="ghost" onClick={() => addElement("text")}>+ Text</button>
        <button className="ghost" onClick={() => addElement("rect")}>+ Rectangle</button>
        <button className="ghost" onClick={() => addElement("circle")}>+ Circle</button>
        <button className="ghost" onClick={() => addElement("line")}>+ Line</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 24, alignItems: "start" }}>
        <div style={{ position: "relative", width: design.canvas_width, height: design.canvas_height, background: "#f8f9fa", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(16,24,32,0.1)", backgroundImage: "radial-gradient(circle, rgba(16,24,32,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
          {elements.map((el) => (
            <div key={el.id} onClick={() => setSelected(el.id)} style={{ position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height, background: el.type === "rect" ? el.color : "transparent", borderRadius: el.type === "circle" ? "50%" : 4, border: el.type === "circle" || el.type === "rect" ? "2px solid rgba(16,24,32,0.15)" : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: el.font_size || 16, color: el.type === "text" ? el.color : "#333", outline: selected === el.id ? "2px solid var(--moss)" : "none", zIndex: 10, overflow: "hidden" }}>
              {el.type === "text" ? el.content : el.type === "line" ? <svg width={el.width} height={el.height}><line x1="0" y1="0" x2={el.width} y2={el.height} stroke={el.color} strokeWidth="2"/></svg> : null}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 16, width: 220 }}>
          <h4 style={{ fontFamily: "var(--font-head)", marginBottom: 12 }}>Properties</h4>
          {selected && (() => { const el = elements.find(e => e.id === selected); if (!el) return null;
            return (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: "0.8rem" }}>X <input type="number" value={el.x} onChange={(e) => updateElement(selected, { x: Number(e.target.value) })} style={inputStyle} /></label>
                <label style={{ fontSize: "0.8rem" }}>Y <input type="number" value={el.y} onChange={(e) => updateElement(selected, { y: Number(e.target.value) })} style={inputStyle} /></label>
                <label style={{ fontSize: "0.8rem" }}>Width <input type="number" value={el.width} onChange={(e) => updateElement(selected, { width: Number(e.target.value) })} style={inputStyle} /></label>
                <label style={{ fontSize: "0.8rem" }}>Height <input type="number" value={el.height} onChange={(e) => updateElement(selected, { height: Number(e.target.value) })} style={inputStyle} /></label>
                <label style={{ fontSize: "0.8rem" }}>Color <input type="text" value={el.color} onChange={(e) => updateElement(selected, { color: e.target.value })} style={inputStyle} /></label>
                <label style={{ fontSize: "0.8rem" }}>Font size <input type="number" value={el.font_size} onChange={(e) => updateElement(selected, { font_size: Number(e.target.value) })} style={inputStyle} /></label>
                <label style={{ fontSize: "0.8rem" }}>Content <textarea value={el.content} onChange={(e) => updateElement(selected, { content: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} /></label>
                <button className="ghost" onClick={() => removeElement(selected)} style={{ color: "var(--coral)", marginTop: 8 }}>Delete element</button>
              </div>
            );
          })()}
          {!selected && <p className="muted" style={{ fontSize: "0.85rem" }}>Click an element to edit</p>}
        </div>
      </div>
    </div>
  );
}
