"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Trash2, UserX } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, getDocument, listDocuments, updateDocument } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppPost, AppProfile } from "@/lib/social/types";
import { normalizePost, normalizeProfile } from "@/lib/social/utils";

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiles" | "posts">("profiles");

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
                <button className="ghost" onClick={() => handleToggleAdmin(prof.id, prof.is_admin)} style={{ fontSize: "0.85rem" }}>
                  {prof.is_admin ? "Remove admin" : "Make admin"}
                </button>
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
