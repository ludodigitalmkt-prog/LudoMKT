import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =============================
// FIREBASE
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyAiPpqV9wI4o4mqsxUk9QP_BG1_DgydR-E",
  authDomain: "ludodigitalmkt-2913f.firebaseapp.com",
  projectId: "ludodigitalmkt-2913f",
  storageBucket: "ludodigitalmkt-2913f.firebasestorage.app",
  messagingSenderId: "443085074885",
  appId: "1:443085074885:web:813627b85da10349f89bac"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


const DEFAULT_LOGO = "./logo.png";
const FALLBACK_LOGO = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop stop-color=%22%238B252C%22/%3E%3Cstop offset=%221%22 stop-color=%22%23b73039%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%2296%22 height=%2296%22 rx=%2224%22 fill=%22url(%23g)%22/%3E%3Cpath d=%22M22 28h52v40H22z%22 fill=%22white%22 opacity=%220.18%22/%3E%3Cpath d=%22M32 24v48M48 24v48M64 24v48M24 36h48M24 52h48M24 68h48%22 stroke=%22white%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3C/svg%3E";
const SETTINGS_KEY = "agenda_inteligente_settings_v2";

// =============================
// ESTADO
// =============================
let currentUser = null;
let currentProfile = null;
let deferredPrompt = null;

let usersData = [];
let clientsData = [];
let benefitsData = [];
let tasksData = [];
let settingsData = {
  themeColor: "#8B252C",
  fontFamily: "Inter, sans-serif"
};

let draggedTaskId = null;

// =============================
// ELEMENTOS
// =============================
const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginMessage = document.getElementById("login-message");
const logoutBtn = document.getElementById("logout-btn");

const menuItems = document.querySelectorAll(".menu-item");
const tabs = document.querySelectorAll(".tab-content");
const pageTitle = document.getElementById("page-title");
const welcomeText = document.getElementById("welcome-text");
const userRoleBadge = document.getElementById("user-role-badge");
const currentUserEmail = document.getElementById("current-user-email");

const statAFazer = document.getElementById("stat-a-fazer");
const statAndamento = document.getElementById("stat-andamento");
const statConcluidas = document.getElementById("stat-concluidas");
const birthdayList = document.getElementById("birthday-list");
const teamCards = document.getElementById("team-cards");

const agendaViewSelect = document.getElementById("agenda-view-select");
const agendaBoardView = document.getElementById("agenda-board-view");
const agendaCalendarView = document.getElementById("agenda-calendar-view");
const agendaDirecaoView = document.getElementById("agenda-direcao-view");

const openTaskModalBtn = document.getElementById("open-task-modal-btn");
const openClientModalBtn = document.getElementById("open-client-modal-btn");
const openBenefitModalBtn = document.getElementById("open-benefit-modal-btn");
const openUserModalBtn = document.getElementById("open-user-modal-btn");

const taskModal = document.getElementById("task-modal");
const clientModal = document.getElementById("client-modal");
const benefitModal = document.getElementById("benefit-modal");
const userModal = document.getElementById("user-modal");

const taskForm = document.getElementById("task-form");
const clientForm = document.getElementById("client-form");
const benefitForm = document.getElementById("benefit-form");
const userForm = document.getElementById("user-form");

const clientsList = document.getElementById("clients-list");
const benefitsList = document.getElementById("benefits-list");
const rhList = document.getElementById("rh-list");
const directionList = document.getElementById("direction-list");
const calendarGrid = document.getElementById("calendar-grid");
const directionDateInput = document.getElementById("direction-date-input");
const calendarMonthInput = document.getElementById("calendar-month-input");

const taskClientSelect = document.getElementById("task-client");
const taskResponsibleSelect = document.getElementById("task-responsible");

const themeColorInput = document.getElementById("theme-color-input");
const fontSelect = document.getElementById("font-select");
const saveSettingsBtn = document.getElementById("save-settings-btn");

const musicUrlInput = document.getElementById("music-url");
const loadMusicBtn = document.getElementById("load-music-btn");
const musicFrame = document.getElementById("music-frame");

const installBtn = document.getElementById("install-btn");

