import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity,
  FlatList, ActivityIndicator, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Asset } from "expo-asset";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { on as busOn, off as busOff } from "../../services/event-bus";
import { getToken } from "../../hooks/use-auth";
import * as GpsTracker from "../../services/gps-tracker";
import * as WsClient from "../../services/websocket-client";
interface NearestCenter {
  id: number; name: string; address: string;
  lat: number; lng: number;
  max_capacity: number; occupancy: number; available: number;
  op_status: string; distance_km: number;
  barangay_name?: string | null;
  is_same_barangay?: boolean;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch { return null; }
}

function injectMsg(webView: WebView | null, obj: object) {
  if (!webView) return;
  webView.injectJavaScript(
    `(function(){var e=new MessageEvent("message",{data:${JSON.stringify(JSON.stringify(obj))}});document.dispatchEvent(e);window.dispatchEvent(e);})();true;`
  );
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "BRFE-App/1.0" } }
    );
    const data = await res.json();
    const addr = data?.address ?? {};
    const barangay = addr.suburb ?? addr.village ?? addr.quarter ?? addr.neighbourhood ?? null;
    if (barangay) return `${barangay}, Bago City`;
    return addr.city ?? addr.town ?? "Bago City";
  } catch { return null; }
}

export default function MapScreen() {
  const webViewRef   = useRef<WebView>(null);
  const mapReadyRef  = useRef(false);
  const pendingQueue = useRef<object[]>([]);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterModeRef = useRef<"smart" | "all" | "none">("none"); // "none" = modal closed

  const [mapReady,       setMapReady]       = useState(false);
  const [gpsUnavailable, setGpsUnavailable] = useState(false);
  const [userId,         setUserId]         = useState<number | null>(null);
  const [htmlUri,        setHtmlUri]        = useState<string | null>(null);
  const [centerCount,    setCenterCount]    = useState(0);
  const [liveCoords,     setLiveCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [barangay,       setBarangay]       = useState<string | null>(null);
  const [showNearest,      setShowNearest]      = useState(false);
  const [nearestCenters,   setNearestCenters]   = useState<NearestCenter[]>([]);
  const [nearestLoading,   setNearestLoading]   = useState(false);
  const [centerFilter,     setCenterFilter]     = useState<"smart" | "all">("smart");
  const [userBarangayName, setUserBarangayName] = useState<string | null>(null);
  const [routeActive,      setRouteActive]      = useState(false);
  const [routeLabel,     setRouteLabel]     = useState<string | null>(null);
  const [userStatus,     setUserStatus]     = useState<string>("Safe");
  const [userAvatar,     setUserAvatar]     = useState<string | null>(null);
  const userStatusRef = useRef<string>("Safe");
  const userAvatarRef = useRef<string | null>(null);

  // Load leaflet HTML asset
  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const asset = Asset.fromModule(require("../../assets/map/leaflet.html"));
      await asset.downloadAsync();
      setHtmlUri(asset.localUri ?? asset.uri);
    })();
  }, []);

  // Decode user ID from JWT
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const payload = decodeJwtPayload(token);
      if (!payload) return;
      const id = payload.user_id ?? payload.sub ?? payload.id;
      if (typeof id === "number") setUserId(id);
    })();
  }, []);

  // Fetch user profile (status + avatar) for map marker
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/api/users/get`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const user = json.data ?? json;
        if (user?.status) { setUserStatus(user.status); userStatusRef.current = user.status; }
        if (user?.avatar_path) { const url = `${API_BASE_URL}/${user.avatar_path}`; setUserAvatar(url); userAvatarRef.current = url; }
      } catch { /* non-fatal */ }
    })();
  }, [userId]);

  // Send message to Leaflet — queues if map not ready
  const sendToMap = useCallback((obj: object) => {
    if (!mapReadyRef.current) {
      pendingQueue.current.push(obj);
      return;
    }
    injectMsg(webViewRef.current, obj);
  }, []);

  // Fetch evacuation centers and push to map
  const fetchCenters = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/centers/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) return;
      const centers: any[] = data.evacuation_centers ?? data.data ?? (Array.isArray(data) ? data : []);
      setCenterCount(centers.length);
      sendToMap({
        type: "update_centers",
        centers: centers.map((c) => ({
          id: c.id, name: c.name, address: c.address ?? "",
          lat: parseFloat(c.lat), lng: parseFloat(c.lng),
          op_status: c.op_status, occupancy: c.occupancy ?? 0, max_capacity: c.max_capacity ?? 0,
        })),
      });
    } catch { /* non-fatal */ }
  }, [sendToMap]);

  // Fetch rescue requests and push to map
  const fetchRescues = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/rescue/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) return;
      const rescues: any[] = data.rescue_requests ?? data.data ?? (Array.isArray(data) ? data : []);
      sendToMap({
        type: "update_rescues",
        rescues: rescues.map((r) => ({
          id: r.id, lat: parseFloat(r.lat), lng: parseFloat(r.lng), req_status: r.req_status,
          avatar: r.avatar_path ? `${API_BASE_URL}/${r.avatar_path}` : null,
          user_status: r.user_status ?? null,
          full_name: r.full_name ?? null,
        })),
      });
    } catch { /* non-fatal */ }
  }, [sendToMap]);

  // Fetch centers for the modal and update map markers accordingly
  const fetchNearest = useCallback(async (mode: "smart" | "all" = "smart") => {
    const coords = GpsTracker.getLastCoords();
    if (!coords) return;
    setNearestLoading(true);
    try {
      const token = await getToken();
      const params = `lat=${coords.latitude}&lng=${coords.longitude}&mode=${mode}`;
      const res = await fetch(
        `${API_BASE_URL}/api/centers/nearest?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!json.error) {
        const centers: NearestCenter[] = json.centers ?? [];
        setNearestCenters(centers);
        setUserBarangayName(json.user_barangay_name ?? null);
        // Update map markers to match the current filter
        sendToMap({
          type: "update_centers",
          centers: centers.map((c) => ({
            id: c.id, name: c.name, address: c.address ?? "",
            lat: c.lat, lng: c.lng,
            op_status: c.op_status, occupancy: c.occupancy, max_capacity: c.max_capacity,
          })),
        });
      }
    } catch { /* non-fatal */ } finally {
      setNearestLoading(false);
    }
  }, [sendToMap]);

  function openNearest() {
    setShowNearest(true);
    setCenterFilter("smart");
    filterModeRef.current = "smart";
    fetchNearest("smart");
  }

  function handleFilterChange(mode: "smart" | "all") {
    setCenterFilter(mode);
    filterModeRef.current = mode;
    fetchNearest(mode);
  }

  function closeNearest() {
    setShowNearest(false);
    // Keep map markers as-is — filterModeRef stays set so map stays filtered
  }

  // GPS tracking — layout already started tracker; just subscribe here
  useEffect(() => {
    const unsubscribe = GpsTracker.onLocationUpdate((update) => {
      setGpsUnavailable(update.unavailable);
      if (update.coords) {
        const { latitude: lat, longitude: lng } = update.coords;
        setLiveCoords({ lat, lng });
        sendToMap({ type: "update_position", lat, lng, status: userStatusRef.current, avatar: userAvatarRef.current });
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        geocodeTimer.current = setTimeout(async () => {
          const name = await reverseGeocode(lat, lng);
          if (name) setBarangay(name);
        }, 2000);
      }
    });
    return () => {
      unsubscribe();
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [sendToMap]);

  // When status or avatar changes, keep refs in sync and update the map marker immediately
  useEffect(() => {
    userStatusRef.current = userStatus;
    userAvatarRef.current = userAvatar;
    if (mapReady) {
      sendToMap({ type: "update_user_status", status: userStatus, avatar: userAvatar });
    }
  }, [userStatus, userAvatar, mapReady, sendToMap]);
  useEffect(() => {
    const onCenterUpdate = () => {
      // If modal is open with a filter, re-fetch filtered; otherwise fetch all
      if (filterModeRef.current !== "none") {
        fetchNearest(filterModeRef.current);
      } else {
        fetchCenters();
      }
    };
    const onRescueRequest = () => fetchRescues();
    WsClient.on("center_update",  onCenterUpdate);
    WsClient.on("rescue_request", onRescueRequest);
    return () => {
      WsClient.off("center_update",  onCenterUpdate);
      WsClient.off("rescue_request", onRescueRequest);
    };
  }, [fetchCenters, fetchNearest, fetchRescues]);

  // Listen for status changes from report submission
  useEffect(() => {
    const onStatusChange = (data: unknown) => {
      const d = data as { status?: string };
      if (d?.status) {
        setUserStatus(d.status);
        userStatusRef.current = d.status;
        sendToMap({ type: "update_user_status", status: d.status, avatar: userAvatarRef.current });
      }
    };
    busOn("status_change", onStatusChange);
    return () => busOff("status_change", onStatusChange);
  }, [sendToMap]);

  // Once map is ready: flush queue + load centers + rescues
  useEffect(() => {
    if (!mapReady) return;
    fetchCenters();
    fetchRescues();
  }, [mapReady, fetchCenters, fetchRescues]);

  async function handleWebViewMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; distance?: string; duration?: string; name?: string };
      if (msg.type === "map_ready") {
        mapReadyRef.current = true;
        setMapReady(true);
        const queue = pendingQueue.current.splice(0);
        // Send API base URL and token so routing proxy works
        const token = await getToken();
        injectMsg(webViewRef.current, { type: "init_config", apiBase: API_BASE_URL, token: token ?? "" });
        queue.forEach((obj) => injectMsg(webViewRef.current, obj));
      } else if (msg.type === "route_started") {
        setRouteActive(true);
        setRouteLabel(msg.name ?? "Center");
      } else if (msg.type === "route_info") {
        setRouteActive(true);
        setRouteLabel(`${msg.distance ?? ""} · ${msg.duration ?? ""}`);
      } else if (msg.type === "route_cancelled") {
        setRouteActive(false);
        setRouteLabel(null);
      } else if (msg.type === "route_no_gps") {
        Alert.alert("No GPS", "Waiting for GPS fix. Please try again in a moment.");
      }
    } catch { /* ignore */ }
  }

  function handleCancelRoute() {
    // Tell the WebView to clear the route
    injectMsg(webViewRef.current, { type: "cancel_route" });
    setRouteActive(false);
    setRouteLabel(null);
  }

  const coordLabel = liveCoords
    ? `${liveCoords.lat.toFixed(5)}, ${liveCoords.lng.toFixed(5)}`
    : null;
  const locationLine = [barangay, coordLabel].filter(Boolean).join("  \u00B7  ") || "Locating...";

  if (!htmlUri) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Bago City Map</Text>
        </View>
        <View style={styles.loading}>
          <Ionicons name="map-outline" size={56} color="#1d4ed8" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="map" size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.topBarTitle}>Bago City</Text>
            <Text style={styles.topBarLocation} numberOfLines={1}>{locationLine}</Text>
          </View>
        </View>
        <View style={styles.topBarRight}>
          {centerCount > 0 && (
            <View style={styles.centerBadge}>
              <Ionicons name="business-outline" size={11} color="#fff" />
              <Text style={styles.centerBadgeText}>{centerCount}</Text>
            </View>
          )}
          {gpsUnavailable && (
            <View style={styles.gpsBadge}>
              <Ionicons name="location-outline" size={11} color="#fff" />
              <Text style={styles.gpsBadgeText}>No GPS</Text>
            </View>
          )}
        </View>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: htmlUri }}
        style={styles.webview}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        onMessage={handleWebViewMessage}
      />

      <View style={styles.bottomBar}>
        <Ionicons name="navigate" size={13} color="#1d4ed8" />
        <Text style={styles.bottomBarText} numberOfLines={1}>{locationLine}</Text>
        <TouchableOpacity style={styles.nearestBtn} onPress={openNearest}>
          <Ionicons name="business" size={13} color="#1d4ed8" />
          <Text style={styles.nearestBtnText}>Nearest</Text>
        </TouchableOpacity>
      </View>

      {/* Active route banner */}
      {routeActive && (
        <View style={styles.routeBanner}>
          <Ionicons name="navigate" size={14} color="#fff" />
          <Text style={styles.routeBannerText} numberOfLines={1}>
            {routeLabel ?? "Navigating..."}
          </Text>
          <TouchableOpacity style={styles.routeCancelBtn} onPress={handleCancelRoute}>
            <Ionicons name="close" size={14} color="#ef4444" />
            <Text style={styles.routeCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.overlay, routeActive && styles.overlayWithRoute]}>
      </View>

      {/* Nearest Centers Modal */}
      <Modal visible={showNearest} animationType="slide" transparent onRequestClose={closeNearest}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Evacuation Centers</Text>
                <Text style={styles.modalSub}>
                  {centerFilter === "smart"
                    ? (userBarangayName ? `Centers in ${userBarangayName}` : "Centers in your barangay")
                    : "All centers sorted by distance"}
                </Text>
              </View>
              <TouchableOpacity onPress={closeNearest} style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Filter toggle */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterBtn, centerFilter === "smart" && styles.filterBtnActive]}
                onPress={() => handleFilterChange("smart")}
              >
                <Ionicons name="navigate" size={13} color={centerFilter === "smart" ? "#fff" : "#64748b"} />
                <Text style={[styles.filterBtnText, centerFilter === "smart" && styles.filterBtnTextActive]}>My Barangay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, centerFilter === "all" && styles.filterBtnActive]}
                onPress={() => handleFilterChange("all")}
              >
                <Ionicons name="list" size={13} color={centerFilter === "all" ? "#fff" : "#64748b"} />
                <Text style={[styles.filterBtnText, centerFilter === "all" && styles.filterBtnTextActive]}>All Centers</Text>
              </TouchableOpacity>
            </View>

            {nearestLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#1d4ed8" />
                <Text style={styles.modalLoadingText}>
                  {centerFilter === "smart" ? "Finding centers in your barangay..." : "Loading all centers..."}
                </Text>
              </View>
            ) : nearestCenters.length === 0 ? (
              <View style={styles.modalLoading}>
                <Ionicons name="business-outline" size={48} color="#cbd5e1" />
                <Text style={styles.modalEmptyText}>
                  {centerFilter === "smart"
                    ? "No evacuation centers in your barangay.\nSwitch to \"All Centers\" to see all."
                    : "No centers found."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={nearestCenters}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingBottom: 16 }}
                renderItem={({ item }) => {
                  const isOpen  = item.op_status === "Open";
                  const isFull  = item.op_status === "Full";
                  const statusColor = isOpen ? "#16a34a" : isFull ? "#d97706" : "#dc2626";
                  const statusBg    = isOpen ? "#dcfce7" : isFull ? "#fef9c3" : "#fee2e2";
                  const pct = item.max_capacity > 0
                    ? Math.round((item.occupancy / item.max_capacity) * 100) : 0;
                  return (
                    <View style={styles.centerCard}>
                      <View style={styles.centerCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.centerName}>{item.name}</Text>
                          <Text style={styles.centerAddress} numberOfLines={1}>{item.address}</Text>
                          {item.barangay_name ? (
                            <View style={styles.barangayRow}>
                              <Ionicons name="location" size={11} color={item.is_same_barangay ? "#1d4ed8" : "#94a3b8"} />
                              <Text style={[styles.barangayText, item.is_same_barangay && styles.barangayTextSame]}>
                                {item.barangay_name}{item.is_same_barangay ? " · Your barangay" : ""}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                          <Ionicons
                            name={isOpen ? "checkmark-circle" : isFull ? "alert-circle" : "close-circle"}
                            size={12} color={statusColor}
                          />
                          <Text style={[styles.statusPillText, { color: statusColor }]}>{item.op_status}</Text>
                        </View>
                      </View>
                      <View style={styles.centerCardRow}>
                        <View style={styles.centerStat}>
                          <Ionicons name="location-outline" size={13} color="#64748b" />
                          <Text style={styles.centerStatText}>{item.distance_km} km away</Text>
                        </View>
                        <View style={styles.centerStat}>
                          <Ionicons name="people-outline" size={13} color="#64748b" />
                          <Text style={styles.centerStatText}>{item.occupancy}/{item.max_capacity} ({item.available} slots)</Text>
                        </View>
                      </View>
                      <View style={styles.capacityBar}>
                        <View style={[styles.capacityFill, {
                          width: `${pct}%` as any,
                          backgroundColor: pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#16a34a",
                        }]} />
                      </View>
                      <TouchableOpacity
                        style={[styles.directionsBtn, !isOpen && styles.directionsBtnDisabled]}
                        onPress={() => {
                          setShowNearest(false);
                          // Send get_directions to Leaflet — it will draw the route
                          sendToMap({ type: "get_directions", toLat: item.lat, toLng: item.lng, name: item.name });
                        }}
                      >
                        <Ionicons name="navigate" size={14} color={isOpen ? "#1d4ed8" : "#94a3b8"} />
                        <Text style={[styles.directionsBtnText, !isOpen && { color: "#94a3b8" }]}>
                          {isOpen ? "Get Directions" : "Center Unavailable"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#1d4ed8" },
  loadingContainer: { flex: 1, backgroundColor: "#1d4ed8" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#1d4ed8",
  },
  topBarLeft:     { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 8 },
  topBarTitle:    { color: "#fff", fontWeight: "800", fontSize: 16 },
  topBarLocation: { color: "rgba(255,255,255,0.80)", fontSize: 10, marginTop: 1 },
  topBarRight:    { flexDirection: "row", gap: 6, alignItems: "center" },
  centerBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  centerBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  gpsBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(239,68,68,0.8)", borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  gpsBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  webview: { flex: 1 },
  bottomBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 14, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: "#bae6fd",
  },
  bottomBarText: { flex: 1, fontSize: 12, color: "#1e40af", fontWeight: "600" },
  loading:     { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#f0f9ff" },
  loadingText: { fontSize: 16, color: "#1d4ed8", fontWeight: "700" },
  overlay: {
    position: "absolute", bottom: 50, left: 16, right: 16,
    flexDirection: "row", justifyContent: "flex-start", alignItems: "flex-end", gap: 8,
  },
  overlayWithRoute: {
    bottom: 92,
  },
  nearestBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#eff6ff", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  nearestBtnText: { fontSize: 11, color: "#1d4ed8", fontWeight: "700" },

  // Active route banner
  routeBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 14, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: "#1e40af",
  },
  routeBannerText: { flex: 1, fontSize: 12, color: "#fff", fontWeight: "600" },
  routeCancelBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  routeCancelText: { fontSize: 11, color: "#ef4444", fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "75%", paddingTop: 8,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  filterRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  filterBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  filterBtnActive: {
    backgroundColor: "#1d4ed8", borderColor: "#1d4ed8",
  },
  filterBtnText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  filterBtnTextActive: { color: "#fff" },
  modalTitle:       { fontSize: 17, fontWeight: "800", color: "#1e293b" },
  modalSub:         { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  modalClose:       { padding: 4 },
  modalLoading:     { alignItems: "center", paddingVertical: 48, gap: 12 },
  modalLoadingText: { fontSize: 14, color: "#64748b" },
  modalEmptyText:   { fontSize: 14, color: "#94a3b8", textAlign: "center" },
  centerCard: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: "#f8fafc",
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#e2e8f0",
  },
  centerCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  centerName:    { fontSize: 14, fontWeight: "800", color: "#1e293b" },
  centerAddress: { fontSize: 12, color: "#64748b", marginTop: 2 },
  barangayRow:   { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  barangayText:  { fontSize: 11, color: "#94a3b8" },
  barangayTextSame: { color: "#1d4ed8", fontWeight: "700" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  centerCardRow:  { flexDirection: "row", gap: 16, marginBottom: 8 },
  centerStat:     { flexDirection: "row", alignItems: "center", gap: 4 },
  centerStatText: { fontSize: 12, color: "#64748b" },
  capacityBar:    { height: 5, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginBottom: 10 },
  capacityFill:   { height: "100%", borderRadius: 3 },
  directionsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "#eff6ff", borderRadius: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  directionsBtnDisabled: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
  directionsBtnText: { fontSize: 13, color: "#1d4ed8", fontWeight: "700" },
});