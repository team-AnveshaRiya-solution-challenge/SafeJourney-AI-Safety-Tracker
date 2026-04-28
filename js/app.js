import { db, auth } from "./firebase-config.js";
import { ref, push, set, update, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  startLiveTracking,
  stopLiveTracking
} from "./tracking.js";
import { initMap } from "./map.js";
import {
  getAISummary,
  getLocalAlertInfo
} from "./ai-layer.js";

let currentTripId = null;
let currentTripData = {};
let currentUser = null;

function setTextElement(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

document.addEventListener("DOMContentLoaded", () => {

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.log("[Auth] No user logged in. Redirecting to login.");
      window.location.href = "../auth/";
      return;
    }

    console.log("[Auth] User logged in:", user.email);
    currentUser = user;
    updateUserNav(user);

    initApp();
  });

  document.getElementById("startJourneyBtn").addEventListener("click", startJourney);
  document.getElementById("endJourneyBtn").addEventListener("click", endJourney);
  document.getElementById("sosBtn").addEventListener("click", triggerSOS);
  document.getElementById("refreshSummaryBtn").addEventListener("click", refreshAISummary);
  document.getElementById("shareWithSelectedBtn").addEventListener("click", shareWithSelected);
  document.getElementById("logoutBtnSide").addEventListener("click", handleLogout);
  document.getElementById("addContactSubmitBtn").addEventListener("click", saveNewContact);

  document.getElementById("activeChatBtn").addEventListener("click", () => {
    if (userContacts.length > 0) openChat(userContacts[0].id, userContacts[0].name);
    else alert("Please add trusted contacts in the 'Trusted Circle' tab first.");
  });
  document.getElementById("activeCallBtn").addEventListener("click", () => {
    if (userContacts.length > 0) window.location.href = `tel:${userContacts[0].phone}`;
    else alert("Please add trusted contacts in the 'Trusted Circle' tab first.");
  });
});

function initApp() {
  requestNotificationPermission();

  initMap();

  loadUserHistory();
  loadUserContacts();

  const hash = window.location.hash.replace("#", "");
  if (hash) {
    const tabBtn = document.querySelector(`[data-tab="${hash}"]`);
    if (tabBtn) tabBtn.click();
  }

  addTimelineEvent(`Welcome back, ${currentUser.displayName || 'Traveller'}! Ready to start.`, "idle");
}

async function updateUserNav(user) {
  const sideAvatar = document.getElementById("sideUserAvatar");
  const sideName = document.getElementById("sideUserName");

  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    if (sideName) sideName.textContent = name;
    if (sideAvatar) sideAvatar.textContent = name[0].toUpperCase();

    const nameInput = document.getElementById("userName");
    const phoneInput = document.getElementById("userPhone");
    if (nameInput && !nameInput.value) nameInput.value = name;

    try {
      const profileRef = ref(db, `users/${user.uid}/profile`);
      onValue(profileRef, (snapshot) => {
        const profile = snapshot.val();
        if (profile && profile.phone && phoneInput && !phoneInput.value) {
          phoneInput.value = profile.phone;
        }
      }, { onlyOnce: true });
    } catch (err) {
      console.error("Profile fetch failed:", err);
    }
  }
}

async function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    try {
      await signOut(auth);
      window.location.href = "../auth/";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }
}

