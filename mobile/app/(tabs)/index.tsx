import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link } from "expo-router";
import { colors, radius, spacing } from "../../src/theme";
import { posts as demoPosts } from "../../src/data/demo";
import { useAuth } from "../../src/lib/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, firebaseEnabled } from "../../src/lib/firebase";
import {
  type BridgeComment,
  type BridgePost,
  displayNameForUser,
  roleForProfile,
  type Strand,
} from "../../src/lib/bridge";

type CommentItem = BridgeComment;

const fallbackPosts: BridgePost[] = demoPosts.map((item) => ({
  id: item.id,
  authorId: item.id,
  authorName: item.author,
  authorRole: item.role,
  title: item.title,
  body: item.body,
  strand: item.strand,
  likes: [],
}));

const strandLabels: Record<Strand, string> = {
  N: "Nature",
  E: "Economy",
  S: "Society",
  W: "Wellbeing",
};

export default function FeedScreen() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<BridgePost[]>(fallbackPosts);
  const [filter, setFilter] = useState<"all" | Strand>("all");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [strand, setStrand] = useState<Strand>("S");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<
    Record<string, CommentItem[]>
  >({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const commentListeners = useRef<Record<string, () => void>>({});

  const canPost = firebaseEnabled && !!db && !!user;

  const filteredPosts = useMemo(() => {
    const base =
      filter === "all" ? posts : posts.filter((post) => post.strand === filter);

    if (!search.trim()) {
      return base;
    }

    const nextQuery = search.trim().toLowerCase();
    return base.filter(
      (post) =>
        post.title.toLowerCase().includes(nextQuery) ||
        post.body.toLowerCase().includes(nextQuery) ||
        post.authorName.toLowerCase().includes(nextQuery)
    );
  }, [filter, posts, search]);

  useEffect(() => {
    if (!db) {
      setNotice(
        "Add Firebase mobile env vars to unlock live posts, messages, and notifications."
      );
      return;
    }

    setLoading(true);

    const postsQuery = query(
      collection(db, "posts"),
      orderBy("created_at", "desc"),
      limit(40)
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      setPosts(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            authorId: (data.author_id as string | undefined) || "guest",
            authorName: (data.author_name as string | undefined) || "Changemaker",
            authorRole:
              (data.author_role as string | undefined) || "Community member",
            title: (data.title as string | undefined) || "Untitled",
            body: (data.body as string | undefined) || "",
            strand: ((data.strand as Strand | undefined) || "S") as Strand,
            likes: Array.isArray(data.likes) ? (data.likes as string[]) : [],
          };
        })
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(commentListeners.current).forEach((unsubscribe) =>
        unsubscribe()
      );
      commentListeners.current = {};
    };
  }, []);

  async function sendNotification(
    recipientId: string,
    type: "like" | "comment",
    postId: string
  ) {
    if (!db || !user || recipientId === user.uid) {
      return;
    }

    await addDoc(collection(db, "profiles", recipientId, "notifications"), {
      actor_id: user.uid,
      actor_name: displayNameForUser(user, profile),
      type,
      post_id: postId,
      read: false,
      created_at: serverTimestamp(),
    });
  }

  async function handlePublish() {
    setNotice(null);

    if (!canPost) {
      setNotice("Sign in with Firebase configured to publish a post.");
      return;
    }

    if (title.trim().length < 3) {
      setNotice("Title needs at least 3 characters.");
      return;
    }

    if (body.trim().length < 10) {
      setNotice("Share a bit more detail about your idea.");
      return;
    }

    if (!db || !user) {
      setNotice("Firebase is not configured for publishing.");
      return;
    }

    try {
      await addDoc(collection(db, "posts"), {
        title: title.trim(),
        body: body.trim(),
        strand,
        author_id: user.uid,
        author_name: displayNameForUser(user, profile),
        author_role: roleForProfile(profile),
        likes: [],
        created_at: serverTimestamp(),
      });

      setTitle("");
      setBody("");
      setFilter("all");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to publish.");
    }
  }

  async function handleApplaud(post: BridgePost) {
    if (!db || !user) {
      setNotice("Sign in to applaud posts.");
      return;
    }

    const hasApplauded = post.likes.includes(user.uid);

    await updateDoc(doc(db, "posts", post.id), {
      likes: hasApplauded ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });

    if (!hasApplauded) {
      await sendNotification(post.authorId, "like", post.id);
    }
  }

  function toggleComments(postId: string) {
    const wasOpen = openComments[postId];

    if (wasOpen) {
      commentListeners.current[postId]?.();
      delete commentListeners.current[postId];
      setOpenComments((prev) => ({ ...prev, [postId]: false }));
      return;
    }

    setOpenComments((prev) => ({ ...prev, [postId]: true }));

    if (!db || commentListeners.current[postId]) {
      return;
    }

    const commentsQuery = query(
      collection(db, "posts", postId, "comments"),
      orderBy("created_at", "asc")
    );

    commentListeners.current[postId] = onSnapshot(commentsQuery, (snapshot) => {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            authorId: (data.author_id as string | undefined) || "guest",
            authorName:
              (data.author_name as string | undefined) || "Changemaker",
            text: (data.text as string | undefined) || "",
          };
        }),
      }));
    });
  }

  async function handleCommentSubmit(postId: string) {
    const draft = (commentDrafts[postId] || "").trim();
    if (draft.length < 2) {
      setNotice("Comment needs at least 2 characters.");
      return;
    }

    if (!db || !user) {
      setNotice("Sign in to comment.");
      return;
    }

    const post = posts.find((item) => item.id === postId);

    try {
      await addDoc(collection(db, "posts", postId, "comments"), {
        author_id: user.uid,
        author_name: displayNameForUser(user, profile),
        text: draft,
        created_at: serverTimestamp(),
      });

      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));

      if (post) {
        await sendNotification(post.authorId, "comment", post.id);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to comment.");
    }
  }

  const liveBadge = !firebaseEnabled
    ? "Connect Firebase"
    : user
      ? "Signed in"
      : "Guest mode";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Bridge</Text>
          <Text style={styles.tagline}>Changemaker Network</Text>
        </View>
        {user ? (
          <View style={styles.demoBadge}>
            <Text style={styles.demoText}>{liveBadge}</Text>
          </View>
        ) : (
          <Link href="/sign-in" style={styles.linkButton}>
            Sign in
          </Link>
        )}
      </View>

      {!firebaseEnabled && (
        <View style={styles.warningCard}>
          <Text style={styles.sectionTitle}>Live backend not connected</Text>
          <Text style={styles.muted}>
            Add Firebase environment variables to unlock realtime posts,
            messages, rooms, and notifications on mobile.
          </Text>
        </View>
      )}

      <TextInput
        style={styles.search}
        placeholder="Search people, projects, and ideas"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Bridge to Impact</Text>
        <Text style={styles.heroTitle}>Build the change together.</Text>
        <Text style={styles.heroBody}>
          Collaborate, share, and move ideas from spark to action with your
          changemaker community.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create a post</Text>
        <TextInput
          style={styles.input}
          placeholder="Give your post a title"
          value={title}
          onChangeText={setTitle}
          editable={canPost}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="What are you building?"
          value={body}
          onChangeText={setBody}
          editable={canPost}
          multiline
        />
        <View style={styles.strandRow}>
          {(["N", "E", "S", "W"] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.strandButton,
                strand === item && styles.strandButtonActive,
              ]}
              onPress={() => setStrand(item)}
            >
              <Text style={styles.strandButtonText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, !canPost && styles.disabledButton]}
          onPress={handlePublish}
          disabled={!canPost}
        >
          <Text style={styles.primaryButtonText}>Publish</Text>
        </TouchableOpacity>
        {notice && <Text style={styles.notice}>{notice}</Text>}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Home Feed</Text>
        <View style={styles.filterRow}>
          {(["all", "N", "E", "S", "W"] as const).map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setFilter(item)}
              style={[
                styles.filterButton,
                filter === item && styles.filterButtonActive,
              ]}
            >
              <Text style={styles.filterText}>
                {item === "all" ? "All" : `${item} ${strandLabels[item]}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && <Text style={styles.muted}>Loading posts...</Text>}

      {filteredPosts.map((post) => {
        const hasApplauded = !!user && post.likes.includes(user.uid);
        const comments = commentsByPost[post.id] || [];

        return (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View>
                <Text style={styles.postAuthor}>{post.authorName}</Text>
                <Text style={styles.postRole}>{post.authorRole}</Text>
              </View>
              <View style={[styles.strandBadge, strandBadge(post.strand)]}>
                <Text style={styles.strandText}>{post.strand}</Text>
              </View>
            </View>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postBody}>{post.body}</Text>
            <View style={styles.postActions}>
              <TouchableOpacity
                style={[
                  styles.ghostButton,
                  hasApplauded && styles.ghostButtonActive,
                ]}
                onPress={() => handleApplaud(post)}
              >
                <Text style={styles.ghostButtonText}>
                  Applaud {post.likes.length}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => toggleComments(post.id)}
              >
                <Text style={styles.ghostButtonText}>
                  {openComments[post.id]
                    ? "Hide comments"
                    : `Comments ${comments.length}`}
                </Text>
              </TouchableOpacity>
            </View>

            {openComments[post.id] && (
              <View style={styles.commentsBox}>
                {comments.length === 0 ? (
                  <Text style={styles.muted}>Start the conversation.</Text>
                ) : (
                  comments.map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                      <Text style={styles.commentBody}>{comment.text}</Text>
                    </View>
                  ))
                )}
                <View style={styles.commentComposer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment"
                    value={commentDrafts[post.id] || ""}
                    onChangeText={(value) =>
                      setCommentDrafts((prev) => ({ ...prev, [post.id]: value }))
                    }
                  />
                  <TouchableOpacity
                    style={styles.commentButton}
                    onPress={() => handleCommentSubmit(post.id)}
                  >
                    <Text style={styles.commentButtonText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function strandBadge(strand: Strand) {
  switch (strand) {
    case "N":
      return { backgroundColor: "#d8efe4" };
    case "E":
      return { backgroundColor: "#f9e0ba" };
    case "S":
      return { backgroundColor: "#f8c3b5" };
    case "W":
      return { backgroundColor: "#c9e4dd" };
    default:
      return { backgroundColor: "#eaeaea" };
  }
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 120,
    backgroundColor: colors.sand,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
  },
  tagline: {
    color: colors.moss,
    fontWeight: "600",
  },
  linkButton: {
    color: colors.moss,
    fontWeight: "700",
  },
  demoBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: "rgba(44, 138, 125, 0.12)",
  },
  demoText: {
    color: colors.moss,
    fontWeight: "600",
  },
  warningCard: {
    backgroundColor: "#fff1ed",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  search: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  hero: {
    backgroundColor: colors.cloud,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 11,
    color: colors.moss,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  heroBody: {
    color: "rgba(16, 24, 32, 0.72)",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.cloud,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  strandRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  strandButton: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(16, 24, 32, 0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
  },
  strandButtonActive: {
    backgroundColor: "rgba(44, 138, 125, 0.12)",
    borderColor: "rgba(44, 138, 125, 0.2)",
  },
  strandButtonText: {
    fontWeight: "700",
    color: colors.ink,
  },
  primaryButton: {
    backgroundColor: colors.coral,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.ink,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.45,
  },
  notice: {
    marginTop: spacing.sm,
    color: colors.moss,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterButton: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  filterButtonActive: {
    backgroundColor: "rgba(44, 138, 125, 0.14)",
  },
  filterText: {
    color: colors.ink,
    fontWeight: "600",
  },
  postCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  postAuthor: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  postRole: {
    color: "rgba(16, 24, 32, 0.6)",
  },
  strandBadge: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  strandText: {
    fontWeight: "700",
    color: colors.ink,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  postBody: {
    color: "rgba(16, 24, 32, 0.76)",
  },
  postActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ghostButton: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(16, 24, 32, 0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  ghostButtonActive: {
    backgroundColor: "rgba(255, 111, 79, 0.08)",
    borderColor: "rgba(255, 111, 79, 0.24)",
  },
  ghostButtonText: {
    color: colors.ink,
    fontWeight: "600",
  },
  commentsBox: {
    marginTop: spacing.md,
    backgroundColor: colors.cloud,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  commentItem: {
    marginBottom: spacing.sm,
  },
  commentAuthor: {
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  commentBody: {
    color: "rgba(16, 24, 32, 0.72)",
  },
  commentComposer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  commentButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  commentButtonText: {
    color: colors.white,
    fontWeight: "700",
  },
  muted: {
    color: "rgba(16, 24, 32, 0.6)",
  },
});
