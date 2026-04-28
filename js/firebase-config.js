// ============================================================
// FILE: js/firebase-config.js
// IMPORTS: Nothing (this is the root of the import chain)
// IMPORTED BY: app.js, guardian.js, tracking.js, ai-layer.js
//
// This is the ONLY place Firebase keys live.
// Change keys here and every other file automatically uses them.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAv4C7x2NFsSX0CAqQ94fVcEzBk3WNY3Rg",
  authDomain:        "woman-safety-app-7136c.firebaseapp.com",
  databaseURL:       "https://woman-safety-app-7136c-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId:         "woman-safety-app-7136c",
  storageBucket:     "woman-safety-app-7136c.firebasestorage.app",
  messagingSenderId: "1088151568900",
  appId:             "1:1088151568900:web:cc0973413f8062609beb51"
};

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

export { db, auth };
