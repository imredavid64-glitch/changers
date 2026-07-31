"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, publicReadOwnerWritePermissions } from "@/lib/appwrite/bridge";
import { DesignElement } from "@/lib/social/types";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const inputStyle = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(16,24,32,0.15)",
  fontSize: "0.85rem",
  marginTop: 2,
  background: "white",
};

export default function NewDesignPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [elements, setElements] = useState<DesignElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

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
    if (!title.trim()) return;
    setSaving(true);
    setError("");

    try {
      const now = Date.now();
      await createDocument(
        COLLECTIONS.designs,
        {
          user_id: user.$id,
          title: title.trim(),
          elements_json: JSON.stringify(elements),
          canvas_width: CANVAS_WIDTH,
          canvas_height: CANVAS_HEIGHT,
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadOwnerWritePermissions(user.$id),
      );

      router.push("/tools/design");
    } catch (e) {
      setError("Failed to save design. Please try again.");
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New design</h1>
          <p className="muted">Sign in to create designs.</p>
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
          <p className="eyebrow">Designer</p>
          <Link href="/tools/design" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to designs
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dirty && (
            <span className="muted" style={{ fontSize: "0.8rem" }}>Unsaved changes</span>
          )}
          <button className="primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving..." : "Save design"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--coral)", fontSize: "0.85rem" }}>{error}</p>}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Design title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
        <div style={{ position: "relative", width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: "#f8f9fa", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(16,24,32,0.1)", backgroundImage: "radial-gradient(circle, rgba(16,24,32,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
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
