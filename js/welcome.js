import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const cardTraveller = document.getElementById("cardTraveller");
const cardGuardian  = document.getElementById("cardGuardian");
const modal         = document.getElementById("guardianModal");
const btnCancel     = document.getElementById("btnCancel");
const btnSubmit     = document.getElementById("btnSubmitLink");
const linkInput     = document.getElementById("trackingLink");
const linkError     = document.getElementById("linkError");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../auth/";
    return;
  }

  const sideAvatar = document.getElementById("sideUserAvatar");
  const sideName   = document.getElementById("sideUserName");
  if (sideName)   sideName.textContent   = user.displayName || user.email.split('@')[0];
  if (sideAvatar) sideAvatar.textContent = (user.displayName || user.email)[0].toUpperCase();
});

const menuBtn = document.getElementById("menuToggle");
const sidebar = document.getElementById("mainSidebar");
const overlay = document.getElementById("sidebarOverlay");

function toggleSidebar() {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("active");
}

if (menuBtn) menuBtn.addEventListener("click", toggleSidebar);
if (overlay) overlay.addEventListener("click", toggleSidebar);

document.getElementById("logoutBtnSide").addEventListener("click", async () => {
  if (confirm("Are you sure you want to logout?")) {
    await signOut(auth);
    window.location.href = "../auth/";
  }
});

cardTraveller.addEventListener("click", () => {
  window.location.href = "../traveller/";
});

cardGuardian.addEventListener("click", () => {
  modal.classList.add("active");
});

btnCancel.addEventListener("click", () => {
  modal.classList.remove("active");
  linkError.style.display = "none";
});

btnSubmit.addEventListener("click", () => {
  const url = linkInput.value.trim();
  
  if (!url) {
    showError("Please enter a link.");
    return;
  }

  try {
    const urlObj = new URL(url);
    const tripId = urlObj.searchParams.get("trip");
    
    if (url.includes("guardian") && tripId) {
      window.location.href = url.replace("guardian.html", "../guardian/");
    } else {
      showError("Invalid link format. Use the full tracking URL.");
    }
  } catch (e) {
    
    if (url.startsWith("-") && url.length > 10) {
      window.location.href = `../guardian/?trip=${url}`;
    } else {
      showError("Please enter a valid URL or Trip ID.");
    }
  }
});

function showError(msg) {
  linkError.textContent = msg;
  linkError.style.display = "block";
}