"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Mail, Shield, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, listDocuments, updateDocument } from "@/lib/appwrite/bridge";
import { account, Query } from "@/lib/appwrite/client";
import type { ContactMessageRecord } from "@/lib/contact/server";
import type { AdminActionRecord } from "@/lib/audit/server";
import type { SpotlightRecord } from "@/lib/spotlight/server";
import { anonymizeUserData, eraseUserData } from "@/lib/userdata/client";
import { AppPost, AppProfile } from "@/lib/social/types";
import { normalizePost, normalizeProfile } from "@/lib/social/utils";
import { TINTS } from "@/lib/theme/tints";

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiles" | "posts" | "messages" | "audit" | "spotlight">("profiles");
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [auditActions, setAuditActions] = useState<AdminActionRecord[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [spotlights, setSpotlights] = useState<SpotlightRecord[]>([]);
  const [spotlightsLoaded, setSpotlightsLoaded] = useState(false);
  const [spotForm, setSpotForm] = useState({ title: "", blurb: "", profileUrl: "", projectUrl: "", strand: "", active: false });
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [eraseTarget, setEraseTarget] = useState<string | null>(null);
  const [eraseConfirmText, setEraseConfirmText] = useState("");
  const [eraseMode, setEraseMode] = useState<"delete" | "anonymize">("delete");

  const isAdmin = profile?.is_admin === true;

  // Reset the loading flag only when the admin flag transitions away; while admin,
  // load() owns `loading` end-to-end.
  const [prevIsAdmin, setPrevIsAdmin] = useState<boolean | null>(null);
  if (isAdmin !== prevIsAdmin) {
    setPrevIsAdmin(isAdmin);
    if (!isAdmin) setLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;

    async function load() {
      try {
        const [profileDocs, postDocs] = await Promise.all([
          listDocuments(COLLECTIONS.profiles, [Query.limit(200)]),
          listDocuments(COLLECTIONS.posts, [Query.limit(200)]),
        ]);
        setProfiles(profileDocs.map((d) => normalizeProfile(d.$id, d)));
        setPosts(postDocs.map((d) => normalizePost(d.$id, d)));
      } catch (error) {
        setStatus("Failed to load data.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [isAdmin]);

  async function handleDeletePost(postId: string) {
    if (!confirm("Delete this post permanently?")) return;
    try {
      const { deleteDocument } = await import("@/lib/appwrite/bridge");
      await deleteDocument(COLLECTIONS.posts, postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setStatus("Post deleted.");
    } catch { setStatus("Failed to delete post."); }
  }

  async function loadMessages() {
    try {
      const jwt = await account.createJWT();
      const response = await fetch("/api/contact", {
        headers: { Authorization: `Bearer ${jwt.jwt}` },
      });
      if (!response.ok) {
        throw new Error(`Contact API returned ${response.status}`);
      }
      const data = (await response.json()) as { messages: ContactMessageRecord[] };
      setMessages(data.messages);
    } catch (error) {
      setStatus("Failed to load contact messages.");
      console.error(error);
    } finally {
      setMessagesLoaded(true);
    }
  }

  useEffect(() => {
    if (activeTab === "messages" && !messagesLoaded && isAdmin) {
      // Lazy-loads external data the first time the tab opens; every setState happens
      // in async callbacks.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadMessages();
    }
  }, [activeTab, messagesLoaded, isAdmin]);

  async function loadAuditActions() {
    try {
      const jwt = await account.createJWT();
      const response = await fetch("/api/audit", {
        headers: { Authorization: `Bearer ${jwt.jwt}` },
      });
      if (!response.ok) {
        throw new Error(`Audit API returned ${response.status}`);
      }
      const data = (await response.json()) as { actions: AdminActionRecord[] };
      setAuditActions(data.actions);
    } catch (error) {
      setStatus("Failed to load audit log.");
      console.error(error);
    } finally {
      setAuditLoaded(true);
    }
  }

  useEffect(() => {
    if (activeTab === "audit" && !auditLoaded && isAdmin) {
      // Lazy-loads external data the first time the tab opens; every setState happens
      // in async callbacks.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadAuditActions();
    }
  }, [activeTab, auditLoaded, isAdmin]);

  async function loadSpotlights() {
    try {
      const jwt = await account.createJWT();
      const response = await fetch("/api/spotlight?all=1", {
        headers: { Authorization: `Bearer ${jwt.jwt}` },
      });
      if (!response.ok) {
        throw new Error(`Spotlight API returned ${response.status}`);
      }
      const data = (await response.json()) as { spotlights: SpotlightRecord[] };
      setSpotlights(data.spotlights);
    } catch (error) {
      setStatus("Failed to load spotlights.");
      console.error(error);
    } finally {
      setSpotlightsLoaded(true);
    }
  }

  useEffect(() => {
    if (activeTab === "spotlight" && !spotlightsLoaded && isAdmin) {
      // Lazy-loads external data the first time the tab opens; every setState happens
      // in async callbacks.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadSpotlights();
    }
  }, [activeTab, spotlightsLoaded, isAdmin]);

  async function handleSaveSpotlight(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    try {
      const jwt = await account.createJWT();
      const response = await fetch("/api/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.jwt}` },
        body: JSON.stringify({
          title: spotForm.title,
          blurb: spotForm.blurb,
          profileUrl: spotForm.profileUrl || null,
          projectUrl: spotForm.projectUrl || null,
          strand: spotForm.strand || null,
          active: spotForm.active,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || `Spotlight API returned ${response.status}`);
      }
      setSpotForm({ title: "", blurb: "", profileUrl: "", projectUrl: "", strand: "", active: false });
      await loadSpotlights();
      setStatus("Spotlight saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save spotlight.");
    }
  }

  async function handleToggleSpotlight(spot: SpotlightRecord) {
    setStatus(null);
    try {
      const jwt = await account.createJWT();
      const response = await fetch("/api/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt.jwt}` },
        body: JSON.stringify({
          id: spot.id,
          title: spot.title,
          blurb: spot.blurb,
          profileUrl: spot.profileUrl,
          projectUrl: spot.projectUrl,
          strand: spot.strand,
          active: !spot.active,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || `Spotlight API returned ${response.status}`);
      }
      await loadSpotlights();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update spotlight.");
    }
  }

  async function handleDeleteSpotlight(id: string) {
    setStatus(null);
    try {
      const jwt = await account.createJWT();
      const response = await fetch(`/api/spotlight?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt.jwt}` },
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || `Spotlight API returned ${response.status}`);
      }
      await loadSpotlights();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete spotlight.");
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  async function handleEraseUser(profileId: string) {
    if (eraseConfirmText !== "DELETE") return;
    setStatus(null);
    try {
      if (eraseMode === "anonymize") {
        const result = await anonymizeUserData(profileId);
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        setStatus(
          `${result.message} (${result.deleted} personal items removed, ${result.anonymized} content items anonymized).`,
        );
        if (result.errors.length > 0) console.error("Anonymize errors:", result.errors);
      } else {
        const result = await eraseUserData(profileId);
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        setStatus(`${result.message} (${result.deleted} items deleted).`);
        if (result.errors.length > 0) console.error("Erase errors:", result.errors);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to erase user data.");
    } finally {
      setEraseTarget(null);
      setEraseConfirmText("");
    }
  }

  async function handleSendReply(id: string) {
    if (!replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const jwt = await account.createJWT();
      const response = await fetch(`/api/contact/${id}/reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt.jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reply: replyText }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: ContactMessageRecord; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Reply API returned ${response.status}`);
      }
      if (data.message) {
        setMessages((prev) => prev.map((m) => (m.id === id ? (data.message as ContactMessageRecord) : m)));
      }
      setReplyTarget(null);
      setReplyText("");
      setStatus("Reply sent by email.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send reply.");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleMessageStatus(id: string, changes: { read?: boolean; replied?: boolean }) {
    try {
      const jwt = await account.createJWT();
      const response = await fetch(`/api/contact/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${jwt.jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      });
      if (!response.ok) {
        throw new Error(`Contact API returned ${response.status}`);
      }
      const data = (await response.json()) as { message: ContactMessageRecord };
      setMessages((prev) => prev.map((m) => (m.id === id ? data.message : m)));
    } catch (error) {
      setStatus("Failed to update message status.");
      console.error(error);
    }
  }

  async function handleToggleAdmin(userId: string, currentValue: boolean) {
    try {
      // eslint-disable-next-line react-hooks/purity -- Date.now() timestamps in event handlers are explicitly permitted by React.
      await updateDocument(COLLECTIONS.profiles, userId, { is_admin: !currentValue, updated_at_ms: Date.now() });
      setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, is_admin: !currentValue } : p));
      setStatus(`Admin toggled for user.`);
    } catch { setStatus("Failed to toggle admin."); }
  }

  if (!user) {
    return <section className="card"><h2>Admin Dashboard</h2><p className="muted">Sign in to access the admin panel.</p></section>;
  }

  if (!isAdmin) {
    return <section className="card"><h2>Access Denied</h2><p className="muted">Only administrators can access this page.</p></section>;
  }

  return (
    <motion.section
      className="card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="section-header">
        <div>
          <h2><Shield size={24} style={{ display: "inline", marginRight: 8, color: "var(--moss)", verticalAlign: "middle" }} /> Admin Dashboard</h2>
          <p className="muted">Manage users and moderate content across the platform.</p>
        </div>
        <div className="filter-row">
          <button className={`filter ${activeTab === "profiles" ? "active" : ""}`} onClick={() => setActiveTab("profiles")}>
            Users ({profiles.length})
          </button>
          <button className={`filter ${activeTab === "posts" ? "active" : ""}`} onClick={() => setActiveTab("posts")}>
            Posts ({posts.length})
          </button>
          <button className={`filter ${activeTab === "messages" ? "active" : ""}`} onClick={() => setActiveTab("messages")}>
            Messages ({messages.length})
          </button>
          <button className={`filter ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>
            Audit
          </button>
          <button className={`filter ${activeTab === "spotlight" ? "active" : ""}`} onClick={() => setActiveTab("spotlight")}>
            <Sparkles size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} /> Spotlight
          </button>
        </div>
      </div>

      {status && <p className="notice" style={{ marginBottom: 16 }}>{status}</p>}

      {loading ? (
        <p className="muted">Loading admin data...</p>
      ) : activeTab === "profiles" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {profiles.length === 0 ? <p className="muted">No users found.</p> : (
            profiles.map((prof) => (
              <div key={prof.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "var(--surface-card-solid)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600 }}>{prof.full_name} {prof.is_admin && <span className="chip">Admin</span>}</p>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>{prof.role} · {prof.id.slice(0, 12)}...</p>
                </div>
                {eraseTarget === prof.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={eraseMode}
                      onChange={(event) => setEraseMode(event.target.value === "anonymize" ? "anonymize" : "delete")}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(16,24,32,0.15)", background: "var(--surface-card-solid)", fontSize: "0.8rem" }}
                      title="Hard delete removes everything; anonymize keeps community content but strips the person's identity"
                    >
                      <option value="delete">Hard delete</option>
                      <option value="anonymize">Anonymize (keep content)</option>
                    </select>
                    <input
                      type="text"
                      value={eraseConfirmText}
                      onChange={(event) => setEraseConfirmText(event.target.value)}
                      placeholder='Type "DELETE"'
                      style={{ width: 110, padding: "6px 10px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--coral) 40%, transparent)", background: "var(--surface-card-solid)", fontSize: "0.8rem" }}
                    />
                    <button className="primary" onClick={() => handleEraseUser(prof.id)} disabled={eraseConfirmText !== "DELETE"} style={{ fontSize: "0.8rem", padding: "8px 14px" }}>
                      Confirm {eraseMode === "anonymize" ? "anonymize" : "erase"}
                    </button>
                    <button className="ghost" onClick={() => { setEraseTarget(null); setEraseConfirmText(""); }} style={{ fontSize: "0.8rem" }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button className="ghost" onClick={() => handleToggleAdmin(prof.id, prof.is_admin)} style={{ fontSize: "0.85rem" }}>
                      {prof.is_admin ? "Remove admin" : "Make admin"}
                    </button>
                    {prof.id !== user.$id && (
                      <button className="ghost" onClick={() => { setEraseConfirmText(""); setEraseMode("delete"); setEraseTarget(prof.id); }} style={{ fontSize: "0.85rem", color: "var(--coral)" }} title="Erase or anonymize this user's data">
                        <Trash2 size={16} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} /> Erase
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === "messages" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {!messagesLoaded ? <p className="muted">Loading messages...</p> : messages.length === 0 ? (
            <p className="muted">No contact messages yet.</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "var(--surface-card-solid)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>
                    {msg.name}{" "}
                    <a href={`mailto:${msg.email}`} style={{ color: "var(--teal)", fontSize: "0.85rem" }}>{msg.email}</a>
                    {msg.organization && <span className="muted" style={{ fontSize: "0.85rem" }}> · {msg.organization}</span>}
                    {msg.repliedAt ? (
                      <span className="chip" style={{ marginLeft: 8, background: TINTS.teal20 }}>Replied</span>
                    ) : msg.readAt ? (
                      <span className="chip" style={{ marginLeft: 8 }}>Read</span>
                    ) : (
                      <span className="chip" style={{ marginLeft: 8, background: "var(--coral)", color: "white" }}>Unread</span>
                    )}
                  </p>
                  {msg.subject && <p style={{ fontWeight: 600, fontSize: "0.9rem", marginTop: 4 }}>{msg.subject}</p>}
                  <p className="muted" style={{ fontSize: "0.9rem", marginTop: 4, whiteSpace: "pre-wrap" }}>{msg.message}</p>
                  <p className="muted" style={{ fontSize: "0.75rem", marginTop: 6 }}>
                    {formatDate(msg.createdAt)} · {msg.userId ? "signed in" : "anonymous"}
                    {msg.pagePath ? ` · from ${msg.pagePath}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "flex-end" }}>
                  <a className="ghost" href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || "Your message to Changers")}`} style={{ fontSize: "0.85rem" }}>
                    <Mail size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} /> Reply
                  </a>
                  <button className="ghost" onClick={() => { setReplyTarget(replyTarget === msg.id ? null : msg.id); setReplyText(""); }} style={{ fontSize: "0.8rem" }}>
                    Reply by email
                  </button>
                  <button className="ghost" onClick={() => handleMessageStatus(msg.id, msg.readAt ? { read: false } : { read: true })} style={{ fontSize: "0.8rem" }}>
                    {msg.readAt ? "Mark unread" : "Mark read"}
                  </button>
                  <button className="ghost" onClick={() => handleMessageStatus(msg.id, msg.repliedAt ? { replied: false } : { replied: true, read: true })} style={{ fontSize: "0.8rem" }}>
                    {msg.repliedAt ? "Unmark replied" : "Mark replied"}
                  </button>
                  {replyTarget === msg.id && (
                    <div style={{ display: "grid", gap: 6, width: 260 }}>
                      <textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder={`Reply to ${msg.name}...`}
                        rows={4}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(16,24,32,0.15)", background: "var(--surface-card-solid)", fontSize: "0.85rem", resize: "vertical" }}
                      />
                      <button className="primary" onClick={() => handleSendReply(msg.id)} disabled={!replyText.trim() || sendingReply} style={{ fontSize: "0.8rem", padding: "8px 14px" }}>
                        {sendingReply ? "Sending..." : "Send reply"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === "audit" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {!auditLoaded ? <p className="muted">Loading audit log...</p> : auditActions.length === 0 ? (
            <p className="muted">No admin actions recorded yet. Erase/anonymize operations on users will appear here.</p>
          ) : (
            auditActions.map((action) => (
              <div key={action.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "var(--surface-card-solid)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>
                    <span className="chip" style={{ background: action.action === "erase" ? "var(--coral)" : TINTS.teal20, color: action.action === "erase" ? "white" : "inherit", marginRight: 8 }}>
                      {action.action}
                    </span>
                    by {action.adminUserId.slice(0, 10)}... → {action.targetUserId.slice(0, 10)}...
                  </p>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    {formatDate(action.createdAt)} · {action.deletedCount} deleted{action.action === "anonymize" ? ` · ${action.anonymizedCount} anonymized` : ""}
                    {action.errorCount > 0 ? ` · ⚠ ${action.errorCount} errors` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === "spotlight" ? (
        <div style={{ display: "grid", gap: 16 }}>
          {!spotlightsLoaded ? (
            <p className="muted">Loading spotlights...</p>
          ) : (
            <>
              <form className="card" onSubmit={handleSaveSpotlight} style={{ padding: 20, display: "grid", gap: 12 }}>
                <p className="eyebrow">Feature a changemaker</p>
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: "0.9rem" }}>Title</label>
                  <input type="text" value={spotForm.title} onChange={(event) => setSpotForm({ ...spotForm, title: event.target.value })} placeholder="e.g. Maya's river clean-up" required />
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: "0.9rem" }}>Blurb (one or two sentences)</label>
                  <textarea value={spotForm.blurb} onChange={(event) => setSpotForm({ ...spotForm, blurb: event.target.value })} placeholder="What this changemaker or project is doing." required style={{ minHeight: 80 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: "0.9rem" }}>Profile link (optional)</label>
                    <input type="text" value={spotForm.profileUrl} onChange={(event) => setSpotForm({ ...spotForm, profileUrl: event.target.value })} placeholder="/profile/..." />
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: "0.9rem" }}>Project link (optional)</label>
                    <input type="text" value={spotForm.projectUrl} onChange={(event) => setSpotForm({ ...spotForm, projectUrl: event.target.value })} placeholder="/projects/..." />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                    Strand
                    <select value={spotForm.strand} onChange={(event) => setSpotForm({ ...spotForm, strand: event.target.value })} style={{ padding: "8px 10px" }}>
                      <option value="">Any</option>
                      <option value="N">Nature</option>
                      <option value="E">Economy</option>
                      <option value="S">Society</option>
                      <option value="W">Wellbeing</option>
                    </select>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                    <input type="checkbox" checked={spotForm.active} onChange={(event) => setSpotForm({ ...spotForm, active: event.target.checked })} style={{ width: 18, height: 18 }} />
                    Activate now (replaces the current one)
                  </label>
                  <button className="primary" type="submit">Save spotlight</button>
                </div>
              </form>

              {spotlights.length === 0 ? (
                <p className="muted">No spotlights yet. Create the first one above.</p>
              ) : (
                spotlights.map((spot) => (
                  <div key={spot.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "var(--surface-card-solid)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600 }}>
                        {spot.active && <span className="chip" style={{ background: TINTS.teal20, marginRight: 8 }}>Active</span>}
                        {spot.title}
                      </p>
                      <p className="muted" style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spot.blurb}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="ghost" onClick={() => handleToggleSpotlight(spot)} style={{ fontSize: "0.8rem" }}>
                        {spot.active ? "Deactivate" : "Activate"}
                      </button>
                      <button className="ghost" onClick={() => handleDeleteSpotlight(spot.id)} style={{ color: "var(--coral)", fontSize: "0.8rem" }} title="Delete spotlight">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.length === 0 ? <p className="muted">No posts found.</p> : (
            posts.map((post) => (
              <div key={post.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "var(--surface-card-solid)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</p>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>by {post.author_name} · {post.likes_count} likes · {post.comments_count} comments</p>
                </div>
                <button className="ghost" onClick={() => handleDeletePost(post.id)} style={{ color: "var(--coral)", fontSize: "0.85rem" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </motion.section>
  );
}
