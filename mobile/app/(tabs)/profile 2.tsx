import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { colors, radius, spacing } from "../../src/theme";
import { useAuth } from "../../src/lib/auth";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your Bridge identity and settings.</Text>

      <View style={styles.card}>
        {user ? (
          <>
            <Text style={styles.name}>{user.user_metadata?.full_name || "Changemaker"}</Text>
            <Text style={styles.role}>{user.user_metadata?.role || "Community member"}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>128</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>76</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
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
});
