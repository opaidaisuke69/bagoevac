import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getToken } from "../../hooks/use-auth";
import * as WsClient from "../../services/websocket-client";
import * as GpsTracker from "../../services/gps-tracker";
import { API_BASE_URL } from "../../constants/config";
import MaintenanceGate from "../../components/MaintenanceGate";

function BadgeIcon({ name, color, size, count }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number; count: number }) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {count > 0 && (
        <View style={badge.dot}>
          <Text style={badge.text}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </View>
  );
}

const badge = StyleSheet.create({
  dot:  { position: "absolute", top: -4, right: -6, backgroundColor: "#dc2626", borderRadius: 8, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  text: { color: "#fff", fontSize: 9, fontWeight: "800" },
});

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);
  const [unreadCount, setUnreadCount] = useState(0);

  async function fetchUnread() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/list?unread_only=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.error) setUnreadCount(json.unread_count ?? 0);
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    GpsTracker.start();
    (async () => {
      const token = await getToken();
      if (token) WsClient.connect(token);
    })();
    fetchUnread();
    const onNotif = () => fetchUnread();
    WsClient.on("notification", onNotif);
    WsClient.on("rescue_status", onNotif);
    return () => {
      WsClient.off("notification", onNotif);
      WsClient.off("rescue_status", onNotif);
    };
  }, []);

  return (
    <MaintenanceGate>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1d4ed8",
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
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "warning" : "warning-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: "News",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "megaphone" : "megaphone-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size, focused }) => (
            <BadgeIcon
              name={focused ? "notifications" : "notifications-outline"}
              color={color}
              size={size}
              count={unreadCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    </MaintenanceGate>
  );
}