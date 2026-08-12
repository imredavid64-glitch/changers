"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Models } from "appwrite";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, CheckSquare, Edit3, Heart, MessageCircle, Send, Share2, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  deleteDocument,
  privateReadWritePermissions,
  publicReadOwnerWritePermissions,
  updateDocument,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppComment, AppPost } from "@/lib/social/types";
import {
  STRAND_LABELS,
  formatRelativeTime,
  getDisplayName,
  normalizeComment,
} from "@/lib/social/utils";

interface PostCardProps {
  post: AppPost;
  user: Models.User<Models.Preferences> | null;
  insight?: string;
  defaultCommentsOpen?: boolean;
  onDelete?: (postId: string) => void;
  onUpdate?: (post: AppPost) => void;
}

function getAvatarFallback(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function PostCard({
  post,
  user,
  insight,
  defaultCommentsOpen = false,
  onDelete,
  onUpdate,
}: PostCardProps) {
  const { profile: currentProfile } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || post.likes.length);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(defaultCommentsOpen);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pollVotes, setPollVotes] = useState<Record<string, string[]>>(post.poll_votes);
  const [userPollVote, setUserPollVote] = useState<string | null>(null);
  const isPostAuthor = Boolean(user && post.author_id === user.$id);

  // Sync optimistic counters when the post (or signed-in user) changes, without
  // clobbering in-flight optimistic updates between renders.
  const [prevPostSyncKey, setPrevPostSyncKey] = useState("");
  const postSyncKey = `${user?.$id ?? ""}:${post.id}`;
  if (postSyncKey !== prevPostSyncKey) {
    setPrevPostSyncKey(postSyncKey);
    setLikesCount(post.likes_count || post.likes.length);
    setCommentsCount(post.comments_count || 0);
    setIsLiked(Boolean(user && post.likes.includes(user.$id)));
  }

  // Reset the saved-state only when the user transitions to signed-out; while signed
  // in the subscription callback owns these values end-to-end.
  const [prevSavedUserId, setPrevSavedUserId] = useState<string | null>(user?.$id ?? null);
  const savedUserId = user?.$id ?? null;
  if (savedUserId !== prevSavedUserId) {
    setPrevSavedUserId(savedUserId);
    if (savedUserId === null) {
      setIsSaved(false);
      setSavedDocId(null);
    }
  }

  useEffect(() => {
    if (!user) return;

    return watchDocuments(
      COLLECTIONS.savedPosts,
      [Query.equal("user_id", user.$id), Query.equal("post_id", post.id), Query.limit(1)],
      (document) => document,
      (documents) => {
        const saved = documents[0];
        setIsSaved(Boolean(saved));
        setSavedDocId(saved?.$id || null);
      },
      () => {
        setIsSaved(false);
        setSavedDocId(null);
      },
    );
  }, [post.id, user]);

  useEffect(() => {
    if (!showComments) return;

    return watchDocuments(
      COLLECTIONS.comments,
      [
        Query.equal("post_id", post.id),
        Query.orderAsc("created_at_ms"),
        Query.limit(200),
      ],
      (document) => normalizeComment(document.$id, document),
      setComments,
      () => setComments([]),
    );
  }, [post.id, showComments]);

  async function toggleLike() {
    if (!user) {
      setNotice("Sign in to react to posts.");
      return;
    }

    const nextLikes = isLiked
      ? post.likes.filter((likeId) => likeId !== user.$id)
      : [...new Set([...post.likes, user.$id])];
    const nextLikesCount = nextLikes.length;

    setNotice(null);
    setIsLiked(!isLiked);
    setLikesCount(nextLikesCount);

    try {
      await updateDocument(COLLECTIONS.posts, post.id, {
        likes: nextLikes,
        likes_count: nextLikesCount,
        updated_at_ms: Date.now(),
      });

      if (!isLiked && post.author_id !== user.$id) {
        await createDocument(
          COLLECTIONS.notifications,
          {
            user_id: post.author_id,
            type: "like",
            actor_name: currentProfile?.full_name || getDisplayName(user),
            actor_id: user.$id,
            post_id: post.id,
            room_id: "",
            read: false,
            message: `${currentProfile?.full_name || getDisplayName(user)} applauded your post.`,
            created_at_ms: Date.now(),
          },
          privateReadWritePermissions(post.author_id),
        );
      }
    } catch (error) {
      setIsLiked((prev) => !prev);
      setLikesCount(post.likes_count || post.likes.length);
      setNotice("We couldn't update your reaction just now.");
      console.error(error);
    }
  }

  async function toggleSave() {
    if (!user) {
      setNotice("Sign in to save posts.");
      return;
    }

    try {
      if (isSaved && savedDocId) {
        await deleteDocument(COLLECTIONS.savedPosts, savedDocId);
        setNotice("Post removed from saved posts.");
      } else {
        await createDocument(
          COLLECTIONS.savedPosts,
          {
            user_id: user.$id,
            post_id: post.id,
            author_id: post.author_id,
            strand: post.strand,
            created_at_ms: Date.now(),
          },
          privateReadWritePermissions(user.$id),
        );
        setNotice("Post saved to your profile.");
      }
    } catch (error) {
      setNotice("We couldn't update your saved posts right now.");
      console.error(error);
    }
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !newComment.trim()) return;

    const text = newComment.trim();
    setNewComment("");
    setNotice(null);

    try {
      await createDocument(
        COLLECTIONS.comments,
        {
          post_id: post.id,
          author_id: user.$id,
          author_name: currentProfile?.full_name || getDisplayName(user),
          author_avatar_file_id: currentProfile?.avatar_file_id || "",
          author_avatar_media_id: currentProfile?.avatar_media_id || "",
          author_avatar_media_storage_key: currentProfile?.avatar_media_storage_key || "",
          author_avatar_media_url: currentProfile?.avatar_media_url || "",
          author_avatar_url: currentProfile?.avatar_url || "",
          text,
          created_at_ms: Date.now(),
        },
        publicReadOwnerWritePermissions(user.$id),
      );

      const nextCommentCount = commentsCount + 1;
      setCommentsCount(nextCommentCount);

      await updateDocument(COLLECTIONS.posts, post.id, {
        comments_count: nextCommentCount,
        updated_at_ms: Date.now(),
      });

      if (post.author_id !== user.$id) {
        await createDocument(
          COLLECTIONS.notifications,
          {
            user_id: post.author_id,
            type: "comment",
            actor_name: currentProfile?.full_name || getDisplayName(user),
            actor_id: user.$id,
            post_id: post.id,
            room_id: "",
            read: false,
            message: `${currentProfile?.full_name || getDisplayName(user)} commented on your post.`,
            created_at_ms: Date.now(),
          },
          privateReadWritePermissions(post.author_id),
        );
      }
    } catch (error) {
      setNotice("We couldn't send your comment right now.");
      console.error(error);
    }
  }

  async function copyLink() {
    const permalink =
      typeof window === "undefined"
        ? `/posts/${post.id}`
        : `${window.location.origin}/posts/${post.id}`;

    try {
      await navigator.clipboard.writeText(permalink);
      setNotice("Post link copied.");
    } catch (error) {
      setNotice("Copy failed. You can still open the post and copy the URL.");
      console.error(error);
    }
  }

  async function handleEditPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || editTitle.trim().length < 4 || editBody.trim().length < 20) {
      setNotice("Title needs at least 4 characters, body at least 20.");
      return;
    }

    try {
      await updateDocument(COLLECTIONS.posts, post.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
        updated_at_ms: Date.now(),
      });
      setNotice("Post updated.");
      setIsEditing(false);
      if (onUpdate) {
        onUpdate({ ...post, title: editTitle.trim(), body: editBody.trim() });
      }
    } catch (error) {
      setNotice("Failed to update post.");
      console.error(error);
    }
  }

  async function handleDeletePost() {
    if (!user) return;
    try {
      await deleteDocument(COLLECTIONS.posts, post.id);
      setNotice("Post deleted.");
      if (onDelete) onDelete(post.id);
    } catch (error) {
      setNotice("Failed to delete post.");
      console.error(error);
    }
  }

  function handleVotePoll(optionIndex: string) {
    if (!user) {
      setNotice("Sign in to vote.");
      return;
    }
    if (userPollVote) return;
    const optionLabel = post.poll_options[Number(optionIndex)];
    if (!optionLabel) return;

    const nextVotes = { ...pollVotes };
    const voters = [...(nextVotes[optionLabel] || []), user.$id];
    nextVotes[optionLabel] = voters;
    setPollVotes(nextVotes);
    setUserPollVote(optionLabel);

    updateDocument(COLLECTIONS.posts, post.id, {
      poll_votes: nextVotes,
      updated_at_ms: Date.now(),
    }).catch(() => {
      setPollVotes(post.poll_votes);
      setUserPollVote(null);
    });

    if (post.author_id !== user.$id) {
      createDocument(
        COLLECTIONS.notifications,
        {
          user_id: post.author_id,
          type: "poll_vote",
          actor_name: currentProfile?.full_name || getDisplayName(user),
          actor_id: user.$id,
          post_id: post.id,
          read: false,
          message: `${currentProfile?.full_name || getDisplayName(user)} voted in your poll.`,
          created_at_ms: Date.now(),
        },
        privateReadWritePermissions(post.author_id),
      ).catch(() => {});
    }
  }

  return (
    <motion.article
      className="post card"
      data-strand={post.strand}
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.25 }}
    >
      <div className="post-header" style={{ alignItems: "flex-start", gap: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {post.author_avatar_url ? (
            <Image
              src={post.author_avatar_url}
              alt={post.author_name}
              width={48}
              height={48}
              unoptimized
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                objectFit: "cover",
                border: "1px solid rgba(16, 24, 32, 0.08)",
              }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(120deg, color-mix(in srgb, var(--teal) 18%, transparent), color-mix(in srgb, var(--sun) 22%, transparent))",
                color: "var(--moss)",
                fontWeight: 700,
              }}
            >
              {getAvatarFallback(post.author_name)}
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/profile/${post.author_id}`} className="post-author">
                {post.author_name}
              </Link>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {formatRelativeTime(post.created_at)}
              </span>
            </div>
            <p className="post-role">{post.author_role}</p>
            {insight && (
              <p
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--moss)",
                  background: "color-mix(in srgb, var(--teal) 12%, transparent)",
                }}
              >
                {insight}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="strand">{STRAND_LABELS[post.strand]}</span>
          <Link
            href={`/posts/${post.id}`}
            className="muted"
            style={{ fontSize: "0.85rem", fontWeight: 600 }}
          >
            View post
          </Link>
          {isPostAuthor && (
            <>
              <button className="ghost" onClick={() => setIsEditing(!isEditing)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>
                <Edit3 size={14} />
              </button>
              {showDeleteConfirm ? (
                <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <button className="primary" onClick={handleDeletePost} style={{ padding: "4px 8px", fontSize: "0.75rem" }}>Confirm</button>
                  <button className="ghost" onClick={() => setShowDeleteConfirm(false)} style={{ padding: "4px 8px", fontSize: "0.75rem" }}>Cancel</button>
                </span>
              ) : (
                <button className="ghost" onClick={() => setShowDeleteConfirm(true)} style={{ padding: "4px 8px", fontSize: "0.8rem", color: "var(--coral)" }}>
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleEditPost} style={{ display: "grid", gap: 12 }}>
          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} required style={{ fontWeight: 700, fontSize: "1.1rem" }} />
          <textarea value={editBody} onChange={e => setEditBody(e.target.value)} required style={{ minHeight: 100 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="primary">Save</button>
            <button type="button" className="ghost" onClick={() => { setIsEditing(false); setEditTitle(post.title); setEditBody(post.body); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ fontSize: "1.25rem", lineHeight: 1.2 }}>{post.title}</h3>
          <p style={{ color: "var(--text-body)" }}>{post.body}</p>

          {post.image_url && (
            <Image
              src={post.image_url}
              alt={post.title}
              width={1400}
              height={900}
              unoptimized
              style={{
                width: "100%",
                maxHeight: 380,
                height: "auto",
                objectFit: "cover",
                borderRadius: 18,
                border: "1px solid rgba(16, 24, 32, 0.08)",
              }}
            />
          )}

          {post.video_url && (
            <video
              src={post.video_url}
              controls
              style={{
                width: "100%",
                maxHeight: 380,
                borderRadius: 18,
                border: "1px solid rgba(16, 24, 32, 0.08)",
              }}
            >
              Your browser does not support video playback.
            </video>
          )}

              {post.is_poll && post.poll_options.length > 0 && (<div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <p style={{ fontWeight: 700 }}>{post.poll_question || "Poll"}</p>
              {post.poll_options.map((option, idx) => {
                const voters = pollVotes[option] || [];
                const pollVoteCount = Object.values(pollVotes).reduce((s, v) => s + v.length, 0);
                const pct = pollVoteCount > 0 ? Math.round((voters.length / pollVoteCount) * 100) : 0;
                const voted = userPollVote === option;
                return (
                  <button
                    key={option}
                    onClick={() => handleVotePoll(String(idx))}
                    disabled={!!userPollVote && !voted}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: `1px solid ${voted ? "var(--teal)" : "rgba(16,24,32,0.12)"}`,
                      background: voted ? "color-mix(in srgb, var(--teal) 10%, transparent)" : "var(--cloud)",
                      cursor: userPollVote && !voted ? "default" : "pointer",
                      textAlign: "left",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      width: `${pct}%`,
                      background: "color-mix(in srgb, var(--teal) 8%, transparent)",
                      transition: "width 0.3s ease",
                    }} />
                    <span style={{ position: "relative", zIndex: 1, flex: 1, fontWeight: voted ? 700 : 400 }}>
                      {option}
                    </span>
                    {userPollVote && (
                      <span style={{ position: "relative", zIndex: 1, fontSize: "0.85rem", color: "var(--moss)", fontWeight: 600 }}>
                        {voters.length} ({pct}%)
                      </span>
                    )}
                    {voted && <CheckSquare size={16} color="var(--teal)" style={{ position: "relative", zIndex: 1 }} />}
                  </button>
                );
              })}
              {!!userPollVote && <p className="muted" style={{ fontSize: "0.85rem" }}>{Object.values(pollVotes).reduce((s, v) => s + v.length, 0)} total vote{Object.values(pollVotes).reduce((s, v) => s + v.length, 0) !== 1 ? "s" : ""}</p>}
            </div>
          )}

          {post.tags.length > 0 && (
            <div className="tag-row" style={{ marginTop: 0 }}>
              {post.tags.map((tag) => (
                <span className="tag" key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className="post-actions"
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid rgba(16, 24, 32, 0.08)",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="ghost"
            onClick={toggleLike}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: isLiked ? "var(--coral)" : "inherit",
              borderColor: isLiked ? "color-mix(in srgb, var(--coral) 30%, transparent)" : undefined,
              background: isLiked ? "color-mix(in srgb, var(--coral) 8%, transparent)" : undefined,
            }}
          >
            <Heart size={16} fill={isLiked ? "var(--coral)" : "none"} />
            {likesCount}
          </button>

          <button
            className="ghost"
            onClick={() => setShowComments((prev) => !prev)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <MessageCircle size={16} />
            {commentsCount}
          </button>

          <button
            className="ghost"
            onClick={toggleSave}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: isSaved ? "color-mix(in srgb, var(--teal) 8%, transparent)" : undefined,
              borderColor: isSaved ? "color-mix(in srgb, var(--teal) 20%, transparent)" : undefined,
            }}
          >
            <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
            {isSaved ? "Saved" : "Save"}
          </button>
        </div>

        <button
          className="ghost"
          onClick={copyLink}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Share2 size={16} />
          Share
        </button>
      </div>

      {notice && (
        <p className="notice" style={{ marginTop: 12 }}>
          {notice}
        </p>
      )}

      <AnimatePresence initial={false}>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", marginTop: 18 }}
          >
            <div
              style={{
                display: "grid",
                gap: 14,
                padding: 18,
                borderRadius: 18,
                background: "rgba(253, 251, 247, 0.95)",
                border: "1px solid rgba(16, 24, 32, 0.06)",
              }}
            >
              <div style={{ display: "grid", gap: 12 }}>
                {comments.length === 0 ? (
                  <p className="muted">No comments yet. Start the conversation.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} style={{ display: "flex", gap: 12 }}>
                      {comment.author_avatar_url ? (
                        <Image
                          src={comment.author_avatar_url}
                          alt={comment.author_name}
                          width={36}
                          height={36}
                          unoptimized
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            objectFit: "cover",
                            border: "1px solid rgba(16, 24, 32, 0.08)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            display: "grid",
                            placeItems: "center",
                            background: "color-mix(in srgb, var(--teal) 14%, transparent)",
                            color: "var(--moss)",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {getAvatarFallback(comment.author_name)}
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <Link
                            href={`/profile/${comment.author_id}`}
                            style={{ fontWeight: 700, fontSize: "0.92rem" }}
                          >
                            {comment.author_name}
                          </Link>
                          <span className="muted" style={{ fontSize: "0.8rem" }}>
                            {formatRelativeTime(comment.created_at)}
                          </span>
                        </div>
                        <p style={{ marginTop: 4 }}>{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={submitComment} style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder={user ? "Add a thoughtful comment..." : "Sign in to comment"}
                  disabled={!user}
                  style={{ flex: 1, background: "var(--surface-card-solid)" }}
                />
                <button
                  type="submit"
                  className="primary"
                  disabled={!user || !newComment.trim()}
                  style={{
                    width: 46,
                    height: 46,
                    padding: 0,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
