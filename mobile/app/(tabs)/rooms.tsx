import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, radius, spacing } from "../../src/theme";
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
import { useAuth } from "../../src/lib/auth";
import { displayNameForUser, type BridgeRoom } from "../../src/lib/bridge";

export default function RoomsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<BridgeRoom[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;

    const roomsQuery = query(
      collection(db, "rooms"),
      orderBy("created_at", "desc"),
      limit(30)
    );

    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      setRooms(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: (data.name as string | undefined) || "Untitled room",
            description: (data.description as string | undefined) || "",
            ownerId: (data.owner_id as string | undefined) || "guest",
            members: Array.isArray(data.members) ? (data.members as string[]) : [],
            lastMessage: (data.last_message as string | undefined) || "",
          };
        })
      );
    });

    return () => unsubscribe();
  }, []);

  async function handleCreateRoom() {
    setNotice(null);

    if (!db || !firebaseEnabled || !user) {
      setNotice("Sign in with Firebase configured to create rooms.");
      return;
    }

    if (name.trim().length < 3 || description.trim().length < 10) {
      setNotice("Add a name and a short mission before creating a room.");
      return;
    }

    try {
      await addDoc(collection(db, "rooms"), {
        name: name.trim(),
        description: description.trim(),
        owner_id: user.uid,
        owner_name: displayNameForUser(user, profile),
        members: [user.uid],
        last_message: "",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setName("");
      setDescription("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create room.");
    }
  }

  async function toggleMembership(room: BridgeRoom) {
    if (!db || !user) {
      setNotice("Sign in to join or leave rooms.");
      return;
    }

    const isMember = room.members.includes(user.uid);

    await updateDoc(doc(db, "rooms", room.id), {
      members: isMember ? arrayRemove(user.uid) : arrayUnion(user.uid),
      updated_at: serverTimestamp(),
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Co-Lab Rooms</Text>
      <Text style={styles.subtitle}>
        Persistent project spaces with chat, tasks, and shared assets.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Start a room</Text>
        <TextInput
          style={styles.input}
          placeholder="Room name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="What will this room build together?"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleCreateRoom}>
          <Text style={styles.primaryButtonText}>Create room</Text>
        </TouchableOpacity>
        {notice && <Text style={styles.notice}>{notice}</Text>}
      </View>

      {!firebaseEnabled && (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Add Firebase environment variables to make rooms and chat live across
            web, desktop, and mobile.
          </Text>
        </View>
      )}

      {rooms.map((room) => {
        const isMember = !!user && room.members.includes(user.uid);

        return (
          <View key={room.id} style={styles.card}>
            <Text style={styles.cardTitle}>{room.name}</Text>
            <Text style={styles.cardBody}>{room.description}</Text>
            <View style={styles.tagRow}>
              <Text style={styles.tag}>
                {room.members.length} member{room.members.length === 1 ? "" : "s"}
              </Text>
              {room.lastMessage ? (
                <Text style={styles.tag}>Latest: {room.lastMessage}</Text>
              ) : (
                <Text style={styles.tag}>Fresh workspace</Text>
              )}
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push(`/rooms/${room.id}`)}
              >
                <Text style={styles.primaryButtonText}>Open room</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => toggleMembership(room)}
              >
                <Text style={styles.secondaryButtonText}>
                  {isMember ? "Leave" : "Join"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
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
  input: {
    backgroundColor: colors.cloud,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  cardBody: {
    color: "rgba(16, 24, 32, 0.7)",
  },
  tagRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: "wrap",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    backgroundColor: "rgba(44, 138, 125, 0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    fontWeight: "600",
    color: colors.ink,
  },
  primaryButton: {
    backgroundColor: colors.coral,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.ink,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: colors.cloud,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.moss,
    fontWeight: "700",
  },
  notice: {
    marginTop: spacing.sm,
    color: colors.moss,
    fontWeight: "600",
  },
});
