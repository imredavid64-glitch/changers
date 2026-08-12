"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, watchDocument, updateDocument, deleteDocument } from "@/lib/appwrite/bridge";
import { normalizeFilm, formatRelativeTime } from "@/lib/social/utils";
import { AppFilm, FilmScene } from "@/lib/social/types";
import { TINTS } from "@/lib/theme/tints";

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

export default function FilmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [film, setFilm] = useState<AppFilm | null>(null);
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<FilmScene[]>([]);
  const [current, setCurrent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const unsub = watchDocument(
      COLLECTIONS.films,
      id,
      (doc) => normalizeFilm(doc.$id, doc as unknown as Record<string, unknown>),
      (f) => {
        if (f) {
          setFilm(f);
          setTitle(f.title);
          setScenes(f.scenes);
          setCurrent(f.scenes[0]?.id || "");
        }
      },
    );

    return unsub;
  }, [user, id]);

  const currentScene = scenes.find((s) => s.id === current);

  function addScene() {
    const newScene = defaultScene(scenes.length + 1);
    setScenes([...scenes, newScene]);
    setCurrent(newScene.id);
    setDirty(true);
  }

  function updateScene(sceneId: string, updates: Partial<FilmScene>) {
    setScenes(scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)));
    setDirty(true);
  }

  function removeScene(sceneId: string) {
    const remaining = scenes.filter((s) => s.id !== sceneId);
    setScenes(remaining.map((s, i) => ({ ...s, number: i + 1 })));
    if (current === sceneId) setCurrent("");
    setDirty(true);
  }

  function buildScript(): string {
    return scenes
      .map(
        (s) =>
          `SCENE ${s.number} \u2014 ${s.shot_type} (${s.duration_secs}s)\nSETTING: ${s.setting}\nDESCRIPTION: ${s.description}\nDIALOGUE: ${s.dialogue}\n`,
      )
      .join("\n");
  }

  function handleExportScript() {
    const script = buildScript();
    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "film"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    if (!film || !user) return;
    setSaving(true);

    try {
      await updateDocument(
        COLLECTIONS.films,
        film.id,
        {
          title: title.trim(),
          scenes_json: JSON.stringify(scenes),
          scene_count: scenes.length,
          updated_at_ms: Date.now(),
        },
      );
      setDirty(false);
    } catch (e) {
      console.error("Failed to save film", e);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!film) return;
    if (!window.confirm("Delete this film? This cannot be undone.")) return;
    setDeleting(true);

    try {
      await deleteDocument(COLLECTIONS.films, film.id);
      router.push("/tools/films");
    } catch (e) {
      console.error("Failed to delete film", e);
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Film</h1>
          <p className="muted">Sign in to view and edit storyboards.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!film) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="muted">Loading film...</p>
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {film.updated_at && (
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Updated {formatRelativeTime(film.updated_at)}
            </span>
          )}
          <button className="ghost" onClick={addScene}>+ Add scene</button>
          <button className="ghost" onClick={handleExportScript}>Export Script</button>
          {dirty && (
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
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

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 16, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ fontFamily: "var(--font-head)", margin: 0 }}>Scenes</h4>
            <button className="ghost" onClick={addScene} style={{ fontSize: "0.8rem" }}>+ Add</button>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {scenes.map((scene) => (
              <div key={scene.id} onClick={() => setCurrent(scene.id)}
                style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", fontSize: "0.85rem", background: current === scene.id ? TINTS.teal12 : "transparent", border: "1px solid rgba(16,24,32,0.06)" }}>
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
