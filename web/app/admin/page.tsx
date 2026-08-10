"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, listDocuments, updateDocument } from "@/lib/appwrite/bridge";
import { account, Query } from "@/lib/appwrite/client";
import type { ContactMessageRecord } from "@/lib/contact/server";
import { eraseUserData } from "@/lib/userdata/client";
import { AppPost, AppProfile } from "@/lib/social/types";
import { normalizePost, normalizeProfile } from "@/lib/social/utils";

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiles" | "posts" | "messages">("profiles");
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [eraseTarget, setEraseTarget] = useState<string | null>(null);
  const [eraseConfirmText, setEraseConfirmText] = useState("");

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
      const result = await eraseUserData(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      setStatus(`${result.message} (${result.deleted} items deleted).`);
      if (result.errors.length > 0) {
        console.error("Erase errors:", result.errors);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to erase user data.");
    } finally {
      setEraseTarget(null);
      setEraseConfirmText("");
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
                    <input
                      type="text"
                      value={eraseConfirmText}
                      onChange={(event) => setEraseConfirmText(event.target.value)}
                      placeholder='Type "DELETE"'
                      style={{ width: 110, padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(255,111,79,0.4)", background: "white", fontSize: "0.8rem" }}
                    />
                    <button className="primary" onClick={() => handleEraseUser(prof.id)} disabled={eraseConfirmText !== "DELETE"} style={{ fontSize: "0.8rem", padding: "8px 14px" }}>
                      Confirm erase
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
                      <button className="ghost" onClick={() => { setEraseConfirmText(""); setEraseTarget(prof.id); }} style={{ fontSize: "0.85rem", color: "var(--coral)" }} title="Permanently delete this user's data and account">
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
                  </p>
                  {msg.subject && <p style={{ fontWeight: 600, fontSize: "0.9rem", marginTop: 4 }}>{msg.subject}</p>}
                  <p className="muted" style={{ fontSize: "0.9rem", marginTop: 4, whiteSpace: "pre-wrap" }}>{msg.message}</p>
                  <p className="muted" style={{ fontSize: "0.75rem", marginTop: 6 }}>
                    {formatDate(msg.createdAt)} · {msg.userId ? "signed in" : "anonymous"}
                    {msg.pagePath ? ` · from ${msg.pagePath}` : ""}
                  </p>
                </div>
                <a className="ghost" href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || "Your message to Changers")}`} style={{ fontSize: "0.85rem", flexShrink: 0 }}>
                  Reply
                </a>
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
