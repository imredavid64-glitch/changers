"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, GraduationCap, Printer } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, getDocument, listDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import {
  CAS_CATEGORY_EMOJI,
  CAS_CATEGORY_LABELS,
  buildCasReport,
  casReportToMarkdown,
  type CasCategory,
  type CasEntry,
  type CasSourceItem,
} from "@/lib/cas/reflections";
import {
  normalizeCodeSnippet,
  normalizeDesign,
  normalizeDocument,
  normalizeEvent,
  normalizeFilm,
  normalizePost,
  normalizeProject,
  normalizeSlideshow,
} from "@/lib/social/utils";

const CATEGORY_ORDER: CasCategory[] = ["creativity", "activity", "service"];

export default function CasPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CasSourceItem[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.$id;

    let cancelled = false;

    async function load() {
      const sources: CasSourceItem[] = [];
      const add = (batch: CasSourceItem[]) => {
        if (!cancelled) sources.push(...batch);
      };

      const [posts, projects, documents, slideshows, designs, films, snippets, hostedEvents, rsvps] =
        await Promise.allSettled([
          listDocuments(COLLECTIONS.posts, [Query.equal("author_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.projects, [Query.equal("owner_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.documents, [Query.equal("user_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.slideshows, [Query.equal("user_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.designs, [Query.equal("user_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.films, [Query.equal("user_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.codeSnippets, [Query.equal("user_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.events, [Query.equal("host_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.eventRsvps, [
            Query.equal("user_id", userId),
            Query.equal("status", "going"),
            Query.limit(300),
          ]),
        ]);

      const ok = <T,>(result: PromiseSettledResult<T>): T | null =>
        result.status === "fulfilled" ? result.value : null;

      for (const doc of ok(posts) || []) {
        const post = normalizePost(String(doc.$id), doc);
        add([{
          id: post.id,
          kind: "post",
          title: post.title,
          description: post.body,
          strand: post.strand,
          dateMs: typeof doc.created_at_ms === "number" ? doc.created_at_ms : undefined,
        }]);
      }
      for (const doc of ok(projects) || []) {
        const project = normalizeProject(String(doc.$id), doc);
        add([{
          id: project.id,
          kind: "project",
          title: project.name,
          description: project.description,
          strand: project.strand,
          dateMs: typeof doc.created_at_ms === "number" ? doc.created_at_ms : undefined,
        }]);
      }
      for (const doc of ok(documents) || []) {
        const document = normalizeDocument(String(doc.$id), doc);
        add([{
          id: document.id,
          kind: "document",
          title: document.title || "Untitled document",
          description: document.body,
          dateMs: typeof doc.created_at_ms === "number" ? doc.created_at_ms : undefined,
        }]);
      }
      for (const doc of ok(slideshows) || []) {
        const slideshow = normalizeSlideshow(String(doc.$id), doc);
        add([{
          id: slideshow.id,
          kind: "slideshow",
          title: slideshow.title || "Untitled slideshow",
          description: slideshow.slides.map((slide) => slide.heading).filter(Boolean).join(", "),
          dateMs: typeof doc.created_at_ms === "number" ? doc.created_at_ms : undefined,
        }]);
      }
      for (const doc of ok(designs) || []) {
        const design = normalizeDesign(String(doc.$id), doc);
        add([{
          id: design.id,
          kind: "design",
          title: design.title || "Untitled design",
          description: `${design.elements.length} elements on a ${design.canvas_width}×${design.canvas_height} canvas`,
          dateMs: typeof doc.created_at_ms === "number" ? doc.created_at_ms : undefined,
        }]);
      }
      for (const doc of ok(films) || []) {
        const film = normalizeFilm(String(doc.$id), doc);
        add([{
          id: film.id,
          kind: "film",
          title: film.title || "Untitled film",
          description: `${film.scenes.length} scenes: ${film.scenes.slice(0, 3).map((scene) => scene.description).filter(Boolean).join("; ")}`,
          dateMs: typeof doc.created_at_ms === "number" ? doc.created_at_ms : undefined,
        }]);
      }
      for (const doc of ok(snippets) || []) {
        const snippet = normalizeCodeSnippet(String(doc.$id), doc);
        add([{
          id: snippet.id,
          kind: "code",
          title: snippet.title || "Untitled snippet",
          description: snippet.language,
          dateMs: typeof doc.created_at_ms === "number" ? doc.created_at_ms : undefined,
        }]);
      }
      for (const doc of ok(hostedEvents) || []) {
        const event = normalizeEvent(String(doc.$id), doc);
        add([{
          id: event.id,
          kind: "event",
          title: event.title,
          description: `${event.description} ${event.is_online ? "(online)" : event.location}`,
          strand: event.strand,
          dateMs: Date.parse(event.date) || undefined,
          isEventHost: true,
        }]);
      }

      const attendedRsvps = ok(rsvps) || [];
      const attendedEvents = await Promise.all(
        attendedRsvps.map(async (rsvp) => {
          const eventId = String(rsvp.event_id || "");
          const eventDoc = eventId ? await getDocument(COLLECTIONS.events, eventId) : null;
          return eventDoc ? normalizeEvent(String(eventDoc.$id), eventDoc) : null;
        }),
      );
      for (const event of attendedEvents.filter((e): e is NonNullable<typeof e> => Boolean(e))) {
        if (sources.some((source) => source.id === event.id && source.kind === "event")) continue;
        add([{
          id: event.id,
          kind: "event",
          title: event.title,
          description: `${event.description} ${event.is_online ? "(online)" : event.location}`,
          strand: event.strand,
          dateMs: Date.parse(event.date) || undefined,
        }]);
      }

      if (!cancelled) {
        setItems(sources);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const report = useMemo(() => buildCasReport(items), [items]);

  function effectiveReflection(entry: CasEntry) {
    return edits[entry.id] ?? entry.reflection;
  }

  async function handleExport() {
    const markdown = casReportToMarkdown(
      { ...report, entries: report.entries.map((entry) => ({ ...entry, reflection: effectiveReflection(entry) })) },
      profile?.full_name || user?.name || "Changemaker",
    );
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "changers-cas-journal.md";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("CAS journal downloaded as Markdown.");
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>CAS Journal</h1>
          <p className="muted">Sign in to auto-generate your IB CAS journal from your Changers activity.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: "grid", gap: 24 }}
    >
      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">IB CAS auto-logger</p>
            <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)", display: "flex", alignItems: "center", gap: 10 }}>
              <GraduationCap size={26} style={{ color: "var(--moss)" }} /> CAS Journal
            </h1>
            <p className="muted">
              Your posts, projects, events, documents, and creative tools are grouped into Creativity, Activity,
              and Service entries with draft reflections — ready to paste into ManageBac or export below.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="ghost" onClick={() => window.print()}>
              <Printer size={16} style={{ marginRight: 6, verticalAlign: "middle" }} /> Print
            </button>
            <button className="primary" onClick={handleExport} disabled={report.entries.length === 0}>
              <Download size={16} style={{ marginRight: 6, verticalAlign: "middle" }} /> Export .md
            </button>
          </div>
        </div>

        {loading ? (
          <p className="muted" style={{ padding: 40, textAlign: "center" }}>Building your journal...</p>
        ) : report.entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎓</div>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>No CAS experiences yet</p>
            <p className="muted" style={{ maxWidth: 440, margin: "0 auto" }}>
              Post, start a project, host an event, or create a document and this page will draft a CAS
              journal entry for it automatically.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 8 }}>
              <div className="mini-card">
                <p className="meta-label">Experiences</p>
                <p className="meta-value">{report.entries.length}</p>
              </div>
              <div className="mini-card">
                <p className="meta-label">Est. hours</p>
                <p className="meta-value">{report.hours}</p>
              </div>
              {CATEGORY_ORDER.map((category) => (
                <div className="mini-card" key={category}>
                  <p className="meta-label">{CAS_CATEGORY_EMOJI[category]} {CAS_CATEGORY_LABELS[category]}</p>
                  <p className="meta-value">{report.byCategory[category]}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
              {CATEGORY_ORDER.map((category) => {
                const entries = report.entries.filter((entry) => entry.category === category);
                if (entries.length === 0) return null;
                return (
                  <div key={category}>
                    <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 10 }}>
                      {CAS_CATEGORY_EMOJI[category]} {CAS_CATEGORY_LABELS[category]} ({entries.length})
                    </h3>
                    <div style={{ display: "grid", gap: 12 }}>
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="bridge-results"
                          style={{ padding: "16px 18px", display: "grid", gap: 8 }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <p style={{ fontWeight: 700 }}>{entry.title}</p>
                            <span className="chip">
                              ~{entry.hours} h · {entry.sourceKind}
                            </span>
                          </div>
                          <p className="muted" style={{ fontSize: "0.9rem" }}>{entry.description}</p>
                          {editing === entry.id ? (
                            <textarea
                              value={effectiveReflection(entry)}
                              onChange={(event) => setEdits((current) => ({ ...current, [entry.id]: event.target.value }))}
                              style={{ minHeight: 160, font: "inherit", fontSize: "0.92rem", lineHeight: 1.55 }}
                            />
                          ) : (
                            <p style={{ whiteSpace: "pre-wrap", fontSize: "0.92rem", lineHeight: 1.55 }}>{effectiveReflection(entry)}</p>
                          )}
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            {editing === entry.id ? (
                              <button className="ghost" onClick={() => setEditing(null)}>Done</button>
                            ) : (
                              <button className="ghost" onClick={() => setEditing(entry.id)}>Edit reflection</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {status && <p className="notice" style={{ marginTop: 16 }}>{status}</p>}

        <div className="bridge-results" style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>How the auto-logger works</p>
          <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.55 }}>
            Documents, slideshows, designs, films, and code map to <strong>Creativity</strong>; events you host
            or attend map to <strong>Activity</strong>; posts and projects map to <strong>Service</strong>.
            Hours are conservative estimates — adjust them and the reflections to match your real experience
            before submitting to your CAS coordinator.
          </p>
        </div>
      </section>
    </motion.div>
  );
}
