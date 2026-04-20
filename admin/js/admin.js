// ============================================
// DSIF Admin Panel — Main Logic
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── Firebase init ──
const firebaseConfig = {
  apiKey: "AIzaSyAXYu7yseh6J6d21m-Jhiwt-EjVIeU5gQ8",
  authDomain: "dsif-shedule.firebaseapp.com",
  projectId: "dsif-shedule",
  storageBucket: "dsif-shedule.firebasestorage.app",
  messagingSenderId: "973476131387",
  appId: "1:973476131387:web:8c2e1234567890abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ── Салбарын нэрс (монгол) ──
const SECTOR_NAMES = {
  energy: "Эрчим хүч",
  mining: "Аялал жуулчлал",
  environment: "Байгаль орчин",
  infra: "Дэд бүтэц",
  edu: "Боловсрол",
  culture: "Соёл",
  health: "Эрүүл мэнд",
  social: "Нийгэм",
  agri: "Хөдөө аж ахуй"
};

// tusul.html-ийн 8 Google Sheet loader-той ижил — админд бүх төслийг харуулах
const PROJECT_SHEETS = [
  { sector: "infra",       id: "1eebLZJiL8lMMJ8YDEt2W06P9f8_NgICX9EXlMNdjvW8", gid: "0" },
  { sector: "environment", id: "1H6ORSfZh61fARTEd-F24bBPzCv88mKIHww8_MdORd68", gid: "0" },
  { sector: "health",      id: "1ah0aKyf2xfXGAu3TljHw-h3Q_kkdiaabo6SuYhsXP8E", gid: "0" },
  { sector: "culture",     id: "1ah0aKyf2xfXGAu3TljHw-h3Q_kkdiaabo6SuYhsXP8E", gid: "904267116" },
  { sector: "edu",         id: "1ah0aKyf2xfXGAu3TljHw-h3Q_kkdiaabo6SuYhsXP8E", gid: "797596799" },
  { sector: "agri",        id: "133ZKSNTFJ2ZaA7MBZPu7PtdE1tSP7hUUh-RVIKhhew8", gid: "0" },
  { sector: "energy",      id: "1ucbKdcgNMBcpyfnvpBzueFflzL-IMzqYtBYre7_uEVk", gid: "0" },
  { sector: "mining",      id: "1gHMiQzvsHb2lIWD8_QSSb7PIWcSm4lFR51dq8npthaU", gid: "0" }
];

const ROLE_LABELS = {
  admin: "Админ",
  "sub-admin": "Дэд админ",
  editor: "Засварлагч",
  viewer: "Үзэгч"
};

// ── Theme toggle ──
(function initThemeToggle() {
  const btn = document.getElementById("admin-theme-toggle");
  if (!btn) return;
  function updateIcon() {
    btn.innerHTML = document.body.classList.contains("light-theme") ? "&#9790;" : "&#9788;";
  }
  updateIcon();
  btn.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    localStorage.setItem("dsif-admin-theme", document.body.classList.contains("light-theme") ? "light" : "dark");
    updateIcon();
  });
})();

// ── Sidebar collapse ──
(function initSidebarCollapse() {
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  const topToggleBtn = document.getElementById("sidebarToggleTop");
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  // Хадгалсан төлөв
  if (localStorage.getItem("dsif-admin-sidebar") === "collapsed") {
    sidebar.classList.add("collapsed");
  }

  function updateTopbar() {
    const topbar = document.getElementById("topbar");
    if (topbar) {
      topbar.style.left = sidebar.classList.contains("collapsed") ? "68px" : "260px";
    }
  }

  // Эхний төлөв
  updateTopbar();

  function toggleSidebar() {
    sidebar.classList.toggle("collapsed");
    localStorage.setItem("dsif-admin-sidebar", sidebar.classList.contains("collapsed") ? "collapsed" : "expanded");
    updateTopbar();
  }

  if (collapseBtn) collapseBtn.addEventListener("click", toggleSidebar);
  if (topToggleBtn) topToggleBtn.addEventListener("click", toggleSidebar);
})();

// ── State ──
let currentUser = null;
let currentAdmin = null;
let selectedThumbnailFile = null;

// ── Auth guard ──
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  const adminDoc = await getDoc(doc(db, "admins", user.uid));
  if (!adminDoc.exists()) {
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  currentAdmin = { id: user.uid, ...adminDoc.data() };

  // UI тохируулах
  document.getElementById("userName").textContent = currentAdmin.name || user.email;
  document.getElementById("userRole").textContent = ROLE_LABELS[currentAdmin.role] || currentAdmin.role;
  document.getElementById("userAvatar").textContent = (currentAdmin.name || user.email).charAt(0).toUpperCase();

  // Эрхээс хамаарч товчнуудыг нуух
  applyPermissions();
  loadDashboard();
});

// ── Эрхийн хязгаарлалт ──
function applyPermissions() {
  const role = currentAdmin.role;
  // viewer болон editor нь дэд админ нэмэх эрхгүй
  if (role === "viewer" || role === "editor") {
    document.getElementById("addSubAdminBtn").style.display = "none";
    // Roles section-г нуух
    const rolesLink = document.querySelector('[data-section="roles"]');
    if (rolesLink) rolesLink.style.display = "none";
    const subAdminLink = document.querySelector('[data-section="sub-admins"]');
    if (subAdminLink) subAdminLink.style.display = "none";
    const sectorsLink = document.querySelector('[data-section="sectors"]');
    if (sectorsLink) sectorsLink.style.display = "none";
  }
  if (role === "viewer") {
    document.getElementById("addProjectBtn").style.display = "none";
  }
}

// ── Topbar title map ──
const SECTION_TITLES = {
  dashboard: "Хянах самбар",
  projects: "Төслийн удирдлага",
  "sub-admins": "Дэд админ",
  roles: "Эрхийн тохиргоо",
  sectors: "Төслийн ангилал",
  menu: "Цэс тохиргоо",
  funding: "Санхүүжилт тохиргоо",
  funders: "Санхүүжүүлэгчид"
};

// ── Sidebar навигаци ──
document.querySelectorAll(".sidebar-nav a[data-section]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const section = link.dataset.section;

    // Active state
    document.querySelectorAll(".sidebar-nav a").forEach((a) => a.classList.remove("active"));
    link.classList.add("active");

    // Show section
    document.querySelectorAll(".section-page").forEach((s) => s.classList.remove("active"));
    const target = document.getElementById("sec-" + section);
    if (target) target.classList.add("active");

    // Topbar title шинэчлэх
    const topTitle = document.getElementById("topbarTitle");
    if (topTitle) topTitle.textContent = SECTION_TITLES[section] || section;

    // Load data
    if (section === "dashboard") loadDashboard();
    if (section === "projects") loadProjects();
    if (section === "sub-admins") loadSubAdmins();
    if (section === "sectors") loadSectors();
    if (section === "menu") loadMenu();
    if (section === "funding") loadFundingSettings();
    if (section === "funders") loadFunders();

    // Mobile: sidebar хаах
    document.getElementById("sidebar").classList.remove("open");
  });
});

