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
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { colors, radius, spacing } from "../../src/theme";
import { useAuth } from "../../src/lib/auth";
import { db } from "../../src/lib/firebase";
import { displayNameForUser, type BridgeRoom } from "../../src/lib/bridge";

type RoomMessage = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
};

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [room, setRoom] = useState<BridgeRoom | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!db || !id || typeof id !== "string") return;

    const unsubscribeRoom = onSnapshot(doc(db, "rooms", id), (snap) => {
      const data = snap.data();
      if (!data) return;

      setRoom({
        id: snap.id,
        name: (data.name as string | undefined) || "Untitled room",
        description: (data.description as string | undefined) || "",
        ownerId: (data.owner_id as string | undefined) || "guest",
        members: Array.isArray(data.members) ? (data.members as string[]) : [],
        lastMessage: (data.last_message as string | undefined) || "",
      });
    });

    const messagesQuery = query(
      collection(db, "rooms", id, "messages"),
      orderBy("created_at", "asc")
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            authorId: (data.author_id as string | undefined) || "guest",
            authorName: (data.author_name as string | undefined) || "Changemaker",
            text: (data.text as string | undefined) || "",
          };
        })
      );
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
    };
  }, [id]);

  const isMember = !!user && !!room && room.members.includes(user.uid);

  async function joinRoom() {
    if (!db || !room || !user) return;

    await updateDoc(doc(db, "rooms", room.id), {
      members: arrayUnion(user.uid),
      updated_at: serverTimestamp(),
    });
  }

  async function handleSend() {
    if (!db || !room || !user || !draft.trim() || typeof id !== "string") {
      return;
    }

    if (!isMember) {
      await joinRoom();
    }

    const text = draft.trim();

    await addDoc(collection(db, "rooms", id, "messages"), {
      author_id: user.uid,
      author_name: displayNameForUser(user, profile),
      text,
      created_at: serverTimestamp(),
    });

    await updateDoc(doc(db, "rooms", id), {
      members: arrayUnion(user.uid),
      last_message: text,
      updated_at: serverTimestamp(),
    });

    setDraft("");
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Link href="/(tabs)/rooms" style={styles.backLink}>
          Back
        </Link>
        <Text style={styles.title}>{room?.name || "Room"}</Text>
        <Text style={styles.subtitle}>
          {room?.description || "Realtime collaboration workspace"}
        </Text>
      </View>

      {!isMember && user ? (
        <View style={styles.joinCard}>
          <Text style={styles.joinText}>
            Join this room to contribute to the conversation.
          </Text>
          <TouchableOpacity style={styles.joinButton} onPress={joinRoom}>
            <Text style={styles.joinButtonText}>Join room</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.messages}>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>
            This room is ready for its first message.
          </Text>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.authorId === user?.uid;

            return (
              <View key={message.id} style={styles.messageGroup}>
                <Text style={styles.authorLabel}>{message.authorName}</Text>
                <View
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
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={user ? "Message the room" : "Sign in to message"}
          value={draft}
          onChangeText={setDraft}
          editable={!!user}
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
  subtitle: {
    color: "rgba(16, 24, 32, 0.62)",
    marginTop: spacing.xs,
  },
  joinCard: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.cloud,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  joinText: {
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  joinButton: {
    backgroundColor: colors.coral,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  joinButtonText: {
    color: colors.ink,
    fontWeight: "700",
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
  messageGroup: {
    marginBottom: spacing.sm,
  },
  authorLabel: {
    color: "rgba(16, 24, 32, 0.55)",
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  messageBubble: {
    maxWidth: "82%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