// =============================
// HELPERS
// =============================
function formatDateBR(dateString) {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeUsername(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

function makeInternalEmail(username = "") {
  const clean = sanitizeUsername(username);
  return clean ? `${clean}@interno.agenda` : "";
}



function getLogoSrc(url) {
  return url && String(url).trim() ? url : DEFAULT_LOGO;
}

function showScreen(screen) {
  [loginScreen, dashboardScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function defaultPermissions() {
  return {
    accessInicio: true,
    accessAgenda: true,
    accessClientes: true,
    accessBeneficios: false,
    accessRh: false,
    accessMusic: true,
    accessAjustes: false,
    canViewDirecao: false,
    canEditAgenda: false,
    canEditClientes: false,
    canEditBeneficios: false,
    canEditRh: false,
    canEditAjustes: false
  };
}

function normalizePermissions(raw = {}) {
  return {
    ...defaultPermissions(),
    ...(raw || {})
  };
}

function getUserPermissions() {
  return normalizePermissions(currentProfile?.permissions || {});
}

function isManager() {
  return currentProfile?.role === "gerencia";
}

function hasTabAccess(tabName) {
  if (isManager()) return true;
  const p = getUserPermissions();

  const map = {
    inicio: p.accessInicio,
    agenda: p.accessAgenda,
    clientes: p.accessClientes,
    beneficios: p.accessBeneficios,
    rh: p.accessRh,
    music: p.accessMusic,
    ajustes: p.accessAjustes
  };

  return !!map[tabName];
}

function canEditScope(scope) {
  if (isManager()) return true;
  const p = getUserPermissions();

  const map = {
    agenda: p.canEditAgenda,
    clientes: p.canEditClientes,
    beneficios: p.canEditBeneficios,
    rh: p.canEditRh,
    ajustes: p.canEditAjustes
  };

  return !!map[scope];
}

function canViewDirecao() {
  if (isManager()) return true;
  return !!getUserPermissions().canViewDirecao;
}

function normalizeHex(hex) {
  const value = String(hex || "").trim();
  if (!value.startsWith("#")) return "#8B252C";
  if (value.length === 4) {
    return "#" + value.slice(1).split("").map(char => char + char).join("");
  }
  return value.length === 7 ? value : "#8B252C";
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex).replace("#", "");
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function shadeHex(hex, factor = 0) {
  const { r, g, b } = hexToRgb(hex);
  const calc = (value) => Math.min(255, Math.max(0, Math.round(value + (255 - value) * factor)));
  const calcDark = (value) => Math.min(255, Math.max(0, Math.round(value * (1 + factor))));
  const apply = factor >= 0 ? calc : calcDark;
  const rr = apply(r).toString(16).padStart(2, "0");
  const gg = apply(g).toString(16).padStart(2, "0");
  const bb = apply(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function setActiveTab(tabName) {
  if (!hasTabAccess(tabName)) {
    const firstAllowed = Array.from(menuItems).find(item => hasTabAccess(item.dataset.tab));
    tabName = firstAllowed ? firstAllowed.dataset.tab : "inicio";
  }

  menuItems.forEach(item => item.classList.toggle("active", item.dataset.tab === tabName));
  tabs.forEach(tab => tab.classList.toggle("active", tab.id === `tab-${tabName}`));

  const titles = {
    inicio: "Tela Inicial",
    agenda: "Agenda",
    clientes: "Clientes",
    beneficios: "Benefícios",
    rh: "RH",
    music: "Music",
    ajustes: "Ajustes"
  };

  pageTitle.textContent = titles[tabName] || "Sistema";
}

function applyRoleVisibility() {
  document.querySelectorAll(".manager-only").forEach(el => {
    const scope = el.dataset.editorScope || "";
    const shouldShow = scope ? canEditScope(scope) : isManager();
    el.classList.toggle("is-hidden-by-role", !shouldShow);
  });

  menuItems.forEach(item => {
    item.classList.toggle("is-hidden-by-access", !hasTabAccess(item.dataset.tab));
  });

  const directionOption = document.querySelector('#agenda-view-select option[value="direcao"]');
  if (directionOption) {
    directionOption.hidden = !canViewDirecao();
    if (!canViewDirecao() && agendaViewSelect.value === "direcao") {
      agendaViewSelect.value = "board";
      agendaBoardView.classList.add("active");
      agendaCalendarView.classList.remove("active");
      agendaDirecaoView.classList.remove("active");
    }
  }
}

function fillUserPermissionsForm(permissions = {}) {
  const p = normalizePermissions(permissions);
  const setChecked = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = value;
  };
  setChecked("perm-access-inicio", p.accessInicio);
  setChecked("perm-access-agenda", p.accessAgenda);
  setChecked("perm-access-clientes", p.accessClientes);
  setChecked("perm-access-beneficios", p.accessBeneficios);
  setChecked("perm-access-rh", p.accessRh);
  setChecked("perm-access-music", p.accessMusic);
  setChecked("perm-access-ajustes", p.accessAjustes);
  setChecked("perm-view-direcao", p.canViewDirecao);
  setChecked("perm-edit-agenda", p.canEditAgenda);
  setChecked("perm-edit-clientes", p.canEditClientes);
  setChecked("perm-edit-beneficios", p.canEditBeneficios);
  setChecked("perm-edit-rh", p.canEditRh);
  setChecked("perm-edit-ajustes", p.canEditAjustes);
}

function readUserPermissionsForm() {
  const checked = (id) => {
    const el = document.getElementById(id);
    return !!el?.checked;
  };
  return {
    accessInicio: checked("perm-access-inicio"),
    accessAgenda: checked("perm-access-agenda"),
    accessClientes: checked("perm-access-clientes"),
    accessBeneficios: checked("perm-access-beneficios"),
    accessRh: checked("perm-access-rh"),
    accessMusic: checked("perm-access-music"),
    accessAjustes: checked("perm-access-ajustes"),
    canViewDirecao: checked("perm-view-direcao"),
    canEditAgenda: checked("perm-edit-agenda"),
    canEditClientes: checked("perm-edit-clientes"),
    canEditBeneficios: checked("perm-edit-beneficios"),
    canEditRh: checked("perm-edit-rh"),
    canEditAjustes: checked("perm-edit-ajustes")
  };
}

function resetTaskForm() {
  taskForm.reset();
  document.getElementById("task-id").value = "";
  document.getElementById("task-status").value = "a_fazer";
  document.getElementById("task-priority").value = "media";
  document.getElementById("task-date").value = new Date().toISOString().slice(0, 10);
}

function resetClientForm() {
  clientForm.reset();
  document.getElementById("client-id").value = "";
}

function resetBenefitForm() {
  benefitForm.reset();
  document.getElementById("benefit-id").value = "";
  document.getElementById("benefit-status").value = "ativo";
}

function resetUserForm() {
  userForm.reset();
  document.getElementById("user-id").value = "";
  if (document.getElementById("user-role")) document.getElementById("user-role").value = "colaborador";
  if (document.getElementById("user-active")) document.getElementById("user-active").checked = true;
  if (document.getElementById("user-username")) document.getElementById("user-username").readOnly = false;
  fillUserPermissionsForm(defaultPermissions());
}

function normalizeIframeUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";

  if (trimmed.includes("open.spotify.com/playlist/")) {
    return trimmed.replace("open.spotify.com/", "open.spotify.com/embed/");
  }
  if (trimmed.includes("open.spotify.com/album/")) {
    return trimmed.replace("open.spotify.com/", "open.spotify.com/embed/");
  }
  if (trimmed.includes("open.spotify.com/track/")) {
    return trimmed.replace("open.spotify.com/", "open.spotify.com/embed/");
  }
  return trimmed;
}

// =============================
// SETTINGS
// =============================
function applySettings() {
  const color = normalizeHex(settingsData.themeColor || "#8B252C");
  const font = settingsData.fontFamily || "Inter, sans-serif";

  document.documentElement.style.setProperty("--primary", color);
  document.documentElement.style.setProperty("--primary-2", shadeHex(color, -0.12));
  document.documentElement.style.setProperty("--font-main", font);

  document.documentElement.style.setProperty("--sidebar-bg", shadeHex(color, -0.84));
  document.documentElement.style.setProperty("--sidebar-card", shadeHex(color, -0.72));
  document.documentElement.style.setProperty("--sidebar-active", "rgba(255,255,255,.14)");
  document.documentElement.style.setProperty("--btn-dark-bg", shadeHex(color, -0.68));
  document.documentElement.style.setProperty("--surface-card", "rgba(255,255,255,.72)");
  document.documentElement.style.setProperty("--surface-soft", "#f6f8fc");

  themeColorInput.value = color;
  fontSelect.value = font;
}

function loadSettingsFromLocal() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    settingsData = {
      ...settingsData,
      ...JSON.parse(raw)
    };
  } catch (error) {
    console.error("Erro ao ler settings do localStorage:", error);
  }
}

async function loadSettingsFromCloud() {
  try {
    const ref = doc(db, "settings", "global");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      settingsData = {
        ...settingsData,
        ...snap.data()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsData));
    }
  } catch (error) {
    console.warn("Não foi possível ler settings online. Usando local.", error);
  }
}