async function startJourney() {
  console.log("[App] Start Journey button clicked");
  const userName = document.getElementById("userName").value.trim();
  const userPhone = document.getElementById("userPhone").value.trim();
  const source = document.getElementById("source").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const expectedArrival = document.getElementById("expectedArrival").value;

  if (!userName || !userPhone || !source || !destination || !expectedArrival) {
    alert("Please fill in all fields (including phone number) before starting.");
    return;
  }

  const startBtn = document.getElementById("startJourneyBtn");
  startBtn.disabled = true;
  startBtn.innerHTML = `<span class="material-symbols-outlined">hourglass_top</span>Starting…`;

  try {
   
    const newRef = push(ref(db, "trips"));
    currentTripId = newRef.key;

    currentTripData = {
      userName, userPhone, source, destination, expectedArrival,
      userId: currentUser.uid,
      uid: currentUser.uid,
      status: "active",
      alertLevel: 0,
      currentLat: null,
      currentLng: null,
      digipin: "",
      summary: "Journey just started. Monitoring is active.",
      sharedWith: {},
      startedAt: Date.now(),
      lastUpdated: Date.now()
    };

    await set(newRef, currentTripData);

    localStorage.setItem("tripId", currentTripId);
    localStorage.setItem("userName", userName);
    localStorage.setItem("source", source);
    localStorage.setItem("destination", destination);
    localStorage.setItem("tripStatus", "active");
    localStorage.setItem("tripAlertLevel", "0");
    localStorage.setItem("tripLastUpdated", String(Date.now()));

    setNavStatus("active", "Tracking");
    setStatusDisplay("active", 0);
    startBtn.style.display = "none";
    document.getElementById("endJourneyBtn").style.display = "flex";

    const activeActions = document.getElementById("activeJourneyActions");
    const staticSos = document.getElementById("staticSos");
    if (activeActions) activeActions.style.display = "flex";
    if (staticSos) staticSos.style.display = "none";

    showShareLink(currentTripId);
    toggleFormLock(true);

    document.getElementById("shareWithSelectedBtn").disabled = false;
    document.getElementById("shareJourneyStatus").textContent =
      `Select contacts below and tap Share to notify them`;

    addTimelineEvent(`Journey started: ${source} → ${destination}`, "safe");

    userContacts.forEach(async c => {
      const guardianUrl = buildGuardianUrl(currentTripId, c.id);
      const msgRef = push(ref(db, `chats/${currentUser.uid}/${c.id}/messages`));
      await set(msgRef, {
        sender: "traveller",
        text: `🚀 I've started a journey! Track me here: ${guardianUrl}`,
        timestamp: Date.now()
      });
    });

    generateAndShowSummary();

    startLiveTracking(currentTripId);

    console.log("[App] Journey started. Trip ID:", currentTripId);

  } catch (err) {
    console.error("[App] Start journey failed with error:", err);
    alert("Could not start journey. Error: " + err.message);
    startBtn.disabled = false;
    startBtn.innerHTML = `<span class="material-symbols-outlined">play_arrow</span>Start Journey`;
  }
}

async function endJourney() {
  if (!currentTripId) return;
  if (!confirm("Mark this journey as safely completed?")) return;

  try {
    stopLiveTracking();

    await update(ref(db, `trips/${currentTripId}`), {
      status: "completed",
      alertLevel: 0,
      summary: "✅ Journey completed. Traveller has arrived safely.",
      lastUpdated: Date.now()
    });

    // Unlock form & Reset action bar
    toggleFormLock(false);
    const activeActions = document.getElementById("activeJourneyActions");
    const staticSos = document.getElementById("staticSos");
    if (activeActions) activeActions.style.display = "none";
    if (staticSos) staticSos.style.display = "flex";

    const historyEntry = {
      ...currentTripData,
      finalStatus: "safe",
      endedAt: Date.now(),
      duration: msToMinutes(Date.now() - currentTripData.startedAt)
    };
    await push(ref(db, `users/${currentUser.uid}/history`), historyEntry);

    setNavStatus("completed", "Arrived ✅");
    setStatusDisplay("completed", 0);
    document.getElementById("endJourneyBtn").disabled = true;
    document.getElementById("endJourneyBtn").innerHTML =
      `<span class="material-symbols-outlined">check_circle</span>Arrived Safely`;

    addTimelineEvent("Journey completed. Arrived safely.", "safe");
    localStorage.setItem("tripStatus", "completed");
    currentTripId = null;

  } catch (err) {
    console.error("[App] End journey failed:", err);
    if (err.message.includes("PERMISSION_DENIED")) {
      alert("Permission Denied: Could not save journey history. Please check your Firebase rules.");
    } else {
      alert("Could not complete journey. Check your connection.");
    }
  }
}

