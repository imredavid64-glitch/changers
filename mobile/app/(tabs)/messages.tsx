import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radius, spacing } from "../../src/theme";
import { useAuth } from "../../src/lib/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db, firebaseEnabled } from "../../src/lib/firebase";
import { type BridgeThread, timestampToMillis } from "../../src/lib/bridge";

type ThreadListItem = BridgeThread & {
  otherName: string;
  updatedAt: number;
};

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadListItem[]>([]);

  useEffect(() => {
    if (!db || !user) return;

    const threadsQuery = query(
      collection(db, "threads"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(threadsQuery, async (snapshot) => {
      const mapped = await Promise.all(
        snapshot.docs.map(async (item) => {
          const data = item.data();
          const participants = Array.isArray(data.participants)
            ? (data.participants as string[])
            : [];
          const otherUserId =
            participants.find((participantId) => participantId !== user.uid) ||
            user.uid;

          let otherName =
            (data.participant_names as Record<string, string> | undefined)?.[
              otherUserId
            ] || "Changemaker";

          if (otherName === "Changemaker") {
            const profileSnap = await getDoc(doc(db, "profiles", otherUserId));
            otherName =
              (profileSnap.data()?.full_name as string | undefined) ||
              (profileSnap.data()?.name as string | undefined) ||
              "Changemaker";
          }

          return {
            id: item.id,
            participants,
            lastMessage: (data.last_message as string | undefined) || "",
            participantNames:
              (data.participant_names as Record<string, string> | undefined) || {},
            otherName,
            updatedAt: timestampToMillis(data.updated_at),
          };
        })
      );

      mapped.sort((left, right) => right.updatedAt - left.updatedAt);
      setThreads(mapped);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Direct chats and room threads.</Text>

      {!firebaseEnabled && (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Connect Firebase to sync direct messages in realtime across every
            device.
          </Text>
        </View>
      )}

      {!user ? (
        <View style={styles.card}>
          <Text style={styles.cardBody}>Sign in to view your inbox.</Text>
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Your inbox is empty. Open a profile on the web and start a direct
            conversation.
          </Text>
        </View>
      ) : (
        threads.map((thread) => (
          <TouchableOpacity
            key={thread.id}
            style={styles.card}
            onPress={() => router.push(`/messages/${thread.id}`)}
          >
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{thread.otherName}</Text>
            </View>
            <Text style={styles.cardBody}>
              {thread.lastMessage || "Started a conversation..."}
            </Text>
          </TouchableOpacity>
        ))
      )}
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
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  cardBody: {
    color: "rgba(16, 24, 32, 0.7)",
  },
});