async function saveSettings() {
  if (!canEditScope("ajustes")) return;

  settingsData.themeColor = themeColorInput.value;
  settingsData.fontFamily = fontSelect.value;

  applySettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsData));

  try {
    await setDoc(doc(db, "settings", "global"), settingsData, { merge: true });
    alert("Ajustes salvos.");
  } catch (error) {
    console.warn(error);
    alert("Ajustes aplicados e salvos localmente neste navegador.");
  }
}

// =============================
// PERFIL / AUTH
// =============================
async function bootstrapProfileIfNeeded(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    currentProfile = {
      id: snap.id,
      ...snap.data(),
      active: snap.data().active !== false,
      permissions: normalizePermissions(snap.data().permissions)
    };
    return;
  }

  const byEmail = await getDocs(query(collection(db, "users"), where("email", "==", user.email || "")));

  if (!byEmail.empty) {
    const source = byEmail.docs[0];
    const sourceData = source.data();

    const migrated = {
      ...sourceData,
      uid: user.uid,
      email: user.email || sourceData.email || "",
      username: sourceData.username || sanitizeUsername((user.email || "").split("@")[0]),
      active: sourceData.active !== false,
      permissions: normalizePermissions(sourceData.permissions),
      updatedAt: serverTimestamp()
    };

    await setDoc(userRef, migrated, { merge: true });
    currentProfile = { id: user.uid, ...migrated };
    return;
  }

  const usersSnap = await getDocs(collection(db, "users"));
  const firstRole = usersSnap.empty ? "gerencia" : "colaborador";

  const profile = {
    uid: user.uid,
    name: user.email?.split("@")[0] || "Usuário",
    username: sanitizeUsername((user.email || "").split("@")[0]),
    email: user.email || "",
    role: firstRole,
    position: firstRole === "gerencia" ? "Administrador" : "",
    sector: firstRole === "gerencia" ? "Gestão" : "Equipe",
    birthday: "",
    photoUrl: "",
    benefits: "",
    active: true,
    permissions: firstRole === "gerencia"
      ? {
          accessInicio: true,
          accessAgenda: true,
          accessClientes: true,
          accessBeneficios: true,
          accessRh: true,
          accessMusic: true,
          accessAjustes: true,
          canViewDirecao: true,
          canEditAgenda: true,
          canEditClientes: true,
          canEditBeneficios: true,
          canEditRh: true,
          canEditAjustes: true
        }
      : defaultPermissions(),
    createdAt: serverTimestamp()
  };

  await setDoc(userRef, profile);
  currentProfile = { id: user.uid, ...profile };
}

async function loadCurrentProfile(user) {
  await bootstrapProfileIfNeeded(user);
  currentProfile.permissions = normalizePermissions(currentProfile.permissions);

  userRoleBadge.textContent = currentProfile.role === "gerencia" ? "Gestão Administrador" : "Colaborador";
  currentUserEmail.textContent = currentProfile.email || "";
  welcomeText.textContent = `Olá, ${currentProfile.name || "usuário"}!`;

  applyRoleVisibility();
}

