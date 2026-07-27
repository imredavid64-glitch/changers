import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../src/theme";
import { threads } from "../../src/data/messages";

export default function MessagesScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Direct chats and room threads.</Text>

      {threads.map((thread) => (
        <View key={thread.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>{thread.name}</Text>
            <Text style={styles.time}>{thread.time}</Text>
          </View>
          <Text style={styles.cardBody}>{thread.lastMessage}</Text>
        </View>
      ))}
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
  time: {
    color: "rgba(16, 24, 32, 0.5)",
    fontSize: 12,
  },
});
