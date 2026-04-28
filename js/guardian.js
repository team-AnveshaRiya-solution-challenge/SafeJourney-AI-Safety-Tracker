import { db, auth }          from "./firebase-config.js";
import { ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getLocalAlertInfo } from "./ai-layer.js";
import { generateDigipin }   from "./digipin.js";

let map            = null;
let travelerMarker = null;
let prevStatus     = null;   
let travelerUid     = null;   
let currentContactId = null;   

onAuthStateChanged(auth, (user) => {
  const sideAvatar = document.getElementById("sideUserAvatar");
  const sideName   = document.getElementById("sideUserName");
  const logoutBtn  = document.getElementById("logoutBtnSide");

  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    if (sideName)   sideName.textContent   = name;
    if (sideAvatar) sideAvatar.textContent = name[0].toUpperCase();
    if (logoutBtn)  logoutBtn.onclick = handleLogout;
  } else {
    if (sideName)   sideName.textContent   = "Guest Guardian";
    if (sideAvatar) sideAvatar.textContent = "G";
    if (logoutBtn)  logoutBtn.style.display = "none";
  }
});

async function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    await signOut(auth);
    window.location.href = "../auth/";
  }
}

const DEFAULT_LAT  = 19.076;
const DEFAULT_LNG  = 72.8777;

