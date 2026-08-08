import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";
import * as GpsTracker from "../../services/gps-tracker";

export default function RescueMapScreen() {
  const [evacuees, setEvacuees] = useState<any[]>([]);
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(GpsTracker.getLastCoords());
  const webRef = useRef<WebView>(null);

  const fetchEvacuees = useCallback(async () => {
    try {
      const token = await getToken();
      // Fetch evacuees needing help in rescuer's barangay
      const res = await fetch(`${API_BASE_URL}/api/users/list-all?status=Need_Assistance,In_Danger`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEvacuees(data.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchEvacuees();
    const interval = setInterval(fetchEvacuees, 5000);
    return () => clearInterval(interval);
  }, [fetchEvacuees]);

  useEffect(() => {
    const unsub = GpsTracker.onLocationUpdate((update) => {
      if (update.coords) setMyCoords(update.coords);
    });
    return unsub;
  }, []);

  // Send data to webview when evacuees or location change
  useEffect(() => {
    if (!webRef.current) return;
    const payload = JSON.stringify({
      type: "update",
      myLocation: myCoords ? { lat: myCoords.latitude, lng: myCoords.longitude } : null,
      evacuees: evacuees.filter((e) => e.latitude && e.longitude).map((e) => ({
        id: e.id,
        name: e.full_name,
        lat: parseFloat(e.latitude),
        lng: parseFloat(e.longitude),
        status: e.status,
      })),
    });
    webRef.current.injectJavaScript(`window.updateMapData(${payload}); true;`);
  }, [evacuees, myCoords]);

  const mapHtml = `
    <!DOCTYPE html>
    <html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>html,body,#map{height:100%;margin:0;padding:0;font-family:sans-serif}</style>
    </head><body>
    <div id="map"></div>
    <script>
      var map = L.map('map').setView([10.535, 122.84], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
      var markers = L.layerGroup().addTo(map);
      var myMarker = null;

      window.updateMapData = function(data) {
        markers.clearLayers();
        // My location (rescuer)
        if (data.myLocation) {
          if (myMarker) { myMarker.setLatLng([data.myLocation.lat, data.myLocation.lng]); }
          else {
            myMarker = L.marker([data.myLocation.lat, data.myLocation.lng], {
              icon: L.divIcon({ html:'<div style="width:18px;height:18px;border-radius:50%;background:#0d9488;border:3px solid white;box-shadow:0 2px 8px rgba(13,148,136,0.5)"></div>', className:'', iconSize:[18,18], iconAnchor:[9,9] })
            }).addTo(map).bindPopup('<b>You</b>');
          }
        }
        // Evacuees needing help
        data.evacuees.forEach(function(e) {
          var color = e.status === 'In_Danger' ? '#ef4444' : '#f59e0b';
          var icon = L.divIcon({
            html:'<div style="width:14px;height:14px;border-radius:50%;background:'+color+';border:2.5px solid white;box-shadow:0 2px 6px '+color+'40"></div>',
            className:'', iconSize:[14,14], iconAnchor:[7,7]
          });
          L.marker([e.lat, e.lng], {icon:icon}).addTo(markers)
            .bindPopup('<b>'+e.name+'</b><br/>'+e.status.replace('_',' '));
        });
      };
    </script>
    </body></html>
  `;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />
      <View style={styles.header}>
        <Ionicons name="map" size={20} color="#fff" />
        <Text style={styles.headerTitle}>Rescue Map</Text>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: "#0d9488" }]} />
          <Text style={styles.legendText}>You</Text>
          <View style={[styles.dot, { backgroundColor: "#f59e0b" }]} />
          <Text style={styles.legendText}>Need Help</Text>
          <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
          <Text style={styles.legendText}>Danger</Text>
        </View>
      </View>
      <WebView
        ref={webRef}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled
        originWhitelist={["*"]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: "#0d4f4f" },
  header:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },
  legend:      { flexDirection: "row", alignItems: "center", gap: 4 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  legendText:  { color: "rgba(255,255,255,0.7)", fontSize: 10, marginRight: 6 },
  map:         { flex: 1 },
});