// =============================
// DADOS
// =============================
async function loadUsers() {
  const q = query(collection(db, "users"), orderBy("name"));
  const snap = await getDocs(q);

  const all = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    active: d.data().active !== false,
    permissions: normalizePermissions(d.data().permissions)
  }));

  const byLogin = new Map();

  for (const user of all) {
    const key = String(user.username || user.email || user.id).toLowerCase();
    if (!byLogin.has(key)) {
      byLogin.set(key, user);
      continue;
    }

    const existing = byLogin.get(key);
    if (existing.id !== existing.uid && user.id === user.uid) {
      byLogin.set(key, user);
    }
  }

  usersData = Array.from(byLogin.values());
}

async function loadClients() {
  const q = query(collection(db, "clients"), orderBy("name"));
  const snap = await getDocs(q);
  clientsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadBenefits() {
  const q = query(collection(db, "benefits"), orderBy("name"));
  const snap = await getDocs(q);
  benefitsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadTasks() {
  const q = query(collection(db, "tasks"), orderBy("date"));
  const snap = await getDocs(q);
  tasksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function reloadAllData() {
  await Promise.all([
    loadUsers(),
    loadClients(),
    loadBenefits(),
    loadTasks()
  ]);

  renderTeam();
  renderBirthdays();
  renderStats();
  renderClients();
  renderBenefits();
  renderRH();
  fillTaskSelects();
  renderBoard();
  renderDirection();
  renderCalendar();
}

// =============================
// BOARD DND
// =============================
async function updateTaskStatus(taskId, newStatus) {
  if (!canEditScope("agenda")) return;
  const task = tasksData.find(item => item.id === taskId);
  if (!task) return;
  if (task.status === newStatus) return;

  try {
    await updateDoc(doc(db, "tasks", taskId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível mover o card.");
  }
}

function initBoardDnD() {
  document.querySelectorAll('.task-list').forEach((list) => {
    if (list.dataset.dndBound === '1') return;
    list.dataset.dndBound = '1';

    list.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!canEditScope("agenda")) return;
      list.classList.add('drag-over');
    });

    list.addEventListener('dragleave', () => {
      list.classList.remove('drag-over');
    });

    list.addEventListener('drop', async (event) => {
      event.preventDefault();
      list.classList.remove('drag-over');
      if (!draggedTaskId) return;
      await updateTaskStatus(draggedTaskId, list.dataset.status);
      draggedTaskId = null;
    });
  });
}

window.startTaskDrag = function(taskId) {
  if (!canEditScope("agenda")) return;
  draggedTaskId = taskId;
};

window.endTaskDrag = function() {
  draggedTaskId = null;
  document.querySelectorAll('.task-list').forEach(list => list.classList.remove('drag-over'));
};

// =============================
// RENDER
// =============================
function renderStats() {
  const today = new Date().toISOString().slice(0, 10);
  const dayTasks = tasksData.filter(task => task.date === today);

  statAFazer.textContent = dayTasks.filter(t => t.status === "a_fazer").length;
  statAndamento.textContent = dayTasks.filter(t => t.status === "em_andamento").length;
  statConcluidas.textContent = dayTasks.filter(t => t.status === "concluido").length;
}

function renderBirthdays() {
  if (!birthdayList) return;
  const month = new Date().getMonth() + 1;
  const birthdays = usersData
    .filter(user => user.active !== false)
    .filter(user => {
      if (!user.birthday) return false;
      const birthMonth = Number(user.birthday.split("-")[1]);
      return birthMonth === month;
    });

  if (!birthdays.length) {
    birthdayList.className = "list empty-state";
    birthdayList.textContent = "Nenhum aniversariante neste mês.";
    return;
  }

  birthdayList.className = "list";
  birthdayList.innerHTML = birthdays.map(user => `
    <div class="team-card">
      <img class="team-avatar" src="${escapeHtml(getLogoSrc(user.photoUrl))}" alt="${escapeHtml(user.name || "")}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO}'">
      <div class="team-content">
        <h4>${escapeHtml(user.name || "")}</h4>
        <div class="team-meta">
          <div>Usuário: ${escapeHtml(user.username || "-")}</div>
          <div>Setor: ${escapeHtml(user.sector || "-")}</div>
          <div>Aniversário: ${formatDateBR(user.birthday)}</div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderTeam() {
  if (!teamCards) return;
  const activeUsers = usersData.filter(user => user.active !== false);

  if (!activeUsers.length) {
    teamCards.innerHTML = `<div class="empty-state">Nenhum colaborador ativo cadastrado.</div>`;
    return;
  }

  teamCards.innerHTML = activeUsers.map(user => {
    const userTasksToday = tasksData.filter(task => task.responsibleId === user.id && task.date === new Date().toISOString().slice(0, 10));
    const doneCount = userTasksToday.filter(t => t.status === "concluido").length;

    return `
      <div class="team-card">
        <img class="team-avatar" src="${escapeHtml(getLogoSrc(user.photoUrl))}" alt="${escapeHtml(user.name || "")}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO}'">
        <div class="team-content">
          <h4>${escapeHtml(user.name || "")}</h4>
          <div class="team-meta">
            <div>Usuário: ${escapeHtml(user.username || "-")}</div>
            <div>Cargo: ${escapeHtml(user.position || "-")}</div>
            <div>Setor: ${escapeHtml(user.sector || "-")}</div>
            <div>${userTasksToday.length} do dia • ${doneCount} concluída(s)</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function fillTaskSelects() {
  const activeUsers = usersData.filter(user => user.active !== false);

  taskClientSelect.innerHTML = `<option value="">Selecione</option>` + clientsData.map(client => `
    <option value="${client.id}">${escapeHtml(client.name || "")}</option>
  `).join("");

  taskResponsibleSelect.innerHTML = activeUsers.map(user => `
    <option value="${user.id}">${escapeHtml(user.name || "")}</option>
  `).join("");
}

function taskCardTemplate(task, mode = "board") {
  const canEdit = canEditScope("agenda");
  const client = clientsData.find(c => c.id === task.clientId);
  const responsible = usersData.find(u => u.id === task.responsibleId);
  const isExtra = task.extraordinary === true;

  return `
    <div class="task-card ${isExtra ? 'extraordinary' : ''}" draggable="true" ondragstart="window.startTaskDrag('${task.id}')" ondragend="window.endTaskDrag()">
      <div class="task-title">${isExtra ? '⚡ ' : ''}${escapeHtml(task.title || "")}</div>
      <div class="task-sub">
        <div><strong>Cliente:</strong> ${escapeHtml(client?.name || "-")}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(responsible?.name || "-")}</div>
        <div><strong>Data:</strong> ${formatDateBR(task.date)} ${task.time ? "• " + escapeHtml(task.time) : ""}</div>
        <div><strong>Prioridade:</strong> ${escapeHtml(task.priority || "-")}</div>
        ${task.theme ? `<div><strong>Tema:</strong> ${escapeHtml(task.theme)}</div>` : ""}
      </div>
      ${mode === "board" ? `
      <div class="task-actions">
        ${canEdit ? `<button class="btn btn-light" onclick="window.editTask('${task.id}')">Editar</button>` : ""}
        ${canEdit ? `<button class="btn btn-light" onclick="window.advanceTask('${task.id}')">Avançar</button>` : ""}
        ${canEdit ? `<button class="btn btn-light" onclick="window.deleteTask('${task.id}')">Excluir</button>` : ""}
      </div>` : ""}
    </div>
  `;
}

function renderBoard() {
  initBoardDnD();
  document.querySelectorAll(".task-list").forEach(list => {
    const status = list.dataset.status;
    const filtered = tasksData.filter(task => task.status === status);

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">Sem itens</div>`;
      return;
    }

    list.innerHTML = filtered.map(task => taskCardTemplate(task, "board")).join("");
  });
}

function renderDirection() {
  const selectedDate = directionDateInput.value || new Date().toISOString().slice(0, 10);
  directionDateInput.value = selectedDate;

  const filtered = tasksData
    .filter(task => task.date === selectedDate)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  if (!filtered.length) {
    directionList.className = "list empty-state";
    directionList.textContent = "Nenhuma demanda nesta data.";
    return;
  }

  directionList.className = "list";
  directionList.innerHTML = filtered.map(task => `
    <div class="direction-item">
      ${taskCardTemplate(task, "direction")}
    </div>
  `).join("");
}

function renderCalendar() {
  const current = calendarMonthInput.value || new Date().toISOString().slice(0, 7);
  calendarMonthInput.value = current;

  const [year, month] = current.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  calendarGrid.innerHTML = "";

  for (let day = 1; day <= lastDay; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayTasks = tasksData.filter(task => task.date === date);

    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.innerHTML = `
      <div class="day-number">${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}</div>
      <div class="calendar-items">
        ${
          dayTasks.length
            ? dayTasks.slice(0, 4).map(task => `
                <div class="calendar-mini">
                  ${task.extraordinary ? '⚡ ' : ''}
                  <strong>${escapeHtml(task.title || "")}</strong><br>
                  ${escapeHtml(task.time || "--:--")} • ${escapeHtml(task.status || "")}
                </div>
              `).join("")
            : `<div class="empty-state">Sem demanda</div>`
        }
      </div>
    `;
    calendarGrid.appendChild(cell);
  }
}

function renderClients() {
  if (!clientsData.length) {
    clientsList.innerHTML = `<div class="empty-state">Nenhum cliente cadastrado.</div>`;
    return;
  }

  clientsList.innerHTML = clientsData.map(client => `
    <div class="client-card">
      <div class="card-top-line">
        <div>
          <h3>${escapeHtml(client.name || "")}</h3>
          <p class="team-meta">${escapeHtml(client.contractType || "-")} • ${escapeHtml(client.plan || "-")}</p>
        </div>
        ${canEditScope("clientes") ? `
          <div class="card-actions">
            <button class="icon-btn" onclick="window.editClient('${client.id}')">✎</button>
            <button class="icon-btn danger" onclick="window.deleteClient('${client.id}')">🗑</button>
          </div>
        ` : ""}
      </div>
      <div class="team-meta"><strong>Serviços:</strong> ${escapeHtml(client.services || "-")}</div>
      <div class="team-meta"><strong>Docs:</strong> ${escapeHtml(client.docs || "-")}</div>
    </div>
  `).join("");
}

function renderBenefits() {
  if (!benefitsData.length) {
    benefitsList.innerHTML = `<div class="empty-state">Nenhum benefício cadastrado.</div>`;
    return;
  }

  benefitsList.innerHTML = benefitsData.map(benefit => `
    <div class="benefit-card">
      <div class="card-top-line">
        <div>
          <h3>${escapeHtml(benefit.name || "")}</h3>
          <p class="team-meta">${escapeHtml(benefit.type || "-")} • ${escapeHtml(benefit.value || "-")}</p>
        </div>
        ${canEditScope("beneficios") ? `
          <div class="card-actions">
            <button class="icon-btn" onclick="window.editBenefit('${benefit.id}')">✎</button>
            <button class="icon-btn danger" onclick="window.deleteBenefit('${benefit.id}')">🗑</button>
          </div>
        ` : ""}
      </div>
      <span class="pill ${benefit.status === 'ativo' ? 'green' : 'yellow'}">${escapeHtml(benefit.status || 'ativo')}</span>
      <div class="team-meta">${escapeHtml(benefit.description || "-")}</div>
    </div>
  `).join("");
}

function getAccessSummary(user) {
  const perms = normalizePermissions(user?.permissions || {});
  const summary = [];
  if (perms.canEditAgenda) summary.push("Editor agenda");
  if (perms.canEditClientes) summary.push("Editor clientes");
  if (perms.canEditBeneficios) summary.push("Editor benefícios");
  if (perms.canEditRh) summary.push("Editor RH");
  if (perms.canEditAjustes) summary.push("Editor ajustes");
  return summary;
}

function renderRH() {
  if (!usersData.length) {
    rhList.innerHTML = `<div class="empty-state">Nenhum colaborador cadastrado.</div>`;
    return;
  }

  rhList.innerHTML = usersData.map(user => {
    const accessSummary = getAccessSummary(user);
    const isActive = user.active !== false;

    return `
      <div class="rh-card">
        <div class="card-top-line">
          <div>
            <h3>${escapeHtml(user.name || "")}</h3>
            <p class="team-meta">Usuário: ${escapeHtml(user.username || "-")}</p>
          </div>
          ${canEditScope("rh") ? `
            <div class="card-actions">
              <button class="icon-btn" onclick="window.editUserProfile('${user.id}')">✎</button>
              <button class="icon-btn ${isActive ? 'danger' : 'success'}" onclick="window.toggleUserActive('${user.id}')">${isActive ? '⏸' : '▶'}</button>
              <button class="icon-btn danger" onclick="window.deleteUserProfile('${user.id}')">🗑</button>
            </div>
          ` : ""}
        </div>
        <div class="team-meta"><strong>Perfil:</strong> ${escapeHtml(user.role || "-")}</div>
        <div class="team-meta"><strong>Cargo:</strong> ${escapeHtml(user.position || "-")}</div>
        <div class="team-meta"><strong>Setor:</strong> ${escapeHtml(user.sector || "-")}</div>
        <div class="team-meta"><strong>Status:</strong> ${isActive ? "Ativo" : "Inativo"}</div>
        <div class="team-meta"><strong>Benefícios:</strong> ${escapeHtml(user.benefits || "-")}</div>
        <div class="access-tags">
          <span class="access-tag ${isActive ? '' : 'inactive'}">${isActive ? 'Ativo na agenda' : 'Fora da agenda'}</span>
          ${accessSummary.length ? accessSummary.map(item => `<span class="access-tag">${escapeHtml(item)}</span>`).join("") : `<span class="access-tag">Somente visualização</span>`}
        </div>
      </div>
    `;
  }).join("");
}

// =============================
// CRUD TAREFAS
// =============================
async function saveTask(event) {
  event.preventDefault();
  if (!canEditScope("agenda")) return;

  const id = document.getElementById("task-id").value.trim();
  const payload = {
    title: document.getElementById("task-title").value.trim(),
    clientId: document.getElementById("task-client").value || "",
    description: document.getElementById("task-description").value.trim(),
    responsibleId: document.getElementById("task-responsible").value || "",
    status: document.getElementById("task-status").value,
    priority: document.getElementById("task-priority").value,
    date: document.getElementById("task-date").value,
    time: document.getElementById("task-time").value,
    theme: document.getElementById("task-theme").value.trim(),
    link: document.getElementById("task-link").value.trim(),
    extraordinary: document.getElementById("task-extraordinary").checked,
    updatedAt: serverTimestamp()
  };

  if (!payload.title || !payload.date) {
    alert("Preencha título e data.");
    return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, "tasks", id), payload);
    } else {
      await addDoc(collection(db, "tasks"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });
    }

    closeModal(taskModal);
    resetTaskForm();
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar a demanda.");
  }
}