async function triggerSOS() {
  if (!currentTripId) {
    alert("Start a journey first before pressing SOS.");
    return;
  }
  if (!confirm("🚨 Send SOS alert to your guardian NOW?")) return;

  try {
    await update(ref(db, `trips/${currentTripId}`), {
      status: "sos",
      alertLevel: 3,
      summary: "🚨 EMERGENCY — Traveller pressed SOS. Immediate assistance needed.",
      lastUpdated: Date.now()
    });

    localStorage.setItem("tripStatus", "sos");
    localStorage.setItem("tripAlertLevel", "3");

    document.getElementById("sosBtn").style.boxShadow = "0 0 0 16px rgba(190,18,60,0.3)";
    setNavStatus("sos", "🚨 SOS");
    setStatusDisplay("sos", 3);

    setAnomalyDisplay(3, "🚨 SOS alert triggered. Guardian has been notified immediately.");
    updateRule("sos", "danger", "TRIGGERED");
    addTimelineEvent("🚨 SOS alert triggered!", "danger");

    alert("SOS sent. Your guardian has been alerted.");

  } catch (err) {
    console.error("[App] SOS failed:", err);
    alert("SOS failed. Check your internet connection.");
  }
}

async function generateAndShowSummary() {
  const tripData = buildCurrentTripSnapshot();
  const text = await getAISummary(tripData);
  setTextElement("aiSummaryText", text);
  setTextElement("summaryUpdatedAt", "Updated " + new Date().toLocaleTimeString());
}