async function requestNotificationPermission() {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    console.log("[Guardian] Notification permission:", permission);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  requestNotificationPermission();
  initGuardianMap(DEFAULT_LAT, DEFAULT_LNG);

  const params = new URLSearchParams(window.location.search);
  const tripId = params.get("trip");
  currentContactId = params.get("contact") || "general";

  if (!tripId) {
    document.getElementById("guardianContent").innerHTML = `
      <div style="padding:4rem 2rem; text-align:center;">
        <span class="material-symbols-outlined" style="font-size:4rem; color:var(--red); margin-bottom:1rem;">link_off</span>
        <h2 style="font-weight:900;">Invalid Tracking Link</h2>
        <p style="color:var(--secondary); margin-bottom:2rem;">The link you followed is broken or the journey has ended.</p>
        <button class="btn btn-primary" onclick="window.location.href='../welcome/'">Go to Home</button>
      </div>`;
    return;
  }

  const sidebar = document.getElementById("mainSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuToggle = document.getElementById("menuToggle");

  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  });

  console.log("[Guardian] Watching trip:", tripId);

  onValue(ref(db, `trips/${tripId}`), (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      setText("alertSummary", "Trip not found or expired.");
      return;
    }

    console.log("[Guardian] Update:", data);

    setText("travelerName", data.userName || "Unknown");
    setText("travelerPhone", data.userPhone || "—");
    setText("routeDisplay", `${data.source || "?"} → ${data.destination || "?"}`);
    setText("etaDisplay",    data.expectedArrival || "—");
    setText("alertLevelG",   String(data.alertLevel ?? 0));
    
    travelerUid = data.uid || data.userId;
    document.getElementById("chatContactName").textContent = data.userName || "Traveller";
    document.getElementById("chatContactAvatar").textContent = (data.userName || "T")[0].toUpperCase();
    
    window.currentTravelerPhone = data.userPhone;

    const initial = document.getElementById("travelerInitial");
    if (initial) initial.textContent = (data.userName || "?")[0].toUpperCase();

    if (data.startedAt) {
      setText("journeyStarted", new Date(data.startedAt).toLocaleTimeString());
    }

    const lat = data.currentLat;
    const lng = data.currentLng;

    if (lat != null && lng != null) {
      setText("coordsDisplay", `${lat.toFixed(5)}° N,  ${lng.toFixed(5)}° E`);
      const digipin = data.digipin || generateDigipin(lat, lng);
      setText("digipinDisplay", digipin);
      updateGuardianMap(lat, lng);
      setText("mapStatusG", "GPS Active");
    } else {
      setText("coordsDisplay",  "Waiting for GPS fix…");
      setText("digipinDisplay", "—");
    }

    const alertInfo   = getLocalAlertInfo(data);
    const summaryText = data.summary || alertInfo.text;

    const alertEl = document.getElementById("alertSummary");
    if (alertEl) {
      alertEl.textContent = summaryText;
      alertEl.className   = `alert-banner ${alertInfo.cssClass}`;
    }

    const badge = document.getElementById("statusBadge");
    if (badge) {
      badge.textContent      = alertInfo.badge;
      badge.style.color      = alertInfo.color;
      badge.style.background = data.status === "sos" ? "#fff1f2" : "#f0fdf4";
      badge.style.border     = `1.5px solid ${alertInfo.color}`;
    }

    if (data.summary) {
      setText("aiSummaryG", data.summary);
    }

    const sosBanner = document.getElementById("sosBanner");
    if (sosBanner) {
      sosBanner.style.display = data.status === "sos" ? "flex" : "none";
    }

    if (data.lastUpdated) {
      const sec = Math.round((Date.now() - data.lastUpdated) / 1000);
      const label = sec < 10 ? "just now" : sec < 60 ? `${sec}s ago` : `${Math.round(sec/60)} min ago`;
      setText("lastUpdated", `Updated ${label}`);
    }

    if (data.status !== prevStatus) {
      const messages = {
        active:    `Journey started: ${data.source} → ${data.destination}`,
        sos:       "🚨 SOS TRIGGERED — Immediate attention required!",
        completed: "✅ Journey completed safely."
      };
      const types = { active: "safe", sos: "danger", completed: "safe" };
      if (messages[data.status]) {
        addGuardianEvent(messages[data.status], types[data.status] || "idle");
      }
      prevStatus = data.status;
    }

    if (lat != null && lat !== undefined) {
      addGuardianEvent(`Location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, "safe");
    }
  });
});

function initGuardianMap(lat, lng) {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  travelerMarker = L.circleMarker([lat, lng], {
    radius: 11, fillColor: "#1E3A8A", color: "#fff", weight: 3,
    opacity: 0, fillOpacity: 0
  }).addTo(map);
  travelerMarker.bindPopup("📍 Traveller is here");
}

function updateGuardianMap(lat, lng) {
  if (!map) { initGuardianMap(lat, lng); return; }
  travelerMarker.setStyle({ opacity: 1, fillOpacity: 1 });
  travelerMarker.setLatLng([lat, lng]);
  if (map.getZoom() < 15) map.setView([lat, lng], 16);
  else map.panTo([lat, lng]);
}

const MAX_EVENTS = 20;
let eventCount = 0;

function addGuardianEvent(text, type = "idle") {
  const timeline = document.getElementById("guardianTimeline");
  const empty    = timeline.querySelector(".timeline-empty");
  if (empty) empty.remove();

  if (text.startsWith("Location") && eventCount % 5 !== 0) { eventCount++; return; }

  const colors = { safe: "var(--green)", warning: "var(--amber)", danger: "var(--red)", idle: "var(--secondary)" };
  const div = document.createElement("div");
  div.className = "timeline-event";
  div.innerHTML = `
    <span class="event-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    <span class="timeline-dot" style="background:${colors[type] || colors.idle}"></span>
    <span class="event-text">${text}</span>
  `;
  timeline.insertBefore(div, timeline.firstChild);

  const all = timeline.querySelectorAll(".timeline-event");
  if (all.length > MAX_EVENTS) all[all.length - 1].remove();

  eventCount++;
}

let chatListener = null;

window.openGuardianChat = function() {
  if (!travelerUid) { alert("Still loading traveller data..."); return; }
  
  const modal = document.getElementById("chatModalOverlay");
  const messagesEl = document.getElementById("chatMessages");
  
  modal.classList.add("active");

  if (chatListener) chatListener();

  const chatRef = ref(db, `chats/${travelerUid}/${currentContactId}/messages`);
  chatListener = onValue(chatRef, (snapshot) => {
    messagesEl.innerHTML = "";
    const data = snapshot.val();
    if (!data) {
      messagesEl.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--secondary); font-size:0.9rem; text-align:center; padding:2rem;">
        <span class="material-symbols-outlined" style="font-size:2.5rem; margin-bottom:12px; opacity:0.3;">chat_bubble</span>
        No messages here yet.<br>Send a message to the traveller.
      </div>`;
      return;
    }

    let lastMsg = null;
    Object.values(data).forEach(m => {
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${m.sender === 'guardian' ? 'sent' : 'received'}`;
      bubble.innerHTML = `
        <div>${m.text}</div>
        <span class="chat-time">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      `;
      messagesEl.appendChild(bubble);
      lastMsg = m;
    });

    if (lastMsg && lastMsg.sender === "traveller") {
      const modal = document.getElementById("chatModalOverlay");
      if (!modal.classList.contains("active") || document.hidden) {
        new Notification(`Safe Journey: Message from Traveller`, {
          body: lastMsg.text,
          icon: "https://cdn-icons-png.flaticon.com/512/3119/3119338.png"
        });
      }
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
};

window.sendGuardianMessage = async function() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !travelerUid) return;

  try {
    const msgRef = push(ref(db, `chats/${travelerUid}/${currentContactId}/messages`));
    await set(msgRef, {
      sender: "guardian",
      text: text,
      timestamp: Date.now()
    });
    input.value = "";
  } catch (err) {
    console.error("Chat send failed:", err);
  }
};

window.closeGuardianChat = function() {
  document.getElementById("chatModalOverlay").classList.remove("active");
  if (chatListener) chatListener();
};

document.getElementById("sendChatBtn").addEventListener("click", sendGuardianMessage);
document.getElementById("chatInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendGuardianMessage();
});
document.getElementById("closeChatBtn").addEventListener("click", closeGuardianChat);
document.getElementById("chatModalOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("chatModalOverlay")) closeGuardianChat();
});

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}