import { db } from "./DatabaseConnection/firebase-config.js";
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, onSnapshot,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


const pages = ["page-login", "page-admin-register"];

function showPage(pageId) {
  pages.forEach(id => {
    document.getElementById(id)?.classList.toggle("hidden", id !== pageId);
  });
  document.getElementById("dashboard-shell")?.classList.add("hidden");
}

function showDashboard(panelId = "panel-home") {
  pages.forEach(id => document.getElementById(id)?.classList.add("hidden"));
  document.getElementById("dashboard-shell")?.classList.remove("hidden");
  showPanel(panelId);
}

function showPanel(panelId) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(panelId)?.classList.remove("hidden");

  // Update active nav item
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.panel === panelId);
  });

  // Load data when switching to RegisteredID panel
  // Only start listener if not already running
  if (panelId === "panel-registered-id" && !ridUnsubscribe) loadRegisteredUsers();
}

// ── Wire up all data-goto and data-panel links ────────────


document.addEventListener("click", e => {
  const gotoEl  = e.target.closest("[data-goto]");
  const panelEl = e.target.closest("[data-panel]");

  if (gotoEl) {
    e.preventDefault();
    showPage(gotoEl.dataset.goto);
  }

  if (panelEl) {
    e.preventDefault();
    showPanel(panelEl.dataset.panel);
    // Close sidebar on mobile
    if (window.innerWidth < 768) setSidebar(false);
  }
});


//  EYE ICON HELPERS

const eyeOffPath = `
  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>
  <circle cx="12" cy="12" r="3"/>
  <line x1="4" y1="4" x2="20" y2="20"/>`;

const eyeOnPath = `
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
  <circle cx="12" cy="12" r="3"/>`;

function initEye(eyeSpanId, iconId, inputId) {
  const icon  = document.getElementById(iconId);
  const input = document.getElementById(inputId);
  if (!icon || !input) return;
  icon.innerHTML = eyeOffPath;
  document.getElementById(eyeSpanId)?.addEventListener("click", () => {
    const show = input.type === "password";
    input.type    = show ? "text" : "password";
    icon.innerHTML = show ? eyeOnPath : eyeOffPath;
  });
}


//  LOGIN

initEye("login-eye", "login-eye-icon", "login-password");

const loginBtn      = document.getElementById("login-btn");
const loginStatus   = document.getElementById("login-status");

loginBtn?.addEventListener("click", async () => {
  const un = document.getElementById("login-username").value.trim();
  const pw = document.getElementById("login-password").value;

  if (!un || !pw) { setStatus(loginStatus, "Please enter username and password.", "error"); return; }

  loginBtn.textContent = "Logging in…";
  loginBtn.disabled    = true;

  try {
    const [userSnap, passSnap] = await Promise.all([
      getDoc(doc(db, "Admin", "Username")),
      getDoc(doc(db, "Admin", "Password"))
    ]);

    if (!userSnap.exists() || !passSnap.exists()) {
      setStatus(loginStatus, "No admin account found. Please register first.", "error");
      return;
    }

    if (un === userSnap.data().value && pw === passSnap.data().value) {
      setStatus(loginStatus, "Login successful! Loading dashboard…", "success");
      setTimeout(() => {
        showDashboard("panel-home");
        loadFullname();
        loadRegisteredUsers(); // ← start real-time listener immediately on login
      }, 1200);
    } else {
      setStatus(loginStatus, "Incorrect username or password.", "error");
    }
  } catch (err) {
    setStatus(loginStatus, "Connection error. Check Firebase configuration.", "error");
    console.error(err);
  } finally {
    loginBtn.textContent = "Login";
    loginBtn.disabled    = false;
  }
});

document.getElementById("login-username")?.addEventListener("keydown", e => { if (e.key === "Enter") loginBtn?.click(); });
document.getElementById("login-password")?.addEventListener("keydown", e => { if (e.key === "Enter") loginBtn?.click(); });


//  ADMIN REGISTER

