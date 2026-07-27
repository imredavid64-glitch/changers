import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { colors, radius, spacing } from "../../src/theme";
import { useAuth } from "../../src/lib/auth";
import { db } from "../../src/lib/firebase";
import { displayNameForUser, type BridgeThread } from "../../src/lib/bridge";

type DirectMessage = {
  id: string;
  senderId: string;
  text: string;
};

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [thread, setThread] = useState<BridgeThread | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [otherName, setOtherName] = useState("Changemaker");

  useEffect(() => {
    if (!db || !id || typeof id !== "string") return;

    const unsubscribeThread = onSnapshot(doc(db, "threads", id), async (snap) => {
      const data = snap.data();
      if (!data) return;

      const participants = Array.isArray(data.participants)
        ? (data.participants as string[])
        : [];
      const otherUserId =
        participants.find((participantId) => participantId !== user?.uid) ||
        user?.uid ||
        "guest";

      let nextOtherName =
        (data.participant_names as Record<string, string> | undefined)?.[
          otherUserId
        ] || "Changemaker";

      if (nextOtherName === "Changemaker") {
        const profileSnap = await getDoc(doc(db, "profiles", otherUserId));
        nextOtherName =
          (profileSnap.data()?.full_name as string | undefined) ||
          (profileSnap.data()?.name as string | undefined) ||
          "Changemaker";
      }

      setOtherName(nextOtherName);
      setThread({
        id: snap.id,
        participants,
        lastMessage: (data.last_message as string | undefined) || "",
        participantNames:
          (data.participant_names as Record<string, string> | undefined) || {},
      });
    });

    const messagesQuery = query(
      collection(db, "threads", id, "messages"),
      orderBy("created_at", "asc")
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            senderId: (data.sender_id as string | undefined) || "guest",
            text: (data.text as string | undefined) || "",
          };
        })
      );
    });

    return () => {
      unsubscribeThread();
      unsubscribeMessages();
    };
  }, [id, user?.uid]);

  async function handleSend() {
    if (!db || !user || !thread || !draft.trim() || typeof id !== "string") {
      return;
    }

    const text = draft.trim();
    const participantNames = {
      ...(thread.participantNames || {}),
      [user.uid]: displayNameForUser(user, profile),
    };

    await addDoc(collection(db, "threads", id, "messages"), {
      sender_id: user.uid,
      sender_name: displayNameForUser(user, profile),
      text,
      created_at: serverTimestamp(),
    });

    await setDoc(
      doc(db, "threads", id),
      {
        participants: thread.participants,
        participant_names: participantNames,
        last_message: text,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );

    setDraft("");
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Link href="/(tabs)/messages" style={styles.backLink}>
          Back
        </Link>
        <Text style={styles.title}>{otherName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.messages}>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>
            This is the start of your direct conversation.
          </Text>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.senderId === user?.uid;

            return (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  isCurrentUser ? styles.myMessage : styles.theirMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isCurrentUser && styles.myMessageText,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a message"
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sand,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  backLink: {
    color: colors.moss,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  messages: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    color: "rgba(16, 24, 32, 0.6)",
    textAlign: "center",
    marginTop: spacing.xl,
  },
  messageBubble: {
    maxWidth: "82%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: colors.teal,
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
  },
  messageText: {
    color: colors.ink,
  },
  myMessageText: {
    color: colors.white,
  },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    backgroundColor: colors.cloud,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.coral,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  sendButtonText: {
    color: colors.ink,
    fontWeight: "700",
  },
});
