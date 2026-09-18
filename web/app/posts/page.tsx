"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, PenLine, Video } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PostCard } from "@/components/PostCard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import SpotlightCard from "@/components/SpotlightCard";
import { COLLECTIONS, createDocument, publicReadOwnerWritePermissions, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppPost, Strand } from "@/lib/social/types";
import { STRAND_LABELS, STRAND_OPTIONS, buildSearchIndex, normalizePost, parseTagInput } from "@/lib/social/utils";
import { FeedTab, sortPostsForTab } from "@/lib/social/feed";
import { uploadMediaAsset } from "@/lib/media/client";
import { refreshBadges } from "@/lib/badges/refresh";
import { TINTS } from "@/lib/theme/tints";

export default function PostsFeedPage() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FeedTab>("latest");
  const [strandFilter, setStrandFilter] = useState<Strand | "all">("all");
  const [isComposing, setIsComposing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isPoll, setIsPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionA, setPollOptionA] = useState("");
  const [pollOptionB, setPollOptionB] = useState("");

  // The URL is an external system: adopt tab/strand params on load and when the URL
  // changes. A render-time adjustment would re-derive from the URL on every render and
  // fight the user's own tab clicks, which must win until the URL actually changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["for-you", "following", "latest", "trending"].includes(tabParam)) {
      setTab(tabParam as FeedTab);
    }
    const strandParam = searchParams.get("strand");
    if (strandParam && ["N", "E", "S", "W"].includes(strandParam)) {
      setStrandFilter(strandParam as Strand);
    }
  }, [searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const preferredStrands = useMemo(
    () => (profile?.interests?.length ? profile.interests : ["S"]) as Strand[],
    [profile],
  );

  useEffect(() => {
    if (!user) return;

    const unsubscribePosts = watchDocuments(
      COLLECTIONS.posts,
      [Query.orderDesc("created_at_ms"), Query.limit(100)],
      (document) => normalizePost(document.$id, document),
      (loadedPosts) => {
        setPosts(loadedPosts);
        setLoading(false);
      },
      (watchError) => {
        setError("Failed to load the feed. Please try again.");
        setLoading(false);
        console.error(watchError);
      },
    );

    const unsubscribeFollows = watchDocuments(
      COLLECTIONS.follows,
      [Query.equal("follower_id", user.$id), Query.limit(500)],
      (document) => String(document.followee_id || ""),
      (ids) => setFollowingIds(ids.filter(Boolean)),
      () => setFollowingIds([]),
    );

    return () => { unsubscribePosts(); unsubscribeFollows(); };
  }, [user]);

  function resetComposer() {
    setImageFile(null);
    setVideoFile(null);
    setIsPoll(false);
    setPollQuestion("");
    setPollOptionA("");
    setPollOptionB("");
  }

  async function handleCreatePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { setStatus("Sign in to post."); return; }
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    const strand = String(formData.get("strand") || "S") as Strand;
    const tags = parseTagInput(String(formData.get("tags") || ""));
    if (!title) { setStatus("Add a title to your post."); return; }

    if (isPoll && (!pollQuestion.trim() || !pollOptionA.trim() || !pollOptionB.trim())) {
      setStatus("Add a poll question and at least two options.");
      return;
    }

    setPublishing(true);
    setStatus(null);

    try {
      const now = Date.now();
      const authorName = profile?.full_name || user.name || "Changemaker";

      let uploadedImageUrl = "";
      let uploadedImageMediaId = "";
      let uploadedImageStorageKey = "";
      if (imageFile) {
        const uploaded = await uploadMediaAsset(imageFile, { purpose: "post", visibility: "public" });
        uploadedImageUrl = uploaded.publicUrl;
        uploadedImageMediaId = uploaded.mediaId;
        uploadedImageStorageKey = uploaded.storageKey;
      }

      let uploadedVideoUrl = "";
      let uploadedVideoMediaId = "";
      let uploadedVideoStorageKey = "";
      if (videoFile) {
        const uploaded = await uploadMediaAsset(videoFile, { purpose: "post", visibility: "public" });
        uploadedVideoUrl = uploaded.publicUrl;
        uploadedVideoMediaId = uploaded.mediaId;
        uploadedVideoStorageKey = uploaded.storageKey;
      }

      await createDocument(
        COLLECTIONS.posts,
        {
          title, body, strand, tags,
          author_id: user.$id,
          author_name: authorName,
          author_role: profile?.role || "Community member",
          image_url: uploadedImageUrl,
          image_media_id: uploadedImageMediaId,
          image_media_storage_key: uploadedImageStorageKey,
          video_url: uploadedVideoUrl,
          video_media_id: uploadedVideoMediaId,
          video_media_storage_key: uploadedVideoStorageKey,
          is_poll: isPoll,
          poll_question: isPoll ? pollQuestion.trim() : "",
          poll_options: isPoll ? [pollOptionA.trim(), pollOptionB.trim()] : [],
          poll_votes: "{}",
          likes: [],
          likes_count: 0,
          comments_count: 0,
          search_index: buildSearchIndex([title, body, authorName, STRAND_LABELS[strand], tags]),
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadOwnerWritePermissions(user.$id),
      );
      event.currentTarget.reset();
      resetComposer();
      setIsComposing(false);
      setStatus("Your post is live.");
      void refreshBadges(user.$id).then((badgeResult) => {
        if (badgeResult?.newlyAwarded?.length) {
          const badge = badgeResult.newlyAwarded[0];
          setStatus(`🏆 Badge earned: ${badge.badge_name}!`);
        }
      });
    } catch (createError) {
      setStatus("Posting failed. Please try again.");
      console.error(createError);
    } finally {
      setPublishing(false);
    }
  }

  const postsVisible = useMemo(() => {
    if (!user) return [];
    const strandFiltered = strandFilter === "all" ? posts : posts.filter((post) => post.strand === strandFilter);
    return sortPostsForTab(strandFiltered, tab, { userId: user.$id, followingIds, preferredStrands: preferredStrands });
  }, [posts, tab, user, followingIds, preferredStrands, strandFilter]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Feed</h1>
          <p className="muted">Sign in to view and share posts from the community.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Community</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Home Feed</h1>
        </div>
        <button className="primary" onClick={() => setIsComposing(!isComposing)}>
          {isComposing ? "Close" : <><PenLine size={16} style={{ marginRight: 6 }} /> Compose</>}
        </button>
      </div>

      <SpotlightCard />

      <OnboardingChecklist />

      {isComposing && (
        <form className="composer-form card" onSubmit={handleCreatePost} style={{ padding: 20 }}>
          <input type="text" name="title" placeholder="Post title" required />
          <div style={{ minHeight: 12 }} />
          <textarea name="body" placeholder="Share progress, ask for collaborators, or tell the story behind the work." style={{ minHeight: 120 }} />

          <div className="button-row" style={{ flexWrap: "wrap", marginTop: 12 }}>
            <label
              className="ghost"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", margin: 0 }}
            >
              <ImagePlus size={16} />
              {imageFile ? "Image attached" : "Add image"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </label>
            <label
              className="ghost"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", margin: 0 }}
            >
              <Video size={16} />
              {videoFile ? "Video attached" : "Add video"}
              <input
                type="file"
                accept="video/*"
                style={{ display: "none" }}
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              type="button"
              className={isPoll ? "primary" : "ghost"}
              onClick={() => setIsPoll(!isPoll)}
            >
              {isPoll ? "Poll on" : "Add poll"}
            </button>
          </div>

          {isPoll && (
            <div className="composer-form" style={{ padding: 12, background: TINTS.teal5, borderRadius: 14, display: "grid", gap: 8 }}>
              <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question" />
              <input type="text" value={pollOptionA} onChange={(e) => setPollOptionA(e.target.value)} placeholder="Option A" />
              <input type="text" value={pollOptionB} onChange={(e) => setPollOptionB(e.target.value)} placeholder="Option B" />
            </div>
          )}

          <div className="composer-actions">
            <div className="button-row" style={{ flexWrap: "wrap" }}>
              <select name="strand" defaultValue="S">
                {STRAND_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input type="text" name="tags" placeholder="Tags, comma separated" style={{ minWidth: 220 }} />
              <button className="primary" type="submit" disabled={publishing}>
                {publishing ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
          {status && <p style={{ color: "var(--moss)", fontSize: "0.85rem", marginTop: 8 }}>{status}</p>}
        </form>
      )}

      <div className="filter-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["latest", "trending", "following", "for-you"] as FeedTab[]).map((feedTab) => (
          <button
            key={feedTab}
            className={`filter ${tab === feedTab ? "active" : ""}`}
            onClick={() => setTab(feedTab)}
          >
            {feedTab}
          </button>
        ))}
      </div>

      <div className="filter-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className={`filter ${strandFilter === "all" ? "active" : ""}`}
          onClick={() => setStrandFilter("all")}
        >
          All strands
        </button>
        {STRAND_OPTIONS.map((s) => (
          <button
            key={s.value}
            className={`filter ${strandFilter === s.value ? "active" : ""}`}
            onClick={() => setStrandFilter(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="muted">{error}</p>}
      {loading && <p className="muted" style={{ padding: 32 }}>Loading the feed...</p>}
      {!loading && postsVisible.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>💚</div>
          <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 8 }}>No posts here yet</h3>
          <p className="muted" style={{ marginBottom: 20 }}>
            Be the first to share a project, idea, or update with the community.
          </p>
          <button className="primary" onClick={() => setIsComposing(true)} style={{ padding: "10px 24px", borderRadius: 999 }}>
            Write the first post
          </button>
        </div>
      )}

      <div className="feed" style={{ display: "grid", gap: 16 }}>
        {postsVisible.map((post) => (
          <PostCard key={post.id} post={post} user={user} />
        ))}
      </div>
    </div>
  );
}