initEye("areg-eye1", "areg-eye-icon1", "areg-password");
initEye("areg-eye2", "areg-eye-icon2", "areg-confirm");

const aregStatus  = document.getElementById("areg-status");
const aregPopup   = document.getElementById("areg-auth-popup");
const aregCodeIn  = document.getElementById("areg-auth-code");
const aregVerify  = document.getElementById("areg-verify-btn");
const aregError   = document.getElementById("areg-auth-error");
const aregBtn     = document.getElementById("areg-btn");
const aregUser    = document.getElementById("areg-username");

let aregVerified      = false;
let aregCodeGenerated = false;

// Show auth popup + generate code on username blur
aregUser?.addEventListener("blur", async () => {
  if (!aregUser.value.trim() || aregVerified || aregCodeGenerated) return;

  aregCodeGenerated         = true;
  aregPopup.classList.remove("hidden");
  aregCodeIn.disabled       = true;
  aregCodeIn.placeholder    = "Generating code…";
  aregVerify.disabled       = true;
  aregError.textContent     = "";

  const newCode   = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await setDoc(doc(db, "Admin", "Auth"), {
      authCode: newCode,
      expiresAt: Timestamp.fromDate(expiresAt),
      generatedAt: serverTimestamp()
    });
    aregCodeIn.placeholder = "Enter 6-digit code";
    aregCodeIn.disabled    = false;
    aregVerify.disabled    = false;
    aregCodeIn.focus();
    aregError.style.color  = "#2e7d32";
    aregError.textContent  = "✔ Code generated! Check Firebase Console → Admin → Auth → authCode";
  } catch (err) {
    aregError.style.color  = "#c0392b";
    aregError.textContent  = "Failed to generate code. Check Firebase configuration.";
    aregCodeIn.disabled    = false;
    aregVerify.disabled    = false;
    aregCodeGenerated      = false;
    console.error(err);
  }
});

aregCodeIn?.addEventListener("keydown", e => { if (e.key === "Enter") aregVerify?.click(); });

// Verify auth code
aregVerify?.addEventListener("click", async () => {
  const entered = aregCodeIn.value.trim();
  if (!entered) { aregError.style.color = "#c0392b"; aregError.textContent = "Please enter the code."; return; }

  aregVerify.textContent = "Checking…";
  aregVerify.disabled    = true;
  aregError.textContent  = "";

  try {
    const snap = await getDoc(doc(db, "Admin", "Auth"));
    if (!snap.exists()) { aregError.style.color = "#c0392b"; aregError.textContent = "No code found. Refresh and try again."; return; }

    const data = snap.data();
    if (data.expiresAt && new Date() > data.expiresAt.toDate()) {
      aregError.style.color = "#c0392b";
      aregError.textContent = "Code expired. Refresh page to generate a new one.";
      aregCodeGenerated = false;
      return;
    }

    if (entered === String(data.authCode).trim()) {
      aregVerified = true;
      aregPopup.classList.add("hidden");
      aregBtn.disabled = false;
      const badge = document.createElement("div");
      badge.className   = "auth-verified-badge";
      badge.textContent = "✔ Authentication verified";
      aregUser.parentNode.insertBefore(badge, aregPopup);
      setStatus(aregStatus, "Code verified! Fill in your password to complete.", "success");
    } else {
      aregError.style.color = "#c0392b";
      aregError.textContent = "Incorrect code. Check Firebase Console and try again.";
    }
  } catch (err) {
    aregError.style.color = "#c0392b";
    aregError.textContent = "Connection error.";
    console.error(err);
  } finally {
    aregVerify.textContent = "Verify";
    aregVerify.disabled    = false;
  }
});

