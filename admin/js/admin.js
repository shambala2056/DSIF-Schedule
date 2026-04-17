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
  mining: "Уул уурхай",
  environment: "Байгаль орчин",
  infra: "Дэд бүтэц",
  edu: "Боловсрол",
  culture: "Соёл",
  health: "Эрүүл мэнд",
  social: "Нийгэм",
  agri: "Хөдөө аж ахуй"
};

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
  sectors: "Төслийн ангилал"
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

    // Сүүлийн үйлдлүүд
    loadActivityLog();
  } catch (err) {
    console.error("Dashboard load error:", err);
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

async function loadProjects(filterSector) {
  const grid = document.getElementById("projectGrid");
  const countEl = document.getElementById("projectCount");
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state"><span class="spinner"></span><p>Ачаалж байна...</p></div>';

  try {
    allProjects = [];

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
            allProjects.push({
              sector,
              slug: meta.slug || slug,
              title: meta.title || slug,
              creator: meta.creator || "",
              desc: "",
              funded: meta.funded || 0,
              days: meta.days || 0,
              backers: meta.backers || 0,
              newest: meta.newest || 0,
              thumbUrl: BASE_PATH + sector + "/" + encodeURIComponent(slug) + "/thumbnail.jpg",
              source: "manifest"
            });
          } catch {}
        }
      } catch {}
    }

    renderProjects(filterSector);
  } catch (err) {
    console.error("Projects load error:", err);
    grid.innerHTML = '<div class="empty-state"><i class="fa fa-exclamation-triangle"></i><p>Алдаа гарлаа</p></div>';
  }
}

function renderProjects(filterSector) {
  const grid = document.getElementById("projectGrid");
  const countEl = document.getElementById("projectCount");
  if (!grid) return;

  let filtered = allProjects;
  if (filterSector && filterSector !== "all") {
    filtered = allProjects.filter((p) => p.sector === filterSector);
  }

  // Эрхийн шүүлт
  const allowedSectors = currentAdmin.allowedSectors || [];
  const isRestricted = currentAdmin.role !== "admin";
  if (isRestricted && allowedSectors.length > 0) {
    filtered = filtered.filter((p) => allowedSectors.includes(p.sector));
  }

  if (countEl) countEl.textContent = `Нийт ${filtered.length} төсөл`;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><i class="fa fa-folder-open"></i><p>Төсөл байхгүй</p></div>';
    return;
  }

  const canEdit = currentAdmin.role === "admin" || currentAdmin.role === "sub-admin" || currentAdmin.role === "editor";
  const canDelete = currentAdmin.role === "admin";

  grid.innerHTML = filtered.map((p) => {
    const fundedColor = p.funded >= 100 ? "#4bac48" : "var(--admin-accent)";
    const fundedPct = Math.min(p.funded, 100);
    const daysText = p.days > 0 ? p.days + " хоног" : "дууссан";
    const viewUrl = p.source === "manifest"
      ? `${BASE_PATH}${p.sector}/${encodeURIComponent(p.slug)}/index.html`
      : `${SITE_PATH}tusul.html?cat=${p.sector}`;

    return `<div class="project-card-admin">
      <img src="${p.thumbUrl}" class="pca-img" alt="${escapeHtml(p.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="pca-img-placeholder" style="display:none"><i class="fa fa-image"></i></div>
      <div class="pca-body">
        <div class="pca-title">${escapeHtml(p.title)}</div>
        <div class="pca-creator"><i class="fa fa-user-circle" style="opacity:.5"></i> ${escapeHtml(p.creator)}</div>
        ${p.desc ? `<div style="font-size:11px;color:var(--admin-text-muted);margin-bottom:8px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(p.desc)}</div>` : ""}
        <div style="margin-bottom:8px">
          <div style="background:var(--admin-dark-3);border-radius:4px;height:6px;overflow:hidden;margin-bottom:4px">
            <div style="width:${fundedPct}%;height:100%;background:${fundedColor};border-radius:4px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--admin-text-muted)">
            <span style="color:${fundedColor};font-weight:600">${p.funded}%</span>
            <span>${p.backers} оролцогч</span>
            <span>${daysText}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="badge badge-sub-admin">${SECTOR_NAMES[p.sector] || p.sector}</span>
          <div class="pca-actions">
            <a href="${viewUrl}" target="_blank" class="btn btn-outline btn-sm"><i class="fa fa-eye"></i></a>
            ${canEdit ? `<button class="btn btn-info btn-sm" onclick="editProject('${p.sector}','${encodeURIComponent(p.slug)}')"><i class="fa fa-edit"></i></button>` : ""}
            ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="confirmDeleteProject('${p.sector}','${encodeURIComponent(p.slug)}','${escapeHtml(p.title)}')"><i class="fa fa-trash"></i></button>` : ""}
          </div>
        </div>
      </div>
    </div>`;
  }).join("");
}

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

    // Зураг upload (Firebase Storage)
    if (selectedThumbnailFile) {
      const storageRef = ref(storage, `projects/${sector}/${slug}/thumbnail.jpg`);
      await uploadBytes(storageRef, selectedThumbnailFile);
      thumbnailUrl = await getDownloadURL(storageRef);
    }

    // Meta мэдээлэл Firestore-д хадгалах
    const metaData = {
      slug,
      title: name,
      creator,
      sector,
      funded: 0,
      days: 0,
      backers: 0,
      newest: Date.now(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };
    if (thumbnailUrl) metaData.thumbnailUrl = thumbnailUrl;

    const docId = sector + "_" + slug;
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
    // Файлын системээс meta.json уншина
    const res = await fetch(BASE_PATH + sector + "/" + encodeURIComponent(slug) + "/meta.json");
    const meta = res.ok ? await res.json() : null;

    document.getElementById("projectModalTitle").textContent = "Төсөл засварлах";
    document.getElementById("projectEditId").value = slug;
    document.getElementById("projectEditSector").value = sector;
    document.getElementById("projectSector").value = sector;
    document.getElementById("projectSector").disabled = true;
    document.getElementById("projectName").value = meta ? meta.title : slug;
    document.getElementById("projectCreator").value = meta ? meta.creator : "";

    // Thumbnail
    const thumbUrl = BASE_PATH + sector + "/" + encodeURIComponent(slug) + "/thumbnail.jpg";
    thumbnailPreview.src = thumbUrl;
    thumbnailPreview.style.display = "block";

    selectedThumbnailFile = null;
    openModal("projectModal");
  } catch (err) {
    showToast("Алдаа: " + err.message, "error");
  }
};

// Төсөл устгах
let deleteTarget = { type: "", id: "", name: "" };

window.confirmDeleteProject = function (sector, slug, name) {
  slug = decodeURIComponent(slug);
  name = name || slug;
  deleteTarget = { type: "project", id: sector + "_" + slug, name, sector, slug };
  document.getElementById("deleteMessage").textContent = `"${name}" төслийг устгахдаа итгэлтэй байна уу?`;
  openModal("deleteModal");
};

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    if (deleteTarget.type === "project") {
      await deleteDoc(doc(db, "projects", deleteTarget.id));
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

function getRoleBadge(role) {
  const cls = {
    admin: "badge-admin",
    "sub-admin": "badge-sub-admin",
    editor: "badge-editor",
    viewer: "badge-viewer"
  };
  return `<span class="badge ${cls[role] || "badge-viewer"}">${ROLE_LABELS[role] || role}</span>`;
}
