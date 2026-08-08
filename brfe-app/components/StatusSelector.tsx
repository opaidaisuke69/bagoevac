import { useState, useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../constants/config";
import { getToken } from "../hooks/use-auth";
import * as WsClient from "../services/websocket-client";

type UserStatus = "Safe" | "Need_Assistance" | "In_Danger";

const STATUS_OPTIONS: {
  value: UserStatus;
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
  confirmMsg: string;
}[] = [
  {
    value: "Safe",
    label: "Safe",
    color: "#16a34a",
    bg: "#dcfce7",
    icon: "checkmark-circle",
    confirmMsg: "Mark yourself as Safe?",
  },
  {
    value: "Need_Assistance",
    label: "Need Help",
    color: "#d97706",
    bg: "#fef9c3",
    icon: "alert-circle",
    confirmMsg: "Mark yourself as needing assistance? LGU will be notified.",
  },
  {
    value: "In_Danger",
    label: "In Danger",
    color: "#dc2626",
    bg: "#fee2e2",
    icon: "warning",
    confirmMsg: "⚠️ Mark yourself as IN DANGER? This will alert the LGU immediately.",
  },
];

interface Props {
  userId: number;
  onStatusChange?: (status: string) => void;
}

export default function StatusSelector({ userId, onStatusChange }: Props) {
  const [current,  setCurrent]  = useState<UserStatus | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);

  // Load current status from API on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/api/users/get`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const user = json.data ?? json;
        if (user?.status) setCurrent(user.status as UserStatus);
      } catch { /* non-fatal */ } finally {
        setFetching(false);
      }
    })();
  }, [userId]);

  function confirmAndUpdate(opt: typeof STATUS_OPTIONS[number]) {
    if (opt.value === current || loading) return;
    Alert.alert(
      "Update Status",
      opt.confirmMsg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: opt.value === "In_Danger" ? "destructive" : "default",
          onPress: () => doUpdate(opt.value),
        },
      ]
    );
  }

  async function doUpdate(status: UserStatus) {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/users/status?id=${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.error) {
        Alert.alert("Error", json.message ?? "Failed to update status.");
      } else {
        setCurrent(status);
        onStatusChange?.(status);
        const { emit } = await import("../services/event-bus");
        emit("status_change", { user_id: userId, status });
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {STATUS_OPTIONS.map((opt) => {
        const isActive = opt.value === current;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.option,
              { borderColor: opt.color },
              isActive && { backgroundColor: opt.color },
            ]}
            onPress={() => confirmAndUpdate(opt)}
            disabled={loading}
            activeOpacity={0.75}
          >
            {loading && isActive ? (
              <ActivityIndicator size="small" color={isActive ? "#fff" : opt.color} />
            ) : (
              <Ionicons name={opt.icon} size={14} color={isActive ? "#fff" : opt.color} />
            )}
            <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column", gap: 6, alignItems: "flex-start",
  },
  option: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 7, paddingHorizontal: 10, borderRadius: 20, borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  optionText: {
    fontSize: 11, fontWeight: "700", color: "#374151",
  },
  optionTextActive: { color: "#fff" },
});