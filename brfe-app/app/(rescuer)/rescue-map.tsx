import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, FlatList, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";
import * as GpsTracker from "../../services/gps-tracker";
import { BARANGAY_BOUNDARIES, BARANGAY_ID_MAP } from "../../constants/barangayBoundaries";

function decodeJwt(token: string): any {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b.padEnd(b.length + ((4 - (b.length % 4)) % 4), "=")));
  } catch { return null; }
}

export default function RescueMapScreen() {
  const [evacuees, setEvacuees] = useState<any[]>([]);
  const [activeRescue, setActiveRescue] = useState<any>(null);
  const [navigating, setNavigating] = useState(false);
  const [routeInfo, setRouteInfo] = useState<string | null>(null);
  const [barangayId, setBarangayId] = useState<number | null>(null);
  const [rescuerId, setRescuerId] = useState<number | null>(null);
  const webRef = useRef<WebView>(null);
  const gpsInterval = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const p = decodeJwt(token);
      if (p?.barangay_id) setBarangayId(p.barangay_id);
      if (p?.user_id) setRescuerId(p.user_id);
    })();
  }, []);

  const fetchEvacuees = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/rescue/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = data.data || data.rescue_requests || [];
      setEvacuees(list.filter((r: any) => r.req_status === "Pending" || r.req_status === "Ongoing"));
    } catch {}
  }, []);

  useEffect(() => {
    fetchEvacuees();
    const i = setInterval(fetchEvacuees, 5000);
    return () => clearInterval(i);
  }, [fetchEvacuees]);

  // Post rescuer GPS to backend every 3 seconds while navigating
  useEffect(() => {
    if (!navigating || !activeRescue) {
      if (gpsInterval.current) { clearInterval(gpsInterval.current); gpsInterval.current = null; }
      return;
    }
    const postLocation = async () => {
      const coords = GpsTracker.getLastCoords();
      if (!coords) return;
      try {
        const token = await getToken();
        await fetch(`${API_BASE_URL}/api/rescue/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude, rescue_id: activeRescue.id }),
        });
      } catch {}
    };
    postLocation();
    gpsInterval.current = setInterval(postLocation, 3000);
    return () => { if (gpsInterval.current) clearInterval(gpsInterval.current); };
  }, [navigating, activeRescue]);

  // GPS tracking
  useEffect(() => {
    const unsub = GpsTracker.onLocationUpdate((update) => {
      if (update.coords && webRef.current) {
        const js = `window.updateMyLocation && window.updateMyLocation(${update.coords.latitude},${update.coords.longitude}); true;`;
        webRef.current.injectJavaScript(js);
      }
    });
    return unsub;
  }, []);

  function startNavigation(rescue: any) {
    setActiveRescue(rescue);
    setNavigating(true);
    // Use best available location
    const lat = rescue.best_lat || rescue.current_lat || rescue.lat;
    const lng = rescue.best_lng || rescue.current_lng || rescue.lng;
    if (webRef.current) {
      webRef.current.injectJavaScript(
        `window.navigateTo && window.navigateTo(${lat},${lng},"${(rescue.full_name || "Evacuee").replace(/"/g, "")}"); true;`
      );
    }
  }

  function cancelNavigation() {
    setNavigating(false);
    setActiveRescue(null);
    setRouteInfo(null);
    if (webRef.current) {
      webRef.current.injectJavaScript(`window.cancelNav && window.cancelNav(); true;`);
    }
  }

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "route_info") setRouteInfo(`${msg.distance} · ${msg.duration}`);
      if (msg.type === "map_ready") {
        // Send boundaries
        const name = barangayId ? (BARANGAY_ID_MAP as any)[barangayId] : null;
        const filtered = name ? BARANGAY_BOUNDARIES.filter((b) => b.name === name) : BARANGAY_BOUNDARIES;
        webRef.current?.injectJavaScript(`window.drawBoundaries && window.drawBoundaries(${JSON.stringify(filtered)}); true;`);
        // Send evacuee markers
        sendEvacueeMarkers();
      }
    } catch {}
  }

  function sendEvacueeMarkers() {
    if (!webRef.current) return;
    const data = evacuees.filter((e) => {
      // Use best_lat/best_lng (guaranteed by backend) or fallback
      const lat = e.best_lat || e.current_lat || e.lat;
      const lng = e.best_lng || e.current_lng || e.lng;
      return lat && lng;
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
  }

  useEffect(() => { sendEvacueeMarkers(); }, [evacuees]);

  const mapHtml = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<style>html,body,#map{height:100%;margin:0;padding:0;font-family:sans-serif}
#nav-bar{display:none;position:absolute;bottom:10px;left:10px;right:10px;background:#fff;border-radius:14px;padding:12px 16px;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:1000;font-size:13px;display:flex;align-items:center;gap:10px}
</style>
</head><body>
<div id="map"></div>
<script>
var map,myMarker=null,evacueeMarkers=[],directionsRenderer=null,directionsService=null;
var navDestLat=null,navDestLng=null,navDestName='',lastRerouteLat=null,lastRerouteLng=null;

function initMap(){
  map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:10.535,lng:122.84},zoom:14,
    disableDefaultUI:true,zoomControl:true,
    styles:[{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]}]
  });
  directionsService=new google.maps.DirectionsService();
  directionsRenderer=new google.maps.DirectionsRenderer({map:map,suppressMarkers:true,
    polylineOptions:{strokeColor:'#0d9488',strokeWeight:5,strokeOpacity:0.8}});
  postToRN({type:'map_ready'});
}