window.editTask = function(id) {
  if (!canEditScope("agenda")) return;
  const task = tasksData.find(item => item.id === id);
  if (!task) return;

  document.getElementById("task-id").value = task.id;
  document.getElementById("task-title").value = task.title || "";
  document.getElementById("task-client").value = task.clientId || "";
  document.getElementById("task-description").value = task.description || "";
  document.getElementById("task-responsible").value = task.responsibleId || "";
  document.getElementById("task-status").value = task.status || "a_fazer";
  document.getElementById("task-priority").value = task.priority || "media";
  document.getElementById("task-date").value = task.date || "";
  document.getElementById("task-time").value = task.time || "";
  document.getElementById("task-theme").value = task.theme || "";
  document.getElementById("task-link").value = task.link || "";
  document.getElementById("task-extraordinary").checked = task.extraordinary === true;

  openModal(taskModal);
};

window.advanceTask = async function(id) {
  if (!canEditScope("agenda")) return;
  const task = tasksData.find(item => item.id === id);
  if (!task) return;

  const steps = ["a_fazer", "em_andamento", "revisao", "publicado", "concluido"];
  const currentIndex = steps.indexOf(task.status);
  const nextStatus = steps[Math.min(currentIndex + 1, steps.length - 1)];

  try {
    await updateDoc(doc(db, "tasks", id), {
      status: nextStatus,
      updatedAt: serverTimestamp()
    });
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível atualizar a demanda.");
  }
};

