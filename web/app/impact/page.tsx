"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, Users } from "lucide-react";
import { COLLECTIONS, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppPost } from "@/lib/social/types";
import { STRAND_LABELS, STRAND_OPTIONS, normalizePost } from "@/lib/social/utils";

export default function ImpactPage() {
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.posts,
      [Query.orderDesc("created_at_ms"), Query.limit(200)],
      (document) => normalizePost(document.$id, document),
      (loadedPosts) => {
        setPosts(loadedPosts);
        setStatus(null);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setPosts([]);
        setStatus("Impact data could not load. Check your Appwrite configuration.");
        setLoading(false);
      },
    );
  }, []);

  const totalPosts = posts.length;
  const totalReactions = posts.reduce((sum, post) => sum + post.likes_count + post.comments_count, 0);
  const activeAuthors = new Set(posts.map((post) => post.author_id)).size;
  const strandCards = STRAND_OPTIONS.map((strand) => {
    const strandPosts = posts.filter((post) => post.strand === strand.value);
    const strandEngagement = strandPosts.reduce(
      (sum, post) => sum + post.likes_count + post.comments_count,
      0,
    );

    return {
      ...strand,
      count: strandPosts.length,
      engagement: strandEngagement,
      percentage: totalPosts === 0 ? 0 : Math.round((strandPosts.length / totalPosts) * 100),
    };
  });

  const dominant = [...strandCards].sort((a, b) => b.count - a.count)[0];

  return (
    <motion.section
      className="card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="section-header">
        <div>
          <h2>
            Impact Map <Activity size={24} style={{ display: "inline", marginLeft: 8, color: "var(--moss)", verticalAlign: "middle" }} />
          </h2>
          <p className="muted">A live view of which strands are attracting the most energy and discussion.</p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="mini-card">
          <p className="meta-label">Active posts</p>
          <p className="meta-value">{totalPosts}</p>
        </div>
        <div className="mini-card">
          <p className="meta-label">Community reactions</p>
          <p className="meta-value">{totalReactions}</p>
        </div>
        <div className="mini-card">
          <p className="meta-label">Active creators</p>
          <p className="meta-value">{activeAuthors}</p>
        </div>
        <div className="mini-card">
          <p className="meta-label">Dominant strand</p>
          <p className="meta-value">{dominant ? STRAND_LABELS[dominant.value] : "None yet"}</p>
        </div>
      </div>

      <div className="impact-grid">
        {loading ? (
          <p className="muted">Calculating live impact...</p>
        ) : status ? (
          <p className="notice">{status}</p>
        ) : (
          strandCards.map((strand, index) => (
            <motion.div
              className="impact-card"
              key={strand.value}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.06, duration: 0.25 }}
              style={{ background: "var(--surface-card-solid)" }}
            >
              <p className="impact-label">{strand.label}</p>
              <p className="impact-value" style={{ fontSize: "2rem", marginTop: 10 }}>{strand.count}</p>
              <p className="muted" style={{ marginBottom: 12 }}>{strand.description}</p>
              <div className="progress">
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${strand.percentage}%` }} />
                </div>
              </div>
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>
                {strand.percentage}% of live posts · {strand.engagement} reactions
              </p>
            </motion.div>
          ))
        )}
      </div>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        <div className="bridge-results">
          <p style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 6 }}>
            <TrendingUp size={18} /> What this means
          </p>
          <p className="muted">
            The Impact Map is driven by what people actually post, react to, and discuss. It becomes more informative as the network grows.
          </p>
        </div>
        <div className="bridge-results">
          <p style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 6 }}>
            <Users size={18} /> Healthy signal
          </p>
          <p className="muted">
            A balanced network usually shows multiple strands moving at once, with strong comment activity rather than only likes.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
