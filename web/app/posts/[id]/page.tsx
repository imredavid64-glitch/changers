"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PostCard } from "@/components/PostCard";
import { COLLECTIONS, watchDocument, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppPost } from "@/lib/social/types";
import { normalizePost } from "@/lib/social/utils";

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const postId = resolvedParams.id;
  const { user } = useAuth();

  const [post, setPost] = useState<AppPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return watchDocument(
      COLLECTIONS.posts,
      postId,
      (document) => normalizePost(document.$id, document),
      (nextPost) => {
        setPost(nextPost);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setPost(null);
        setLoading(false);
      },
    );
  }, [postId]);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.posts,
      [Query.orderDesc("created_at_ms"), Query.limit(18)],
      (document) => normalizePost(document.$id, document),
      (loadedPosts) => {
        setRelatedPosts(loadedPosts.filter((item) => item.id !== postId));
      },
      (error) => {
        console.error(error);
        setRelatedPosts([]);
      },
    );
  }, [postId]);

  if (loading) {
    return <p className="muted" style={{ padding: 32 }}>Loading post...</p>;
  }

  if (!post) {
    return (
      <section className="card">
        <h2>Post not found</h2>
        <p className="muted">This post may have been deleted or never existed.</p>
      </section>
    );
  }

  const sameStrandPosts = relatedPosts.filter((item) => item.strand === post.strand).slice(0, 3);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <Link
          href="/posts"
          className="muted"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> Back to feed
        </Link>
      </div>

      <PostCard post={post} user={user} defaultCommentsOpen />

      {sameStrandPosts.length > 0 && (
        <section className="card">
          <h3 style={{ marginBottom: 8 }}>More in this strand</h3>
          <p className="muted" style={{ marginBottom: 18 }}>
            Similar conversations are happening across the same impact area.
          </p>
          <div className="feed">
            {sameStrandPosts.map((relatedPost) => (
              <PostCard key={relatedPost.id} post={relatedPost} user={user} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
