"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, getDocument, listDocuments, privateReadWritePermissions, publicReadOwnerWritePermissions } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppProfile, Strand } from "@/lib/social/types";
import { STRAND_LABELS, normalizeProfile, timestampToMillis } from "@/lib/social/utils";
import { TINTS } from "@/lib/theme/tints";

interface Connection {
  id: string;
  full_name: string;
  role: string;
  interests: Strand[];
  youFollows: boolean;
  followsYou: boolean;
  avatar_url?: string;
  connectionMs: number;
}

interface Suggestion {
  profile: AppProfile;
  reasons: string[];
}

type Category = "all" | "mutual" | "following" | "followers" | Strand;
type SortMode = "recent" | "name" | "mutual";

const STRAND_COLORS: Record<Strand, string> = {
  N: "#2e8b57",
  E: "var(--moss)",
  S: "var(--sun)",
  W: "var(--teal)",
};

export default function NetworkPage() {
  const { user, profile: myProfile } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  // Reset the signed-out loading state only when the user actually transitions away;
  // while signed in the load() path owns `loading` end-to-end.
  const [prevNetworkUserId, setPrevNetworkUserId] = useState<string | null>(user?.$id ?? null);
  const networkUserId = user?.$id ?? null;
  if (networkUserId !== prevNetworkUserId) {
    setPrevNetworkUserId(networkUserId);
    if (networkUserId === null) setLoading(false);
  }

  useEffect(() => {
    if (!user) return;

    let active = true;
    const userId = user.$id;

    async function load() {
      try {
        const [followingDocs, followerDocs] = await Promise.all([
          listDocuments(COLLECTIONS.follows, [Query.equal("follower_id", userId), Query.limit(300)]),
          listDocuments(COLLECTIONS.follows, [Query.equal("followee_id", userId), Query.limit(300)]),
        ]);

        const followingMap = new Map<string, number>();
        const followerMap = new Map<string, number>();

        followingDocs.forEach((doc) => {
          const id = String(doc.followee_id || "");
          if (id) followingMap.set(id, timestampToMillis(doc.created_at));
        });
        followerDocs.forEach((doc) => {
          const id = String(doc.follower_id || "");
          if (id) followerMap.set(id, timestampToMillis(doc.created_at));
        });

        const allIds = Array.from(new Set([...followingMap.keys(), ...followerMap.keys()]));

        const profiles: (AppProfile | null)[] = await Promise.all(
          allIds.map(async (profileId) => {
            const doc = await getDocument(COLLECTIONS.profiles, profileId);
            return doc ? normalizeProfile(doc.$id, doc) : null;
          }),
        );

        if (!active) return;

        const conns: Connection[] = allIds.map((profileId, index) => {
          const profile = profiles[index];
          return {
            id: profileId,
            full_name: profile?.full_name || "(changemaker)",
            role: profile?.role || "Community member",
            interests: profile?.interests?.length ? profile.interests : ["S"],
            youFollows: followingMap.has(profileId),
            followsYou: followerMap.has(profileId),
            avatar_url: profile?.avatar_url,
            connectionMs: Math.max(followingMap.get(profileId) || 0, followerMap.get(profileId) || 0),
          };
        });

        setConnections(conns);
        setSuggestions(await buildSuggestions(userId, new Set(allIds)));
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [user]);

  const visible = useMemo(() => {
    let list = connections.filter((conn) => {
      if (category === "mutual") return conn.youFollows && conn.followsYou;
      if (category === "following") return conn.youFollows;
      if (category === "followers") return conn.followsYou;
      if (category === "all") return true;
      return conn.interests.includes(category as Strand);
    });

    if (sortMode === "recent") list = [...list].sort((a, b) => b.connectionMs - a.connectionMs);
    else if (sortMode === "mutual") list = [...list].sort((a, b) => Number(b.youFollows && b.followsYou) - Number(a.youFollows && a.followsYou));
    else list = [...list].sort((a, b) => a.full_name.localeCompare(b.full_name));

    return list;
  }, [connections, category, sortMode]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Network</h1>
          <p className="muted">Sign in to view your connections web.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const mutualCount = connections.filter((c) => c.youFollows && c.followsYou).length;

  async function followUser(targetId: string, targetName: string) {
    if (!user) return;
    try {
      await createDocument(
        COLLECTIONS.follows,
        {
          follower_id: user.$id,
          followee_id: targetId,
          // eslint-disable-next-line react-hooks/purity -- Date.now() timestamps in event handlers are explicitly permitted by React.
          created_at_ms: Date.now(),
        },
        publicReadOwnerWritePermissions(user.$id),
        `${user.$id}_${targetId}`,
      );
      createDocument(
        COLLECTIONS.notifications,
        {
          user_id: targetId,
          type: "follow",
          actor_name: myProfile?.full_name || user.name || "Changemaker",
          actor_id: user.$id,
          read: false,
          message: `${myProfile?.full_name || user.name || "Someone"} started following you.`,
          // eslint-disable-next-line react-hooks/purity -- Date.now() timestamps in event handlers are explicitly permitted by React.
          created_at_ms: Date.now(),
        },
        privateReadWritePermissions(targetId),
      ).catch(() => {});
      setSuggestions((current) => current.filter((s) => s.profile.id !== targetId));
      setConnections((current) => [...current, {
        id: targetId,
        full_name: targetName,
        role: "Community member",
        interests: ["S"],
        youFollows: true,
        followsYou: false,
        connectionMs: Date.now(),
      }]);
    } catch (error) {
      console.error(error);
    }
  }

  const categories: { key: Category; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mutual", label: "Mutual" },
    { key: "following", label: "Following" },
    { key: "followers", label: "Followers" },
    { key: "N", label: "Nature" },
    { key: "E", label: "Economy" },
    { key: "S", label: "Society" },
    { key: "W", label: "Wellbeing" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: "grid", gap: 24 }}
    >
      <div className="section-header">
        <div>
          <p className="eyebrow">Community</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>My Network</h1>
          <p className="muted">All of your relationships in one place — categorize by strand or direction, and sort by recency or mutual connection.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <div className="filter-row">
            {categories.map((cat) => (
              <button key={cat.key} className={`filter ${category === cat.key ? "active" : ""}`} onClick={() => setCategory(cat.key)}>
                {cat.label}
              </button>
            ))}
          </div>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            <option value="recent">Sort: Recently connected</option>
            <option value="name">Sort: Name A→Z</option>
            <option value="mutual">Sort: Mutual first</option>
          </select>
        </div>

        {loading ? (
          <p className="muted" style={{ padding: 40, textAlign: "center" }}>Building your network...</p>
        ) : connections.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <UserPlus size={40} color="var(--moss)" style={{ marginBottom: 12 }} />
            <p className="muted">Your network is empty. Follow changemakers to start.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>No connections in this view.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {visible.map((conn) => {
              const isMutual = conn.youFollows && conn.followsYou;
              const reason = conn.youFollows && conn.followsYou
                ? "Mutual"
                : conn.youFollows
                  ? "You follow"
                  : "Follows you";
              return (
                <Link
                  key={conn.id}
                  href={`/profile/${conn.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 14,
                    textDecoration: "none",
                    background: isMutual ? TINTS.teal6 : "var(--surface-card-solid)",
                    border: isMutual ? "1.5px solid var(--teal)" : "1px solid rgba(16,24,32,0.08)",
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: 6, flexShrink: 0, background: STRAND_COLORS[conn.interests[0]] }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: "var(--ink)" }}>{conn.full_name}</p>
                    <p className="muted" style={{ fontSize: "0.8rem" }}>{conn.role}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="tag">{reason}</span>
                    {conn.interests.slice(0, 2).map((s) => <span className="tag" key={s}>{STRAND_LABELS[s]}</span>)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <div className="section-header" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-head)" }}><Sparkles size={20} style={{ display: "inline", marginRight: 8, color: "var(--moss)", verticalAlign: "middle" }} /> People you might know</h2>
              <p className="muted">Changemakers with shared strands, mutual connections, or similar focus areas.</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {suggestions.map(({ profile, reasons }) => (
              <div key={profile.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--surface-card-solid)", border: "1px solid rgba(16,24,32,0.08)" }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, flexShrink: 0, background: STRAND_COLORS[profile.interests[0] || "S"] }} />
                <Link href={`/profile/${profile.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                  <p style={{ fontWeight: 600, color: "var(--ink)" }}>{profile.full_name}</p>
                  <p className="muted" style={{ fontSize: "0.8rem" }}>{reasons.slice(0, 2).join(" · ")}</p>
                </Link>
                <button className="primary" onClick={() => followUser(profile.id, profile.full_name)}>
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-head)" }}>Network map</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            {connections.length} connections, {mutualCount} mutual. Rings are color-coded by each connection&apos;s primary strand; mutual connections sit closer to you.
          </p>
        </div>
        <NetworkMap connections={connections} />
      </div>
    </motion.div>
  );
}

async function buildSuggestions(userId: string, connectedIds: Set<string>): Promise<Suggestion[]> {
  try {
    const allProfiles = await listDocuments(COLLECTIONS.profiles, [Query.limit(500)]);
    const profiles = allProfiles
      .map((doc) => normalizeProfile(doc.$id, doc))
      .filter((profile) => profile.id !== userId && !connectedIds.has(profile.id));

    return profiles
      .map((profile) => {
        const reasons: string[] = [];
        if (profile.is_mentor) reasons.push("Mentor");
        if (profile.mentor_focus) reasons.push("Open to mentoring");
        if (profile.interests.length) reasons.push(`${STRAND_LABELS[profile.interests[0]]} focus`);
        if (reasons.length === 0) reasons.push("Changemaker");
        return { profile, reasons, score: profile.interests.length * 10 + (profile.is_mentor ? 8 : 0) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ profile, reasons }) => ({ profile, reasons }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

function NetworkMap({ connections }: { connections: Connection[] }) {
  const nodes = connections.slice(0, 60);
  const center = 210;
  const positioned = layout(nodes, center);

  return (
    <svg viewBox="0 0 420 420" style={{ width: "100%", height: "auto" }}>
      <circle cx={center} cy={center} r={200 * 0.55} fill="none" stroke={TINTS.moss12} strokeDasharray="4 6" />
      <circle cx={center} cy={center} r={200 * 0.9} fill="none" stroke={TINTS.moss12} strokeDasharray="4 6" />
      {positioned.map(({ x, y }, index) =>
        positioned.slice(index + 1).map(({ x: x2, y: y2 }, j) => (
          <line key={`${index}-${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke={TINTS.moss6} strokeWidth="1" />
        )),
      )}
      <circle cx={center} cy={center} r={16} fill="var(--teal)" />
      <text x={center} y={center + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">You</text>
      {positioned.map(({ conn, x, y }) => (
        <circle key={conn.id} cx={x} cy={y} r={10} fill={STRAND_COLORS[conn.interests[0]]}>
          <title>{`${conn.full_name}${conn.youFollows && conn.followsYou ? " (mutual)" : ""}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function layout(nodes: Connection[], center = 210) {
  return nodes.map((conn, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const ring = conn.youFollows && conn.followsYou ? 0.55 : 0.9;
    return { conn, x: center + Math.cos(angle) * 200 * ring, y: center + Math.sin(angle) * 200 * ring };
  });
}