async function refreshAISummary() {
  const btn = document.getElementById("refreshSummaryBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:0.9rem; animation:spin 1s linear infinite">refresh</span> Updating…`;

  await generateAndShowSummary();

  btn.disabled = false;
  btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:0.9rem;">refresh</span> Refresh Summary`;
}

async function shareWithSelected() {
  if (!currentTripId) { alert("Start a journey first."); return; }

  const selected = userContacts.filter(c => c.selected);
  if (selected.length === 0) { alert("Select at least one contact first."); return; }

  const sharedWith = {};
  selected.forEach(c => { sharedWith[c.id] = c.name; });

  try {
    await update(ref(db, `trips/${currentTripId}`), { sharedWith });
    alert(`Journey shared with: ${selected.map(c => c.name).join(", ")}`);
    addTimelineEvent(`Journey shared with ${selected.length} contact(s).`, "safe");
  } catch (err) {
    console.error("[App] Share failed:", err);
    alert("Could not share. Check your connection.");
  }
}

window.onTrackingUpdate = function ({ lat, lng, digipin, alertLevel, anomaly }) {

  setTextElement("currentCoords", lat.toFixed(5));
  setTextElement("currentLng", lng.toFixed(5));
  setTextElement("digiPinDisplay", digipin);
  setTextElement("lastUpdatedDisplay", "Updated " + new Date().toLocaleTimeString());
  setTextElement("mapStatus", "GPS Active");

  setStatusDisplay(localStorage.getItem("tripStatus") || "active", alertLevel);

  updateSafetyIntel(alertLevel, anomaly);

  currentTripData.currentLat = lat;
  currentTripData.currentLng = lng;
  currentTripData.digipin    = digipin;
};

function updateSafetyIntel(alertLevel, anomaly) {

  if (anomaly && anomaly.anomalyDetected) {
    setAnomalyDisplay(anomaly.newAlertLevel, anomaly.summary);

    if (anomaly.newAlertLevel >= 2) {
      updateRule("stationary", "warning", "CHECK");
      addTimelineEvent(anomaly.summary, "warning");
    }
  } else {
    if (alertLevel === 0) {
      setAnomalyDisplay(0, "No anomaly detected. Journey is proceeding normally.");
      updateRule("stationary", "safe", "OK");
    }
  }

  const eta = document.getElementById("expectedArrival")?.value;
  if (eta && currentTripData.startedAt) {
    const [h, m] = eta.split(":").map(Number);
    const etaToday = new Date();
    etaToday.setHours(h, m, 0, 0);
    if (Date.now() > etaToday.getTime()) {
      updateRule("eta", "warning", "OVERDUE");
      setAnomalyDisplay(1, "⚠️ Journey has exceeded the expected arrival time.");
      addTimelineEvent("Journey exceeded expected arrival time.", "warning");
    }
  }
}

export function setAnomalyDisplay(level, message) {
  const icons = { 0: "🟢", 1: "🟡", 2: "🟠", 3: "🔴" };
  document.getElementById("anomalyIcon").textContent = icons[level] || "🟡";
  document.getElementById("anomalyMessage").textContent = message;
  document.getElementById("anomalyLevel").textContent = level;
}

export function updateRule(ruleId, state, statusText) {
  const item = document.getElementById(`rule-${ruleId}`);
  const dot = item?.querySelector(".rule-dot");
  const stat = document.getElementById(`ruleStatus-${ruleId}`);
  if (dot) { dot.className = `rule-dot ${state}`; }
  if (stat) {
    stat.textContent = statusText;
    const colors = { safe: "var(--green)", warning: "var(--amber)", danger: "var(--red)" };
    stat.style.color = colors[state] || "var(--green)";
  }
}

export function addTimelineEvent(text, type = "idle") {
  const timeline = document.getElementById("eventTimeline");
  const empty = timeline.querySelector(".timeline-empty");
  if (empty) empty.remove();

  const colors = { safe: "var(--green)", warning: "var(--amber)", danger: "var(--red)", idle: "var(--secondary)" };

  const event = document.createElement("div");
  event.className = "timeline-event";
  event.innerHTML = `
    <span class="event-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    <span class="timeline-dot" style="background:${colors[type] || colors.idle}"></span>
    <span class="event-text">${text}</span>
  `;
  timeline.insertBefore(event, timeline.firstChild);
}

let userHistory = [];

function loadUserHistory() {
  const historyRef = ref(db, `users/${currentUser.uid}/history`);
  const tripsRef = ref(db, "trips");

  let historyData = {};
  let tripsData = {};

  const combineAndRender = () => {
    userHistory = [];

    // Process ongoing trips
    Object.keys(tripsData).forEach(tid => {
      if (tripsData[tid].userId === currentUser.uid && tripsData[tid].status !== "completed") {
        userHistory.push({ id: tid, ...tripsData[tid], isOngoing: true });
      }
    });

    // Process completed history
    Object.keys(historyData).forEach(key => {
      userHistory.push({ id: key, ...historyData[key], isOngoing: false });
    });

    userHistory.sort((a, b) => {
      if (a.isOngoing && !b.isOngoing) return -1;
      if (!a.isOngoing && b.isOngoing) return 1;
      return (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt);
    });

    renderHistory(userHistory);
  };

  onValue(historyRef, (snapshot) => {
    historyData = snapshot.val() || {};
    combineAndRender();
  }, (err) => {
    console.error("[History] Read failed:", err);
    if (err.message.includes("PERMISSION_DENIED")) {
      console.warn("[History] Permission denied for history path. Check Firebase rules.");
    }
  });

  onValue(tripsRef, (snapshot) => {
    tripsData = snapshot.val() || {};
    combineAndRender();
  }, (err) => {
    console.error("[Trips] Read failed:", err);
  });
}

function renderHistory(data) {
  const grid = document.getElementById("historyGrid");
  grid.innerHTML = "";

  if (!data || !data.length) {
    grid.innerHTML = `<div style="color:var(--secondary); padding:2rem; text-align:center;">No history found.</div>`;
    return;
  }

  const tagMap = {
    safe: { cls: "tag-safe", label: "✅ Safe" },
    sos: { cls: "tag-sos", label: "🚨 SOS" },
    active: { cls: "tag-active", label: "📡 Ongoing" },
    completed: { cls: "tag-safe", label: "✅ Arrived" }
  };

  data.forEach(j => {
    const status = j.isOngoing ? "active" : (j.finalStatus || "completed");
    const tag = tagMap[status] || tagMap.safe;

    const card = document.createElement("div");
    card.className = `history-card${j.isOngoing ? ' ongoing' : ''}`;

    const dateStr = new Date(j.startedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const timeStr = new Date(j.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    card.innerHTML = `
      <div class="hc-header">
        <div class="hc-route-info">
          <div class="hc-route">${j.source} → ${j.destination}</div>
          <div class="hc-meta">
            <span class="material-symbols-outlined">event</span> ${dateStr}
            <span class="meta-sep">•</span>
            <span class="material-symbols-outlined">schedule</span> ${timeStr}
          </div>
        </div>
        <div class="status-badge ${tag.cls}">${tag.label}</div>
      </div>

      <div class="hc-stats-row">
        <div class="hc-stat">
          <div class="stat-label">Safety Alerts</div>
          <div class="stat-value ${j.alertLevel > 0 ? 'text-red' : 'text-green'}">${j.alertLevel || 0}</div>
        </div>
        <div class="hc-stat">
          <div class="stat-label">Duration</div>
          <div class="stat-value">${j.duration || "—"}</div>
        </div>
      </div>

      <div class="hc-footer">
        ${j.isOngoing
        ? `<button class="btn btn-primary" onclick="resumeJourney('${j.id}')">
               <span class="material-symbols-outlined">play_circle</span> Resume Tracking
             </button>`
        : `<button class="btn btn-outline" onclick="alert('Detailed logs: No safety incidents recorded.')">
               <span class="material-symbols-outlined">analytics</span> View Details
             </button>`
      }
      </div>
    `;
    grid.appendChild(card);
  });
}

window.resumeJourney = function (tripId) {
  const trip = userHistory.find(t => t.id === tripId);
  if (!trip) return;

  document.getElementById("userName").value = trip.userName || "";
  document.getElementById("userPhone").value = trip.userPhone || "";
  document.getElementById("source").value = trip.source || "";
  document.getElementById("destination").value = trip.destination || "";
  document.getElementById("expectedArrival").value = trip.expectedArrival || "";

  currentTripId = tripId;
  currentTripData = trip;

  toggleFormLock(true);

  const activeActions = document.getElementById("activeJourneyActions");
  const staticSos = document.getElementById("staticSos");
  if (activeActions) activeActions.style.display = "flex";
  if (staticSos) staticSos.style.display = "none";

  localStorage.setItem("tripId", tripId);
  localStorage.setItem("userName", trip.userName);
  localStorage.setItem("tripStatus", trip.status);

  document.querySelectorAll(".sidebar-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.getElementById("tab-dashboard").classList.add("active");

  startLiveTracking(tripId);

  document.getElementById("startJourneyBtn").style.display = "none";
  document.getElementById("endJourneyBtn").style.display = "flex";
  showShareLink(tripId);
  setNavStatus(trip.status, trip.status === "sos" ? "🚨 SOS" : "Tracking");

  addTimelineEvent("Resumed ongoing journey tracking.", "safe");
};


window.filterHistory = function (filter) {
  const filtered = filter === "all"
    ? userHistory
    : userHistory.filter(j => j.finalStatus === filter);
  renderHistory(filtered);
};

let userContacts = [];

function loadUserContacts() {
  const contactsRef = ref(db, `users/${currentUser.uid}/contacts`);
  onValue(contactsRef, (snapshot) => {
    const data = snapshot.val();
    userContacts = [];
    if (data) {
      Object.keys(data).forEach(key => {
        userContacts.push({ id: key, ...data[key] });
      });
    }
    renderContacts(userContacts);
  });
}


async function saveNewContact() {
  const name = document.getElementById("newContactName").value.trim();
  const relation = document.getElementById("newContactRelation").value.trim();
  const phone = document.getElementById("newContactPhone").value.trim();

  if (!name || !relation || !phone) {
    alert("Please fill in all contact details.");
    return;
  }

  const btn = document.getElementById("addContactSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
    const contactsRef = ref(db, `users/${currentUser.uid}/contacts`);
    await push(contactsRef, {
      name,
      relationship: relation,
      phone,
      createdAt: Date.now()
    });

  
    document.getElementById("newContactName").value = "";
    document.getElementById("newContactRelation").value = "";
    document.getElementById("newContactPhone").value = "";

    alert("Contact added successfully!");
  } catch (err) {
    console.error("Add contact failed:", err);
    if (err.message.includes("PERMISSION_DENIED")) {
      alert("Permission Denied: Could not save contact. Please check your Firebase rules.");
    } else {
      alert("Failed to add contact.");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Add";
  }
}

function renderContacts(contacts) {
  const grid = document.getElementById("contactsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (contacts.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--secondary); padding:3rem;">No trusted contacts added yet.</div>`;
    return;
  }

  contacts.forEach(c => {
    const card = document.createElement("div");
    card.className = `contact-card${c.selected ? " selected" : ""}`;
    card.dataset.contactId = c.id;
    card.innerHTML = `
      <div class="contact-top" style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <div class="contact-avatar" style="width:48px; height:48px; background:var(--primary-lt); color:var(--primary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.2rem;">
          ${c.name[0].toUpperCase()}
        </div>
        <div style="flex:1">
          <div class="contact-name" style="font-weight:800; font-size:1.1rem; color:#0f172a;">${c.name}</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="contact-relation" style="font-size:0.75rem; font-weight:700; color:var(--secondary); text-transform:uppercase; letter-spacing:0.05em;">${c.relationship}</span>
            <span style="color:var(--outline); font-size:10px;">•</span>
            <span class="contact-phone" style="font-size:0.85rem; color:var(--secondary); font-family:monospace;">${c.phone}</span>
          </div>
        </div>
        <div class="selected-check material-symbols-outlined" style="color:var(--primary); font-weight:900; font-size:1.4rem;">${c.selected ? "check_circle" : ""}</div>
      </div>
      
      <div class="contact-actions" style="display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--outline);">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); window.location.href='tel:${c.phone}'" style="flex:1; padding:6px;">
          <span class="material-symbols-outlined" style="font-size:1rem;">call</span>
        </button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openChat('${c.id}', '${c.name}')" style="flex:1; padding:6px;">
          <span class="material-symbols-outlined" style="font-size:1rem;">chat</span>
        </button>
        <button class="btn btn-primary btn-sm" id="shareBtn-${c.id}" onclick="event.stopPropagation(); shareWithOne('${c.id}', '${c.name}')" style="flex:2; padding:6px; font-size:0.75rem;">
          <span class="material-symbols-outlined" style="font-size:1rem;">share</span> Share Link
        </button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); removeContact('${c.id}', '${c.name}')" style="width:36px; padding:6px;" title="Remove Contact">
          <span class="material-symbols-outlined" style="font-size:1rem;">delete</span>
        </button>
      </div>
    `;

    card.addEventListener("click", () => {
      c.selected = !c.selected;
      card.classList.toggle("selected", c.selected);
      const checkEl = card.querySelector(".selected-check");
      if (checkEl) checkEl.textContent = c.selected ? "check_circle" : "";
    });

    grid.appendChild(card);
  });
}

window.shareWithOne = async function (contactId, contactName) {
  if (!currentTripId) { alert("Start a journey first to share it."); return; }
  const guardianUrl = buildGuardianUrl(currentTripId, contactId);
  if (navigator.share) {
    await navigator.share({ title: `Safe Journey — Track ${localStorage.getItem("userName")}`, url: guardianUrl });
  } else {
    await navigator.clipboard.writeText(guardianUrl);
    alert(`Link copied! Send it to ${contactName}.`);
  }
};

window.removeContact = async function (contactId, contactName) {
  if (!confirm(`Are you sure you want to remove ${contactName} from your Trusted Circle?`)) return;

  try {
    const contactRef = ref(db, `users/${currentUser.uid}/contacts/${contactId}`);
    await remove(contactRef);
    addTimelineEvent(`Removed contact: ${contactName}`, "idle");
  } catch (err) {
    console.error("Remove contact failed:", err);
    alert("Failed to remove contact.");
  }
};

function setNavStatus(status, label) {
  const pill = document.getElementById("navStatusPill");
  const labelEl = document.getElementById("navStatusLabel");
  if (!pill || !labelEl) return;

  labelEl.textContent = label;
  pill.classList.remove("active", "emergency");

  if (status === "active") {
    pill.classList.add("active");
  } else if (status === "sos") {
    pill.classList.add("emergency");
  }
}

function buildGuardianUrl(tripId, contactId = null) {
  const base = window.location.href.split("/").slice(0, -1).join("/");
  let url = `${base}/guardian.html?trip=${tripId}`;
  if (contactId) url += `&contact=${contactId}`;
  return url;
}

function showShareLink(tripId) {
  const section = document.getElementById("shareSection");
  const input = document.getElementById("shareUrl");
  if (section && input) {
    input.value = buildGuardianUrl(tripId);
    section.style.display = "block";
  }
}

function setStatusDisplay(status, alertLevel) {
  document.getElementById("statusDisplay").textContent = status.toUpperCase();
  document.getElementById("alertLevelDisplay").textContent = alertLevel;
}

function buildCurrentTripSnapshot() {
  return {
    userName: localStorage.getItem("userName") || "",
    source: localStorage.getItem("source") || "",
    destination: localStorage.getItem("destination") || "",
    status: localStorage.getItem("tripStatus") || "active",
    alertLevel: parseInt(localStorage.getItem("tripAlertLevel") || "0"),
    lastUpdated: parseInt(localStorage.getItem("tripLastUpdated") || "0"),
    currentLat: currentTripData.currentLat,
    currentLng: currentTripData.currentLng
  };
}

let chatListener = null;
let currentChatContactId = null;

async function requestNotificationPermission() {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    console.log("[App] Notification permission:", permission);
  }
}

window.openChat = function (contactId, contactName) {
  currentChatContactId = contactId;
  const modal = document.getElementById("chatModalOverlay");
  const nameEl = document.getElementById("chatContactName");
  const avatarEl = document.getElementById("chatContactAvatar");
  const messagesEl = document.getElementById("chatMessages");

  nameEl.textContent = contactName;
  avatarEl.textContent = contactName[0];
  messagesEl.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--secondary); font-size:0.9rem;">
    <span class="material-symbols-outlined" style="font-size:2rem; margin-bottom:12px; opacity:0.5;">sync</span>
    Connecting to secure chat...
  </div>`;
  const sendLinkBtn = document.getElementById("sendLinkInChatBtn");
  if (sendLinkBtn) {
    sendLinkBtn.style.display = currentTripId ? "flex" : "none";
  }

  modal.classList.add("active");

  if (chatListener) chatListener();

  const chatRef = ref(db, `chats/${currentUser.uid}/${contactId}/messages`);
  chatListener = onValue(chatRef, (snapshot) => {
    messagesEl.innerHTML = "";
    const data = snapshot.val();
    if (!data) {
      messagesEl.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--secondary); font-size:0.9rem; text-align:center; padding:2rem;">
        <span class="material-symbols-outlined" style="font-size:2.5rem; margin-bottom:12px; opacity:0.3;">chat_bubble</span>
        No messages here yet.<br>Send a message to your trusted contact.
      </div>`;
      return;
    }

    let lastMsg = null;
    Object.values(data).forEach(m => {
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${m.sender === 'traveller' ? 'sent' : 'received'}`;
      bubble.innerHTML = `
        <div>${m.text}</div>
        <span class="chat-time">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      `;
      messagesEl.appendChild(bubble);
      lastMsg = m;
    });

    if (lastMsg && lastMsg.sender === "guardian") {
      const modal = document.getElementById("chatModalOverlay");
      if (!modal.classList.contains("active") || document.hidden) {
        new Notification(`Safe Journey: Message from ${contactName}`, {
          body: lastMsg.text,
          icon: "https://cdn-icons-png.flaticon.com/512/3119/3119338.png"
        });
      }
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
};

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !currentChatContactId) return;

  try {
    const msgRef = push(ref(db, `chats/${currentUser.uid}/${currentChatContactId}/messages`));
    await set(msgRef, {
      sender: "traveller",
      text: text,
      timestamp: Date.now()
    });
    input.value = "";
  } catch (err) {
    console.error("Chat send failed:", err);
  }
}

document.getElementById("closeChatBtn").addEventListener("click", () => {
  document.getElementById("chatModalOverlay").classList.remove("active");
  if (chatListener) chatListener();
});

document.getElementById("chatModalOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("chatModalOverlay")) {
    document.getElementById("chatModalOverlay").classList.remove("active");
    if (chatListener) chatListener();
  }
});

document.getElementById("sendChatBtn").addEventListener("click", sendChatMessage);
document.getElementById("chatInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

document.getElementById("sendLinkInChatBtn").addEventListener("click", async () => {
  if (!currentTripId || !currentChatContactId) return;
  const guardianUrl = buildGuardianUrl(currentTripId);
  try {
    const msgRef = push(ref(db, `chats/${currentUser.uid}/${currentChatContactId}/messages`));
    await set(msgRef, {
      sender: "traveller",
      text: `📍 My Live Journey Link: ${guardianUrl}`,
      timestamp: Date.now()
    });
    addTimelineEvent("Shared live link in chat.", "safe");
  } catch (err) {
    console.error("Link share in chat failed:", err);
  }
});

function openContactSelector() {
  if (userContacts.length === 0) {
    alert("Add trusted contacts first in the 'Trusted Circle' tab.");
    return;
  }
  renderContactSelectList();
  document.getElementById("contactSelectModalOverlay").classList.add("active");
}

function closeContactSelector() {
  document.getElementById("contactSelectModalOverlay").classList.remove("active");
}

function renderContactSelectList() {
  const list = document.getElementById("contactSelectList");
  list.innerHTML = "";
  userContacts.forEach(c => {
    const item = document.createElement("div");
    item.className = "contact-select-item";
    item.innerHTML = `
      <div class="contact-avatar" style="background:var(--primary-lt); color:var(--primary);">${c.name[0].toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-weight:800; font-size:0.9rem;">${c.name}</div>
        <div style="font-size:0.75rem; color:var(--secondary);">${c.relationship}</div>
      </div>
      <span class="material-symbols-outlined" style="color:var(--primary); font-size:1.2rem;">chevron_right</span>
    `;
    item.onclick = () => {
      closeContactSelector();
      openChat(c.id, c.name);
    };
    list.appendChild(item);
  });
}

document.getElementById("closeContactSelectBtn").addEventListener("click", closeContactSelector);
document.getElementById("contactSelectModalOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("contactSelectModalOverlay")) closeContactSelector();
});

document.getElementById("activeChatBtn").addEventListener("click", openContactSelector);

function msToMinutes(ms) {
  return Math.round(ms / 60000) + " min";
}

function toggleFormLock(isLocked) {
  const inputs = ["userName", "userPhone", "source", "destination", "expectedArrival"];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = isLocked;
  });
}