function postToRN(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o));}

window.updateMyLocation=function(lat,lng){
  var pos={lat:lat,lng:lng};
  if(myMarker){myMarker.setPosition(pos);}
  else{
    myMarker=new google.maps.Marker({position:pos,map:map,zIndex:1000,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#0d9488',fillOpacity:1,strokeColor:'#fff',strokeWeight:3}});
    map.setCenter(pos);map.setZoom(15);
  }
  // Auto-reroute if navigating and moved more than 50m from last route calc
  if(navDestLat!==null&&lastRerouteLat!==null){
    var dlat=lat-lastRerouteLat,dlng=lng-lastRerouteLng;
    var dist=Math.sqrt(dlat*dlat+dlng*dlng)*111000;
    if(dist>50){
      lastRerouteLat=lat;lastRerouteLng=lng;
      doRoute(lat,lng,navDestLat,navDestLng,navDestName);
    }
  }
};

window.updateEvacuees=function(list){
  evacueeMarkers.forEach(function(m){m.setMap(null);});
  evacueeMarkers=[];
  list.forEach(function(e){
    var color = e.offline ? '#9ca3af' : (e.user_status==='In_Danger'?'#ef4444':'#f59e0b');
    var m=new google.maps.Marker({position:{lat:e.lat,lng:e.lng},map:map,zIndex:500,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:2.5}});
    var statusText = e.offline ? 'Offline (last known location)' : (e.user_status||'').replace('_',' ');
    var info=new google.maps.InfoWindow({content:'<div style="font-family:sans-serif"><b>'+e.name+'</b><br/><span style="color:'+color+';font-weight:700;">'+statusText+'</span></div>'});
    m.addListener('click',function(){info.open(map,m);});
    evacueeMarkers.push(m);
  });
};

window.drawBoundaries=function(boundaries){
  boundaries.forEach(function(b){
    var coords=b.coords,rings;
    if(typeof coords[0][0]==='number'){rings=[coords];}else{rings=coords;}
    rings.forEach(function(ring){
      var path=ring.map(function(c){return{lat:c[1],lng:c[0]};});
      new google.maps.Polygon({paths:path,map:map,strokeColor:b.color,strokeOpacity:0.8,strokeWeight:2,fillColor:b.color,fillOpacity:0.2,clickable:false,zIndex:1});
    });
    if(boundaries.length===1){
      var bounds=new google.maps.LatLngBounds();
      rings.forEach(function(ring){ring.forEach(function(c){bounds.extend({lat:c[1],lng:c[0]});});});
      map.fitBounds(bounds,{top:20,bottom:20,left:20,right:20});
    }
  });
};

window.navigateTo=function(lat,lng,name){
  if(!myMarker)return;
  navDestLat=lat;navDestLng=lng;navDestName=name;
  var origin=myMarker.getPosition();
  lastRerouteLat=origin.lat();lastRerouteLng=origin.lng();
  doRoute(origin.lat(),origin.lng(),lat,lng,name);
};

function doRoute(fromLat,fromLng,toLat,toLng,name){
  directionsService.route({
    origin:{lat:fromLat,lng:fromLng},
    destination:{lat:toLat,lng:toLng},
    travelMode:google.maps.TravelMode.DRIVING
  },function(result,status){
    if(status==='OK'){
      directionsRenderer.setDirections(result);
      var leg=result.routes[0].legs[0];
      // Send step-by-step instructions
      var steps=leg.steps.map(function(s){return s.instructions.replace(/<[^>]*>/g,'');});
      postToRN({type:'route_info',distance:leg.distance.text,duration:leg.duration.text,nextStep:steps[0]||''});
    }
  });
}

window.cancelNav=function(){
  directionsRenderer.setDirections({routes:[]});
  navDestLat=null;navDestLng=null;lastRerouteLat=null;lastRerouteLng=null;
};
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAgqwnR4Y2VbK7kIi_yrYxxHr5FTiXQwZc&callback=initMap"></script>
</body></html>`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />
      <View style={styles.header}>
        <Ionicons name="navigate" size={18} color="#fff" />
        <Text style={styles.headerTitle}>Rescue Map</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{evacuees.length} active</Text>
        </View>
      </View>

      <WebView
        ref={webRef}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled
        originWhitelist={["*"]}
        onMessage={handleMessage}
      />

      {/* Navigation bar */}
      {navigating && activeRescue && (
        <View style={styles.navBar}>
          <Ionicons name="navigate" size={16} color="#0d9488" />
          <View style={{ flex: 1 }}>
            <Text style={styles.navName}>{activeRescue.full_name || "Evacuee"}</Text>
            <Text style={styles.navInfo}>{routeInfo || "Calculating route..."}</Text>
            {activeRescue.contact_no && (
              <Text style={styles.navContact}>📞 {activeRescue.contact_no}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.navCancel} onPress={cancelNavigation}>
            <Text style={styles.navCancelText}>End</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Evacuee list at bottom */}
      {!navigating && evacuees.length > 0 && (
        <View style={styles.listWrap}>
          <FlatList
            horizontal
            data={evacuees}
            keyExtractor={(item) => String(item.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
            renderItem={({ item }) => {
              const isDanger = item.user_status === "In_Danger";
              const lat = item.best_lat || item.current_lat || item.lat;
              const lng = item.best_lng || item.current_lng || item.lng;
              return (
                <TouchableOpacity style={[styles.card, isDanger && styles.cardDanger]} onPress={() => startNavigation(item)}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.full_name || "Evacuee"}</Text>
                  <Text style={[styles.cardStatus, { color: isDanger ? "#ef4444" : "#f59e0b" }]}>
                    {(item.user_status || "").replace("_", " ")}
                  </Text>
                  {item.barangay_name && <Text style={styles.cardBarangay}>{item.barangay_name}</Text>}
                  {item.contact_no && <Text style={styles.cardContact}>📞 {item.contact_no}</Text>}
                  {lat && lng && <Text style={styles.cardCoords}>{parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}</Text>}
                  <View style={styles.cardNav}>
                    <Ionicons name="navigate" size={12} color="#0d9488" />
                    <Text style={styles.cardNavText}>Navigate</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d4f4f" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },
  headerBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  headerBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  map: { flex: 1 },
  navBar: {
    position: "absolute", bottom: 16, left: 16, right: 16,
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  navName: { fontSize: 14, fontWeight: "800", color: "#1e293b" },
  navInfo: { fontSize: 12, color: "#64748b", marginTop: 1 },
  navCancel: { backgroundColor: "#fef2f2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  navCancelText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  listWrap: { position: "absolute", bottom: 16, left: 0, right: 0 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12, width: 150,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  cardDanger: { borderLeftWidth: 3, borderLeftColor: "#ef4444" },
  cardName: { fontSize: 13, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  cardStatus: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  cardBarangay: { fontSize: 10, color: "#64748b", marginBottom: 1 },
  cardContact: { fontSize: 10, color: "#0d9488", marginBottom: 1 },
  cardCoords: { fontSize: 9, color: "#94a3b8", marginBottom: 4 },
  cardNav: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardNavText: { fontSize: 11, color: "#0d9488", fontWeight: "700" },
  navContact: { fontSize: 11, color: "#0d9488", marginTop: 2 },
});