window.deleteTask = async function(id) {
  if (!canEditScope("agenda")) return;
  if (!confirm("Deseja excluir esta demanda?")) return;

  try {
    await deleteDoc(doc(db, "tasks", id));
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível excluir a demanda.");
  }
};

// =============================
// CRUD CLIENTES
// =============================
async function saveClient(event) {
  event.preventDefault();
  if (!canEditScope("clientes")) return;

  const id = document.getElementById("client-id").value.trim();
  const payload = {
    name: document.getElementById("client-name").value.trim(),
    contractType: document.getElementById("client-contract").value.trim(),
    plan: document.getElementById("client-plan").value.trim(),
    docs: document.getElementById("client-docs").value.trim(),
    services: document.getElementById("client-services").value.trim(),
    updatedAt: serverTimestamp()
  };

  if (!payload.name) {
    alert("Informe o nome do cliente.");
    return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, "clients", id), payload);
    } else {
      await addDoc(collection(db, "clients"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    closeModal(clientModal);
    resetClientForm();
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar o cliente.");
  }
}

window.editClient = function(id) {
  if (!canEditScope("clientes")) return;
  const client = clientsData.find(item => item.id === id);
  if (!client) return;

  document.getElementById("client-id").value = client.id;
  document.getElementById("client-name").value = client.name || "";
  document.getElementById("client-contract").value = client.contractType || "";
  document.getElementById("client-plan").value = client.plan || "";
  document.getElementById("client-docs").value = client.docs || "";
  document.getElementById("client-services").value = client.services || "";

  openModal(clientModal);
};

window.deleteClient = async function(id) {
  if (!canEditScope("clientes")) return;
  if (!confirm("Deseja excluir este cliente?")) return;

  try {
    await deleteDoc(doc(db, "clients", id));
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível excluir o cliente.");
  }
};

// =============================
// CRUD BENEFÍCIOS
// =============================
async function saveBenefit(event) {
  event.preventDefault();
  if (!canEditScope("beneficios")) return;

  const id = document.getElementById("benefit-id").value.trim();
  const payload = {
    name: document.getElementById("benefit-name").value.trim(),
    type: document.getElementById("benefit-type").value.trim(),
    value: document.getElementById("benefit-value").value.trim(),
    status: document.getElementById("benefit-status").value,
    description: document.getElementById("benefit-description").value.trim(),
    updatedAt: serverTimestamp()
  };

  if (!payload.name) {
    alert("Informe o nome do benefício.");
    return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, "benefits", id), payload);
    } else {
      await addDoc(collection(db, "benefits"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    closeModal(benefitModal);
    resetBenefitForm();
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar o benefício.");
  }
}

window.editBenefit = function(id) {
  if (!canEditScope("beneficios")) return;
  const benefit = benefitsData.find(item => item.id === id);
  if (!benefit) return;

  document.getElementById("benefit-id").value = benefit.id;
  document.getElementById("benefit-name").value = benefit.name || "";
  document.getElementById("benefit-type").value = benefit.type || "";
  document.getElementById("benefit-value").value = benefit.value || "";
  document.getElementById("benefit-status").value = benefit.status || "ativo";
  document.getElementById("benefit-description").value = benefit.description || "";

  openModal(benefitModal);
};

window.deleteBenefit = async function(id) {
  if (!canEditScope("beneficios")) return;
  if (!confirm("Deseja excluir este benefício?")) return;

  try {
    await deleteDoc(doc(db, "benefits", id));
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível excluir o benefício.");
  }
};

// =============================
// CRUD USUÁRIOS / RH
// =============================
async function saveUserProfile(event) {
  event.preventDefault();
  if (!canEditScope("rh")) return;

  const documentId = document.getElementById("user-id").value.trim();
  const username = sanitizeUsername(document.getElementById("user-username").value);
  const name = document.getElementById("user-name").value.trim();
  const initialPassword = document.getElementById("user-password").value;
  const internalEmail = makeInternalEmail(username);

  if (!name || !username) {
    alert("Informe nome e usuário.");
    return;
  }

  let userId = documentId;
  let storedEmail = internalEmail;

  if (!documentId) {
    if (!initialPassword || initialPassword.length < 6) {
      alert("A senha inicial precisa ter pelo menos 6 caracteres.");
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(creatorAuth, internalEmail, initialPassword);
      userId = credential.user.uid;
      storedEmail = credential.user.email || internalEmail;
      await signOut(creatorAuth);
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        alert("Esse usuário já existe. Escolha outro nome de usuário.");
      } else {
        alert("Não foi possível criar o login interno do colaborador.");
      }
      return;
    }
  } else {
    const existing = usersData.find(item => item.id === documentId);
    storedEmail = existing?.email || internalEmail;
  }

  const payload = {
    uid: userId,
    name,
    username,
    email: storedEmail,
    role: document.getElementById("user-role")?.value || "colaborador",
    position: document.getElementById("user-position")?.value?.trim() || "",
    sector: document.getElementById("user-sector")?.value?.trim() || "",
    birthday: document.getElementById("user-birthday")?.value || "",
    photoUrl: document.getElementById("user-photo")?.value?.trim() || "",
    benefits: document.getElementById("user-benefits")?.value?.trim() || "",
    active: document.getElementById("user-active") ? document.getElementById("user-active").checked : true,
    permissions: readUserPermissionsForm(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "users", userId), payload, { merge: true });
    closeModal(userModal);
    resetUserForm();
    await reloadAllData();
    alert(documentId ? "Colaborador atualizado com sucesso." : "Colaborador criado com sucesso.");
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar o colaborador. Verifique as rules do Firestore.");
  }
}