// Mobile toggle
document.getElementById("mobileToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// ── Logout ──
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
async function loadDashboard() {
  try {
    // Төслийн тоо (файлын системээс)
    try {
      if (allProjects.length === 0) await loadProjects();
      document.getElementById("statProjects").textContent = allProjects.length;
    } catch {
      const projectsSnap = await getDocs(collection(db, "projects"));
      document.getElementById("statProjects").textContent = projectsSnap.size;
    }

    // Админ тоо
    const adminsSnap = await getDocs(collection(db, "admins"));
    document.getElementById("statAdmins").textContent = adminsSnap.size;

    // Бүртгэлийн тоо
    try {
      const regsSnap = await getDocs(collection(db, "registrations"));
      document.getElementById("statRegistrations").textContent = regsSnap.size;
    } catch {
      document.getElementById("statRegistrations").textContent = "—";
    }

    // Салбар жагсаалт шинэчлэх
    refreshSectorLists();

    // Сүүлийн санхүүжилт хүсэлтүүд
    loadDashboardFunding();

    // Сүүлийн үйлдлүүд
    loadActivityLog();
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

async function loadDashboardFunding() {
  const tbody = document.getElementById("dashboardFundingTable");
  if (!tbody) return;
  try {
    const q = query(collection(db, "fundings"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa fa-inbox"></i><p>Санхүүжилтийн хүсэлт байхгүй</p></td></tr>';
      return;
    }
    tbody.innerHTML = "";
    let count = 0;
    snap.forEach((d) => {
      if (count >= 5) return; // зөвхөн сүүлийн 5
      count++;
      const data = d.data();
      const date = data.createdAt ? formatDate(data.createdAt.toDate()) : "—";
      let nameCell;
      if (data.type === "org") {
        const parts = [
          `<strong>${escapeHtml(data.orgName || "—")}</strong>`,
          data.person ? `<small style="opacity:.75">${escapeHtml(data.person)}</small>` : "",
          data.position ? `<small style="opacity:.55;font-style:italic">${escapeHtml(data.position)}</small>` : ""
        ].filter(Boolean);
        nameCell = parts.join("<br>");
      } else {
        nameCell = `<strong>${escapeHtml(data.name || "—")}</strong>`;
      }
      const amount = (parseFloat(data.amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "₮";
      const typeBadge = data.type === "org"
        ? '<span class="badge badge-admin">Байгууллага</span>'
        : '<span class="badge badge-sub-admin">Хувь хүн</span>';
      tbody.innerHTML += `<tr>
        <td style="font-size:11px">${date}</td>
        <td>${escapeHtml((data.project || "").substring(0, 50))}${(data.project || "").length > 50 ? "…" : ""}</td>
        <td>${nameCell}</td>
        <td>${escapeHtml(data.phone || "—")}</td>
        <td style="font-weight:700;color:var(--admin-primary)">${amount}</td>
        <td>${typeBadge}</td>
      </tr>`;
    });
  } catch (e) {
    console.warn("Dashboard funding load:", e);
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa fa-inbox"></i><p>Санхүүжилтийн хүсэлт байхгүй</p></td></tr>';
  }
}

async function loadActivityLog() {
  const tbody = document.getElementById("activityLog");
  try {
    const q = query(collection(db, "activity_log"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><i class="fa fa-inbox"></i><p>Үйлдэл бүртгэгдээгүй</p></td></tr>';
      return;
    }
    tbody.innerHTML = "";
    snap.forEach((d) => {
      const data = d.data();
      const date = data.timestamp ? formatDate(data.timestamp.toDate()) : "—";
      tbody.innerHTML += `<tr>
        <td>${date}</td>
        <td>${escapeHtml(data.userName || "—")}</td>
        <td>${escapeHtml(data.action || "—")}</td>
      </tr>`;
    });
  } catch {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><i class="fa fa-inbox"></i><p>Үйлдэл бүртгэгдээгүй</p></td></tr>';
  }
}

async function logActivity(action) {
  try {
    const logRef = doc(collection(db, "activity_log"));
    await setDoc(logRef, {
      userId: currentUser.uid,
      userName: currentAdmin.name || currentUser.email,
      action,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Log error:", err);
  }
}

// ═══════════════════════════════════════
//  PROJECTS (файлын системээс уншина)
// ═══════════════════════════════════════
const BASE_PATH = "../projects/";
const SITE_PATH = "../";
let allProjects = []; // { sector, slug, title, creator, funded, days, backers, newest, thumbUrl, desc, source }
let deletedProjectIds = []; // Устгагдсан төслүүдийн ID жагсаалт

async function loadProjects(filterSector) {
  const grid = document.getElementById("projectGrid");
  const countEl = document.getElementById("projectCount");
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state"><span class="spinner"></span><p>Ачаалж байна...</p></div>';

  try {
    allProjects = [];

    // 0) Устгагдсан төслүүдийн жагсаалтыг Firestore-аас авах
    try {
      const delSnap = await getDoc(doc(db, "settings", "deleted_projects"));
      if (delSnap.exists() && delSnap.data().ids) {
        deletedProjectIds = delSnap.data().ids;
      }
    } catch(e) { deletedProjectIds = []; }

    // Давхардлыг таних: sector + нэр-ийн хөнгөн хувилбараар ID үүсгэх
    // Mongolian Cyrillic letters (ө, ү, ң гэх мэт) алдахгүйн тулд Unicode property-ийг ашиглана
    const norm = (s) => (s || "").toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}\-]/gu, "");
    const seen = new Map(); // key -> index in allProjects
    const keyOf = (sector, titleOrSlug) => `${norm(sector)}::${norm(titleOrSlug)}`;

    // 1) tusul.html-аас hardcoded төслүүдийг parse хийж авна
    try {
      const res = await fetch(SITE_PATH + "tusul.html");
      if (res.ok) {
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const cards = doc.querySelectorAll(".project-card[data-cat]");
        cards.forEach((card) => {
          const sector = card.dataset.cat;
          const title = card.querySelector(".pcard-title")?.textContent?.trim() || "";
          const creator = card.querySelector(".pcard-creator")?.textContent?.trim() || "";
          const desc = card.querySelector(".pcard-desc")?.textContent?.trim() || "";
          const imgEl = card.querySelector(".pcard-img");
          const thumbUrl = imgEl ? SITE_PATH + imgEl.getAttribute("src") : "";
          const funded = parseInt(card.dataset.funded) || 0;
          const days = parseInt(card.dataset.days) || 0;
          const backers = parseInt(card.dataset.backers) || 0;
          const newest = parseInt(card.dataset.newest) || 0;
          const slug = (card.dataset.name || title).toLowerCase().replace(/\s+/g, "-");

          const key = keyOf(sector, card.dataset.name || title);
          if (seen.has(key)) return; // HTML дотор өөрөө давхардвал алгасна
          seen.set(key, allProjects.length);
          allProjects.push({ sector, slug, title, creator, desc, funded, days, backers, newest, thumbUrl, source: "html" });
        });
      }
    } catch (e) { console.warn("tusul.html parse:", e); }

    // 2) manifest.json-тай салбаруудаас (projects/{sector}/manifest.json)
    const sectors = Object.keys(SECTOR_NAMES);
    for (const sector of sectors) {
      try {
        const res = await fetch(BASE_PATH + sector + "/manifest.json");
        if (!res.ok) continue;
        const slugs = await res.json();
        for (const slug of slugs) {
          try {
            const metaRes = await fetch(BASE_PATH + sector + "/" + encodeURIComponent(slug) + "/meta.json");
            if (!metaRes.ok) continue;
            const meta = await metaRes.json();
            const effSlug = meta.slug || slug;
            const key = keyOf(sector, meta.title || effSlug);
            const altKey = keyOf(sector, effSlug);
            // Аль хэдийн HTML-оос орсон төсөл байвал manifest-ийн мэдээллээр шинэчлэн дарж бичнэ
            if (seen.has(key) || seen.has(altKey)) {
              const idx = seen.get(key) ?? seen.get(altKey);
              allProjects[idx] = {
                ...allProjects[idx],
                title: meta.title || allProjects[idx].title,
                creator: meta.creator || allProjects[idx].creator,
                funded: meta.funded ?? allProjects[idx].funded,
                days: meta.days ?? allProjects[idx].days,
                backers: meta.backers ?? allProjects[idx].backers,
                newest: meta.newest ?? allProjects[idx].newest,
                thumbUrl: BASE_PATH + sector + "/" + encodeURIComponent(effSlug) + "/thumbnail.jpg",
                slug: effSlug,
                source: "manifest"
              };
              continue;
            }
            seen.set(key, allProjects.length);
            allProjects.push({
              sector,
              slug: effSlug,
              title: meta.title || effSlug,
              creator: meta.creator || "",
              desc: "",
              funded: meta.funded || 0,
              days: meta.days || 0,
              backers: meta.backers || 0,
              newest: meta.newest || 0,
              thumbUrl: BASE_PATH + sector + "/" + encodeURIComponent(effSlug) + "/thumbnail.jpg",
              source: "manifest"
            });
          } catch {}
        }
      } catch {}
    }

    // 3) Firestore-аас төслүүд унших (админаар нэмсэн)
    try {
      const snap = await getDocs(collection(db, "projects"));
      snap.forEach((d) => {
        const data = d.data();
        const sector = data.sector;
        const slug = data.slug;
        if (!sector || !slug) return;
        // Давхардлыг 3 түвшинд шалгана: Firestore docId, sector+slug, sector+title
        let idx = allProjects.findIndex((p) => p.sector === sector && p.slug === slug);
        if (idx === -1) {
          const k1 = keyOf(sector, slug);
          const k2 = keyOf(sector, data.title || "");
          const seenIdx = seen.get(k1) ?? seen.get(k2);
          if (typeof seenIdx === "number") idx = seenIdx;
        }
        if (idx !== -1) {
          if (data.title) allProjects[idx].title = data.title;
          if (data.creator) allProjects[idx].creator = data.creator;
          if (data.thumbnailUrl) allProjects[idx].thumbUrl = data.thumbnailUrl;
          if (typeof data.funded === "number") allProjects[idx].funded = data.funded;
          if (typeof data.days === "number") allProjects[idx].days = data.days;
          if (typeof data.backers === "number") allProjects[idx].backers = data.backers;
          allProjects[idx].hidden = !!data.hidden;
          allProjects[idx].firestoreId = d.id;
        } else {
          const key = keyOf(sector, data.title || slug);
          if (seen.has(key)) return;
          seen.set(key, allProjects.length);
          allProjects.push({
            sector,
            slug,
            title: data.title || slug,
            creator: data.creator || "",
            desc: "",
            funded: data.funded || 0,
            days: data.days || 0,
            backers: data.backers || 0,
            newest: data.newest || 0,
            thumbUrl: data.thumbnailUrl || "",
            hidden: !!data.hidden,
            firestoreId: d.id,
            source: "firestore"
          });
        }
      });
    } catch (e) { console.warn("Firestore projects load:", e); }

    // 4) Google Sheet loader-уудаас төслүүдийг унших (tusul.html-тэй ижил эх үүсвэр)
    // Зөвхөн sheet-д байгаа төслүүдийг эцэст нь үлдээхийн тулд түлхүүрүүдийг цуглуулна
    const sheetKeys = new Set();
    await Promise.all(PROJECT_SHEETS.map(async (s) => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${s.id}/gviz/tq?tqx=out:json&gid=${s.gid}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const text = await res.text();
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart < 0 || jsonEnd < 0) return;
        const json = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
        const cols = (json.table.cols || []).map((c) => (c.label || "").trim());
        const rows = json.table.rows || [];
        // Mongolian Cyrillic NFC/NFD normalization-аас үүдэх алдагдлыг арилгахын тулд NFC-д оруулна
        const normLabel = (s) => (s || "").toString().toLowerCase().normalize("NFC");
        // 1) Яг таарах label, 2) substring таарах, 3) fallback index
        const colIdxStrict = (p) => {
          const needle = normLabel(p);
          // exact
          let idx = cols.findIndex((c) => c && normLabel(c) === needle);
          if (idx !== -1) return idx;
          // substring
          return cols.findIndex((c) => c && normLabel(c).indexOf(needle) !== -1);
        };
        // "Төслийн нэр" гэж хэмээгч байгуулж өөр "...нэр" багана эхэлж гармаас сэргийлнэ
        // → exact match-ийг эхэлж оролдох, substring бол "төсөл санаачлагч ... нэр"-ийг хоёрдугаарт үлдээнэ
        let iName = cols.findIndex((c) => c && normLabel(c) === normLabel("Төслийн нэр"));
        if (iName === -1) {
          // Зөв "төсл(и|и)йн нэр" substring, гэхдээ "санаачлагч"-тай биш
          iName = cols.findIndex((c) => {
            const n = c ? normLabel(c) : "";
            return n.indexOf("төслийн нэр") !== -1 && n.indexOf("санаачлагч") === -1;
          });
        }
        if (iName === -1) {
          // Эцсийн fallback: нэртэй сүүлчийн "нэр" багана — энэ Google Sheet-ийн нийтлэг бүтцэд 5-р багана байдаг
          iName = 5;
        }
        let iCreator = colIdxStrict("Байгууллагын нэр");
        if (iCreator === -1) iCreator = colIdxStrict("Төсөл санаачлагч");
        const iAmount = colIdxStrict("Нийт санхүүжил"); // "Нийт санхүүжилтйн" typo-г ч хамруулна
        const iDuration = colIdxStrict("Хэрэгжих хугацаа");
        const get = (cells, i) => {
          if (i < 0 || i >= cells.length) return "";
          const c = cells[i];
          if (!c) return "";
          if (c.f != null) return c.f.toString().trim();
          return c.v != null ? c.v.toString().trim() : "";
        };
        let sheetAdded = 0;
        rows.forEach((r, rowIdx) => {
          const cells = r.c || [];
          const title = get(cells, iName);
          if (!title) return;
          const creator = iCreator !== -1 ? get(cells, iCreator) : "";
          const amountStr = iAmount !== -1 ? get(cells, iAmount) : "";
          const amountNum = Number((amountStr || "").toString().replace(/[^\d.]/g, "")) || 0;
          const slug = (norm(title) || "sheet") + "-" + rowIdx;
          const key = keyOf(s.sector, title);
          sheetKeys.add(key);
          sheetAdded++;
          allProjects.push({
            sector: s.sector,
            slug,
            title,
            creator,
            desc: "",
            funded: 0,
            days: 0,
            backers: 0,
            newest: 0,
            thumbUrl: "",
            amount: amountNum,
            duration: iDuration !== -1 ? get(cells, iDuration) : "",
            source: "sheet",
            sheetRowIdx: rowIdx,
            sheetId: s.id,
            sheetGid: s.gid
          });
        });
        console.log(`[Admin/Sheet] ${s.sector}: ${sheetAdded} төсөл (iName=${iName}, cols=${cols.length})`);
      } catch (e) {
        console.warn("Sheet load:", s.sector, e);
      }
    }));

    // Sheet-ийн мөрүүдийг үндсэн жагсаалт. Давхардалыг: sector + title + creator
    // (ижил нэртэй ч өөр байгууллагаас ирсэн төслүүдийг хоёуланг үлдээнэ)
    const sheetProjectsRaw = allProjects.filter((p) => p.source === "sheet");
    const otherProjects = allProjects.filter((p) => p.source !== "sheet");

    const dedupMap = new Map();
    let dupCount = 0;
    sheetProjectsRaw.forEach((p) => {
      const titleKey = norm(p.title);
      const creatorKey = norm(p.creator || "");
      const k = `${norm(p.sector)}::${titleKey}::${creatorKey}`;
      if (dedupMap.has(k)) { dupCount++; return; }
      dedupMap.set(k, p);
    });

    // Metadata давхарлах (Firestore/manifest-аас ирсэн thumbnail, hidden г.м)
    const titleLookup = new Map();
    for (const p of dedupMap.values()) {
      const tk = keyOf(p.sector, p.title);
      if (!titleLookup.has(tk)) titleLookup.set(tk, p);
    }
    otherProjects.forEach((op) => {
      const sp = titleLookup.get(keyOf(op.sector, op.title))
              || (op.slug ? titleLookup.get(keyOf(op.sector, op.slug)) : null);
      if (!sp) return;
      if (op.thumbUrl && !sp.thumbUrl) sp.thumbUrl = op.thumbUrl;
      if (typeof op.hidden === "boolean") sp.hidden = op.hidden;
      if (op.firestoreId) sp.firestoreId = op.firestoreId;
      if (op.creator && !sp.creator) sp.creator = op.creator;
    });

    allProjects = Array.from(dedupMap.values());
    console.log(`[Admin/Projects] Нийт төсөл: ${allProjects.length}, давхардсан: ${dupCount}`);

    // 5) Санхүүжилтийн жинхэнэ хувийг тооцоолох — fundings collection-оос
    try {
      if (allFunders.length === 0) {
        const fSnap = await getDocs(collection(db, "fundings"));
        allFunders = [];
        fSnap.forEach((d) => allFunders.push(Object.assign({ id: d.id }, d.data())));
      }
      computeProjectFundedPercent();
    } catch (e) {
      console.warn("Funded% compute fail:", e);
    }

    renderProjects(filterSector);
  } catch (err) {
    console.error("Projects load error:", err);
    grid.innerHTML = '<div class="empty-state"><i class="fa fa-exclamation-triangle"></i><p>Алдаа гарлаа</p></div>';
  }
}

// Funder-уудаас төсөл тус бүрийн санхүүжсэн дүнг тооцоолж funded% (0–100+)-ийг шинэчилнэ
function computeProjectFundedPercent() {
  // Төслийн нэрээр funder-уудыг бүлэглэж дүн нийлбэрлэх
  const sumByTitle = new Map();      // norm title → нийт дүн
  const goalByTitle = new Map();      // norm title → projectAmount (funder-аас)

  allFunders.forEach((f) => {
    const key = normProjectTitle(f.project);
    if (!key) return;
    sumByTitle.set(key, (sumByTitle.get(key) || 0) + (parseFloat(f.amount) || 0));
    // Funder өгөгдөлд projectAmount байгаа бол ашиглана
    if (f.projectAmount && !goalByTitle.has(key)) {
      goalByTitle.set(key, parseFloat(f.projectAmount) || 0);
    }
  });

  let updated = 0;
  allProjects.forEach((p) => {
    const titleKey = normProjectTitle(p.title);
    const raised = sumByTitle.get(titleKey) || 0;
    if (raised <= 0) return; // Funder байхгүй төслүүдийг алгасах

    // Зорилго: project-ийн өөрийн amount > funder-ээс ирсэн projectAmount
    const goal = parseFloat(p.amount) || goalByTitle.get(titleKey) || 0;
    p.raisedAmount = raised;
    if (goal > 0) {
      p.funded = Math.round((raised / goal) * 100);
      p.amount = goal; // зорилго багана дүн харуулахад хэрэгтэй
    } else {
      p.funded = 0; // зорилго мэдэгдэхгүй
    }
    updated++;
  });
  console.log(`[Funded%] Updated ${updated}/${allProjects.length} projects from ${allFunders.length} funders`);
}

function populateProjectColumnFilters() {
  const sectorSel = document.querySelector('[data-proj-search="sector"]');
  if (!sectorSel) return;
  const prev = sectorSel.value || "";
  const sectorsInData = new Set();
  allProjects.forEach((p) => { if (p.sector) sectorsInData.add(p.sector); });
  // Бүх ангилал — SECTOR_NAMES-аас давхар + санхүүжүүлэгчтэй ч байсан төслүүд
  const all = new Set([...sectorsInData, ...Object.keys(SECTOR_NAMES)]);
  sectorSel.innerHTML = '<option value="">бүгд</option>';
  Array.from(all)
    .sort((a, b) => (SECTOR_NAMES[a] || a).localeCompare(SECTOR_NAMES[b] || b, "mn"))
    .forEach((s) => {
      const cnt = allProjects.filter((p) => p.sector === s).length;
      if (cnt === 0) return; // хоосон ангиллыг алгасах
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = (SECTOR_NAMES[s] || s) + ` (${cnt})`;
      sectorSel.appendChild(opt);
    });
  if (Array.from(sectorSel.options).some((o) => o.value === prev)) sectorSel.value = prev;
}

// Project col-search input listeners
document.addEventListener("input", (e) => {
  if (e.target && e.target.dataset && e.target.dataset.projSearch) {
    renderProjects(document.getElementById("projectFilterSector")?.value);
  }
});
document.addEventListener("change", (e) => {
  if (e.target && e.target.dataset && e.target.dataset.projSearch) {
    renderProjects(document.getElementById("projectFilterSector")?.value);
  }
});

function renderProjects(filterSector) {
  const grid = document.getElementById("projectGrid");
  const countEl = document.getElementById("projectCount");
  if (!grid) return;

  // Per-column хайлтын утгууд
  const colSearch = {};
  document.querySelectorAll("[data-proj-search]").forEach((el) => {
    colSearch[el.dataset.projSearch] = (el.value || "").toString().toLowerCase().trim();
  });

  // Sector dropdown-ыг бөглөх (одоо ачаалагдсан төслүүдээс)
  populateProjectColumnFilters();

  // Устгагдсан төслүүдийг шүүх
  let filtered = allProjects.filter((p) => {
    const pid = p.sector + "_" + p.slug;
    return !deletedProjectIds.includes(pid);
  });

  if (filterSector && filterSector !== "all") {
    filtered = filtered.filter((p) => p.sector === filterSector);
  }

  // Эрхийн шүүлт
  const allowedSectors = currentAdmin.allowedSectors || [];
  const isRestricted = currentAdmin.role !== "admin";
  if (isRestricted && allowedSectors.length > 0) {
    filtered = filtered.filter((p) => allowedSectors.includes(p.sector));
  }

  // Per-column шүүлт
  filtered = filtered.filter((p) => {
    if (colSearch.name && !(p.title || "").toLowerCase().includes(colSearch.name)
        && !(p.creator || "").toLowerCase().includes(colSearch.name)) return false;
    if (colSearch.sector && p.sector !== colSearch.sector) return false;
    if (colSearch.status === "visible" && p.hidden) return false;
    if (colSearch.status === "hidden" && !p.hidden) return false;
    return true;
  });

  // Санхүүжилтийн дараалал (ихээс бага / багаас их)
  if (colSearch.amount === "desc" || colSearch.amount === "asc") {
    const dir = colSearch.amount === "desc" ? -1 : 1;
    filtered.sort((a, b) => {
      const av = (parseFloat(a.raisedAmount) || 0);
      const bv = (parseFloat(b.raisedAmount) || 0);
      if (av !== bv) return (av - bv) * dir;
      // Тэнцүү бол funded% —> amount (goal) дарааллаар
      const af = (parseFloat(a.funded) || 0);
      const bf = (parseFloat(b.funded) || 0);
      if (af !== bf) return (af - bf) * dir;
      return ((parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0)) * dir;
    });
  }

  if (countEl) countEl.textContent = `Нийт ${filtered.length} төсөл`;

  if (filtered.length === 0) {
    grid.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa fa-folder-open"></i><p>Төсөл байхгүй</p></td></tr>';
    updateBulkBar();
    return;
  }

  const canEdit = currentAdmin.role === "admin" || currentAdmin.role === "sub-admin" || currentAdmin.role === "editor";
  const canDelete = currentAdmin.role === "admin";

  // Салбар бүрийн Google Sheet edit URL (tusul.html доторх loader-уудтай таарна)
  const SECTOR_SHEETS = {
    infra:       { id: "1eebLZJiL8lMMJ8YDEt2W06P9f8_NgICX9EXlMNdjvW8", gid: "0" },
    environment: { id: "1H6ORSfZh61fARTEd-F24bBPzCv88mKIHww8_MdORd68", gid: "0" },
    health:      { id: "1ah0aKyf2xfXGAu3TljHw-h3Q_kkdiaabo6SuYhsXP8E", gid: "0" },
    agri:        { id: "133ZKSNTFJ2ZaA7MBZPu7PtdE1tSP7hUUh-RVIKhhew8", gid: "0" },
    culture:     { id: "1ah0aKyf2xfXGAu3TljHw-h3Q_kkdiaabo6SuYhsXP8E", gid: "904267116" },
    edu:         { id: "1ah0aKyf2xfXGAu3TljHw-h3Q_kkdiaabo6SuYhsXP8E", gid: "797596799" },
    energy:      { id: "1ucbKdcgNMBcpyfnvpBzueFflzL-IMzqYtBYre7_uEVk", gid: "0" },
    mining:      { id: "1gHMiQzvsHb2lIWD8_QSSb7PIWcSm4lFR51dq8npthaU", gid: "0" }
  };

  grid.innerHTML = filtered.map((p) => {
    const fundedColor = p.funded >= 100 ? "#4bac48" : "var(--admin-accent)";
    const fundedPct = Math.min(p.funded, 100);
    // View: тухайн төслийн дэлгэрэнгүй модал автоматаар нээгдэхээр параметр дамжуулна
    const viewUrl = p.source === "manifest"
      ? `${BASE_PATH}${p.sector}/${encodeURIComponent(p.slug)}/index.html`
      : `${SITE_PATH}tusul.html?cat=${p.sector}&project=${encodeURIComponent(p.title)}`;
    // Edit: тухайн салбарын Google Sheet-ийг шууд нээнэ
    const sheet = SECTOR_SHEETS[p.sector];
    const sheetUrl = sheet
      ? `https://docs.google.com/spreadsheets/d/${sheet.id}/edit#gid=${sheet.gid}`
      : null;
    const thumb = p.thumbUrl
      ? `<img src="${p.thumbUrl}" style="width:50px;height:34px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">`
      : '<span style="color:var(--admin-text-muted)">—</span>';
    const pid = p.sector + "_" + p.slug;
    const statusBadge = p.hidden
      ? '<span class="badge badge-viewer"><i class="fa fa-eye-slash"></i> Нуугдсан</span>'
      : "";
    const rowStyle = p.hidden ? "opacity:.55" : "";

    return `<tr style="${rowStyle}" data-pid="${escapeHtml(pid)}">
      <td><input type="checkbox" class="project-select" data-sector="${p.sector}" data-slug="${encodeURIComponent(p.slug)}" data-title="${escapeHtml(p.title)}" data-source="${p.source}" data-hidden="${p.hidden ? 1 : 0}"></td>
      <td>${thumb}</td>
      <td>
        <div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.title)}</div>
        <div style="font-size:11px;color:var(--admin-text-muted)"><i class="fa fa-user-circle" style="opacity:.5"></i> ${escapeHtml(p.creator)}</div>
      </td>
      <td><span class="badge badge-sub-admin">${SECTOR_NAMES[p.sector] || p.sector}</span></td>
      <td style="min-width:160px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;background:var(--admin-dark-3);border-radius:4px;height:6px;overflow:hidden;min-width:60px">
            <div style="width:${fundedPct}%;height:100%;background:${fundedColor};border-radius:4px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${fundedColor};white-space:nowrap">${p.funded}%</span>
        </div>
        ${p.raisedAmount > 0 ? `<div style="font-size:10px;color:var(--admin-text-muted);margin-top:3px">
          <strong style="color:var(--admin-primary)">${p.raisedAmount.toLocaleString()}₮</strong>${p.amount ? ` / ${p.amount.toLocaleString()}₮` : ""}
        </div>` : (p.amount ? `<div style="font-size:10px;color:var(--admin-text-muted);margin-top:3px">Зорилго: ${p.amount.toLocaleString()}₮</div>` : "")}
      </td>
      <td>${statusBadge}</td>
      <td>
        <div class="action-btns">
          <a href="${viewUrl}" target="_blank" class="btn btn-outline btn-sm" title="Төслийн дэлгэрэнгүй"><i class="fa fa-eye"></i></a>
          <button class="btn btn-outline btn-sm" data-title="${escapeHtml(p.title)}" onclick="showProjectFunders(this.dataset.title)" title="Санхүүжүүлэгчид"><i class="fa fa-users"></i></button>
          ${canEdit && sheetUrl ? `<a href="${sheetUrl}" target="_blank" rel="noopener" class="btn btn-info btn-sm" title="Google Sheet-ээр засах"><i class="fa fa-edit"></i></a>` : ""}
        </div>
      </td>
    </tr>`;
  }).join("");

  // Checkbox event listeners
  grid.querySelectorAll(".project-select").forEach((cb) => {
    cb.addEventListener("change", updateBulkBar);
  });
  const selectAll = document.getElementById("projectSelectAll");
  if (selectAll) selectAll.checked = false;
  updateBulkBar();
}

// ── Тухайн төслийн санхүүжүүлэгчдийн жагсаалт харуулах ──
function showProjectFunders(title) {
  const modal = document.getElementById("projectFundersModal");
  const titleEl = document.getElementById("projectFundersTitle");
  const summaryEl = document.getElementById("projectFundersSummary");
  const listEl = document.getElementById("projectFundersList");
  if (!modal || !listEl || !summaryEl) return;

  titleEl.textContent = title;
  const key = normProjectTitle(title);
  const funders = (allFunders || []).filter((f) => normProjectTitle(f.project) === key);

  // Нийлбэр ба төслийн зорилго
  const totalRaised = funders.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
  const project = (allProjects || []).find((p) => normProjectTitle(p.title) === key);
  const goal = project ? (parseFloat(project.amount) || 0) : 0;
  const pct = goal > 0 ? Math.round((totalRaised / goal) * 100) : 0;

  const pctStatus = pct >= 100 ? "fs-pct-complete" : (pct >= 50 ? "fs-pct-mid" : "fs-pct-low");
  summaryEl.innerHTML = `
    <div class="fs-grid">
      <div class="fs-stat">
        <div class="fs-stat-icon"><i class="fa fa-users"></i></div>
        <div class="fs-stat-val">${funders.length}</div>
        <div class="fs-stat-lbl">САНХҮҮЖҮҮЛЭГЧ</div>
      </div>
      <div class="fs-stat">
        <div class="fs-stat-icon"><i class="fa fa-coins"></i></div>
        <div class="fs-stat-val">${totalRaised.toLocaleString()}<span class="fs-currency">₮</span></div>
        <div class="fs-stat-lbl">ЦУГЛАСАН ДҮН</div>
      </div>
      ${goal > 0 ? `<div class="fs-stat">
        <div class="fs-stat-icon"><i class="fa fa-bullseye"></i></div>
        <div class="fs-stat-val fs-stat-muted">${goal.toLocaleString()}<span class="fs-currency">₮</span></div>
        <div class="fs-stat-lbl">ЗОРИЛГО</div>
      </div>
      <div class="fs-stat ${pctStatus}">
        <div class="fs-stat-icon"><i class="fa fa-percent"></i></div>
        <div class="fs-stat-val">${pct}<span class="fs-currency">%</span></div>
        <div class="fs-stat-lbl">БИЕЛЭЛТ</div>
      </div>` : ""}
    </div>
    ${goal > 0 ? `<div class="fs-bar-wrap">
      <div class="fs-bar-fill" style="width:${Math.min(pct, 100)}%"></div>
    </div>` : ""}
  `;

  if (funders.length === 0) {
    listEl.innerHTML = `<div class="funders-empty">
      <i class="fa fa-inbox"></i>
      <p>Одоогоор санхүүжүүлэгч байхгүй байна</p>
    </div>`;
  } else {
    // Хамгийн сүүлд илгээснийг дээр байрлуулах
    funders.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });
    listEl.innerHTML = `
      <table class="funders-tbl-brand">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Нэр / Байгууллага</th>
            <th>Утас</th>
            <th style="text-align:right">Дүн</th>
            <th style="text-align:right;white-space:nowrap">Хувь</th>
            <th>Огноо</th>
          </tr>
        </thead>
        <tbody>
          ${funders.map((f, i) => {
            const dt = f.createdAt?.seconds
              ? new Date(f.createdAt.seconds * 1000).toLocaleString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
              : "—";
            const amt = parseFloat(f.amount) || 0;
            const isOrg = f.type === "org" || f.orgName;
            const displayName = isOrg
              ? (f.orgName || "—")
              : (f.name || "—");
            const subLine = isOrg && (f.person || f.position)
              ? `<div class="funder-sub">${escapeHtml([f.person, f.position].filter(Boolean).join(" · "))}</div>`
              : "";
            const typeBadge = isOrg
              ? `<span class="funder-type-badge funder-org"><i class="fa fa-building"></i> ААН</span>`
              : `<span class="funder-type-badge funder-person"><i class="fa fa-user"></i> Иргэн</span>`;
            const sharePct = totalRaised > 0 ? ((amt / totalRaised) * 100) : 0;
            const shareText = sharePct >= 10 ? sharePct.toFixed(0) : sharePct.toFixed(1);
            const goalShare = goal > 0 ? ((amt / goal) * 100).toFixed(1) : null;
            return `<tr>
              <td class="funder-num">${i + 1}</td>
              <td>
                <div class="funder-name-row">
                  ${typeBadge}
                  <strong class="funder-name">${escapeHtml(displayName)}</strong>
                </div>
                ${subLine}
              </td>
              <td class="funder-phone">${escapeHtml(f.phone || "—")}</td>
              <td class="funder-amount">${amt.toLocaleString()}<span class="fs-currency">₮</span></td>
              <td class="funder-share">
                <div class="funder-share-val">${shareText}%</div>
                ${goalShare !== null ? `<div class="funder-share-sub">зорилгоос ${goalShare}%</div>` : ""}
              </td>
              <td class="funder-date">${dt}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  modal.classList.add("active");
}
window.showProjectFunders = showProjectFunders;

// ── Bulk actions ──
function getSelectedProjects() {
  const boxes = document.querySelectorAll(".project-select:checked");
  return Array.from(boxes).map((cb) => ({
    sector: cb.dataset.sector,
    slug: decodeURIComponent(cb.dataset.slug),
    title: cb.dataset.title,
    source: cb.dataset.source,
    hidden: cb.dataset.hidden === "1"
  }));
}

function updateBulkBar() {
  const selected = getSelectedProjects();
  const bar = document.getElementById("bulkActionsBar");
  const cnt = document.getElementById("bulkSelectedCount");
  if (!bar) return;
  if (selected.length === 0) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";
  if (cnt) cnt.textContent = `${selected.length} төсөл сонгогдсон`;

  // Show/Hide button-уудыг сонголтод тааруулан идэвхжүүлэх
  const anyVisible = selected.some((s) => !s.hidden);
  const anyHidden = selected.some((s) => s.hidden);
  document.getElementById("bulkHideBtn").style.display = anyVisible ? "" : "none";
  document.getElementById("bulkShowBtn").style.display = anyHidden ? "" : "none";
}

// Select all checkbox
document.addEventListener("DOMContentLoaded", () => {}, { once: true });
(function initBulkHandlers() {
  const selectAll = document.getElementById("projectSelectAll");
  if (selectAll) {
    selectAll.addEventListener("change", (e) => {
      document.querySelectorAll(".project-select").forEach((cb) => {
        cb.checked = e.target.checked;
      });
      updateBulkBar();
    });
  }

  const clearBtn = document.getElementById("bulkClearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      document.querySelectorAll(".project-select").forEach((cb) => (cb.checked = false));
      if (selectAll) selectAll.checked = false;
      updateBulkBar();
    });
  }

  const hideBtn = document.getElementById("bulkHideBtn");
  if (hideBtn) hideBtn.addEventListener("click", () => bulkToggleVisibility(true));
  const showBtn = document.getElementById("bulkShowBtn");
  if (showBtn) showBtn.addEventListener("click", () => bulkToggleVisibility(false));
  const bulkDelBtn = document.getElementById("bulkDeleteBtn");
  if (bulkDelBtn) bulkDelBtn.addEventListener("click", confirmBulkDelete);
})();

