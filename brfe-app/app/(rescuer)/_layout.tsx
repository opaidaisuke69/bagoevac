import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getToken } from "../../hooks/use-auth";
import * as WsClient from "../../services/websocket-client";
import * as GpsTracker from "../../services/gps-tracker";

export default function RescuerLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);

  useEffect(() => {
    // Start GPS tracking for rescuer location sharing
    GpsTracker.start();
    (async () => {
      const token = await getToken();
      if (token) WsClient.connect(token);
    })();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0d9488",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="assignments"
        options={{
          title: "Assignments",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="active-rescue"
        options={{
          title: "Active",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "navigate" : "navigate-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rescue-map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rescuer-profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