window.editUserProfile = function(id) {
  if (!canEditScope("rh")) return;
  const user = usersData.find(item => item.id === id);
  if (!user) return;

  document.getElementById("user-id").value = user.id;
  document.getElementById("user-name").value = user.name || "";
  document.getElementById("user-username").value = user.username || "";
  if (document.getElementById("user-username")) document.getElementById("user-username").readOnly = false;
  if (document.getElementById("user-role")) document.getElementById("user-role").value = user.role || "colaborador";
  if (document.getElementById("user-position")) document.getElementById("user-position").value = user.position || "";
  if (document.getElementById("user-sector")) document.getElementById("user-sector").value = user.sector || "";
  if (document.getElementById("user-birthday")) document.getElementById("user-birthday").value = user.birthday || "";
  if (document.getElementById("user-photo")) document.getElementById("user-photo").value = user.photoUrl || "";
  if (document.getElementById("user-benefits")) document.getElementById("user-benefits").value = user.benefits || "";
  if (document.getElementById("user-notes")) document.getElementById("user-notes").value = user.notes || "";
  if (document.getElementById("user-active")) document.getElementById("user-active").checked = user.active !== false;
  fillUserPermissionsForm(user.permissions || defaultPermissions());

  openModal(userModal);
};

window.toggleUserActive = async function(id) {
  if (!canEditScope("rh")) return;
  const user = usersData.find(item => item.id === id);
  if (!user) return;

  try {
    const nextValue = !(user.active !== false);
    await setDoc(doc(db, "users", id), { active: nextValue, updatedAt: serverTimestamp() }, { merge: true });
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível alterar o status do colaborador.");
  }
};

