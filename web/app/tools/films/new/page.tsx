"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, publicReadOwnerWritePermissions } from "@/lib/appwrite/bridge";
import { FilmScene } from "@/lib/social/types";

const SHOT_TYPES: FilmScene["shot_type"][] = ["wide", "medium", "close-up", "pov", "aerial"];

function defaultScene(number: number): FilmScene {
  return {
    id: Math.random().toString(36).slice(2, 9),
    number,
    setting: "Setting",
    description: "",
    dialogue: "",
    shot_type: "medium",
    duration_secs: 10,
  };
}

export default function NewFilmPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<FilmScene[]>([]);
  const [current, setCurrent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentScene = scenes.find((s) => s.id === current);

  function addScene() {
    const newScene = defaultScene(scenes.length + 1);
    setScenes([...scenes, newScene]);
    setCurrent(newScene.id);
  }

  function updateScene(id: string, updates: Partial<FilmScene>) {
    setScenes(scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  function removeScene(id: string) {
    const remaining = scenes.filter((s) => s.id !== id);
    setScenes(remaining.map((s, i) => ({ ...s, number: i + 1 })));
    if (current === id) setCurrent(null);
  }

  async function handleSave() {
    if (!title.trim() || scenes.length === 0 || !user) return;
    setSaving(true);
    setError("");

    try {
      const now = Date.now();
      await createDocument(
        COLLECTIONS.films,
        {
          user_id: user.$id,
          title: title.trim(),
          scenes_json: JSON.stringify(scenes),
          scene_count: scenes.length,
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadOwnerWritePermissions(user.$id),
      );

      router.push("/tools/films");
    } catch (e) {
      setError("Failed to save film. Please try again.");
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>New film</h1>
          <p className="muted">Sign in to create storyboards.</p>
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
          <p className="eyebrow">Film editor</p>
          <Link href="/tools/films" style={{ fontSize: "0.85rem", color: "var(--moss)" }}>
            ← Back to films
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" onClick={handleSave} disabled={saving || scenes.length === 0}>
            {saving ? "Saving..." : "Save film"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--coral)", fontSize: "0.85rem" }}>{error}</p>}

      <input
        type="text"
        placeholder="Film title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          width: "100%", border: "none", background: "transparent",
          fontSize: "1.5rem", fontWeight: 700, padding: "0 0 12px 0", outline: "none",
          fontFamily: "var(--font-head)",
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 16, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ fontFamily: "var(--font-head)", margin: 0 }}>Scenes</h4>
            <button className="ghost" onClick={addScene} style={{ fontSize: "0.8rem" }}>+ Add</button>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {scenes.map((scene) => (
              <div key={scene.id} onClick={() => setCurrent(scene.id)}
                style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontSize: "0.85rem", background: current === scene.id ? "rgba(44, 138, 125, 0.12)" : "transparent", border: "1px solid rgba(16,24,32,0.06)" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Scene {scene.number}</div>
                <div style={{ color: "var(--moss)", fontSize: "0.75rem", textTransform: "uppercase" }}>{scene.shot_type}</div>
                <div className="muted" style={{ fontSize: "0.8rem" }}>{scene.setting.slice(0, 40)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {currentScene ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontFamily: "var(--font-head)", margin: 0 }}>Scene {currentScene.number}</h3>
                <button className="ghost" onClick={() => removeScene(currentScene.id)} style={{ color: "var(--coral)", fontSize: "0.8rem" }}>Remove</button>
              </div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Setting <input type="text" value={currentScene.setting} onChange={(e) => updateScene(currentScene.id, { setting: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(16,24,32,0.15)", marginTop: 4, fontSize: "0.9rem" }} /></label>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Description <textarea value={currentScene.description} onChange={(e) => updateScene(currentScene.id, { description: e.target.value })} style={{ width: "100%", minHeight: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(16,24,32,0.15)", marginTop: 4, fontSize: "0.9rem", resize: "vertical" }} /></label>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Dialogue <textarea value={currentScene.dialogue} onChange={(e) => updateScene(currentScene.id, { dialogue: e.target.value })} style={{ width: "100%", minHeight: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(16,24,32,0.15)", marginTop: 4, fontSize: "0.9rem", resize: "vertical" }} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Shot type <select value={currentScene.shot_type} onChange={(e) => updateScene(currentScene.id, { shot_type: e.target.value as FilmScene["shot_type"] })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(16,24,32,0.15)", marginTop: 4, fontSize: "0.9rem" }}>
                  {SHOT_TYPES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select></label>
                <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Duration (sec) <input type="number" value={currentScene.duration_secs} onChange={(e) => updateScene(currentScene.id, { duration_secs: Number(e.target.value) })} min={1} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(16,24,32,0.15)", marginTop: 4, fontSize: "0.9rem" }} /></label>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p className="muted">Select a scene or add one to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