async function bulkToggleVisibility(hide) {
  const selected = getSelectedProjects();
  if (selected.length === 0) return;
  const btn = hide ? document.getElementById("bulkHideBtn") : document.getElementById("bulkShowBtn");
  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    let processed = 0;
    for (const p of selected) {
      const docId = p.sector + "_" + p.slug;
      try {
        // Firestore-д hidden талбар тохируулах
        await setDoc(
          doc(db, "projects", docId),
          {
            hidden: hide,
            // HTML/manifest эх үүсвэртэй төсөл бол үндсэн мэдээллийг хадгалах
            sector: p.sector,
            slug: p.slug,
            title: p.title,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
          },
          { merge: true }
        );
        processed++;
      } catch (e) {
        console.warn("Hide/show failed for", docId, e);
      }
    }
    await logActivity(hide ? `${processed} төслийг нуув` : `${processed} төслийг харуулав`);
    showToast(hide ? `${processed} төсөл нуугдлаа` : `${processed} төсөл харагдана`, "success");
    loadProjects();
  } catch (err) {
    showToast("Алдаа: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function confirmBulkDelete() {
  const selected = getSelectedProjects();
  if (selected.length === 0) return;
  deleteTarget = { type: "bulk-projects", items: selected };
  document.getElementById("deleteMessage").textContent = `Сонгогдсон ${selected.length} төслийг устгахдаа итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.`;
  openModal("deleteModal");
}

// ═══════════════════════════════════════
//  EXCEL IMPORT
// ═══════════════════════════════════════

// Excel-ийн багана → Firestore талбар
const EXCEL_COLUMNS = [
  "Төслийн ангилал", "Салбар", "Төслийн нэр", "Товч тайлбар", "Дэлгэрэнгүй тайлбар",
  "Байгууллагын нэр", "Хэрэгжүүлэх байршил", "Хэрэгжилтийн үе шат", "Хэрэгжилтийн хугацаа",
  "Холбоо барих хүний нэр", "Утас", "И-мэйл", "Бүртгэсэн огноо", "ХАА-н чиглэл",
  "Хамрах малчид / Өрхийн тоо", "Экспортод чиглэсэн үү?", "Зорилтот экспортын зах зээл",
  "Органик стандарт, гэрчилгээ авах уу?", "Хадгалалт, тээврийн дэд бүтэц",
  "Нийт хөрөнгө оруулалт шаардлага", "Форумд хайж буй хөрөнгө оруулалт",
  "Хөрөнгө оруулалт эргэх хугацаа (жил)", "Жилийн хүлээгдэж буй өгөөж",
  "Санхүүжилтийн хэлбэр", "Санхүүжилтийн одоогийн байдал",
  "CO₂ хэмнэлт / бууралт (тонн/жил)", "Орон нутгийн иргэдэд үзүүлэх ашиг тус",
  "Үйлдвэрлэлийн хүчин чадал / Гаралт", "Шаардлагатай газар нутаг",
  "Гадаадын технологи / түнш", "Ашиглах технологи, онцлог",
  "Тусгай зөвшөөрлийн байдал", "Байгаль орчны үнэлгээ",
  "Гол эрсдэл ба шийдэл", "Байгууллагын хэлбэр", "Албан тушаал",
  "Гол зорилго", "B2B уулзалтын хүсэлт",
  "Малчдын чадавхийг бэхжүүлэх бүрэлдэхүүн байх уу?",
  "Бий болох ажлын байрны тоо", "Нэмэлт тэмдэглэл"
];

let importedRows = []; // parsed rows
let importFileNameVal = "";

// Ангилалын нэр → key рүү хөрвүүлэх (fuzzy)
function mapCategoryToKey(excelCat) {
  if (!excelCat) return "";
  const normalized = excelCat.toString().trim().toLowerCase();
  if (!normalized) return "";
  // 1) Яг таарах
  for (const cat of categoriesData) {
    if (cat.name.toLowerCase() === normalized) return cat.key;
    if (cat.key.toLowerCase() === normalized) return cat.key;
  }
  // 2) Хэсэгчлэн таарах
  for (const cat of categoriesData) {
    if (cat.name.toLowerCase().includes(normalized) || normalized.includes(cat.name.toLowerCase())) return cat.key;
  }
  return "";
}

// Загвар файл татах (XLSX)
document.getElementById("downloadTemplateBtn")?.addEventListener("click", () => {
  if (typeof XLSX === "undefined") { showToast("XLSX сан ачаалагдаагүй байна", "error"); return; }
  const wb = XLSX.utils.book_new();
  // Нэг жишээ мөр
  const sampleRow = {};
  EXCEL_COLUMNS.forEach((col) => { sampleRow[col] = ""; });
  sampleRow["Төслийн ангилал"] = "Эрчим хүч";
  sampleRow["Төслийн нэр"] = "Жишээ төсөл";
  sampleRow["Байгууллагын нэр"] = "Жишээ ХХК";
  sampleRow["Товч тайлбар"] = "Төслийн тухай товч тайлбар...";
  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: EXCEL_COLUMNS });
  // Баганы өргөн
  ws["!cols"] = EXCEL_COLUMNS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, "Төслүүд");
  XLSX.writeFile(wb, "dsif-project-template.xlsx");
  showToast("Загвар татагдлаа", "success");
});

