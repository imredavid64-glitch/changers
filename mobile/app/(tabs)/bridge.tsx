import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radius, spacing } from "../../src/theme";
import { useAuth } from "../../src/lib/auth";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db, firebaseEnabled } from "../../src/lib/firebase";
import { displayNameForUser } from "../../src/lib/bridge";

type BridgeRequest = {
  id: string;
  userId: string;
  userName: string;
  need: string;
  skill: string;
};

export default function BridgeScreen() {
  const { user, profile } = useAuth();
  const [need, setNeed] = useState("");
  const [skill, setSkill] = useState("");
  const [requests, setRequests] = useState<BridgeRequest[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!db) return;

    const bridgeQuery = query(
      collection(db, "bridge_requests"),
      orderBy("created_at", "desc"),
      limit(40)
    );

    const unsubscribe = onSnapshot(bridgeQuery, (snapshot) => {
      setRequests(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            userId: (data.user_id as string | undefined) || "guest",
            userName: (data.user_name as string | undefined) || "Changemaker",
            need: (data.need as string | undefined) || "",
            skill: (data.skill as string | undefined) || "",
          };
        })
      );
    });

    return () => unsubscribe();
  }, []);

  async function handleSubmit() {
    setNotice(null);

    if (need.trim().length < 3 || skill.trim().length < 3) {
      setNotice("Add a clear need and skill to continue.");
      return;
    }

    const suggestionList = requests
      .filter((item) => item.userId !== user?.uid)
      .filter(
        (item) =>
          item.need.toLowerCase().includes(skill.trim().toLowerCase()) ||
          item.skill.toLowerCase().includes(need.trim().toLowerCase())
      )
      .slice(0, 3)
      .map(
        (item) =>
          `${item.userName} can help with "${item.need}" and offers ${item.skill}.`
      );

    setSuggestions(
      suggestionList.length > 0
        ? suggestionList
        : [
            `We will match changemakers who need ${skill.trim()} and can support ${need.trim()}.`,
          ]
    );

    if (!db || !firebaseEnabled || !user) {
      setNotice("Sign in with Firebase configured to create bridge requests.");
      return;
    }

    try {
      await addDoc(collection(db, "bridge_requests"), {
        user_id: user.uid,
        user_name: displayNameForUser(user, profile),
        need: need.trim(),
        skill: skill.trim(),
        created_at: serverTimestamp(),
      });

      setNeed("");
      setSkill("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to create bridge card."
      );
    }
  }

  const personalRequests = user
    ? requests.filter((item) => item.userId === user.uid)
    : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Bridge Cards</Text>
      <Text style={styles.subtitle}>
        Match skills and needs to form fast collaboration bridges.
      </Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="What do you need?"
          value={need}
          onChangeText={setNeed}
        />
        <TextInput
          style={styles.input}
          placeholder="What can you offer?"
          value={skill}
          onChangeText={setSkill}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Find matches</Text>
        </TouchableOpacity>
        {notice && <Text style={styles.notice}>{notice}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bridge suggestions</Text>
        {suggestions.length === 0 ? (
          <Text style={styles.muted}>Add a need and offer to see suggestions.</Text>
        ) : (
          suggestions.map((item) => (
            <Text key={item} style={styles.listItem}>
              • {item}
            </Text>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your bridge requests</Text>
        {personalRequests.length === 0 ? (
          <Text style={styles.muted}>No bridge requests yet.</Text>
        ) : (
          personalRequests.map((item) => (
            <View key={item.id} style={styles.requestItem}>
              <Text style={styles.requestTitle}>{item.need}</Text>
              <Text style={styles.requestBody}>Offers: {item.skill}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Live bridge board</Text>
        {!firebaseEnabled && (
          <Text style={styles.muted}>
            Connect Firebase to make this board live across every device.
          </Text>
        )}
        {requests.slice(0, 8).map((item) => (
          <View key={item.id} style={styles.requestItem}>
            <Text style={styles.requestTitle}>{item.userName}</Text>
            <Text style={styles.requestBody}>Needs: {item.need}</Text>
            <Text style={styles.requestBody}>Offers: {item.skill}</Text>
          </View>
        ))}
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
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.cloud,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.coral,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.ink,
    fontWeight: "700",
  },
  notice: {
    marginTop: spacing.sm,
    color: colors.moss,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  muted: {
    color: "rgba(16, 24, 32, 0.6)",
  },
  listItem: {
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  requestItem: {
    marginBottom: spacing.sm,
  },
  requestTitle: {
    fontWeight: "700",
    color: colors.ink,
  },
  requestBody: {
    color: "rgba(16, 24, 32, 0.6)",
  },
});
