import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { AuthProvider } from "../src/lib/auth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
