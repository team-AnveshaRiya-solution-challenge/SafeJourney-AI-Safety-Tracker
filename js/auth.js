import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const authForm     = document.getElementById("authForm");
const emailInput   = document.getElementById("email");
const passInput    = document.getElementById("password");
const nameInput    = document.getElementById("regName");
const nameGroup    = document.getElementById("nameGroup");
const phoneInput   = document.getElementById("regPhone");
const phoneGroup   = document.getElementById("phoneGroup");
const btnSubmit    = document.getElementById("btnSubmit");
const btnText      = document.getElementById("btnText");
const authError    = document.getElementById("authError");
const authSubtitle = document.getElementById("authSubtitle");
const toggleAuth   = document.getElementById("toggleAuth");
const footerText   = document.getElementById("footerText");
const tabLogin     = document.getElementById("tabLogin");
const tabSignup    = document.getElementById("tabSignup");

let isLoginMode = true;

function setMode(login) {
  isLoginMode = login;
  authError.style.display = "none";
  
  if (isLoginMode) {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    nameGroup.style.display = "none";
    phoneGroup.style.display = "none";
    authSubtitle.textContent = "Welcome back! Please sign in.";
    btnText.textContent = "Sign In";
    footerText.textContent = "Don't have an account?";
    toggleAuth.textContent = "Create one";
    nameInput.required = false;
    phoneInput.required = false;
  } else {
    tabLogin.classList.remove("active");
    tabSignup.classList.add("active");
    nameGroup.style.display = "block";
    phoneGroup.style.display = "block";
    authSubtitle.textContent = "Join us to travel with confidence.";
    btnText.textContent = "Create Account";
    footerText.textContent = "Already have an account?";
    toggleAuth.textContent = "Sign in instead";
    nameInput.required = true;
    phoneInput.required = true;
  }
}

tabLogin.addEventListener("click", () => setMode(true));
tabSignup.addEventListener("click", () => setMode(false));
toggleAuth.addEventListener("click", (e) => {
  e.preventDefault();
  setMode(!isLoginMode);
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  const pass  = passInput.value;
  const name  = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  
  authError.style.display = "none";
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span> Processing...`;

  try {
    if (isLoginMode) {

      await signInWithEmailAndPassword(auth, email, pass);
      window.location.href = "../welcome/";
    } else {
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      await set(ref(db, `users/${user.uid}/profile`), {
        name: name,
        email: email,
        phone: phone,
        createdAt: Date.now()
      });

      window.location.href = "../welcome/";
    }
  } catch (error) {
    console.error("Auth Error:", error);
    authError.textContent = formatError(error.code);
    authError.style.display = "block";
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<span>${isLoginMode ? 'Sign In' : 'Create Account'}</span><span class="material-symbols-outlined">arrow_forward</span>`;
  }
});

function formatError(code) {
  switch (code) {
    case "auth/user-not-found": return "No account found with this email.";
    case "auth/wrong-password": return "Incorrect password. Please try again.";
    case "auth/email-already-in-use": return "This email is already registered.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    default: return "An error occurred. Please try again later.";
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "../welcome/";
  }
});
