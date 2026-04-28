// ============================================================
//  Dashboard/Home/Home.js
// ============================================================

import { db } from "../../DatabaseConnection/firebase-config.js";
import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Sidebar toggle ───────────────────────────────────────────
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
window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) {
    sidebarOverlay.classList.remove("show");
  }
});

// ── Load fullname from Firestore ─────────────────────────────
async function loadFullname() {
  try {
    const snap = await getDoc(doc(db, "Admin", "RegisteredEmployee"));
    if (snap.exists()) {
      const d = snap.data();
      const name = `${d.firstName} ${d.lastName}`.trim();
      document.getElementById("topbarFullname").textContent = name;
      document.getElementById("topbarAvatar").textContent =
        (d.firstName?.[0] || "") + (d.lastName?.[0] || "");
    }
  } catch (err) {
    console.error("Could not load fullname:", err);
  }
}

loadFullname();