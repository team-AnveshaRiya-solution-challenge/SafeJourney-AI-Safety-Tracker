let GEMINI_API_KEY = "";

// Expert Fix: Use dynamic import so the app doesn't crash if config.js is missing on Vercel
async function loadConfig() {
  try {
    const config = await import('./config.js');
    GEMINI_API_KEY = config.GEMINI_API_KEY;
  } catch (e) {
    console.warn("[AI] Config file not found, using local fallback mode.");
  }
}
loadConfig();

const GEMINI_URL_BASE = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent`;


/**
 * Returns a status object based on trip data.
 * This is instant — no API call needed.
 *
 * @param {object} tripData - The trip object from Firebase
 * @returns {{ badge: string, text: string, color: string, cssClass: string }}
 */
export function getLocalAlertInfo(tripData) {
  const status             = tripData.status      || "idle";
  const alertLevel         = tripData.alertLevel  || 0;
  const lastUpdated        = tripData.lastUpdated || 0;
  const secondsSinceUpdate = (Date.now() - lastUpdated) / 1000;

  // ── SOS: highest priority ──────────────────────────────
  if (status === "sos" || alertLevel >= 3) {
    return {
      badge:    "🚨 SOS",
      text:     "EMERGENCY — Traveller has triggered SOS. Contact immediately.",
      color:    "#BE123C",
      cssClass: "sos"
    };
  }

  // ── Inactivity warning ─────────────────────────────────
  // No GPS update for 8+ minutes while journey is active
  if (status === "active" && lastUpdated > 0 && secondsSinceUpdate > 480) {
    return {
      badge:    "⚠️ DELAYED",
      text:     `No location update for ${Math.round(secondsSinceUpdate / 60)} minutes. Traveller may need help.`,
      color:    "#B45309",
      cssClass: "sos"
    };
  }

  // ── Journey completed ──────────────────────────────────
  if (status === "completed") {
    return {
      badge:    "✅ ARRIVED",
      text:     "Journey completed. Traveller has arrived safely.",
      color:    "#10B981",
      cssClass: "safe"
    };
  }

  // ── Active and safe ────────────────────────────────────
  if (status === "active") {
    return {
      badge:    "🟢 SAFE",
      text:     "Journey is active. Traveller is on the move.",
      color:    "#10B981",
      cssClass: "safe"
    };
  }

  // ── Default / not started ──────────────────────────────
  return {
    badge:    "⬜ IDLE",
    text:     "Waiting for journey to begin.",
    color:    "#64748B",
    cssClass: "idle"
  };
}


/**
 * Calls Google Gemini to generate a smart safety summary.
 * Falls back to local rule-based text if anything fails.
 *
 * @param {object} tripData - Full trip object from Firebase
 * @returns {Promise<string>} - A short safety summary sentence
 */
export async function getAISummary(tripData) {

  if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
    console.info("[Gemini] No API key configured. Using local alert text fallback.");
    return getLocalAlertInfo(tripData).text;
  }

  try {
    const {
      userName    = "the traveller",
      source      = "origin",
      destination = "destination",
      status      = "unknown",
      alertLevel  = 0,
      lastUpdated = 0
    } = tripData;

    const minutesSinceUpdate = lastUpdated
      ? Math.round((Date.now() - lastUpdated) / 60000)
      : null;

    const prompt = `
You are a safety monitoring assistant for a women's commute safety app called Safe Journey.

A guardian is monitoring a traveller. Here is the current trip status:
- Traveller name: ${userName}
- Route: ${source} → ${destination}
- Current status: ${status}
- Alert level: ${alertLevel} (0 = safe, 1 = caution, 2 = warning, 3 = emergency/SOS)
- Minutes since last GPS update: ${minutesSinceUpdate ?? "unknown"}

Write ONE short, calm sentence (maximum 25 words) as a safety summary for the guardian.

Rules:
- If status is "sos" OR alert level is 3: write an urgent emergency message
- If minutes since update is more than 8 and status is "active": write a mild concern message
- If status is "completed": write a reassuring arrival confirmation
- If status is "active" and update is recent: write a calm safety confirmation
- Do NOT use markdown, bullet points, asterisks, or any formatting
- Output ONLY the summary sentence, nothing else
`.trim();

    // ── Call the Gemini API ───────────────────────────────
    const response = await fetch(`${GEMINI_URL_BASE}?key=${GEMINI_API_KEY}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        
        generationConfig: {
          maxOutputTokens: 60,
          temperature:     0.3   
        }
      })
    });

    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(`Gemini error ${response.status}: ${errData?.error?.message || "unknown"}`);
    }

    const data = await response.json();

    
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (text && text.length > 5) {
      console.log("[Gemini] ✅ Summary generated:", text);
      return text;
    }

    throw new Error("Gemini returned empty response");

  } catch (err) {
    
    console.warn("[Gemini] ⚠️ Falling back to local summary:", err.message);
    return getLocalAlertInfo(tripData).text;
  }
}

/**
 * Checks for anomalies in the current tracking state.
 *
 * @param {object} params
 * @param {number} params.lastUpdated    - timestamp of previous update
 * @param {number} params.currentLat
 * @param {number} params.currentLng
 * @param {number} params.previousLat
 * @param {number} params.previousLng
 * @param {string} params.currentStatus
 * @returns {{ anomalyDetected: boolean, newAlertLevel: number, summary: string }}
 */
export function detectAnomaly({
  lastUpdated,
  currentLat,
  currentLng,
  previousLat,
  previousLng,
  currentStatus
}) {
  // Don't flag anomalies if SOS is already active or journey is done
  if (currentStatus === "sos" || currentStatus === "completed") {
    return {
      anomalyDetected: false,
      newAlertLevel:   currentStatus === "sos" ? 3 : 0,
      summary:         ""
    };
  }

  const secondsGap = lastUpdated ? (Date.now() - lastUpdated) / 1000 : 0;

  if (secondsGap > 600) {
    return {
      anomalyDetected: true,
      newAlertLevel:   2,
      summary: `⚠️ No movement detected for ${Math.round(secondsGap / 60)} minutes. Guardian has been notified.`
    };
  }

  if (previousLat && previousLng) {
    const latDiff = Math.abs(currentLat - previousLat);
    const lngDiff = Math.abs(currentLng - previousLng);
    if (latDiff > 0.5 || lngDiff > 0.5) {
      console.warn("[Anomaly] Large GPS jump detected — likely a glitch, ignoring.");
    }
  }

  return { anomalyDetected: false, newAlertLevel: 0, summary: "" };
}
