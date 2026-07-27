import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Link } from "expo-router";
import { colors, radius, spacing } from "../../src/theme";
import { useAuth } from "../../src/lib/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db, firebaseEnabled } from "../../src/lib/firebase";
import { timestampToMillis } from "../../src/lib/bridge";

type ProfilePost = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
};

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [posts, setPosts] = useState<ProfilePost[]>([]);

  useEffect(() => {
    if (!db || !user) return;

    const unsubscribeFollowers = onSnapshot(
      collection(db, "profiles", user.uid, "followers"),
      (snapshot) => setFollowers(snapshot.size)
    );
    const unsubscribeFollowing = onSnapshot(
      collection(db, "profiles", user.uid, "following"),
      (snapshot) => setFollowing(snapshot.size)
    );
    const postsQuery = query(
      collection(db, "posts"),
      where("author_id", "==", user.uid),
      orderBy("created_at", "desc")
    );
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      setPosts(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            title: (data.title as string | undefined) || "Untitled",
            body: (data.body as string | undefined) || "",
            createdAt: timestampToMillis(data.created_at),
          };
        })
      );
    });

    return () => {
      unsubscribeFollowers();
      unsubscribeFollowing();
      unsubscribePosts();
    };
  }, [user?.uid]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your Bridge identity and settings.</Text>

      <View style={styles.card}>
        {user ? (
          <>
            <Text style={styles.name}>{profile?.fullName || "Changemaker"}</Text>
            <Text style={styles.role}>{profile?.role || "Community member"}</Text>
            {profile?.location ? (
              <Text style={styles.role}>{profile.location}</Text>
            ) : null}
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{following}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
            <View style={styles.timeline}>
              <Text style={styles.timelineTitle}>Recent activity</Text>
              {!firebaseEnabled && (
                <Text style={styles.role}>
                  Connect Firebase to load your live changemaker profile.
                </Text>
              )}
              {posts.length === 0 ? (
                <Text style={styles.role}>No posts yet. Share your first idea.</Text>
              ) : (
                posts.slice(0, 4).map((post) => (
                  <View key={post.id} style={styles.postItem}>
                    <Text style={styles.postTitle}>{post.title}</Text>
                    <Text style={styles.postBody}>{post.body}</Text>
                  </View>
                ))
              )}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={signOut}>
              <Text style={styles.primaryButtonText}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.name}>Guest mode</Text>
            <Text style={styles.role}>Sign in to publish and collaborate.</Text>
            <Link href="/sign-in" style={styles.linkButton}>
              Sign in
            </Link>
            <Link href="/sign-up" style={styles.linkButton}>
              Create account
            </Link>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.sand,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    color: "rgba(16, 24, 32, 0.6)",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(44, 138, 125, 0.12)",
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  statLabel: {
    color: "rgba(16, 24, 32, 0.6)",
    fontSize: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  role: {
    marginTop: spacing.xs,
    color: "rgba(16, 24, 32, 0.7)",
  },
  email: {
    marginTop: spacing.xs,
    color: "rgba(16, 24, 32, 0.6)",
  },
  primaryButton: {
    backgroundColor: colors.coral,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: colors.ink,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: spacing.sm,
    color: colors.moss,
    fontWeight: "700",
  },
  timeline: {
    marginTop: spacing.lg,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  postItem: {
    backgroundColor: colors.cloud,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  postTitle: {
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  postBody: {
    color: "rgba(16, 24, 32, 0.65)",
  },
});