// Register admin
aregBtn?.addEventListener("click", async () => {
  if (!aregVerified) { setStatus(aregStatus, "Please complete authentication first.", "error"); return; }

  const fn  = document.getElementById("areg-firstname").value.trim();
  const ln  = document.getElementById("areg-lastname").value.trim();
  const un  = aregUser.value.trim();
  const pw  = document.getElementById("areg-password").value;
  const cpw = document.getElementById("areg-confirm").value;

  if (!fn || !ln || !un || !pw || !cpw) { setStatus(aregStatus, "Please fill in all fields.", "error"); return; }
  if (pw.length < 6) { setStatus(aregStatus, "Password must be at least 6 characters.", "error"); return; }
  if (pw !== cpw)    { setStatus(aregStatus, "Passwords do not match.", "error"); return; }

  aregBtn.textContent = "Registering…";
  aregBtn.disabled    = true;

  try {
    await setDoc(doc(db, "Admin", "Username"),          { value: un });
    await setDoc(doc(db, "Admin", "Password"),          { value: pw });
    await setDoc(doc(db, "Admin", "RegisteredEmployee"),{ firstName: fn, lastName: ln, username: un, createdAt: serverTimestamp() });
    await deleteDoc(doc(db, "Admin", "Auth"));

    setStatus(aregStatus, "Registered successfully! Redirecting to login…", "success");
    ["areg-firstname","areg-lastname","areg-username","areg-password","areg-confirm"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    aregVerified = aregCodeGenerated = false;
    aregBtn.disabled = true;
    setTimeout(() => showPage("page-login"), 2000);
  } catch (err) {
    setStatus(aregStatus, "Registration failed: " + err.message, "error");
    aregBtn.textContent = "Register";
    aregBtn.disabled    = false;
    console.error(err);
  }
});


//  DASHBOARD — SIDEBAR TOGGLE

const hamburger      = document.getElementById("hamburger");
const sidebar        = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const dashLayout     = document.getElementById("dash-layout");

let sidebarOpen = window.innerWidth >= 768;

function setSidebar(open) {
  sidebarOpen = open;
  sidebar?.classList.toggle("open", open);
  sidebarOverlay?.classList.toggle("show", open && window.innerWidth < 768);
  hamburger?.classList.toggle("open", open);
  if (window.innerWidth >= 768) {
    sidebar?.classList.toggle("force-closed", !open);
    dashLayout?.classList.toggle("sidebar-closed", !open);
  }
}

hamburger?.addEventListener("click",      () => setSidebar(!sidebarOpen));
sidebarOverlay?.addEventListener("click", () => setSidebar(false));
window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) sidebarOverlay?.classList.remove("show");
});


//  DASHBOARD — LOAD FULLNAME

async function loadFullname() {
  try {
    const snap = await getDoc(doc(db, "Admin", "RegisteredEmployee"));
    if (snap.exists()) {
      const d    = snap.data();
      const name = `${d.firstName} ${d.lastName}`.trim();
      const el   = document.getElementById("topbar-fullname");
      const av   = document.getElementById("topbar-avatar");
      if (el) el.textContent = name;
      if (av) av.textContent = (d.firstName?.[0] || "") + (d.lastName?.[0] || "");
    }
  } catch (err) { console.error(err); }
}


//  EMPLOYEE REGISTER PANEL

const empregBtn    = document.getElementById("empreg-btn");
const empregStatus = document.getElementById("empreg-status");
const empregInput  = document.getElementById("empreg-id");

empregInput?.addEventListener("keydown", e => { if (e.key === "Enter") empregBtn?.click(); });

empregBtn?.addEventListener("click", async () => {
  const empId = empregInput.value.trim();
  if (!empId) { setStatus(empregStatus, "Please enter an Employee ID.", "error"); return; }

  empregBtn.textContent = "Checking…";
  empregBtn.disabled    = true;
  clearStatus(empregStatus);

  try {
    const docRef  = doc(db, "Registered_User", empId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data        = docSnap.data();
      const isCompleted = data.First_Name || data.FirstName || data.Username;
      setStatus(empregStatus,
        isCompleted
          ? `ID "${empId}" is already registered and completed.`
          : `ID "${empId}" is already pending. Waiting for mobile app registration.`,
        "warning"
      );
    } else {
      await setDoc(docRef, { UserID: empId, status: "pending", registeredAt: serverTimestamp() });
      setStatus(empregStatus, `Employee ID "${empId}" registered! Waiting for mobile app completion.`, "success");
      empregInput.value = "";
    }
  } catch (err) {
    setStatus(empregStatus, "Failed to register: " + err.message, "error");
    console.error(err);
  } finally {
    empregBtn.textContent = "Register";
    empregBtn.disabled    = false;
  }
});

