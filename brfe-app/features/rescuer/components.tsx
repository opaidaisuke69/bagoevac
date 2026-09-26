/**
 * Reusable UI pieces shared across the rescuer screens: a gradient-style
 * header, badges, and a soft-glass card. Kept dependency-free (no extra
 * libraries) so it drops into the existing Expo project cleanly.
 *
 * Lives OUTSIDE the app/ directory so expo-router never scans it as a route.
 */
import React from "react";
import { View, Text, StyleSheet, StatusBar, ViewStyle, StyleProp } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RC, RADIUS, SPACING, shadow } from "./theme";

type HeaderProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
};

/** Deep-teal screen header with optional icon, subtitle and a right slot. */
export function ScreenHeader({ title, subtitle, icon, right }: HeaderProps) {
  return (
    <View style={hStyles.wrap}>
      <View style={hStyles.left}>
        {icon && (
          <View style={hStyles.iconBubble}>
            <Ionicons name={icon} size={20} color="#fff" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={hStyles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={hStyles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ? <View style={hStyles.right}>{right}</View> : null}
    </View>
  );
}

/** SafeAreaView + StatusBar wrapper with the shared teal top / slate body. */
export function RescuerScreen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={hStyles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={RC.primaryDark} />
      {children}
    </SafeAreaView>
  );
}

/** Small rounded pill used for statuses and counts. */
export function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[hStyles.badge, { backgroundColor: bg }]}>
      <Text style={[hStyles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** White elevated surface card. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[hStyles.card, style]}>{children}</View>;
}

const hStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RC.primaryDark },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: RC.primaryDark,
  },
  left: { flexDirection: "row", alignItems: "center", gap: SPACING.md, flex: 1 },
  iconBubble: {
    width: 38, height: 38, borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center", alignItems: "center",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12.5, fontWeight: "600", marginTop: 1 },
  right: { marginLeft: SPACING.md },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  card: { backgroundColor: RC.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, ...shadow(2) },
});
