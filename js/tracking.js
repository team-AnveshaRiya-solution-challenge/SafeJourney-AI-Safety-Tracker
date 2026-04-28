import { db } from "./firebase-config.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { updateMapMarker } from "./map.js";
import { generateDigipin } from "./digipin.js";
import {
  detectAnomaly,
  getAISummary
} from "./ai-layer.js";

let watchId = null;
let prevLat = null;
let prevLng = null;
let aiCallTimer = null;

export function startLiveTracking(tripId) {
  if (!navigator.geolocation) {
    alert("This browser does not support GPS. Tracking won't work.");
    return;
  }

  console.log("[Tracking] Starting GPS for trip:", tripId);

  watchId = navigator.geolocation.watchPosition(

    
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const now = Date.now();

      console.log("[Tracking] GPS received:", { lat, lng, timestamp: now });

      
      updateMapMarker(lat, lng);

      
      const digipin = generateDigipin(lat, lng);
      console.log("[Tracking] Generated digipin:", digipin, { lat, lng });

      const tripState = getLocalTripState();
      const anomaly = detectAnomaly({
        lastUpdated: tripState.lastUpdated,
        currentLat: lat,
        currentLng: lng,
        previousLat: prevLat,
        previousLng: prevLng,
        currentStatus: tripState.status
      });

      const payload = {
        currentLat: lat,
        currentLng: lng,
        digipin,
        lastUpdated: now
      };

      if (anomaly.anomalyDetected) {
        payload.alertLevel = anomaly.newAlertLevel;
        payload.summary = anomaly.summary;
        localStorage.setItem("tripAlertLevel", String(anomaly.newAlertLevel));
      }

      try {
        await update(ref(db, `trips/${tripId}`), payload);
        console.log("[Tracking] ✅ Firebase updated with Digipin:", digipin);
        localStorage.setItem("tripLastUpdated", String(now));
      } catch (err) {
        console.error("[Tracking] ❌ Firebase write failed:", err);
      }

      if (typeof window.onTrackingUpdate === "function") {
        window.onTrackingUpdate({
          lat, lng, digipin,
          alertLevel: anomaly.anomalyDetected ? anomaly.newAlertLevel : tripState.alertLevel,
          anomaly
        });
      }

      prevLat = lat;
      prevLng = lng;
    },

    (err) => {
      const msgs = {
        1: "Location permission denied. Allow location in browser settings.",
        2: "GPS unavailable. Move to an open area.",
        3: "GPS timeout. Retrying…"
      };
      console.error("[Tracking] GPS error:", err.code);
      alert(msgs[err.code] || "GPS error occurred.");
    },

    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );

  aiCallTimer = setInterval(async () => {
    try {
      const state = getLocalTripState();
      if (state.status !== "active") return;
      const summary = await getAISummary(state);
      await update(ref(db, `trips/${tripId}`), { summary });
      console.log("[AI] Summary updated:", summary);
    } catch (err) {
      console.warn("[AI] Refresh skipped:", err.message);
    }
  }, 60000);
}

export function stopLiveTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (aiCallTimer !== null) {
    clearInterval(aiCallTimer);
    aiCallTimer = null;
  }
  console.log("[Tracking] Stopped.");
}

function getLocalTripState() {
  return {
    status: localStorage.getItem("tripStatus") || "active",
    alertLevel: parseInt(localStorage.getItem("tripAlertLevel") || "0"),
    lastUpdated: parseInt(localStorage.getItem("tripLastUpdated") || String(Date.now())),
    userName: localStorage.getItem("userName") || "",
    source: localStorage.getItem("source") || "",
    destination: localStorage.getItem("destination") || "",
    currentLat: prevLat,
    currentLng: prevLng
  };
}