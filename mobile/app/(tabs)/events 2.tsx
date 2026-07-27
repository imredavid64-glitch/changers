import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../src/theme";
import { events } from "../../src/data/sections";

const notifications = [
  "Kai uploaded new cleanup data.",
  "New mentor available for circular economy projects.",
  "Bridge to Impact showcase starts in 2 days.",
];

const spotlight = [
  {
    title: "Idea Forge",
    body: "Turn a spark into a proposal with a structured canvas and pitch reel.",
  },
  {
    title: "Impact Compass",
    body: "Track Nature, Economy, Society, and Wellbeing in every project.",
  },
];

export default function ExploreScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.subtitle}>What’s happening across Bridge.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        {notifications.map((item) => (
          <Text key={item} style={styles.listItem}>
            • {item}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Spotlight</Text>
        {spotlight.map((item) => (
          <View key={item.title} style={styles.spotlightItem}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Upcoming events</Text>
        {events.map((event) => (
          <View key={event.title} style={styles.eventItem}>
            <Text style={styles.date}>{event.date}</Text>
            <Text style={styles.cardTitle}>{event.title}</Text>
            <Text style={styles.cardBody}>{event.location}</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  listItem: {
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  spotlightItem: {
    marginBottom: spacing.sm,
  },
  eventItem: {
    marginBottom: spacing.md,
  },
  date: {
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    color: "rgba(16, 24, 32, 0.6)",
    marginBottom: spacing.xs,
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
});