// Import modal нээх
document.getElementById("importExcelBtn")?.addEventListener("click", () => {
  document.getElementById("importStep1").style.display = "block";
  document.getElementById("importStep2").style.display = "none";
  document.getElementById("importStep3").style.display = "none";
  document.getElementById("importConfirmBtn").style.display = "none";
  document.getElementById("excelFileInput").value = "";
  importedRows = [];
  openModal("importModal");
});

// File upload handlers
const excelUploadEl = document.getElementById("excelUpload");
const excelFileInput = document.getElementById("excelFileInput");
if (excelUploadEl && excelFileInput) {
  excelUploadEl.addEventListener("click", () => excelFileInput.click());
  excelUploadEl.addEventListener("dragover", (e) => { e.preventDefault(); excelUploadEl.style.borderColor = "var(--admin-primary)"; });
  excelUploadEl.addEventListener("dragleave", () => { excelUploadEl.style.borderColor = "var(--admin-border)"; });
  excelUploadEl.addEventListener("drop", (e) => {
    e.preventDefault();
    excelUploadEl.style.borderColor = "var(--admin-border)";
    if (e.dataTransfer.files.length) handleExcelFile(e.dataTransfer.files[0]);
  });
  excelFileInput.addEventListener("change", () => {
    if (excelFileInput.files.length) handleExcelFile(excelFileInput.files[0]);
  });
}

