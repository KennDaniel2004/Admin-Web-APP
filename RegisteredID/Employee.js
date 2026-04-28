// ============================================================
//  Dashboard/RegisteredID/RegisteredID.js
//
//  Reads ALL documents from Registered_User collection.
//  Splits into:
//    - Completed: has First_Name (filled by mobile app)
//    - Pending:   only has UserID + status: "pending"
//
//  Field names match your Firestore structure:
//    First_Name, Last_Name, Middle_Name, Position,
//    UserID, Username, Password, status, registeredAt
// ============================================================

import { db } from "../../DatabaseConnection/firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  orderBy,
  query
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

// ── Load admin fullname ───────────────────────────────────────
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
const completedGrid    = document.getElementById("completedGrid");
const pendingGrid      = document.getElementById("pendingGrid");
const searchInput      = document.getElementById("searchInput");
const tabCompleted     = document.getElementById("tabCompleted");
const tabPending       = document.getElementById("tabPending");
const completedPanel   = document.getElementById("completedPanel");
const pendingPanel     = document.getElementById("pendingPanel");
const badgeCompleted   = document.getElementById("badgeCompleted");
const badgePending     = document.getElementById("badgePending");
const completedCount   = document.getElementById("completedCount");
const pendingCount     = document.getElementById("pendingCount");
const totalCount       = document.getElementById("totalCount");
const refreshBtn       = document.getElementById("refreshBtn");

// ── State ─────────────────────────────────────────────────────
let allCompleted = [];
let allPending   = [];
let activeTab    = "completed";

// ── Tab switching ─────────────────────────────────────────────
tabCompleted.addEventListener("click", () => switchTab("completed"));
tabPending.addEventListener("click",   () => switchTab("pending"));

function switchTab(tab) {
  activeTab = tab;
  tabCompleted.classList.toggle("active", tab === "completed");
  tabPending.classList.toggle("active",   tab === "pending");
  completedPanel.classList.toggle("hidden", tab !== "completed");
  pendingPanel.classList.toggle("hidden",   tab !== "pending");
  applySearch(searchInput.value);
}

// ── Refresh button ────────────────────────────────────────────
refreshBtn.addEventListener("click", () => loadAll());

// ── Search ────────────────────────────────────────────────────
searchInput.addEventListener("input", () => applySearch(searchInput.value));

function applySearch(term) {
  const t = term.toLowerCase().trim();
  if (activeTab === "completed") {
    const filtered = !t ? allCompleted : allCompleted.filter(u =>
      `${u.First_Name} ${u.Middle_Name || ""} ${u.Last_Name}`.toLowerCase().includes(t) ||
      (u.UserID     || "").toLowerCase().includes(t) ||
      (u.Username   || "").toLowerCase().includes(t) ||
      (u.Position   || "").toLowerCase().includes(t)
    );
    renderCompleted(filtered);
  } else {
    const filtered = !t ? allPending : allPending.filter(u =>
      (u.UserID || "").toLowerCase().includes(t)
    );
    renderPending(filtered);
  }
}

// ── Load all users from Registered_User collection ───────────
async function loadAll() {
  // Reset UI
  completedGrid.innerHTML = `<p class="loading-text">Loading…</p>`;
  pendingGrid.innerHTML   = `<p class="loading-text">Loading…</p>`;

  try {
    const snap = await getDocs(collection(db, "Registered_User"));

    allCompleted = [];
    allPending   = [];

    snap.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };

      // A user is "completed" if the mobile app has filled in First_Name
      if (data.First_Name) {
        allCompleted.push(data);
      } else {
        allPending.push(data);
      }
    });

    // Sort completed by name
    allCompleted.sort((a, b) =>
      (a.First_Name || "").localeCompare(b.First_Name || "")
    );

    // Sort pending by registeredAt (newest first)
    allPending.sort((a, b) => {
      const ta = a.registeredAt?.toDate?.() || new Date(0);
      const tb = b.registeredAt?.toDate?.() || new Date(0);
      return tb - ta;
    });

    // Update counts
    const total = allCompleted.length + allPending.length;
    completedCount.textContent = allCompleted.length;
    pendingCount.textContent   = allPending.length;
    totalCount.textContent     = total;
    badgeCompleted.textContent = allCompleted.length;
    badgePending.textContent   = allPending.length;

    // Render current tab
    applySearch(searchInput.value);

  } catch (err) {
    console.error("Error loading Registered_User:", err);
    completedGrid.innerHTML = `<p class="no-results">Failed to load. Check your connection.</p>`;
    pendingGrid.innerHTML   = `<p class="no-results">Failed to load. Check your connection.</p>`;
  }
}

// ── Render completed cards ────────────────────────────────────
function renderCompleted(users) {
  completedGrid.innerHTML = "";

  if (users.length === 0) {
    completedGrid.innerHTML = `<p class="no-results">No completed registrations found.</p>`;
    return;
  }

  users.forEach(u => {
    const fn       = u.First_Name  || "";
    const ln       = u.Last_Name   || "";
    const mn       = u.Middle_Name || "";
    const initials = (fn[0] || "") + (ln[0] || "");
    const fullName = `${fn} ${mn ? mn + " " : ""}${ln}`.trim();

    const card = document.createElement("div");
    card.className = "emp-card";
    card.innerHTML = `
      <div class="emp-avatar">${initials.toUpperCase()}</div>
      <div class="emp-name">${fullName}</div>
      ${mn ? `<div class="emp-mid">M.I.: ${mn}</div>` : ""}
      <div class="emp-id">ID: ${u.UserID || u.id}</div>
      ${u.Username ? `<div class="emp-username">@${u.Username}</div>` : ""}
      ${u.Position ? `<div class="emp-position">${u.Position}</div>` : ""}
    `;
    completedGrid.appendChild(card);
  });
}

// ── Render pending list ───────────────────────────────────────
function renderPending(users) {
  pendingGrid.innerHTML = "";

  if (users.length === 0) {
    pendingGrid.innerHTML = `<p class="no-results" style="text-align:center;padding:40px 0;color:#ccc;">No pending registrations.</p>`;
    return;
  }

  users.forEach(u => {
    const date = u.registeredAt?.toDate?.()
      ? u.registeredAt.toDate().toLocaleDateString("en-PH", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit"
        })
      : "—";

    const item = document.createElement("div");
    item.className = "pending-item";
    item.innerHTML = `
      <div class="pending-item-left">
        <div class="pending-dot"></div>
        <div>
          <div class="pending-id">${u.UserID || u.id}</div>
          <div class="pending-date">Registered: ${date}</div>
        </div>
      </div>
      <div class="pending-badge-tag">⏳ Pending</div>
    `;
    pendingGrid.appendChild(item);
  });
}

// ── Init ──────────────────────────────────────────────────────
loadAll();