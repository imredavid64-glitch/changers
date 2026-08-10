"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, listDocuments, updateDocument } from "@/lib/appwrite/bridge";
import { account, Query } from "@/lib/appwrite/client";
import type { ContactMessageRecord } from "@/lib/contact/server";
import type { AdminActionRecord } from "@/lib/audit/server";
import { anonymizeUserData, eraseUserData } from "@/lib/userdata/client";
import { AppPost, AppProfile } from "@/lib/social/types";
import { normalizePost, normalizeProfile } from "@/lib/social/utils";

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiles" | "posts" | "messages" | "audit">("profiles");
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [auditActions, setAuditActions] = useState<AdminActionRecord[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [eraseTarget, setEraseTarget] = useState<string | null>(null);
  const [eraseConfirmText, setEraseConfirmText] = useState("");
  const [eraseMode, setEraseMode] = useState<"delete" | "anonymize">("delete");

  const isAdmin = profile?.is_admin === true;

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }

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
      void loadAuditActions();
    }
  }, [activeTab, auditLoaded, isAdmin]);

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
        </div>
      </div>

      {status && <p className="notice" style={{ marginBottom: 16 }}>{status}</p>}

      {loading ? (
        <p className="muted">Loading admin data...</p>
      ) : activeTab === "profiles" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {profiles.length === 0 ? <p className="muted">No users found.</p> : (
            profiles.map((prof) => (
              <div key={prof.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "white" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600 }}>{prof.full_name} {prof.is_admin && <span className="chip">Admin</span>}</p>
                  <p className="muted" style={{ fontSize: "0.85rem" }}>{prof.role} · {prof.id.slice(0, 12)}...</p>
                </div>
                {eraseTarget === prof.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={eraseMode}
                      onChange={(event) => setEraseMode(event.target.value === "anonymize" ? "anonymize" : "delete")}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(16,24,32,0.15)", background: "white", fontSize: "0.8rem" }}
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
                      style={{ width: 110, padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(255,111,79,0.4)", background: "white", fontSize: "0.8rem" }}
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
              <div key={msg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "white" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>
                    {msg.name}{" "}
                    <a href={`mailto:${msg.email}`} style={{ color: "var(--teal)", fontSize: "0.85rem" }}>{msg.email}</a>
                    {msg.organization && <span className="muted" style={{ fontSize: "0.85rem" }}> · {msg.organization}</span>}
                    {msg.repliedAt ? (
                      <span className="chip" style={{ marginLeft: 8, background: "rgba(44,138,125,0.2)" }}>Replied</span>
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
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(16,24,32,0.15)", background: "white", fontSize: "0.85rem", resize: "vertical" }}
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
              <div key={action.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "white" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>
                    <span className="chip" style={{ background: action.action === "erase" ? "var(--coral)" : "rgba(44,138,125,0.2)", color: action.action === "erase" ? "white" : "inherit", marginRight: 8 }}>
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
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.length === 0 ? <p className="muted">No posts found.</p> : (
            posts.map((post) => (
              <div key={post.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(16,24,32,0.08)", background: "white" }}>
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
