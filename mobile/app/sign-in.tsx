import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { colors, radius, spacing } from "../src/theme";
import { useAuth } from "../src/lib/auth";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setStatus(null);

    if (!email.includes("@")) {
      setStatus("Enter a valid email.");
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const errorMessage = await signIn(email.trim(), password.trim());
    setLoading(false);

    if (errorMessage) {
      setStatus(errorMessage);
      return;
    }

    router.replace("/(tabs)");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Welcome back to Bridge.</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Signing in..." : "Sign in"}
          </Text>
        </TouchableOpacity>
        {status && <Text style={styles.notice}>{status}</Text>}
        <Text style={styles.footerText}>
          New here? <Link href="/sign-up">Create an account</Link>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.sand,
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: "rgba(16, 24, 32, 0.6)",
    marginBottom: spacing.lg,
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
  disabledButton: {
    opacity: 0.6,
  },
  notice: {
    marginTop: spacing.sm,
    color: colors.moss,
    fontWeight: "600",
  },
  footerText: {
    marginTop: spacing.md,
    color: "rgba(16, 24, 32, 0.6)",
  },
});
