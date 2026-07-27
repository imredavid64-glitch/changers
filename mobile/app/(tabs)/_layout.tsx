import { Tabs } from "expo-router";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.moss,
        tabBarInactiveTintColor: "rgba(16, 24, 32, 0.5)",
        tabBarStyle: {
          borderTopColor: "rgba(16, 24, 32, 0.1)",
          backgroundColor: colors.white,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="rooms" options={{ title: "Rooms" }} />
      <Tabs.Screen name="events" options={{ title: "Explore" }} />
      <Tabs.Screen name="bridge" options={{ title: "Bridge" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
