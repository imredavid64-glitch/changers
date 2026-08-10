import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { APP_NAME, APP_URL } from "./src/lib/config";
import { colors } from "./src/theme";

type NavButtonProps = {
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

function NavButton({ label, disabled, onPress }: NavButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.navButton,
        disabled && styles.navButtonDisabled,
        pressed && !disabled && styles.navButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.navButtonText, disabled && styles.navButtonTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    // Open anything outside the Changers app in the system browser.
    if (!request.url.startsWith(APP_URL)) {
      void Linking.openURL(request.url);
      return false;
    }
    return true;
  }, []);

  const reload = useCallback(() => {
    setFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>{APP_NAME}</Text>
          </View>
          <View style={styles.navRow}>
            <NavButton label="‹" disabled={!canGoBack} onPress={() => webViewRef.current?.goBack()} />
            <NavButton label="›" disabled={!canGoForward} onPress={() => webViewRef.current?.goForward()} />
            <NavButton label="↻" onPress={reload} />
          </View>
        </View>

        {failed ? (
          <View style={styles.center}>
            <Text style={styles.failedTitle}>Can’t reach Changers</Text>
            <Text style={styles.failedBody}>
              Check your connection and try again. The app needs the network to
              load {APP_URL}.
            </Text>
            <Pressable style={styles.retryButton} onPress={reload}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: APP_URL }}
            style={styles.webView}
            onLoadStart={() => {
              setLoading(true);
              setFailed(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            onNavigationStateChange={(state) => {
              setCanGoBack(state.canGoBack);
              setCanGoForward(state.canGoForward);
            }}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            startInLoadingState={false}
            javaScriptEnabled
            domStorageEnabled
            onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          />
        )}

        {loading && !failed && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={colors.teal} size="large" />
            {progress > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(16,24,32,0.12)",
    backgroundColor: colors.cloud,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.coral,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  navRow: {
    flexDirection: "row",
    gap: 6,
  },
  navButton: {
    width: 40,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(44,138,125,0.12)",
  },
  navButtonPressed: {
    backgroundColor: "rgba(44,138,125,0.24)",
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.moss,
  },
  navButtonTextDisabled: {
    color: colors.ink,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  failedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
  failedBody: {
    fontSize: 15,
    textAlign: "center",
    color: "rgba(16,24,32,0.7)",
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: colors.coral,
  },
  retryText: {
    color: colors.ink,
    fontWeight: "700",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(253,251,247,0.6)",
  },
  progressTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(16,24,32,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.teal,
  },
});