// ══════════════════════════════════════════════════════════
//  REGISTERED ID PANEL
// ══════════════════════════════════════════════════════════
let allCompleted = [];
let allPending   = [];
let ridActiveTab = "completed";

const completedGrid  = document.getElementById("completed-grid");
const pendingList    = document.getElementById("pending-list");
const ridSearch      = document.getElementById("rid-search");
const tabCompleted   = document.getElementById("tab-completed");
const tabPending     = document.getElementById("tab-pending");
const panelCompleted = document.getElementById("tab-panel-completed");
const panelPending   = document.getElementById("tab-panel-pending");

tabCompleted?.addEventListener("click", () => switchRidTab("completed"));
tabPending?.addEventListener("click",   () => switchRidTab("pending"));
document.getElementById("rid-refresh-btn")?.addEventListener("click", loadRegisteredUsers);
ridSearch?.addEventListener("input", () => applyRidSearch(ridSearch.value));

function switchRidTab(tab) {
  ridActiveTab = tab;
  tabCompleted?.classList.toggle("active", tab === "completed");
  tabPending?.classList.toggle("active",   tab === "pending");
  panelCompleted?.classList.toggle("hidden", tab !== "completed");
  panelPending?.classList.toggle("hidden",   tab !== "pending");
  applyRidSearch(ridSearch?.value || "");
}

function applyRidSearch(term) {
  const t = term.toLowerCase().trim();
  if (ridActiveTab === "completed") {
    renderCompleted(!t ? allCompleted : allCompleted.filter(u =>
      `${u.First_Name} ${u.Middle_Name||""} ${u.Last_Name}`.toLowerCase().includes(t) ||
      (u.UserID||"").toLowerCase().includes(t) ||
      (u.Username||"").toLowerCase().includes(t) ||
      (u.Position||"").toLowerCase().includes(t)
    ));
  } else {
    renderPending(!t ? allPending : allPending.filter(u =>
      (u.UserID||"").toLowerCase().includes(t)
    ));
  }
}

// ── Real-time listener handle (so we can detach it if needed) ──
let ridUnsubscribe = null;