window.deleteUserProfile = async function(id) {
  if (!canEditScope("rh")) return;
  if (id === currentUser.uid) {
    alert("Você não pode excluir seu próprio perfil em uso.");
    return;
  }
  if (!confirm("Deseja excluir esta ficha de colaborador?")) return;

  try {
    await deleteDoc(doc(db, "users", id));
    await reloadAllData();
  } catch (error) {
    console.error(error);
    alert("Não foi possível excluir o colaborador.");
  }
};

// =============================
// EVENTOS
// =============================
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";

  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "Não foi possível entrar. Verifique e-mail e senha da gestão.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

menuItems.forEach(item => {
  item.addEventListener("click", () => setActiveTab(item.dataset.tab));
});

agendaViewSelect.addEventListener("change", () => {
  const value = agendaViewSelect.value;
  agendaBoardView.classList.toggle("active", value === "board");
  agendaCalendarView.classList.toggle("active", value === "calendar");
  agendaDirecaoView.classList.toggle("active", value === "direcao");
});

document.querySelectorAll("[data-close-modal]").forEach(button => {
  button.addEventListener("click", () => {
    const modalId = button.getAttribute("data-close-modal");
    closeModal(document.getElementById(modalId));
  });
});

openTaskModalBtn?.addEventListener("click", () => {
  resetTaskForm();
  openModal(taskModal);
});

openClientModalBtn?.addEventListener("click", () => {
  resetClientForm();
  openModal(clientModal);
});

openBenefitModalBtn?.addEventListener("click", () => {
  resetBenefitForm();
  openModal(benefitModal);
});

openUserModalBtn?.addEventListener("click", () => {
  resetUserForm();
  openModal(userModal);
});

taskForm.addEventListener("submit", saveTask);
clientForm.addEventListener("submit", saveClient);
benefitForm.addEventListener("submit", saveBenefit);
userForm.addEventListener("submit", saveUserProfile);
saveSettingsBtn?.addEventListener("click", saveSettings);

directionDateInput.addEventListener("change", renderDirection);
calendarMonthInput.addEventListener("change", renderCalendar);

loadMusicBtn.addEventListener("click", () => {
  const url = normalizeIframeUrl(musicUrlInput.value);
  if (!url) {
    alert("Cole uma URL válida.");
    return;
  }
  musicFrame.src = url;
});

// =============================
// PWA
// =============================
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err => {
      console.error("Erro ao registrar service worker:", err);
    });
  });
}

// =============================
// AUTH OBSERVER
// =============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    currentProfile = null;
    showScreen(loginScreen);
    return;
  }

  currentUser = user;

  try {
    loadSettingsFromLocal();
    applySettings();

    await loadCurrentProfile(user);

    if (currentProfile?.active === false) {
      await signOut(auth);
      alert("Este acesso está inativo. Procure a gerência.");
      return;
    }

    await loadSettingsFromCloud();
    applySettings();
    await reloadAllData();

    if (!directionDateInput.value) {
      directionDateInput.value = new Date().toISOString().slice(0, 10);
    }

    if (!calendarMonthInput.value) {
      calendarMonthInput.value = new Date().toISOString().slice(0, 7);
    }

    renderDirection();
    renderCalendar();

    setActiveTab("inicio");
    showScreen(dashboardScreen);
  } catch (error) {
    console.error(error);
    alert("Erro ao carregar dados do sistema.");
  }
});

// aplica local logo no carregamento
loadSettingsFromLocal();
applySettings();
