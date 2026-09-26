import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Linking, ActivityIndicator, Platform } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";
import * as GpsTracker from "../../services/gps-tracker";
import { BARANGAY_BOUNDARIES, BARANGAY_ID_MAP } from "../../constants/barangayBoundaries";
import { isInsideBarangay } from "../../services/geo";
import { RC, RADIUS, SPACING, shadow, glow } from "../../features/rescuer/theme";
import { RescuerScreen, ScreenHeader } from "../../features/rescuer/components";

function decodeJwt(token: string): any {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b.padEnd(b.length + ((4 - (b.length % 4)) % 4), "=")));
  } catch { return null; }
}

export default function RescueMapScreen() {
  const [evacuees, setEvacuees] = useState<any[]>([]);
  const [barangayId, setBarangayId] = useState<number | null>(null);
  const [myId, setMyId] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const p = decodeJwt(token);
      if (p?.barangay_id) setBarangayId(p.barangay_id);
      if (p?.user_id != null) setMyId(Number(p.user_id));
    })();
    GpsTracker.start();
  }, []);

  const fetchEvacuees = useCallback(async () => {
    try {
      const token = await getToken();
      const meId = myId ?? (() => {
        const p = decodeJwt(token || "");
        return p?.user_id != null ? Number(p.user_id) : null;
      })();
      const res = await fetch(`${API_BASE_URL}/api/rescue/list?status=Ongoing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = data.rescue_requests || data.data || [];

      // Only evacuees ASSIGNED TO THIS RESCUER — an Ongoing request whose
      // responder is me. Requests handled by other rescuers are hidden.
      const mine = list.filter(
        (r: any) => r.req_status === "Ongoing" && meId != null && Number(r.responder_id) === meId
      );

      // Never show rescued/safe evacuees on the map. A completed rescue marks
      // the evacuee as "Safe", so drop anything already resolved.
      const notSafe = mine.filter((r: any) => {
        const s = String(r.user_status || "").toLowerCase();
        return r.req_status !== "Completed" && s !== "safe";
      });

      const brgyName = barangayId != null ? (BARANGAY_ID_MAP as any)[barangayId] : null;
      const scoped = brgyName
        ? notSafe.filter((r: any) => isInsideBarangay(r.best_lat ?? r.lat, r.best_lng ?? r.lng, brgyName))
        : notSafe;
      setEvacuees(scoped);
    } catch {}
  }, [barangayId, myId]);

  useEffect(() => {
    fetchEvacuees();
    const i = setInterval(fetchEvacuees, 5000);
    return () => clearInterval(i);
  }, [fetchEvacuees]);

  // Feed GPS into the map once it is ready (shows the rescuer's live position).
  useEffect(() => {
    if (!mapReady) return;
    const unsub = GpsTracker.onLocationUpdate((update) => {
      if (update.coords && webRef.current) {
        if (!gpsLocked) setGpsLocked(true);
        const acc = update.coords.accuracy ?? "null";
        const js = `window.updateMyLocation && window.updateMyLocation(${update.coords.latitude},${update.coords.longitude},${acc}); true;`;
        webRef.current.injectJavaScript(js);
      }
    });
    return unsub;
  }, [mapReady, gpsLocked]);

  // Launch the phone's native Google Maps turn-by-turn navigation. On mobile
  // this opens the real Google Maps app (system navigation overlay). Falls back
  // to Apple Maps on iOS if Google Maps isn't installed, then to the web.
  const openInGoogleMaps = useCallback(async (lat: number, lng: number, label?: string) => {
    if (!isFinite(lat) || !isFinite(lng)) return;
    const q = `${lat},${lng}`;
    try {
      if (Platform.OS === "android") {
        // Starts Google Maps driving navigation directly.
        await Linking.openURL(`google.navigation:q=${q}&mode=d`);
        return;
      }
      if (Platform.OS === "ios") {
        const gmaps = `comgooglemaps://?daddr=${q}&directionsmode=driving`;
        if (await Linking.canOpenURL(gmaps)) {
          await Linking.openURL(gmaps);
          return;
        }
        // Apple Maps fallback (d = drive).
        await Linking.openURL(`http://maps.apple.com/?daddr=${q}&dirflg=d`);
        return;
      }
    } catch {
      // fall through to web
    }
    // Web / last-resort fallback: Google Maps directions in the browser.
    const name = label ? `&destination_place_id=${encodeURIComponent(label)}` : "";
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving${name}`
    );
  }, []);

  // Navigate = hand off to the native Google Maps app. No in-app routing.
  const navigateToEvacuee = useCallback((rescue: any) => {
    const lat = parseFloat(rescue.best_lat || rescue.current_lat || rescue.lat);
    const lng = parseFloat(rescue.best_lng || rescue.current_lng || rescue.lng);
    openInGoogleMaps(lat, lng, rescue.full_name);
  }, [openInGoogleMaps]);

  const recenter = useCallback(() => {
    webRef.current?.injectJavaScript(`window.recenter && window.recenter(); true;`);
  }, []);

  const fitAll = useCallback(() => {
    webRef.current?.injectJavaScript(`window.fitAll && window.fitAll(); true;`);
  }, []);

  const sendEvacueeMarkers = useCallback(() => {
    if (!webRef.current) return;
    const data = evacuees.filter((e) => {
      const lat = e.best_lat || e.current_lat || e.lat;
      const lng = e.best_lng || e.current_lng || e.lng;
      // Safety net: never plot a rescued/safe evacuee even if one slips in.
      const safe = String(e.user_status || "").toLowerCase() === "safe" || e.req_status === "Completed";
      return lat && lng && !safe;
    }).map((e) => ({
      id: e.id,
      name: e.full_name || "Evacuee",
      lat: parseFloat(e.best_lat || e.current_lat || e.lat),
      lng: parseFloat(e.best_lng || e.current_lng || e.lng),
      status: e.req_status,
      user_status: e.user_status,
      offline: !e.is_online,
    }));
    webRef.current.injectJavaScript(`window.updateEvacuees && window.updateEvacuees(${JSON.stringify(data)}); true;`);
  }, [evacuees]);

  useEffect(() => { sendEvacueeMarkers(); }, [sendEvacueeMarkers]);

  // Draw ONLY the rescuer's own barangay jurisdiction on the map.
  const drawMyBarangay = useCallback(() => {
    if (!webRef.current) return;
    const name = barangayId != null ? (BARANGAY_ID_MAP as any)[barangayId] : null;
    if (!name) return; // Wait until the barangay is known — never draw all.
    const filtered = BARANGAY_BOUNDARIES.filter((b) => b.name === name);
    if (filtered.length === 0) return;
    webRef.current.injectJavaScript(
      `window.drawBoundaries && window.drawBoundaries(${JSON.stringify(filtered)}); true;`
    );
  }, [barangayId]);

  // Redraw the jurisdiction once the map is ready AND the barangay is resolved
  // (the JWT decode is async, so barangayId often lands after map_ready).
  useEffect(() => {
    if (mapReady) drawMyBarangay();
  }, [mapReady, drawMyBarangay]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "marker_tap") {
        const target = evacuees.find((e) => String(e.id) === String(msg.id));
        if (target) navigateToEvacuee(target);
      }
      if (msg.type === "map_ready") {
        setMapReady(true);
        // Draw only THIS rescuer's barangay jurisdiction. If the barangay isn't
        // resolved from the JWT yet, the dedicated effect above draws it once it
        // is — we never fall back to drawing every barangay.
        drawMyBarangay();
        const coords = GpsTracker.getLastCoords();
        if (coords && webRef.current) {
          webRef.current.injectJavaScript(
            `window.updateMyLocation && window.updateMyLocation(${coords.latitude},${coords.longitude},${coords.accuracy ?? "null"}); true;`
          );
        }
        sendEvacueeMarkers();
      }
    } catch {}
  }

  const dangerCount = useMemo(
    () => evacuees.filter((e) => (e.user_status || "").toLowerCase().includes("danger")).length,
    [evacuees]
  );

  const mapHtml = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<style>html,body,#map{height:100%;margin:0;padding:0;font-family:sans-serif}</style>
</head><body>
<div id="map"></div>
<script>
var map,myMarker=null,myAccuracy=null,evacueeMarkers=[];

function initMap(){
  map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:10.535,lng:122.84},zoom:14,
    disableDefaultUI:true,zoomControl:false,gestureHandling:'greedy',
    styles:[
      {featureType:'poi',stylers:[{visibility:'off'}]},
      {featureType:'transit',stylers:[{visibility:'off'}]},
      {featureType:'road',elementType:'labels.icon',stylers:[{visibility:'off'}]}
    ]
  });
  postToRN({type:'map_ready'});
}
function postToRN(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o));}

window.updateMyLocation=function(lat,lng,acc){
  var pos={lat:lat,lng:lng};
  var radius=(acc&&acc>0)?Math.min(120,Math.max(12,acc)):20;
  if(myMarker){myMarker.setPosition(pos);myAccuracy.setCenter(pos);myAccuracy.setRadius(radius);}
  else{
    myAccuracy=new google.maps.Circle({center:pos,radius:radius,map:map,fillColor:'#0d9488',fillOpacity:0.12,strokeColor:'#0d9488',strokeOpacity:0.3,strokeWeight:1,zIndex:998,clickable:false});
    myMarker=new google.maps.Marker({position:pos,map:map,zIndex:1000,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:'#0d9488',fillOpacity:1,strokeColor:'#fff',strokeWeight:3}});
    map.setCenter(pos);map.setZoom(16);
  }
};

window.recenter=function(){ if(myMarker){map.panTo(myMarker.getPosition());map.setZoom(16);} };

window.fitAll=function(){
  var b=new google.maps.LatLngBounds();var any=false;
  if(myMarker){b.extend(myMarker.getPosition());any=true;}
  evacueeMarkers.forEach(function(m){b.extend(m.getPosition());any=true;});
  if(any)map.fitBounds(b,{top:80,bottom:220,left:50,right:50});
};

window.updateEvacuees=function(list){
  evacueeMarkers.forEach(function(m){m.setMap(null);});
  evacueeMarkers=[];
  list.forEach(function(e){
    var danger=(e.user_status||'').toLowerCase().indexOf('danger')>-1;
    var color=e.offline?'#9ca3af':(danger?'#ef4444':'#f59e0b');
    var m=new google.maps.Marker({position:{lat:e.lat,lng:e.lng},map:map,zIndex:danger?600:500,
      icon:{path:'M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z',fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:1.5,scale:1.6,anchor:new google.maps.Point(12,22)}});
    var statusText=e.offline?'Offline · last known':((e.user_status||'').replace('_',' '));
    var html='<div style="font-family:sans-serif;min-width:150px"><b>'+e.name+'</b><br/><span style="color:'+color+';font-weight:700;font-size:12px">'+statusText+'</span><br/><button onclick="window.__nav('+e.id+')" style="margin-top:6px;background:#0d9488;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:700;font-size:12px">Navigate</button></div>';
    var info=new google.maps.InfoWindow({content:html});
    m.addListener('click',function(){info.open(map,m);});
    evacueeMarkers.push(m);
  });
};
window.__nav=function(id){postToRN({type:'marker_tap',id:id});};

var boundaryPolys=[];
window.drawBoundaries=function(boundaries){
  // Clear any previously drawn boundary polygons so re-draws never stack.
  boundaryPolys.forEach(function(p){p.setMap(null);});
  boundaryPolys=[];
  boundaries.forEach(function(b){
    var coords=b.coords,rings;
    if(typeof coords[0][0]==='number'){rings=[coords];}else{rings=coords;}
    rings.forEach(function(ring){
      var path=ring.map(function(c){return{lat:c[1],lng:c[0]};});
      var poly=new google.maps.Polygon({paths:path,map:map,strokeColor:b.color,strokeOpacity:0.85,strokeWeight:2,fillColor:b.color,fillOpacity:0.12,clickable:false,zIndex:1});
      boundaryPolys.push(poly);
    });
    if(boundaries.length===1){
      var bounds=new google.maps.LatLngBounds();
      rings.forEach(function(ring){ring.forEach(function(c){bounds.extend({lat:c[1],lng:c[0]});});});
      map.fitBounds(bounds,{top:20,bottom:20,left:20,right:20});
    }
  });
};
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAYMxiPynLx-KZ7udjt382QPsgadmzh7HM&callback=initMap"></script>
</body></html>`;

  return (
    <RescuerScreen>
      <ScreenHeader
        title="Rescue Map"
        subtitle={`${evacuees.length} assigned to you`}
        icon="map"
        right={
          <View style={styles.headerBadges}>
            {dangerCount > 0 && (
              <View style={styles.dangerBadge}>
                <Ionicons name="warning" size={12} color="#fff" />
                <Text style={styles.dangerBadgeTxt}>{dangerCount}</Text>
              </View>
            )}
            <View style={[styles.gpsDot, { backgroundColor: gpsLocked ? RC.green : RC.amber }]} />
          </View>
        }
      />

      <View style={styles.mapWrap}>
        <WebView
          ref={webRef}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled
          originWhitelist={["*"]}
          onMessage={handleMessage}
        />

        {!mapReady && (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={RC.primary} />
            <Text style={styles.mapLoadingTxt}>Loading map…</Text>
          </View>
        )}

        {/* Floating map controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={recenter}>
            <Ionicons name="locate" size={20} color={RC.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={fitAll}>
            <Ionicons name="scan-outline" size={20} color={RC.text} />
          </TouchableOpacity>
        </View>

        {/* Evacuee bottom sheet */}
        <View style={[styles.sheet, shadow(6)]}>
          <TouchableOpacity style={styles.sheetHandle} onPress={() => setSheetOpen((v) => !v)} activeOpacity={0.8}>
            <View style={styles.handleBar} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>My assigned evacuees</Text>
              <View style={styles.sheetCount}><Text style={styles.sheetCountTxt}>{evacuees.length}</Text></View>
              <Ionicons name={sheetOpen ? "chevron-down" : "chevron-up"} size={18} color={RC.textMuted} style={{ marginLeft: "auto" }} />
            </View>
          </TouchableOpacity>

          {sheetOpen && (
            evacuees.length === 0 ? (
              <View style={styles.sheetEmpty}>
                <Ionicons name="checkmark-done-circle-outline" size={32} color={RC.primary} />
                <Text style={styles.sheetEmptyTxt}>No evacuees assigned to you</Text>
              </View>
            ) : (
              <FlatList
                horizontal
                data={evacuees}
                keyExtractor={(item) => String(item.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sheetList}
                renderItem={({ item }) => {
                  const danger = (item.user_status || "").toLowerCase().includes("danger");
                  const lat = item.best_lat || item.current_lat || item.lat;
                  const lng = item.best_lng || item.current_lng || item.lng;
                  return (
                    <View style={[styles.eCard, danger && styles.eCardDanger]}>
                      <View style={styles.eTop}>
                        <View style={[styles.eDot, { backgroundColor: item.is_online === false ? RC.textFaint : danger ? RC.red : RC.amber }]} />
                        <Text style={styles.eName} numberOfLines={1}>{item.full_name || "Evacuee"}</Text>
                      </View>
                      <Text style={[styles.eStatus, { color: danger ? RC.red : RC.amber }]} numberOfLines={1}>
                        {(item.user_status || "Needs help").replace("_", " ")}
                      </Text>
                      {item.barangay_name ? <Text style={styles.eMeta} numberOfLines={1}>{item.barangay_name}</Text> : null}
                      {lat && lng ? <Text style={styles.eCoords}>{parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}</Text> : null}
                      <TouchableOpacity style={[styles.eNavBtn, glow(RC.primary, 2)]} onPress={() => navigateToEvacuee(item)}>
                        <Ionicons name="navigate" size={13} color="#fff" />
                        <Text style={styles.eNavTxt}>Navigate</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )
          )}
        </View>
      </View>
    </RescuerScreen>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, backgroundColor: RC.bg },
  map: { flex: 1 },
  mapLoading: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: RC.bg },
  mapLoadingTxt: { marginTop: SPACING.md, color: RC.textMuted, fontWeight: "700" },

  headerBadges: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  dangerBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: RC.red, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  dangerBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  gpsDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },

  controls: { position: "absolute", right: SPACING.lg, top: SPACING.lg, gap: SPACING.md },
  ctrlBtn: { width: 46, height: 46, borderRadius: RADIUS.md, backgroundColor: RC.surface, justifyContent: "center", alignItems: "center", ...shadow(3) },

  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: RC.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: SPACING.lg },
  sheetHandle: { paddingTop: SPACING.sm, paddingHorizontal: SPACING.lg },
  handleBar: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: RC.border, marginBottom: SPACING.sm },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingBottom: SPACING.sm },
  sheetTitle: { fontSize: 15, fontWeight: "800", color: RC.text },
  sheetCount: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.pill, backgroundColor: RC.primaryTint, alignItems: "center" },
  sheetCountTxt: { fontSize: 12, fontWeight: "800", color: RC.primary },

  sheetEmpty: { alignItems: "center", gap: 8, paddingVertical: SPACING.xl },
  sheetEmptyTxt: { fontSize: 13, color: RC.textMuted, fontWeight: "600" },

  sheetList: { paddingHorizontal: SPACING.lg, gap: SPACING.md, paddingTop: 4 },
  eCard: { width: 168, backgroundColor: RC.bgAlt, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: RC.border },
  eCardDanger: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  eTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  eDot: { width: 8, height: 8, borderRadius: 4 },
  eName: { fontSize: 13.5, fontWeight: "800", color: RC.text, flex: 1 },
  eStatus: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  eMeta: { fontSize: 11, color: RC.textMuted },
  eCoords: { fontSize: 10, color: RC.textFaint, marginTop: 1, marginBottom: SPACING.sm },
  eNavBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: RC.primary, borderRadius: RADIUS.sm, paddingVertical: 9, marginTop: 2 },
  eNavTxt: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
});