function loadRegisteredUsers() {
  // Show loading state
  if (completedGrid) completedGrid.innerHTML = `<p class="loading-text">Loading…</p>`;
  if (pendingList)   pendingList.innerHTML   = `<p class="loading-text">Loading…</p>`;

  // Detach any existing listener before starting a new one
  if (ridUnsubscribe) { ridUnsubscribe(); ridUnsubscribe = null; }

  // onSnapshot fires immediately with current data,
  // then again every time ANY document in Registered_User changes,
  // is added, or is deleted — no refresh needed.
  ridUnsubscribe = onSnapshot(
    collection(db, "Registered_User"),
    (snap) => {
      allCompleted = [];
      allPending   = [];

      snap.forEach(s => {
        const data = { id: s.id, ...s.data() };

        // ── Determine if this doc is COMPLETED or PENDING ──────
        //
        // COMPLETED: mobile app has synced full info.
        //   Mobile app (UserDaoImpl) saves these fields to Firestore:
        //   First_Name, Last_Name, Middle_Name, Position, Username
        //
        // PENDING: admin pre-registered only the ID via web app.
        //   Web app saves: { UserID, status:"pending", registeredAt }
        //   No First_Name yet.
        //
        // We check First_Name as the definitive "completed" marker.
        // We also accept Employee_Id field (mobile uses Employee_Id
        // as the document key via SyncManager).

        const isCompleted = !!(
          data.First_Name  ||   // mobile app field
          data.firstName        // fallback camelCase
        );

        if (isCompleted) {
          // Normalise field names so renderCompleted always works
          // regardless of whether mobile used snake_case or camelCase
          allCompleted.push({
            ...data,
            First_Name  : data.First_Name  || data.firstName  || "",
            Last_Name   : data.Last_Name   || data.lastName   || "",
            Middle_Name : data.Middle_Name || data.middleName || "",
            Position    : data.Position    || data.position   || "",
            Username    : data.Username    || data.username   || "",
            UserID      : data.UserID      || data.Employee_Id || data.employeeId || s.id,
          });
        } else {
          allPending.push({
            ...data,
            UserID: data.UserID || data.Employee_Id || data.employeeId || s.id,
          });
        }
      });

      // Sort completed A→Z by first name
      allCompleted.sort((a, b) =>
        (a.First_Name || "").localeCompare(b.First_Name || "")
      );

      // Sort pending newest first
      allPending.sort((a, b) => {
        const ta = a.registeredAt?.toDate?.() || new Date(0);
        const tb = b.registeredAt?.toDate?.() || new Date(0);
        return tb - ta;
      });

      // Update summary counts
      const total = allCompleted.length + allPending.length;
      document.getElementById("rid-completed-count").textContent = allCompleted.length;
      document.getElementById("rid-pending-count").textContent   = allPending.length;
      document.getElementById("rid-total-count").textContent     = total;
      document.getElementById("badge-completed").textContent     = allCompleted.length;
      document.getElementById("badge-pending").textContent       = allPending.length;

      // Re-render current tab with current search term
      applyRidSearch(ridSearch?.value || "");
    },
    (err) => {
      console.error("Real-time listener error:", err);
      if (completedGrid) completedGrid.innerHTML = `<p class="no-results">Failed to load. Check your connection.</p>`;
      if (pendingList)   pendingList.innerHTML   = `<p class="no-results">Failed to load. Check your connection.</p>`;
    }
  );
}

function renderCompleted(users) {
  if (!completedGrid) return;
  completedGrid.innerHTML = "";
  if (!users.length) { completedGrid.innerHTML = `<p class="no-results">No completed registrations found.</p>`; return; }
  users.forEach(u => {
    const fn  = u.First_Name  || "";
    const ln  = u.Last_Name   || "";
    const mn  = u.Middle_Name || "";
    const initials = (fn[0]||"") + (ln[0]||"");
    const card = document.createElement("div");
    card.className = "emp-card";
    card.innerHTML = `
      <div class="emp-avatar">${initials.toUpperCase()}</div>
      <div class="emp-name">${fn} ${mn ? mn+" " : ""}${ln}</div>
      ${mn ? `<div class="emp-mid">M.I.: ${mn}</div>` : ""}
      <div class="emp-id">ID: ${u.UserID||u.id}</div>
      ${u.Username  ? `<div class="emp-username">@${u.Username}</div>` : ""}
      ${u.Position  ? `<div class="emp-position">${u.Position}</div>` : ""}
    `;
    completedGrid.appendChild(card);
  });
}

function renderPending(users) {
  if (!pendingList) return;
  pendingList.innerHTML = "";
  if (!users.length) { pendingList.innerHTML = `<p class="no-results" style="text-align:center;padding:40px 0;">No pending registrations.</p>`; return; }
  users.forEach(u => {
    const date = u.registeredAt?.toDate?.()
      ? u.registeredAt.toDate().toLocaleDateString("en-PH",{ year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit" })
      : "—";
    const item = document.createElement("div");
    item.className = "pending-item";
    item.innerHTML = `
      <div class="pending-item-left">
        <div class="pending-dot"></div>
        <div>
          <div class="pending-id">${u.UserID||u.id}</div>
          <div class="pending-date">Registered: ${date}</div>
        </div>
      </div>
      <div class="pending-badge-tag">⏳ Pending</div>
    `;
    pendingList.appendChild(item);
  });
}


function setStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className   = "status-msg " + type;
}
function clearStatus(el) {
  if (!el) return;
  el.textContent = "";
  el.className   = "status-msg";
}

showPage("page-login");