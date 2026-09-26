/**
 * Shared design tokens for the Rescuer app screens.
 * Keeping these in one place keeps the rescuer UI cohesive: same palette,
 * spacing scale, radii, and shadows across Assignments, Active Rescue, Map,
 * and Profile.
 *
 * Lives OUTSIDE the app/ directory so expo-router never scans it as a route.
 */
import { Platform, ViewStyle } from "react-native";

export const RC = {
  // Brand
  primary: "#0d9488", // teal-600
  primaryDark: "#0d4f4f", // deep teal (headers)
  primaryDarker: "#0a3d3d",
  primarySoft: "#ccfbf1", // teal-100
  primaryTint: "#f0fdfa", // teal-50

  // Accents
  blue: "#2563eb",
  purple: "#7c3aed",
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#ef4444",
  redDark: "#dc2626",

  // Neutrals
  ink: "#0f172a", // slate-900
  text: "#1e293b", // slate-800
  textMuted: "#64748b", // slate-500
  textFaint: "#94a3b8", // slate-400
  border: "#e2e8f0", // slate-200
  divider: "#f1f5f9", // slate-100
  surface: "#ffffff",
  bg: "#f1f5f9", // slate-100 (screen background)
  bgAlt: "#f8fafc", // slate-50
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/** Soft elevated-card shadow (cross-platform). */
export const shadow = (elevation = 2): ViewStyle => ({
  elevation,
  shadowColor: "#0f172a",
  shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.12,
  shadowRadius: elevation * 3,
  shadowOffset: { width: 0, height: elevation },
});

/** Colored glow shadow for primary action buttons. */
export const glow = (color: string, elevation = 4): ViewStyle => ({
  elevation,
  shadowColor: color,
  shadowOpacity: 0.35,
  shadowRadius: elevation * 2,
  shadowOffset: { width: 0, height: elevation / 2 },
});

/** Maps a rescue/user status string to a semantic color + soft background. */
export function statusColors(status?: string): { fg: string; bg: string } {
  const s = (status || "").toLowerCase();
  if (s.includes("danger")) return { fg: RC.red, bg: "#fee2e2" };
  if (s.includes("pending")) return { fg: "#b45309", bg: "#fef3c7" };
  if (s.includes("ongoing") || s.includes("accepted")) return { fg: RC.blue, bg: "#dbeafe" };
  if (s.includes("way")) return { fg: RC.blue, bg: "#dbeafe" };
  if (s.includes("arrived")) return { fg: RC.purple, bg: "#ede9fe" };
  if (s.includes("completed") || s.includes("safe")) return { fg: RC.green, bg: "#dcfce7" };
  return { fg: RC.textMuted, bg: RC.divider };
}
