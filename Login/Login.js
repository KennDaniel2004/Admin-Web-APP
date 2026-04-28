
import { db } from "../DatabaseConnection/firebase-config.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── DOM refs ─────────────────────────────────────────────────
const usernameInput  = document.getElementById("username");
const passwordInput  = document.getElementById("password");
const loginBtn       = document.getElementById("loginBtn");
const statusMsg      = document.getElementById("statusMsg");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon        = document.getElementById("eyeIcon");

// ── Eye icon paths ───────────────────────────────────────────
const eyeOff = `
  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>
  <circle cx="12" cy="12" r="3"/>
  <line x1="4" y1="4" x2="20" y2="20"/>
`;
const eyeOpen = `
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
  <circle cx="12" cy="12" r="3"/>
`;

eyeIcon.innerHTML = eyeOff;

togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type  = show ? "text" : "password";
  eyeIcon.innerHTML   = show ? eyeOpen : eyeOff;
});

// ── Login button ─────────────────────────────────────────────
loginBtn.addEventListener("click", async () => {
  const enteredUser = usernameInput.value.trim();
  const enteredPass = passwordInput.value;

  // Basic validation
  if (!enteredUser || !enteredPass) {
    showStatus("Please enter your username and password.", "error");
    return;
  }

  loginBtn.textContent = "Logging in…";
  loginBtn.disabled    = true;
  clearStatus();

  try {
    // Read Admin/Username document
    const userSnap = await getDoc(doc(db, "Admin", "Username"));
    // Read Admin/Password document
    const passSnap = await getDoc(doc(db, "Admin", "Password"));

    if (!userSnap.exists() || !passSnap.exists()) {
      showStatus("No admin account found. Please register first.", "error");
      return;
    }

    const storedUser = String(userSnap.data().value).trim();
    const storedPass = String(passSnap.data().value).trim();

    if (enteredUser === storedUser && enteredPass === storedPass) {
      // ✅ Credentials match
      showStatus("Login successful! Redirecting…", "success");

      // ⚠️  Change this path to your actual dashboard page
      setTimeout(() => { window.location.href = "../Dashboard/Home.html"; }, 1500);

    } else {
      showStatus("Incorrect username or password.", "error");
    }

  } catch (err) {
    console.error("Login error:", err);
    showStatus("Connection error. Check your Firebase configuration.", "error");
  } finally {
    loginBtn.textContent = "Login";
    loginBtn.disabled    = false;
  }
});

[usernameInput, passwordInput].forEach(input => {
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") loginBtn.click();
  });
});

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className   = "status-msg " + type;
}

function clearStatus() {
  statusMsg.textContent = "";
  statusMsg.className   = "status-msg";
}