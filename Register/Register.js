// ============================================================
//  Register/Register.js
//
//  NEW FLOW:
//  1. Fill First name, Last name, Username
//  2. On username blur → system AUTO-GENERATES a random 6-digit
//     code, saves it to Firestore Admin/Auth { authCode, expiresAt }
//     and shows the auth popup
//  3. Admin opens Firebase Console → sees the code → types it in
//  4. On correct code + not expired → popup closes, Register unlocks
//  5. Fill Password + Confirm Password → Register
//  6. Saves to Firestore:
//       Admin/Username           { value }
//       Admin/Password           { value }
//       Admin/RegisteredEmployee { firstName, lastName, username, createdAt }
//  7. Deletes Admin/Auth (cleans up the temp code)
//  8. Redirects to Login page
// ============================================================

import { db } from "../DatabaseConnection/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── DOM refs ─────────────────────────────────────────────────
const firstNameInput  = document.getElementById("firstName");
const lastNameInput   = document.getElementById("lastName");
const usernameInput   = document.getElementById("username");
const authPopup       = document.getElementById("authPopup");
const authCodeInput   = document.getElementById("authCode");
const verifyBtn       = document.getElementById("verifyBtn");
const authError       = document.getElementById("authError");
const passwordInput   = document.getElementById("password");
const confirmInput    = document.getElementById("confirmPassword");
const registerBtn     = document.getElementById("registerBtn");
const statusMsg       = document.getElementById("statusMsg");
const togglePwd1      = document.getElementById("togglePwd1");
const togglePwd2      = document.getElementById("togglePwd2");
const eyeIcon1        = document.getElementById("eyeIcon1");
const eyeIcon2        = document.getElementById("eyeIcon2");

// ── Eye icon SVG paths ───────────────────────────────────────
const eyeOff = `
  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>
  <circle cx="12" cy="12" r="3"/>
  <line x1="4" y1="4" x2="20" y2="20"/>
`;
const eyeOpen = `
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
  <circle cx="12" cy="12" r="3"/>
`;

eyeIcon1.innerHTML = eyeOff;
eyeIcon2.innerHTML = eyeOff;

togglePwd1.addEventListener("click", () => toggleEye(passwordInput, eyeIcon1));
togglePwd2.addEventListener("click", () => toggleEye(confirmInput,  eyeIcon2));

function toggleEye(input, icon) {
  const show = input.type === "password";
  input.type     = show ? "text" : "password";
  icon.innerHTML = show ? eyeOpen : eyeOff;
}

// ── State ────────────────────────────────────────────────────
let verified      = false;
let codeGenerated = false;

// ── Generate a random 6-digit code ──────────────────────────
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Show auth popup + auto-save code to Firestore ────────────
usernameInput.addEventListener("blur", async () => {
  if (usernameInput.value.trim() === "" || verified || codeGenerated) return;

  codeGenerated = true;

  authPopup.classList.remove("hidden");
  authError.textContent     = "";
  authError.style.color     = "#2e7d32";
  verifyBtn.disabled        = true;
  authCodeInput.disabled    = true;
  authCodeInput.placeholder = "Generating code…";

  const newCode   = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await setDoc(doc(db, "Admin", "Auth"), {
      authCode    : newCode,
      expiresAt   : Timestamp.fromDate(expiresAt),
      generatedAt : serverTimestamp()
    });

    authCodeInput.placeholder = "Enter 6-digit code";
    authCodeInput.disabled    = false;
    verifyBtn.disabled        = false;
    authCodeInput.focus();

    authError.style.color = "#2e7d32";
    authError.textContent = "✔ Code generated! Check Firebase Console → Admin → Auth → authCode";

  } catch (err) {
    console.error("Failed to generate auth code:", err);
    authError.style.color     = "#c0392b";
    authError.textContent     = "Failed to generate code. Check your Firebase configuration.";
    authCodeInput.placeholder = "Enter code";
    authCodeInput.disabled    = false;
    verifyBtn.disabled        = false;
    codeGenerated             = false;
  }
});