function handleExcelFile(file) {
  if (typeof XLSX === "undefined") { showToast("XLSX сан ачаалагдаагүй байна", "error"); return; }
  importFileNameVal = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      if (!rows.length) { showToast("Файлд өгөгдөл байхгүй байна", "error"); return; }
      importedRows = rows;
      renderImportPreview();
    } catch (err) {
      console.error("Excel parse error:", err);
      showToast("Excel уншихад алдаа гарлаа: " + err.message, "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderImportPreview() {
  document.getElementById("importStep1").style.display = "none";
  document.getElementById("importStep2").style.display = "block";
  document.getElementById("importConfirmBtn").style.display = "";
  document.getElementById("importFileName").textContent = importFileNameVal;
  document.getElementById("importRowCount").textContent = `— ${importedRows.length} мөр`;

  // Ангиллаар нь (Салбар-аас) эрэмбэлж харуулна
  const withKey = importedRows.map((row) => {
    const salbar = row["Салбар"] || row["Төслийн ангилал"] || "";
    return { row, excelCat: salbar, sectorKey: mapCategoryToKey(salbar) };
  });
  withKey.sort((a, b) => {
    const ak = a.sectorKey || "zzz"; // тохирохгүйг доор нь
    const bk = b.sectorKey || "zzz";
    if (ak !== bk) return ak.localeCompare(bk);
    const at = (a.row["Төслийн нэр"] || "").toString();
    const bt = (b.row["Төслийн нэр"] || "").toString();
    return at.localeCompare(bt);
  });
  importedRows = withKey.map((x) => x.row); // бодит эрэмбэлэлт

  const tbody = document.getElementById("importPreview");
  let anyUnmapped = 0;
  tbody.innerHTML = withKey.map(({ row, excelCat, sectorKey }, i) => {
    const title = row["Төслийн нэр"] || "";
    const org = row["Байгууллагын нэр"] || "";
    const brief = row["Товч тайлбар"] || "";
    const isValid = !!title && !!sectorKey;
    if (!sectorKey) anyUnmapped++;

    let statusBadge;
    if (!title) {
      statusBadge = '<span class="badge badge-viewer">Нэр алга</span>';
    } else if (!sectorKey) {
      statusBadge = '<span class="badge badge-editor">Ангилал тохирохгүй</span>';
    } else {
      statusBadge = '<span class="badge badge-admin">Бэлэн</span>';
    }

    const sectorCell = sectorKey
      ? `<span class="badge badge-sub-admin">${escapeHtml(SECTOR_NAMES[sectorKey] || sectorKey)}</span> <small style="opacity:.6">(${escapeHtml(excelCat)})</small>`
      : `<em style="color:var(--admin-text-muted)">${escapeHtml(excelCat || "—")}</em>`;

    return `<tr style="${!isValid ? 'opacity:.6' : ''}">
      <td style="font-size:11px;color:var(--admin-text-muted)">${i + 1}</td>
      <td style="font-weight:600">${escapeHtml(title.substring(0, 60))}${title.length > 60 ? '…' : ''}</td>
      <td>${sectorCell}</td>
      <td>${escapeHtml(org.substring(0, 30))}${org.length > 30 ? '…' : ''}</td>
      <td style="font-size:12px">${escapeHtml(brief.substring(0, 50))}${brief.length > 50 ? '…' : ''}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join("");

  document.getElementById("importMappingWarning").style.display = anyUnmapped > 0 ? "block" : "none";
  const validCount = importedRows.filter((r) => r["Төслийн нэр"] && mapCategoryToKey(r["Салбар"] || r["Төслийн ангилал"])).length;
  document.getElementById("importConfirmText").textContent = `${validCount} төсөл оруулах`;
  document.getElementById("importConfirmBtn").disabled = validCount === 0;
}

// Буцах товч
document.getElementById("importBackBtn")?.addEventListener("click", () => {
  document.getElementById("importStep1").style.display = "block";
  document.getElementById("importStep2").style.display = "none";
  document.getElementById("importConfirmBtn").style.display = "none";
  document.getElementById("excelFileInput").value = "";
});

// Импортыг эхлүүлэх
document.getElementById("importConfirmBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("importConfirmBtn");
  btn.disabled = true;

  document.getElementById("importStep2").style.display = "none";
  document.getElementById("importStep3").style.display = "block";
  document.getElementById("importCancelBtn").disabled = true;

  const progressBar = document.getElementById("importProgressBar");
  const progressText = document.getElementById("importProgressText");
  const progressDetail = document.getElementById("importProgressDetail");

  const validRows = importedRows
    .map((row) => ({ row, sectorKey: mapCategoryToKey(row["Салбар"] || row["Төслийн ангилал"]), title: (row["Төслийн нэр"] || "").toString().trim() }))
    .filter((r) => r.title && r.sectorKey)
    // Ангиллаар эрэмбэлж багц бүрд ижил sector-ийн мөрүүд орно
    .sort((a, b) => {
      if (a.sectorKey !== b.sectorKey) return a.sectorKey.localeCompare(b.sectorKey);
      return a.title.localeCompare(b.title);
    });

  let success = 0;
  let failed = 0;

  console.log("[import] Эхэлж байна:", validRows.length, "мөр");

  // Параллель оруулалт (10-аар багцалж ачаалал багасгана)
  const BATCH_SIZE = 10;
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);

    progressText.textContent = `Оруулж байна: ${Math.min(i + BATCH_SIZE, validRows.length)} / ${validRows.length}`;
    progressBar.style.width = ((i / validRows.length) * 100) + "%";

    const results = await Promise.allSettled(batch.map(async ({ row, sectorKey, title }) => {
      const slug = title.toLowerCase().replace(/\s+/g, "-");
      const docId = sectorKey + "_" + slug;

      // Бүх талбарыг Firestore-д хадгалах (pre-check алга → хурдан)
      const metaData = {
        slug,
        title,
        creator: (row["Байгууллагын нэр"] || "").toString(),
        sector: sectorKey,
        funded: 0,
        days: 0,
        backers: 0,
        newest: Date.now(),
        // Дэлгэрэнгүй мэдээлэл (extra)
        extra: {
          category: (row["Төслийн ангилал"] || "").toString(),
          sectorText: (row["Салбар"] || "").toString(),
          briefDesc: (row["Товч тайлбар"] || "").toString(),
          fullDesc: (row["Дэлгэрэнгүй тайлбар"] || "").toString(),
          location: (row["Хэрэгжүүлэх байршил"] || "").toString(),
          stage: (row["Хэрэгжилтийн үе шат"] || "").toString(),
          duration: (row["Хэрэгжилтийн хугацаа"] || "").toString(),
          contactName: (row["Холбоо барих хүний нэр"] || "").toString(),
          phone: (row["Утас"] || "").toString(),
          email: (row["И-мэйл"] || "").toString(),
          registeredAt: (row["Бүртгэсэн огноо"] || "").toString(),
          agriFocus: (row["ХАА-н чиглэл"] || "").toString(),
          herdersCount: (row["Хамрах малчид / Өрхийн тоо"] || "").toString(),
          exportOriented: (row["Экспортод чиглэсэн үү?"] || "").toString(),
          exportMarket: (row["Зорилтот экспортын зах зээл"] || "").toString(),
          organicCert: (row["Органик стандарт, гэрчилгээ авах уу?"] || "").toString(),
          logistics: (row["Хадгалалт, тээврийн дэд бүтэц"] || "").toString(),
          totalInvestment: (row["Нийт хөрөнгө оруулалт шаардлага"] || "").toString(),
          forumInvestment: (row["Форумд хайж буй хөрөнгө оруулалт"] || "").toString(),
          paybackYears: (row["Хөрөнгө оруулалт эргэх хугацаа (жил)"] || "").toString(),
          annualReturn: (row["Жилийн хүлээгдэж буй өгөөж"] || "").toString(),
          financingType: (row["Санхүүжилтийн хэлбэр"] || "").toString(),
          financingStatus: (row["Санхүүжилтийн одоогийн байдал"] || "").toString(),
          co2Reduction: (row["CO₂ хэмнэлт / бууралт (тонн/жил)"] || "").toString(),
          communityBenefit: (row["Орон нутгийн иргэдэд үзүүлэх ашиг тус"] || "").toString(),
          capacity: (row["Үйлдвэрлэлийн хүчин чадал / Гаралт"] || "").toString(),
          landRequired: (row["Шаардлагатай газар нутаг"] || "").toString(),
          foreignPartner: (row["Гадаадын технологи / түнш"] || "").toString(),
          technology: (row["Ашиглах технологи, онцлог"] || "").toString(),
          permits: (row["Тусгай зөвшөөрлийн байдал"] || "").toString(),
          envAssessment: (row["Байгаль орчны үнэлгээ"] || "").toString(),
          risks: (row["Гол эрсдэл ба шийдэл"] || "").toString(),
          orgType: (row["Байгууллагын хэлбэр"] || "").toString(),
          position: (row["Албан тушаал"] || "").toString(),
          mainGoal: (row["Гол зорилго"] || "").toString(),
          b2bRequest: (row["B2B уулзалтын хүсэлт"] || "").toString(),
          herderCapacity: (row["Малчдын чадавхийг бэхжүүлэх бүрэлдэхүүн байх уу?"] || "").toString(),
          jobsCreated: (row["Бий болох ажлын байрны тоо"] || "").toString(),
          notes: (row["Нэмэлт тэмдэглэл"] || "").toString()
        },
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      };

      await setDoc(doc(db, "projects", docId), metaData, { merge: true });

      if (deletedProjectIds.includes(docId)) {
        deletedProjectIds = deletedProjectIds.filter((id) => id !== docId);
      }
      return { ok: true, docId, title };
    }));

    results.forEach((r, j) => {
      if (r.status === "fulfilled") {
        success++;
      } else {
        failed++;
        console.error("[import] Мөр амжилтгүй:", batch[j]?.title, r.reason);
      }
    });

    if (batch[batch.length - 1]) {
      progressDetail.textContent = batch[batch.length - 1].title;
    }
    console.log(`[import] Багц ${Math.floor(i / BATCH_SIZE) + 1}: ${success} амжилттай, ${failed} алдаа`);
  }

  // deleted_projects шинэчлэх
  try {
    await setDoc(doc(db, "settings", "deleted_projects"), {
      ids: deletedProjectIds,
      updatedAt: serverTimestamp()
    });
  } catch(e) {}

  await logActivity(`Excel-ээр ${success} төсөл оруулав${failed ? ` (${failed} алдаа)` : ""}`);

  progressBar.style.width = "100%";
  progressText.textContent = "Дууслаа!";
  progressDetail.textContent = `${success} амжилттай, ${failed} алдаа`;

  setTimeout(() => {
    closeModal("importModal");
    document.getElementById("importCancelBtn").disabled = false;
    showToast(`${success} төсөл амжилттай нэмэгдлээ${failed ? `, ${failed} алдаа` : ""}`, failed ? "info" : "success");
    loadProjects();
    loadDashboard();
  }, 1500);
});

// Салбараар шүүх
document.getElementById("projectFilterSector").addEventListener("change", (e) => {
  renderProjects(e.target.value);
});

// Төсөл нэмэх modal
document.getElementById("addProjectBtn").addEventListener("click", () => {
  document.getElementById("projectModalTitle").textContent = "Төсөл нэмэх";
  document.getElementById("projectForm").reset();
  document.getElementById("projectEditId").value = "";
  document.getElementById("projectEditSector").value = "";
  document.getElementById("projectSector").disabled = false;
  document.getElementById("thumbnailPreview").style.display = "none";
  selectedThumbnailFile = null;
  openModal("projectModal");
});

// Thumbnail upload
const thumbnailUploadEl = document.getElementById("thumbnailUpload");
const thumbnailInput = document.getElementById("projectThumbnail");
const thumbnailPreview = document.getElementById("thumbnailPreview");

thumbnailUploadEl.addEventListener("click", () => thumbnailInput.click());
thumbnailUploadEl.addEventListener("dragover", (e) => { e.preventDefault(); thumbnailUploadEl.style.borderColor = "var(--admin-primary)"; });
thumbnailUploadEl.addEventListener("dragleave", () => { thumbnailUploadEl.style.borderColor = "var(--admin-border)"; });
thumbnailUploadEl.addEventListener("drop", (e) => {
  e.preventDefault();
  thumbnailUploadEl.style.borderColor = "var(--admin-border)";
  if (e.dataTransfer.files.length) handleThumbnail(e.dataTransfer.files[0]);
});
thumbnailInput.addEventListener("change", () => {
  if (thumbnailInput.files.length) handleThumbnail(thumbnailInput.files[0]);
});

function handleThumbnail(file) {
  if (!file.type.startsWith("image/")) { showToast("Зөвхөн зураг файл оруулна уу", "error"); return; }
  selectedThumbnailFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    thumbnailPreview.src = e.target.result;
    thumbnailPreview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

// Төсөл хадгалах (Firestore + Firebase Storage)
document.getElementById("saveProjectBtn").addEventListener("click", async () => {
  const name = document.getElementById("projectName").value.trim();
  const sector = document.getElementById("projectSector").value;
  const creator = document.getElementById("projectCreator").value.trim();
  const editId = document.getElementById("projectEditId").value;
  const editSector = document.getElementById("projectEditSector").value;

  if (!name || !sector || !creator) { showToast("Бүх талбарыг бөглөнө үү", "error"); return; }

  const btn = document.getElementById("saveProjectBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const slug = editId || name.toLowerCase().replace(/\s+/g, "-");
    let thumbnailUrl = "";

    // Зураг upload (Firebase Storage) — алдаа гарвал base64 fallback ашиглана
    if (selectedThumbnailFile) {
      console.log("[saveProject] Зураг upload эхэлж байна...", selectedThumbnailFile.name, selectedThumbnailFile.size, "bytes");
      try {
        // Өмнөх зургийг устгах
        if (editId) {
          try {
            const oldRef = ref(storage, `projects/${sector}/${slug}/thumbnail.jpg`);
            await deleteObject(oldRef);
          } catch(e) { /* өмнөх зураг байхгүй бол алдаа гарахгүй */ }
        }
        const storageRef = ref(storage, `projects/${sector}/${slug}/thumbnail.jpg`);

        // 30 секундын timeout
        const uploadPromise = uploadBytes(storageRef, selectedThumbnailFile);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Upload timeout (30s)")), 30000)
        );
        await Promise.race([uploadPromise, timeoutPromise]);

        thumbnailUrl = await getDownloadURL(storageRef);
        console.log("[saveProject] Storage upload амжилттай:", thumbnailUrl);
      } catch (uploadErr) {
        console.warn("[saveProject] Storage upload бүтэлгүйтлээ, base64 fallback ашиглаж байна:", uploadErr);
        showToast("Storage-д байршуулж чадсангүй, зургийг шууд хадгалж байна...", "info");
        // Base64 fallback: зургийг шахаад data URL хэлбэрээр Firestore-д хадгалах
        thumbnailUrl = await compressToDataUrl(selectedThumbnailFile, 800, 0.75);
        console.log("[saveProject] Base64 data URL үүсгэв, урт:", thumbnailUrl.length);
      }
    }

    // Өмнөх мэдээллийг хадгалах (засварлахад funded, days гэх мэт алдагдахгүйн тулд)
    let prevData = {};
    if (editId) {
      try {
        const prevDoc = await getDoc(doc(db, "projects", sector + "_" + slug));
        if (prevDoc.exists()) prevData = prevDoc.data();
      } catch(e) {}
    }

    // Meta мэдээлэл Firestore-д хадгалах
    const metaData = {
      slug,
      title: name,
      creator,
      sector,
      funded: prevData.funded || 0,
      days: prevData.days || 0,
      backers: prevData.backers || 0,
      newest: prevData.newest || Date.now(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };
    if (thumbnailUrl) metaData.thumbnailUrl = thumbnailUrl;

    const docId = sector + "_" + slug;
    console.log("[saveProject] Firestore бичих эхэлж байна:", docId);
    if (editId) {
      await updateDoc(doc(db, "projects", docId), metaData);
      await logActivity(`"${name}" төслийг засварлав`);
      showToast("Төсөл засварлагдлаа", "success");
    } else {
      metaData.createdAt = serverTimestamp();
      metaData.createdBy = currentUser.uid;
      await setDoc(doc(db, "projects", docId), metaData);
      await logActivity(`"${name}" төслийг ${SECTOR_NAMES[sector]} ангилалд нэмэв`);
      showToast("Төсөл нэмэгдлээ", "success");
    }

    // Өмнө устгагдсан жагсаалтаас хасах (ижил нэрээр дахин нэмэх тохиолдол)
    if (deletedProjectIds.includes(docId)) {
      deletedProjectIds = deletedProjectIds.filter((id) => id !== docId);
      try {
        await setDoc(doc(db, "settings", "deleted_projects"), {
          ids: deletedProjectIds,
          updatedAt: serverTimestamp()
        });
        console.log("[saveProject] deleted_projects-оос хасав:", docId);
      } catch(e) { console.warn("deleted_projects шинэчлэх алдаа:", e); }
    }

    console.log("[saveProject] Амжилттай хадгалагдлаа");

    closeModal("projectModal");
    loadProjects();
    loadDashboard();
  } catch (err) {
    console.error("Save project error:", err);
    showToast("Алдаа: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-save"></i> Хадгалах';
  }
});

// Төсөл засварлах
window.editProject = async function (sector, slug) {
  slug = decodeURIComponent(slug);
  try {
    // allProjects-аас олох
    const project = allProjects.find((p) => p.sector === sector && p.slug === slug);

    // Файлын системээс meta.json уншина
    let meta = null;
    try {
      const res = await fetch(BASE_PATH + sector + "/" + encodeURIComponent(slug) + "/meta.json");
      if (res.ok) meta = await res.json();
    } catch(e) {}

    // Firestore-аас мөн шалгах
    let firestoreMeta = null;
    try {
      const docId = sector + "_" + slug;
      const d = await getDoc(doc(db, "projects", docId));
      if (d.exists()) firestoreMeta = d.data();
    } catch(e) {}

    document.getElementById("projectModalTitle").textContent = "Төсөл засварлах";
    document.getElementById("projectEditId").value = slug;
    document.getElementById("projectEditSector").value = sector;
    document.getElementById("projectSector").value = sector;
    document.getElementById("projectSector").disabled = true;
    document.getElementById("projectName").value = (firestoreMeta && firestoreMeta.title) || (meta && meta.title) || (project && project.title) || slug;
    document.getElementById("projectCreator").value = (firestoreMeta && firestoreMeta.creator) || (meta && meta.creator) || (project && project.creator) || "";

    // Thumbnail — Firestore URL эсвэл файлын систем эсвэл allProjects-аас
    let thumbUrl = "";
    if (firestoreMeta && firestoreMeta.thumbnailUrl) {
      thumbUrl = firestoreMeta.thumbnailUrl;
    } else if (project && project.thumbUrl) {
      thumbUrl = project.thumbUrl;
    } else {
      thumbUrl = BASE_PATH + sector + "/" + encodeURIComponent(slug) + "/thumbnail.jpg";
    }

    if (thumbUrl) {
      thumbnailPreview.src = thumbUrl;
      thumbnailPreview.style.display = "block";
    } else {
      thumbnailPreview.style.display = "none";
    }

    selectedThumbnailFile = null;
    openModal("projectModal");
  } catch (err) {
    showToast("Алдаа: " + err.message, "error");
  }
};

// Төсөл устгах
let deleteTarget = { type: "", id: "", name: "" };

window.confirmDeleteProject = function (sector, slug, name, source) {
  slug = decodeURIComponent(slug);
  name = name || slug;
  source = source || "firestore";
  deleteTarget = { type: "project", id: sector + "_" + slug, name, sector, slug, source };
  if (source === "html") {
    document.getElementById("deleteMessage").textContent = `"${name}" төсөл tusul.html файлд hardcoded байгаа тул Firestore-аас устгана. Файлаас гараар устгах шаардлагатай.`;
  } else {
    document.getElementById("deleteMessage").textContent = `"${name}" төслийг устгахдаа итгэлтэй байна уу?`;
  }
  openModal("deleteModal");
};

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    if (deleteTarget.type === "project") {
      // Firestore-аас устгах
      try {
        await deleteDoc(doc(db, "projects", deleteTarget.id));
      } catch(e) { console.warn("Firestore delete:", e); }

      // Устгагдсан жагсаалтад нэмэх (HTML/manifest төслүүдийг дахин харуулахгүйн тулд)
      if (!deletedProjectIds.includes(deleteTarget.id)) {
        deletedProjectIds.push(deleteTarget.id);
      }
      await setDoc(doc(db, "settings", "deleted_projects"), { ids: deletedProjectIds, updatedAt: serverTimestamp() });

      await logActivity(`"${deleteTarget.name}" төслийг устгав`);
      showToast("Төсөл устгагдлаа", "success");
      loadProjects();
      loadDashboard();
    } else if (deleteTarget.type === "sub-admin") {
      await deleteDoc(doc(db, "admins", deleteTarget.id));
      await logActivity(`"${deleteTarget.name}" дэд админыг хаслаа`);
      showToast("Дэд админ хасагдлаа", "success");
      loadSubAdmins();
      loadDashboard();
    } else if (deleteTarget.type === "sector") {
      // categories.json-аас хасах
      categoriesData = categoriesData.filter((c) => c.key !== deleteTarget.id);
      await setDoc(doc(db, "settings", "categories"), {
        list: categoriesData,
        updatedAt: serverTimestamp()
      });
      await logActivity(`"${deleteTarget.name}" ангилалыг устгав`);
      showToast("Ангилал устгагдлаа", "success");
      loadSectors();
      loadDashboard();
    } else if (deleteTarget.type === "bulk-projects") {
      let processed = 0;
      for (const p of deleteTarget.items) {
        const docId = p.sector + "_" + p.slug;
        try {
          await deleteDoc(doc(db, "projects", docId));
        } catch(e) { console.warn("Firestore delete:", docId, e); }
        if (!deletedProjectIds.includes(docId)) deletedProjectIds.push(docId);
        processed++;
      }
      await setDoc(doc(db, "settings", "deleted_projects"), {
        ids: deletedProjectIds,
        updatedAt: serverTimestamp()
      });
      await logActivity(`${processed} төслийг нэгэн зэрэг устгав`);
      showToast(`${processed} төсөл устгагдлаа`, "success");
      loadProjects();
      loadDashboard();
    }
    closeModal("deleteModal");
  } catch (err) {
    showToast("Алдаа: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-trash"></i> Устгах';
  }
});

// ═══════════════════════════════════════
//  SUB-ADMINS
// ═══════════════════════════════════════
async function loadSubAdmins() {
  const tbody = document.getElementById("subAdminsTable");
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px"><span class="spinner"></span></td></tr>';

  try {
    const snap = await getDocs(collection(db, "admins"));
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa fa-user-shield"></i><p>Админ байхгүй</p></td></tr>';
      return;
    }

    tbody.innerHTML = "";
    snap.forEach((d) => {
      const data = d.data();
      const date = data.createdAt ? formatDate(data.createdAt.toDate()) : "—";
      const roleBadge = getRoleBadge(data.role);
      const isCurrentUser = d.id === currentUser.uid;
      const canManage = currentAdmin.role === "admin" && !isCurrentUser;

      tbody.innerHTML += `<tr>
        <td>${escapeHtml(data.name || "—")}</td>
        <td>${escapeHtml(data.email || "—")}</td>
        <td>${roleBadge}</td>
        <td>${date}</td>
        <td>
          <div class="action-btns">
            ${canManage ? `<button class="btn btn-info btn-sm" onclick="editSubAdmin('${d.id}')"><i class="fa fa-edit"></i></button>` : ""}
            ${canManage ? `<button class="btn btn-danger btn-sm" onclick="confirmDeleteSubAdmin('${d.id}','${escapeHtml(data.name || data.email)}')"><i class="fa fa-trash"></i></button>` : ""}
            ${isCurrentUser ? '<span class="badge badge-admin">Та</span>' : ""}
          </div>
        </td>
      </tr>`;
    });
  } catch (err) {
    console.error("Sub-admins load error:", err);
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>Алдаа гарлаа</p></td></tr>';
  }
}

// Дэд админ нэмэх modal
document.getElementById("addSubAdminBtn").addEventListener("click", () => {
  document.getElementById("subAdminModalTitle").textContent = "Дэд админ нэмэх";
  document.getElementById("subAdminForm").reset();
  document.getElementById("subAdminEditId").value = "";
  document.getElementById("subAdminPasswordGroup").style.display = "block";
  document.getElementById("subAdminPassword").required = true;
  // Бүх checkbox сонголтыг цуцлах
  document.querySelectorAll("#sectorPermissions input").forEach((cb) => (cb.checked = false));
  openModal("subAdminModal");
});

// Дэд админ хадгалах
document.getElementById("saveSubAdminBtn").addEventListener("click", async () => {
  const name = document.getElementById("subAdminName").value.trim();
  const email = document.getElementById("subAdminEmail").value.trim();
  const password = document.getElementById("subAdminPassword").value;
  const role = document.getElementById("subAdminRole").value;
  const editId = document.getElementById("subAdminEditId").value;

  // Сонгогдсон салбарууд
  const allowedSectors = [];
  document.querySelectorAll("#sectorPermissions input:checked").forEach((cb) => {
    allowedSectors.push(cb.value);
  });

  if (!name || !email) { showToast("Нэр, имэйл заавал бөглөнө", "error"); return; }
  if (!editId && (!password || password.length < 6)) { showToast("Нууц үг 6+ тэмдэгт байх ёстой", "error"); return; }

  const btn = document.getElementById("saveSubAdminBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    if (editId) {
      // Засварлах (зөвхөн Firestore дахь мэдээлэл)
      await updateDoc(doc(db, "admins", editId), {
        name,
        email,
        role,
        allowedSectors,
        updatedAt: serverTimestamp()
      });
      await logActivity(`"${name}" дэд админы мэдээллийг засварлав`);
      showToast("Дэд админ засварлагдлаа", "success");
    } else {
      // Шинээр үүсгэх — Firebase Auth-д хэрэглэгч үүсгэнэ
      // Тэмдэглэл: Client SDK-р бусад хэрэглэгч үүсгэх нь одоогийн session-г солих тул
      // бид secondary app ашиглана
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await updateProfile(cred.user, { displayName: name });

      // Firestore-д админ бичлэг нэмэх
      await setDoc(doc(db, "admins", cred.user.uid), {
        name,
        email,
        role,
        allowedSectors,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });

      // Secondary auth-аас гарах
      await signOut(secondaryAuth);

      await logActivity(`"${name}" дэд админыг нэмэв (${ROLE_LABELS[role]})`);
      showToast("Дэд админ амжилттай нэмэгдлээ", "success");
    }

    closeModal("subAdminModal");
    loadSubAdmins();
    loadDashboard();
  } catch (err) {
    console.error("Save sub-admin error:", err);
    if (err.code === "auth/email-already-in-use") {
      showToast("Энэ имэйл хаяг бүртгэлтэй байна", "error");
    } else {
      showToast("Алдаа: " + err.message, "error");
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-save"></i> Хадгалах';
  }
});

// Дэд админ засварлах
window.editSubAdmin = async function (id) {
  try {
    const d = await getDoc(doc(db, "admins", id));
    if (!d.exists()) { showToast("Олдсонгүй", "error"); return; }
    const data = d.data();

    document.getElementById("subAdminModalTitle").textContent = "Дэд админ засварлах";
    document.getElementById("subAdminEditId").value = id;
    document.getElementById("subAdminName").value = data.name || "";
    document.getElementById("subAdminEmail").value = data.email || "";
    document.getElementById("subAdminRole").value = data.role || "sub-admin";
    // Нууц үг засварлахад шаардлагагүй
    document.getElementById("subAdminPasswordGroup").style.display = "none";
    document.getElementById("subAdminPassword").required = false;

    // Салбар checkbox тохируулах
    const allowed = data.allowedSectors || [];
    document.querySelectorAll("#sectorPermissions input").forEach((cb) => {
      cb.checked = allowed.includes(cb.value);
    });

    openModal("subAdminModal");
  } catch (err) {
    showToast("Алдаа: " + err.message, "error");
  }
};

// Дэд админ устгах
window.confirmDeleteSubAdmin = function (id, name) {
  deleteTarget = { type: "sub-admin", id, name };
  document.getElementById("deleteMessage").textContent = `"${name}" дэд админыг хасахдаа итгэлтэй байна уу?`;
  openModal("deleteModal");
};

// ═══════════════════════════════════════
//  SECTORS
// ═══════════════════════════════════════

// ── Ангилалуудын мэдээлэл (categories.json-аас) ──
const CATEGORIES_PATH = "../data/categories.json";
let categoriesData = [];
let selectedSectorImgFile = null;

async function loadSectors() {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state"><span class="spinner"></span><p>Ачаалж байна...</p></div>';

  try {
    const res = await fetch(CATEGORIES_PATH);
    if (!res.ok) throw new Error("categories.json уншигдсангүй");
    categoriesData = await res.json();

    // Төслийн тоо
    let projectCounts = {};
    allProjects.forEach((p) => { projectCounts[p.sector] = (projectCounts[p.sector] || 0) + 1; });

    const canManage = currentAdmin.role === "admin";

    grid.innerHTML = categoriesData.map((cat) => {
      const count = projectCounts[cat.key] || 0;
      const imgSrc = "../" + cat.image;
      return `<div class="project-card-admin">
        <img src="${imgSrc}" class="pca-img" alt="${escapeHtml(cat.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="pca-img-placeholder" style="display:none"><i class="fa fa-image"></i></div>
        <div class="pca-body">
          <div class="pca-title">${escapeHtml(cat.name)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
            <div>
              <code style="background:rgba(75,172,72,0.1);padding:3px 8px;border-radius:4px;font-size:11px;color:var(--admin-primary)">${escapeHtml(cat.key)}</code>
              <span class="badge badge-sub-admin" style="margin-left:6px">${count} төсөл</span>
            </div>
            <div class="pca-actions">
              ${canManage ? `<button class="btn btn-info btn-sm" onclick="editSector('${cat.key}')"><i class="fa fa-edit"></i></button>` : ""}
              ${canManage ? `<button class="btn btn-danger btn-sm" onclick="confirmDeleteSector('${cat.key}','${escapeHtml(cat.name)}')"><i class="fa fa-trash"></i></button>` : ""}
            </div>
          </div>
        </div>
      </div>`;
    }).join("");

    // SECTOR_NAMES шинэчлэх
    Object.keys(SECTOR_NAMES).forEach((k) => delete SECTOR_NAMES[k]);
    categoriesData.forEach((cat) => { SECTOR_NAMES[cat.key] = cat.name; });

    await refreshSectorLists();

  } catch (err) {
    console.error("Categories load error:", err);
    grid.innerHTML = '<div class="empty-state"><i class="fa fa-exclamation-triangle"></i><p>Алдаа: ' + escapeHtml(err.message) + '</p></div>';
  }
}

// Sector зураг upload handler
const sectorImgUpload = document.getElementById("sectorImgUpload");
const sectorImgInput = document.getElementById("sectorImgInput");
const sectorImgPreview = document.getElementById("sectorImgPreview");

sectorImgUpload.addEventListener("click", () => sectorImgInput.click());
sectorImgUpload.addEventListener("dragover", (e) => { e.preventDefault(); sectorImgUpload.style.borderColor = "var(--admin-primary)"; });
sectorImgUpload.addEventListener("dragleave", () => { sectorImgUpload.style.borderColor = "var(--admin-border)"; });
sectorImgUpload.addEventListener("drop", (e) => {
  e.preventDefault();
  sectorImgUpload.style.borderColor = "var(--admin-border)";
  if (e.dataTransfer.files.length) handleSectorImg(e.dataTransfer.files[0]);
});
sectorImgInput.addEventListener("change", () => {
  if (sectorImgInput.files.length) handleSectorImg(sectorImgInput.files[0]);
});

function handleSectorImg(file) {
  if (!file.type.startsWith("image/")) { showToast("Зөвхөн зураг файл оруулна уу", "error"); return; }
  selectedSectorImgFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    sectorImgPreview.src = e.target.result;
    sectorImgPreview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

// Ангилал нэмэх modal
document.getElementById("addSectorBtn").addEventListener("click", () => {
  document.getElementById("sectorModalTitle").textContent = "Ангилал нэмэх";
  document.getElementById("sectorForm").reset();
  document.getElementById("sectorEditKey").value = "";
  document.getElementById("sectorKey").disabled = false;
  sectorImgPreview.style.display = "none";
  selectedSectorImgFile = null;
  openModal("sectorModal");
});

// Ангилал хадгалах → categories.json шинэчлэх
document.getElementById("saveSectorBtn").addEventListener("click", async () => {
  const key = document.getElementById("sectorKey").value.trim().toLowerCase();
  const name = document.getElementById("sectorName").value.trim();
  const editKey = document.getElementById("sectorEditKey").value;

  if (!key || !name) { showToast("Түлхүүр болон нэр заавал бөглөнө", "error"); return; }
  if (!/^[a-z0-9\-]+$/.test(key)) { showToast("Түлхүүр зөвхөн жижиг латин үсэг, тоо, зураас байна", "error"); return; }

  const btn = document.getElementById("saveSectorBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    let imgPath = "";

    // Зураг upload (Firebase Storage)
    if (selectedSectorImgFile) {
      const storageRef = ref(storage, `categories/${key}.webp`);
      await uploadBytes(storageRef, selectedSectorImgFile);
      const url = await getDownloadURL(storageRef);
      imgPath = url; // Firebase Storage URL
    }

    if (editKey) {
      // Засварлах
      const idx = categoriesData.findIndex((c) => c.key === editKey);
      if (idx !== -1) {
        categoriesData[idx].name = name;
        if (imgPath) categoriesData[idx].image = imgPath;
      }
      await logActivity(`"${name}" ангилалын нэрийг засварлав`);
      showToast("Ангилал засварлагдлаа", "success");
    } else {
      // Давхардал шалгах
      if (categoriesData.some((c) => c.key === key)) {
        showToast(`"${key}" түлхүүртэй ангилал аль хэдийн байна`, "error");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-save"></i> Хадгалах';
        return;
      }
      categoriesData.push({
        key,
        name,
        image: imgPath || "images/demo/homepage-1.webp"
      });
      await logActivity(`"${name}" (${key}) ангилалыг нэмэв`);
      showToast("Ангилал амжилттай нэмэгдлээ", "success");
    }

    // Firestore-д categories мэдээлэл хадгалах (sync)
    await setDoc(doc(db, "settings", "categories"), {
      list: categoriesData,
      updatedAt: serverTimestamp()
    });

    closeModal("sectorModal");
    loadSectors();
  } catch (err) {
    showToast("Алдаа: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-save"></i> Хадгалах';
  }
});

// Ангилал засварлах
window.editSector = function (key) {
  const cat = categoriesData.find((c) => c.key === key);
  if (!cat) { showToast("Олдсонгүй", "error"); return; }

  document.getElementById("sectorModalTitle").textContent = "Ангилал засварлах";
  document.getElementById("sectorEditKey").value = key;
  document.getElementById("sectorKey").value = key;
  document.getElementById("sectorKey").disabled = true;
  document.getElementById("sectorName").value = cat.name;

  // Зураг preview
  if (cat.image) {
    const imgSrc = cat.image.startsWith("http") ? cat.image : "../" + cat.image;
    sectorImgPreview.src = imgSrc;
    sectorImgPreview.style.display = "block";
  } else {
    sectorImgPreview.style.display = "none";
  }
  selectedSectorImgFile = null;

  openModal("sectorModal");
};

// Ангилал устгах
window.confirmDeleteSector = function (key, name) {
  deleteTarget = { type: "sector", id: key, name };
  document.getElementById("deleteMessage").textContent = `"${name}" ангилалыг устгахдаа итгэлтэй байна уу? Энэ ангилалд хамаарах төслүүд ангилалгүй болно.`;
  openModal("deleteModal");
};

// Бүх dropdown-д салбар жагсаалтыг шинэчлэх
async function refreshSectorLists() {
  try {
    // categoriesData байхгүй бол categories.json-аас ачаалах
    if (!categoriesData.length) {
      try {
        const res = await fetch(CATEGORIES_PATH);
        if (res.ok) categoriesData = await res.json();
      } catch {}
    }

    // SECTOR_NAMES шинэчлэх
    Object.keys(SECTOR_NAMES).forEach((k) => delete SECTOR_NAMES[k]);
    categoriesData.forEach((cat) => { SECTOR_NAMES[cat.key] = cat.name; });

    // Төсөл нэмэх modal дахь select
    const projectSectorEl = document.getElementById("projectSector");
    if (projectSectorEl) {
      const val = projectSectorEl.value;
      projectSectorEl.innerHTML = '<option value="">— Ангилал сонгох —</option>';
      categoriesData.forEach((cat) => {
        projectSectorEl.innerHTML += `<option value="${cat.key}">${escapeHtml(cat.name)}</option>`;
      });
      if (val) projectSectorEl.value = val;
    }

    // Төсөл шүүлтийн select
    const filterEl = document.getElementById("projectFilterSector");
    if (filterEl) {
      const val = filterEl.value;
      filterEl.innerHTML = '<option value="all">Бүх ангилал</option>';
      categoriesData.forEach((cat) => {
        filterEl.innerHTML += `<option value="${cat.key}">${escapeHtml(cat.name)}</option>`;
      });
      if (val) filterEl.value = val;
    }

    // Дэд админ ангилал checkbox
    const permEl = document.getElementById("sectorPermissions");
    if (permEl) {
      const checked = [];
      permEl.querySelectorAll("input:checked").forEach((cb) => checked.push(cb.value));
      permEl.innerHTML = "";
      categoriesData.forEach((cat) => {
        const isChecked = checked.includes(cat.key) ? "checked" : "";
        permEl.innerHTML += `<label><input type="checkbox" value="${cat.key}" ${isChecked}> ${escapeHtml(cat.name)}</label>`;
      });
    }

    // Dashboard stat
    const statEl = document.getElementById("statSectors");
    if (statEl) statEl.textContent = categoriesData.length;

  } catch (err) {
    console.error("Refresh sector lists error:", err);
  }
}

// ═══════════════════════════════════════
//  MENU / ЦЭС ТОХИРГОО
// ═══════════════════════════════════════
const MENU_PATH = "../data/menu.json";
let menuData = [];

async function loadMenu() {
  const tbody = document.getElementById("menuTable");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px"><span class="spinner"></span></td></tr>';

  try {
    const res = await fetch(MENU_PATH);
    if (res.ok) menuData = await res.json();

    // Firestore-д хадгалсан тохиргоо байвал давхардуулах
    try {
      const snap = await getDoc(doc(db, "settings", "menu"));
      if (snap.exists() && snap.data().list) {
        menuData = snap.data().list;
      }
    } catch {}

    renderMenuTable(tbody);
  } catch (err) {
    console.error("Menu load error:", err);
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state"><p>Алдаа гарлаа</p></td></tr>';
  }
}

function renderMenuTable(tbody) {
  const canManage = currentAdmin.role === "admin";
  tbody.innerHTML = "";

  const menuItems = menuData.filter((m) => m.type !== "section");
  const sectionItems = menuData.filter((m) => m.type === "section");

  // Header цэснүүд
  tbody.innerHTML += `<tr><td colspan="4" style="padding:12px 16px;font-size:11px;font-weight:700;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--admin-border)">Header цэс</td></tr>`;
  menuItems.forEach((item, i) => {
    const idx = menuData.indexOf(item);
    renderMenuRow(tbody, item, idx, canManage);
  });

  // Хуудасны section-ууд
  if (sectionItems.length) {
    tbody.innerHTML += `<tr><td colspan="4" style="padding:12px 16px;font-size:11px;font-weight:700;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--admin-border)">Нүүр хуудасны хэсгүүд</td></tr>`;
    sectionItems.forEach((item) => {
      const idx = menuData.indexOf(item);
      renderMenuRow(tbody, item, idx, canManage);
    });
  }
}

function renderMenuRow(tbody, item, idx, canManage) {
  const statusBadge = item.visible
    ? '<span class="badge badge-admin">Харагдана</span>'
    : '<span class="badge badge-viewer">Нуугдсан</span>';
  const toggleIcon = item.visible ? "fa-eye-slash" : "fa-eye";
  const toggleTitle = item.visible ? "Нуух" : "Харуулах";
  const linkHref = "../" + item.href;

  tbody.innerHTML += `<tr style="${!item.visible ? 'opacity:.55' : ''}">
    <td style="font-weight:600">${escapeHtml(item.label)}</td>
    <td><a href="${linkHref}" target="_blank" style="font-size:12px;color:var(--admin-primary);text-decoration:none">${escapeHtml(item.href)} <i class="fa fa-external-link-alt" style="font-size:10px;margin-left:4px"></i></a></td>
    <td>${statusBadge}</td>
    <td>
      <div class="action-btns">
        ${canManage ? `<button class="btn ${item.visible ? 'btn-warning' : 'btn-primary'} btn-sm" onclick="toggleMenuItem(${idx})" title="${toggleTitle}"><i class="fa ${toggleIcon}"></i></button>` : ""}
      </div>
    </td>
  </tr>`;
}

window.toggleMenuItem = async function (idx) {
  menuData[idx].visible = !menuData[idx].visible;
  const label = menuData[idx].label;
  const action = menuData[idx].visible ? "харуулав" : "нуулаа";

  try {
    await setDoc(doc(db, "settings", "menu"), {
      list: menuData,
      updatedAt: serverTimestamp()
    });
    await logActivity(`"${label}" цэсийг ${action}`);
    showToast(`"${label}" цэсийг ${action}`, "success");
    renderMenuTable(document.getElementById("menuTable"));
  } catch (err) {
    menuData[idx].visible = !menuData[idx].visible;
    showToast("Алдаа: " + err.message, "error");
  }
};

// ═══════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

// Global дээр modal хаах function
window.closeModal = closeModal;

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle";
  toast.innerHTML = `<i class="fa ${icon}"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatDate(date) {
  if (!date) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Зургийг шахаад data URL (base64) болгох — Storage бүтэлгүйтэх үеийн fallback
function compressToDataUrl(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Файл унших алдаа"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Зураг ачаалах алдаа"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function getRoleBadge(role) {
  const cls = {
    admin: "badge-admin",
    "sub-admin": "badge-sub-admin",
    editor: "badge-editor",
    viewer: "badge-viewer"
  };
  return `<span class="badge ${cls[role] || "badge-viewer"}">${ROLE_LABELS[role] || role}</span>`;
}

// ═══════════════════════════════════════
//  FUNDING SETTINGS (нээх/хаах + хүсэлтийн жагсаалт)
// ═══════════════════════════════════════
async function loadFundingSettings() {
  // 1) Одоогийн тохиргоог унших
  try {
    const snap = await getDoc(doc(db, "settings", "funding"));
    const enabled = snap.exists() ? snap.data().enabled !== false : true;
    updateFundingToggleUI(enabled);
  } catch (e) {
    console.warn("Funding settings load:", e);
    updateFundingToggleUI(true);
  }

  // 2) Санхүүжилтийн хүсэлтүүдийг жагсаах
  try {
    const q = query(collection(db, "fundings"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const tbody = document.getElementById("fundingRequestsTable");
    if (!tbody) return;
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa fa-inbox"></i><p>Санхүүжилтийн хүсэлт байхгүй</p></td></tr>';
      return;
    }
    tbody.innerHTML = "";
    snap.forEach((d) => {
      const data = d.data();
      const date = data.createdAt ? formatDate(data.createdAt.toDate()) : "—";
      let nameCell;
      if (data.type === "org") {
        const parts = [
          `<strong>${escapeHtml(data.orgName || "—")}</strong>`,
          data.person ? `<small style="opacity:.75">${escapeHtml(data.person)}</small>` : "",
          data.position ? `<small style="opacity:.55;font-style:italic">${escapeHtml(data.position)}</small>` : ""
        ].filter(Boolean);
        nameCell = parts.join("<br>");
      } else {
        nameCell = `<strong>${escapeHtml(data.name || "—")}</strong>`;
      }
      const amount = (parseFloat(data.amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "₮";
      const typeBadge = data.type === "org"
        ? '<span class="badge badge-admin">Байгууллага</span>'
        : '<span class="badge badge-sub-admin">Хувь хүн</span>';
      tbody.innerHTML += `<tr>
        <td style="font-size:11px">${date}</td>
        <td>${escapeHtml((data.project || "").substring(0, 50))}${(data.project || "").length > 50 ? "…" : ""}</td>
        <td>${nameCell}</td>
        <td>${escapeHtml(data.phone || "—")}</td>
        <td style="font-weight:700;color:var(--admin-primary)">${amount}</td>
        <td>${typeBadge}</td>
      </tr>`;
    });
  } catch (e) {
    console.warn("Funding requests load:", e);
  }
}

function updateFundingToggleUI(enabled) {
  const toggle = document.getElementById("fundingToggle");
  const label = document.getElementById("fundingStatusText");
  const track = document.querySelector(".funding-switch .toggle-track");
  const thumb = document.querySelector(".funding-switch .toggle-thumb");
  if (toggle) toggle.checked = enabled;
  if (label) {
    label.textContent = enabled ? "Нээлттэй" : "Хаалттай";
    label.style.color = enabled ? "var(--admin-primary)" : "#c44";
  }
  if (track) track.style.background = enabled ? "var(--admin-primary)" : "#c44";
  if (thumb) thumb.style.left = enabled ? "28px" : "3px";
}

// Toggle click handler
document.addEventListener("click", async (e) => {
  const sw = e.target.closest(".funding-switch");
  if (!sw) return;
  e.preventDefault();
  const toggle = document.getElementById("fundingToggle");
  if (!toggle) return;
  const newVal = !toggle.checked;
  updateFundingToggleUI(newVal);
  try {
    await setDoc(doc(db, "settings", "funding"), {
      enabled: newVal,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser ? currentUser.uid : null
    });
    await logActivity(`Санхүүжилтийн функцийг ${newVal ? "нээв" : "хаав"}`);
    showToast(`Санхүүжилт ${newVal ? "нээгдлээ" : "хаагдлаа"}`, "success");
  } catch (err) {
    console.error("Funding toggle error:", err);
    showToast("Алдаа: " + err.message, "error");
    updateFundingToggleUI(!newVal); // revert
  }
});

// ═══════════════════════════════════════
//  FUNDERS (санхүүжүүлэгчдийн жагсаалт)
// ═══════════════════════════════════════
let allFunders = []; // {id, ...data}

// Төсөл нэрийг хэвийн болгох — ангилахад/харьцуулахад
function normProjectTitle(s) {
  return (s || "").toString().toLowerCase().trim()
    .replace(/^\s*\d+\.\s*/, "") // эхний "1.", "2." гэх мэт
    .replace(/\s+/g, " ");
}

async function loadFunders() {
  const tbody = document.getElementById("fundersTable");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><span class="spinner"></span><p>Ачаалж байна...</p></td></tr>';

  try {
    // 1) Funder өгөгдлийг авах — orderBy байхгүй, fundings-д createdAt байхгүй doc байж болзошгүй
    let snap;
    try {
      snap = await getDocs(query(collection(db, "fundings"), orderBy("createdAt", "desc")));
    } catch (orderErr) {
      console.warn("Funders: orderBy fail, fallback", orderErr);
      snap = await getDocs(collection(db, "fundings"));
    }

    allFunders = [];
    snap.forEach((d) => allFunders.push(Object.assign({ id: d.id }, d.data())));
    // createdAt байхгүй doc-уудыг доош нь жагсаах (date desc)
    allFunders.sort((a, b) => {
      const ta = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    console.log("[Funders] Loaded:", allFunders.length, "items");

    // 2) Filter + render — шууд харуулна
    populateFunderFilters();
    renderFunders();

    // 3) allProjects ачаалаагүй бол background-д ачаалаад дараа sector mapping-г шинэчлэх
    if (allProjects.length === 0) {
      loadProjects().then(() => {
        populateFunderFilters();
        renderFunders();
      }).catch((e) => console.warn("Funders: bg project load fail", e));
    }
  } catch (e) {
    console.error("Funders load error:", e);
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa fa-triangle-exclamation"></i><p>Ачаалахад алдаа: ${escapeHtml(e.message || String(e))}</p></td></tr>`;
  }
}

// Funder-ийн ангилалыг тодорхойлох — хадгалагдсан sector эсвэл нэрээр fallback
function getFunderSector(f) {
  if (f.sector) return f.sector; // tusul.html-ээс шууд хадгалсан
  // Хуучин өгөгдөл — нэрээр allProjects-аас хайх
  const norm = normProjectTitle(f.project);
  if (!norm) return "";
  const match = allProjects.find((p) => normProjectTitle(p.title) === norm);
  return match ? match.sector : "";
}

function populateFunderFilters() {
  // Ангилалын dropdown — бүх боломжит ангиллуудыг үргэлж харуулна
  const sectorsWithFunders = new Set();
  allFunders.forEach((f) => {
    const s = getFunderSector(f);
    if (s) sectorsWithFunders.add(s);
  });

  const sectorSel = document.getElementById("fundersSectorFilter");
  if (sectorSel) {
    const prev = sectorSel.value || "all";
    sectorSel.innerHTML = '<option value="all">Бүх ангилал</option>';
    // Бүх ангилал — SECTOR_NAMES-аас, тэмдгээр ялгана:
    //  • тоо — санхүүжүүлэгчтэй
    Object.keys(SECTOR_NAMES).sort((a, b) => SECTOR_NAMES[a].localeCompare(SECTOR_NAMES[b], "mn")).forEach((s) => {
      const cnt = allFunders.filter((f) => getFunderSector(f) === s).length;
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = SECTOR_NAMES[s] + (cnt > 0 ? ` (${cnt})` : "");
      sectorSel.appendChild(opt);
    });
    sectorSel.value = prev;
  }

  // Төслийн dropdown — ангилалаар шүүгдсэн төслүүд
  refreshFunderProjectOptions();
}

function refreshFunderProjectOptions() {
  const sectorSel = document.getElementById("fundersSectorFilter");
  const projSel = document.getElementById("fundersProjectFilter");
  if (!projSel) return;
  const sectorVal = sectorSel ? sectorSel.value : "all";
  const prev = projSel.value || "all";

  // Funder өгөгдлөөс уникал төслийн нэрс цуглуулах (ангилалаар шүүсэн)
  const map = new Map(); // norm → display title
  allFunders.forEach((f) => {
    const n = normProjectTitle(f.project);
    if (!n) return;
    if (sectorVal !== "all" && getFunderSector(f) !== sectorVal) return;
    if (!map.has(n)) map.set(n, (f.project || "").replace(/^\s*\d+\.\s*/, "").trim());
  });

  projSel.innerHTML = '<option value="all">Бүх төсөл</option>';
  Array.from(map.entries())
    .sort((a, b) => a[1].localeCompare(b[1], "mn"))
    .forEach(([norm, display]) => {
      const opt = document.createElement("option");
      opt.value = norm;
      opt.textContent = display.length > 60 ? display.substring(0, 60) + "…" : display;
      opt.title = display;
      projSel.appendChild(opt);
    });
  if (Array.from(projSel.options).some((o) => o.value === prev)) projSel.value = prev;
  else projSel.value = "all";
}

function renderFunders() {
  const tbody = document.getElementById("fundersTable");
  const countEl = document.getElementById("fundersCount");
  if (!tbody) return;

  const search = (document.getElementById("fundersSearch")?.value || "").toLowerCase().trim();
  const typeFilter = document.getElementById("fundersTypeFilter")?.value || "all";
  const sectorFilter = document.getElementById("fundersSectorFilter")?.value || "all";
  const projectFilter = document.getElementById("fundersProjectFilter")?.value || "all";

  // Per-column хайлт
  const colSearch = {};
  document.querySelectorAll("[data-col-search]").forEach((el) => {
    colSearch[el.dataset.colSearch] = (el.value || "").toString().toLowerCase().trim();
  });

  const filtered = allFunders.filter((f) => {
    if (typeFilter !== "all" && f.type !== typeFilter) return false;
    if (sectorFilter !== "all" && getFunderSector(f) !== sectorFilter) return false;
    const projNorm = normProjectTitle(f.project);
    if (projectFilter !== "all" && projNorm !== projectFilter) return false;
    if (search) {
      const hay = [f.orgName, f.name, f.person, f.position, f.phone, f.project, f.sectorName, f.note].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(search)) return false;
    }
    // Per-column шүүлт
    if (colSearch.date && !(f.createdAt && formatDate(f.createdAt.toDate()).toLowerCase().includes(colSearch.date))) return false;
    if (colSearch.type && f.type !== colSearch.type) return false;
    if (colSearch.name) {
      const nm = (f.type === "org" ? (f.orgName + " " + (f.person || "")) : (f.name || "")).toLowerCase();
      if (!nm.includes(colSearch.name)) return false;
    }
    if (colSearch.position && !(f.position || "").toLowerCase().includes(colSearch.position)) return false;
    if (colSearch.phone && !(f.phone || "").toString().toLowerCase().includes(colSearch.phone)) return false;
    if (colSearch.project && !(f.project || "").toLowerCase().includes(colSearch.project)) return false;
    if (colSearch.amount) {
      const amtStr = (parseFloat(f.amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      if (!amtStr.includes(colSearch.amount.replace(/[,\s]/g, ""))) return false;
    }
    return true;
  });

  // Stats (бүх өгөгдлийн дээр — шүүлтээр биш)
  const totals = allFunders.reduce((acc, f) => {
    acc.total++;
    if (f.type === "org") acc.org++; else acc.person++;
    acc.amount += parseFloat(f.amount) || 0;
    return acc;
  }, { total: 0, org: 0, person: 0, amount: 0 });
  const fmtNum = (n) => Number(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText("statFundersTotal", fmtNum(totals.total));
  setText("statFundersOrg", fmtNum(totals.org));
  setText("statFundersPerson", fmtNum(totals.person));
  setText("statFundersAmount", fmtNum(totals.amount) + "₮");

  if (countEl) countEl.textContent = `${filtered.length} / ${allFunders.length}`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fa fa-inbox"></i><p>Санхүүжүүлэгч олдсонгүй</p></td></tr>';
    return;
  }

  tbody.innerHTML = "";
  filtered.forEach((f, idx) => {
    const date = f.createdAt ? formatDate(f.createdAt.toDate()) : "—";
    const typeBadge = f.type === "org"
      ? '<span class="badge badge-admin">Байгууллага</span>'
      : '<span class="badge badge-sub-admin">Хувь хүн</span>';
    let nameCell;
    if (f.type === "org") {
      const parts = [
        `<strong>${escapeHtml(f.orgName || "—")}</strong>`,
        f.person ? `<small style="opacity:.75">${escapeHtml(f.person)}</small>` : ""
      ].filter(Boolean);
      nameCell = parts.join("<br>");
    } else {
      nameCell = `<strong>${escapeHtml(f.name || "—")}</strong>`;
    }
    const amount = fmtNum(parseFloat(f.amount) || 0) + "₮";
    const projectText = (f.project || "—").substring(0, 40);
    const projectFull = f.project || "";
    const sectorKey = getFunderSector(f);
    const sectorLabel = f.sectorName || SECTOR_NAMES[sectorKey] || "";
    const sectorBadge = sectorLabel
      ? `<br><small style="display:inline-block;margin-top:4px;font-size:10px;font-weight:600;background:rgba(75,172,72,0.15);color:var(--admin-primary);padding:3px 8px;border-radius:999px;border:1px solid rgba(75,172,72,0.35)">${escapeHtml(sectorLabel)}</small>`
      : "";
    const hasNote = !!(f.note && f.note.trim());
    const noteBtnClass = hasNote ? "btn btn-warning btn-sm has-note" : "btn btn-outline btn-sm";
    const noteTitle = hasNote ? `Тэмдэглэл: ${f.note.substring(0, 60)}${f.note.length > 60 ? "…" : ""}` : "Тэмдэглэл нэмэх";
    tbody.innerHTML += `<tr>
      <td style="font-size:12px;color:var(--admin-text-muted)">${idx + 1}</td>
      <td style="font-size:11px">${date}</td>
      <td>${typeBadge}</td>
      <td>${nameCell}</td>
      <td>${escapeHtml(f.position || "—")}</td>
      <td>${escapeHtml(f.phone || "—")}</td>
      <td title="${escapeHtml(projectFull)}">${escapeHtml(projectText)}${projectFull.length > 40 ? "…" : ""}${sectorBadge}</td>
      <td style="text-align:right;font-weight:700;color:var(--admin-primary)">${amount}</td>
      <td style="white-space:nowrap">
        <button class="${noteBtnClass}" data-funder-note="${f.id}" title="${escapeHtml(noteTitle)}" style="margin-right:4px"><i class="fa fa-note-sticky"></i></button>
        <button class="btn btn-danger btn-sm" data-funder-delete="${f.id}" title="Устгах"><i class="fa fa-trash"></i></button>
      </td>
    </tr>`;
  });
}

// Filter / search listeners
const FUNDER_FILTER_IDS = ["fundersSearch", "fundersTypeFilter", "fundersSectorFilter", "fundersProjectFilter"];
document.addEventListener("input", (e) => {
  if (!e.target) return;
  if (FUNDER_FILTER_IDS.includes(e.target.id)) renderFunders();
  else if (e.target.dataset && e.target.dataset.colSearch) renderFunders();
});
document.addEventListener("change", (e) => {
  if (!e.target) return;
  if (e.target.id === "fundersSectorFilter") {
    refreshFunderProjectOptions();
    renderFunders();
  } else if (FUNDER_FILTER_IDS.includes(e.target.id)) {
    renderFunders();
  } else if (e.target.dataset && e.target.dataset.colSearch) {
    renderFunders();
  }
});

// Reset filters
document.addEventListener("click", (e) => {
  if (!e.target.closest("#fundersResetFilters")) return;
  const sel = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  sel("fundersSearch", "");
  sel("fundersTypeFilter", "all");
  sel("fundersSectorFilter", "all");
  refreshFunderProjectOptions();
  sel("fundersProjectFilter", "all");
  renderFunders();
});

// Refresh funders
document.addEventListener("click", (e) => {
  if (!e.target.closest("#refreshFundersBtn")) return;
  loadFunders();
  showToast("Шинэчилж байна...", "success");
});

// Note товч дарвал modal нээх
let currentNoteFunderId = null;
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-funder-note]");
  if (!btn) return;
  const id = btn.dataset.funderNote;
  const funder = allFunders.find((f) => f.id === id);
  if (!funder) return;
  currentNoteFunderId = id;
  const titleEl = document.getElementById("funderNoteTitle");
  const subEl = document.getElementById("funderNoteSub");
  const txt = document.getElementById("funderNoteText");
  const name = funder.type === "org" ? funder.orgName : funder.name;
  if (titleEl) titleEl.textContent = "Тэмдэглэл — " + (name || "Санхүүжүүлэгч");
  if (subEl) subEl.textContent = (funder.project || "").substring(0, 80);
  if (txt) txt.value = funder.note || "";
  document.getElementById("funderNoteModal").classList.add("active");
});

// Note хадгалах
document.addEventListener("click", async (e) => {
  if (!e.target.closest("#funderNoteSaveBtn")) return;
  if (!currentNoteFunderId) return;
  const txt = document.getElementById("funderNoteText");
  const note = (txt?.value || "").trim();
  try {
    await updateDoc(doc(db, "fundings", currentNoteFunderId), {
      note: note,
      noteUpdatedAt: serverTimestamp(),
      noteUpdatedBy: currentUser ? currentUser.uid : null
    });
    const funder = allFunders.find((f) => f.id === currentNoteFunderId);
    if (funder) funder.note = note;
    document.getElementById("funderNoteModal").classList.remove("active");
    renderFunders();
    showToast(note ? "Тэмдэглэл хадгалагдлаа" : "Тэмдэглэл устгагдлаа", "success");
    await logActivity("Санхүүжүүлэгчийн тэмдэглэл шинэчлэв");
  } catch (err) {
    console.error("Note save:", err);
    showToast("Алдаа: " + err.message, "error");
  }
});

// Delete funder
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-funder-delete]");
  if (!btn) return;
  const id = btn.dataset.funderDelete;
  if (!confirm("Энэ санхүүжүүлэгчийг устгах уу?")) return;
  try {
    await deleteDoc(doc(db, "fundings", id));
    allFunders = allFunders.filter((f) => f.id !== id);
    renderFunders();
    showToast("Устгалаа", "success");
    await logActivity("Санхүүжүүлэгч устгав");
  } catch (err) {
    console.error("Funder delete:", err);
    showToast("Алдаа: " + err.message, "error");
  }
});

// CSV export
document.addEventListener("click", (e) => {
  if (!e.target.closest("#exportFundersBtn")) return;
  if (!allFunders.length) { showToast("Өгөгдөл байхгүй", "error"); return; }
  const headers = ["Огноо", "Төрөл", "Байгууллага/Нэр", "Албан тушаал", "Холбогдох хүн", "Утас", "Ангилал", "Төсөл", "Дүн"];
  const rows = allFunders.map((f) => {
    const date = f.createdAt ? formatDate(f.createdAt.toDate()) : "";
    const type = f.type === "org" ? "Байгууллага" : "Хувь хүн";
    const orgOrName = f.type === "org" ? (f.orgName || "") : (f.name || "");
    const sectorKey = getFunderSector(f);
    const sectorLabel = f.sectorName || SECTOR_NAMES[sectorKey] || "";
    return [date, type, orgOrName, f.position || "", f.person || "", f.phone || "", sectorLabel, f.project || "", f.amount || 0];
  });
  const csv = [headers, ...rows].map((r) => r.map((c) => {
    const s = String(c).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(",")).join("\n");
  const bom = "\uFEFF"; // Excel UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `funders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
