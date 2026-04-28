// ============================================================
//  Dashboard/Register/Register.js
//
//  FLOW:
//  1. Admin enters an Employee ID
//  2. Check if it already exists in Registered_User collection
//     - If exists → show warning (already registered)
//     - If not    → create document with status: "pending"
//  3. Mobile app user later fills their full info using that ID
//     → document gets updated with full info (status: "completed")
//  4. RegisteredID page monitors all IDs and their status
// ============================================================

import { db } from "../../DatabaseConnection/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Sidebar ──────────────────────────────────────────────────
const hamburger      = document.getElementById("hamburger");
const sidebar        = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const layout         = document.getElementById("layout");
let sidebarOpen = window.innerWidth >= 768;

function setSidebar(open) {
  sidebarOpen = open;
  sidebar.classList.toggle("open", open);
  sidebarOverlay.classList.toggle("show", open && window.innerWidth < 768);
  hamburger.classList.toggle("open", open);
  if (window.innerWidth >= 768) {
    sidebar.classList.toggle("force-closed", !open);
    layout.classList.toggle("sidebar-closed", !open);
  }
}
hamburger.addEventListener("click", () => setSidebar(!sidebarOpen));
sidebarOverlay.addEventListener("click", () => setSidebar(false));

// ── Load admin fullname from Firestore ───────────────────────
async function loadFullname() {
  try {
    const snap = await getDoc(doc(db, "Admin", "RegisteredEmployee"));
    if (snap.exists()) {
      const d = snap.data();
      document.getElementById("topbarFullname").textContent =
        `${d.firstName} ${d.lastName}`.trim();
      document.getElementById("topbarAvatar").textContent =
        (d.firstName?.[0] || "") + (d.lastName?.[0] || "");
    }
  } catch (err) { console.error(err); }
}
loadFullname();

// ── DOM refs ─────────────────────────────────────────────────
const employeeIdInput = document.getElementById("employeeId");
const registerBtn     = document.getElementById("registerBtn");
const statusMsg       = document.getElementById("statusMsg");

// Allow Enter key to submit
employeeIdInput.addEventListener("keydown", e => {
  if (e.key === "Enter") registerBtn.click();
});

// ── Register button ──────────────────────────────────────────
registerBtn.addEventListener("click", async () => {
  const empId = employeeIdInput.value.trim();

  if (!empId) {
    show("Please enter an Employee ID.", "error");
    return;
  }

  registerBtn.textContent = "Checking…";
  registerBtn.disabled    = true;
  clearStatus();

  try {
    // Check if this ID already exists in Registered_User collection
    const docRef  = doc(db, "Registered_User", empId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Check if already completed (mobile app filled in the full info)
      const isCompleted = data.First_Name || data.FirstName || data.Username;

      if (isCompleted) {
        show(`ID "${empId}" is already registered and completed.`, "warning");
      } else {
        show(`ID "${empId}" is already pending. Waiting for mobile app registration.`, "warning");
      }

      registerBtn.textContent = "Register";
      registerBtn.disabled    = false;
      return;
    }

    // ── ID does not exist → save as pending ─────────────────
    await setDoc(docRef, {
      UserID      : empId,
      status      : "pending",
      registeredAt: serverTimestamp()
    });

    show(`Employee ID "${empId}" registered successfully! Waiting for mobile app completion.`, "success");
    employeeIdInput.value = "";

  } catch (err) {
    console.error("Firestore error:", err);
    show("Failed to register: " + err.message, "error");
  } finally {
    registerBtn.textContent = "Register";
    registerBtn.disabled    = false;
  }
});

// ── Helpers ──────────────────────────────────────────────────
function show(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className   = "status-msg " + type;
}
function clearStatus() {
  statusMsg.textContent = "";
  statusMsg.className   = "status-msg";
}