// Allow Enter key to trigger verify
authCodeInput.addEventListener("keydown", e => {
  if (e.key === "Enter") verifyBtn.click();
});

// ── Verify auth code ─────────────────────────────────────────
verifyBtn.addEventListener("click", async () => {
  const entered = authCodeInput.value.trim();

  if (!entered) {
    authError.style.color = "#c0392b";
    authError.textContent = "Please enter the authentication code.";
    return;
  }

  verifyBtn.textContent = "Checking…";
  verifyBtn.disabled    = true;
  authError.textContent = "";

  try {
    const authSnap = await getDoc(doc(db, "Admin", "Auth"));

    if (!authSnap.exists()) {
      authError.style.color = "#c0392b";
      authError.textContent = "No code found. Refresh the page and try again.";
      verifyBtn.textContent = "Verify";
      verifyBtn.disabled    = false;
      return;
    }

    const data       = authSnap.data();
    const storedCode = String(data.authCode).trim();

    // Check expiry
    if (data.expiresAt) {
      const expiresAt = data.expiresAt.toDate();
      if (new Date() > expiresAt) {
        authError.style.color = "#c0392b";
        authError.textContent = "Code expired (10 min limit). Refresh the page to generate a new one.";
        verifyBtn.textContent = "Verify";
        verifyBtn.disabled    = false;
        codeGenerated         = false;
        return;
      }
    }

    if (entered === storedCode) {
      // ✅ Correct
      verified = true;
      authPopup.classList.add("hidden");
      registerBtn.disabled = false;

      const badge = document.createElement("div");
      badge.className   = "auth-verified-badge";
      badge.textContent = "✔ Authentication verified";
      usernameInput.parentNode.insertBefore(badge, authPopup);

      showStatus("Code verified! Fill in your password to complete registration.", "success");

    } else {
      authError.style.color = "#c0392b";
      authError.textContent = "Incorrect code. Please check Firebase Console and try again.";
    }

  } catch (err) {
    console.error("Firestore verify error:", err);
    authError.style.color = "#c0392b";
    authError.textContent = "Connection error. Check your internet connection.";
  } finally {
    verifyBtn.textContent = "Verify";
    verifyBtn.disabled    = false;
  }
});

// ── Register button ──────────────────────────────────────────
registerBtn.addEventListener("click", async () => {

  if (!verified) {
    showStatus("Please complete the authentication step first.", "error");
    return;
  }

  const fn  = firstNameInput.value.trim();
  const ln  = lastNameInput.value.trim();
  const un  = usernameInput.value.trim();
  const pw  = passwordInput.value;
  const cpw = confirmInput.value;

  if (!fn || !ln || !un || !pw || !cpw) {
    showStatus("Please fill in all fields.", "error");
    return;
  }

  if (pw.length < 6) {
    showStatus("Password must be at least 6 characters.", "error");
    return;
  }

  if (pw !== cpw) {
    showStatus("Passwords do not match.", "error");
    return;
  }

  registerBtn.textContent = "Registering…";
  registerBtn.disabled    = true;

  try {
    await setDoc(doc(db, "Admin", "Username"), { value: un });

    // ⚠️ Plain text password — temporary setup only.
    await setDoc(doc(db, "Admin", "Password"), { value: pw });

    await setDoc(doc(db, "Admin", "RegisteredEmployee"), {
      firstName : fn,
      lastName  : ln,
      username  : un,
      createdAt : serverTimestamp()
    });

    // Clean up the Auth code document after successful registration
    await deleteDoc(doc(db, "Admin", "Auth"));

    showStatus("Admin registered successfully! Redirecting to login…", "success");

    [firstNameInput, lastNameInput, usernameInput,
     passwordInput, confirmInput, authCodeInput]
      .forEach(el => el.value = "");
    verified = false;

    setTimeout(() => { window.location.href = "../Login/Login.html"; }, 2000);

  } catch (err) {
    console.error("Firestore write error:", err);
    showStatus("Registration failed: " + err.message, "error");
    registerBtn.textContent = "Register";
    registerBtn.disabled    = false;
  }
});

// ── Helpers ──────────────────────────────────────────────────
function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className   = "status-msg " + type;
}