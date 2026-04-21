import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
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
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

const secondaryApp = getApps().find(a => a.name === "SecondaryAgenda")
  || initializeApp(firebaseConfig, "SecondaryAgenda");
const secondaryAuth = getAuth(secondaryApp);

const byId = (id) => document.getElementById(id);
const val = (id) => byId(id)?.value ?? "";
const trimmedVal = (id) => val(id).trim();
const checkedVal = (id) => !!byId(id)?.checked;

function normalizeUsername(username = "") {
  return String(username)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function toHiddenEmail(login = "") {
  const raw = String(login).trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  return `${normalizeUsername(raw)}@interno.ludo.com`;
}

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

function monthDays(year, month) {
  return new Date(year, month, 0).getDate();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function closeModal(modal) { if (modal) modal.classList.add("hidden"); }
function openModal(modal) { if (modal) modal.classList.remove("hidden"); }

let currentUser = null;
let currentProfile = null;
let usersData = [];
let colaboradoresData = [];
let tasksData = [];
let clientsData = [];
let benefitsData = [];
let settingsData = { themeColor: "#8B252C", fontFamily: "Inter, sans-serif" };
let draggedTaskId = null;

const loginScreen = byId("login-screen");
const dashboardScreen = byId("dashboard-screen");
const loginForm = byId("login-form");
const loginMessage = byId("login-message");
const logoutBtn = byId("logout-btn");
const menuItems = document.querySelectorAll(".menu-item");
const tabs = document.querySelectorAll(".tab-content");
const pageTitle = byId("page-title");
const welcomeText = byId("welcome-text");
const homeHello = byId("home-hello");
const userRoleBadge = byId("user-role-badge");
const currentUserName = byId("current-user-name");
const currentUserLogin = byId("current-user-login");
const statAFazer = byId("stat-a-fazer");
const statAndamento = byId("stat-andamento");
const statConcluidas = byId("stat-concluidas");
const agendaViewSelect = byId("agenda-view-select");
const agendaBoardView = byId("agenda-board-view");
const agendaCalendarView = byId("agenda-calendar-view");
const agendaDirecaoView = byId("agenda-direcao-view");
const directionList = byId("direction-list");
const directionDateInput = byId("direction-date-input");
const calendarMonthInput = byId("calendar-month-input");
const calendarGrid = byId("calendar-grid");
const openTaskModalBtn = byId("open-task-modal-btn");
const openClientModalBtn = byId("open-client-modal-btn");
const openBenefitModalBtn = byId("open-benefit-modal-btn");
const openUserModalBtn = byId("open-user-modal-btn");
const taskModal = byId("task-modal");
const clientModal = byId("client-modal");
const benefitModal = byId("benefit-modal");
const userModal = byId("user-modal");
const taskForm = byId("task-form");
const clientForm = byId("client-form");
const benefitForm = byId("benefit-form");
const userForm = byId("user-form");
const taskClientSelect = byId("task-client");
const taskResponsibleSelect = byId("task-responsible");
const clientsList = byId("clients-list");
const benefitsList = byId("benefits-list");
const rhList = byId("rh-list");
const themeColorInput = byId("theme-color-input");
const fontSelect = byId("font-select");
const saveSettingsBtn = byId("save-settings-btn");
const musicUrlInput = byId("music-url");
const loadMusicBtn = byId("load-music-btn");
const musicFrame = byId("music-frame");

function isManager() { return currentProfile?.role === "gerencia"; }
function getPerm(key) { return isManager() || currentProfile?.permissions?.[key] === true; }

function applyRoleVisibility() {
  document.querySelectorAll(".manager-only").forEach(el => {
    if (
      isManager() ||
      getPerm("canEditAgenda") ||
      getPerm("canEditClientes") ||
      getPerm("canEditBeneficios") ||
      getPerm("canEditRh") ||
      getPerm("canEditAjustes")
    ) el.classList.remove("is-hidden-by-role");
    else el.classList.add("is-hidden-by-role");
  });
}

function applyTabVisibility() {
  const rules = {
    inicio: getPerm("accessInicio") || isManager(),
    agenda: getPerm("accessAgenda") || isManager(),
    clientes: getPerm("accessClientes") || isManager(),
    beneficios: getPerm("accessBeneficios") || isManager(),
    rh: getPerm("accessRh") || isManager(),
    music: getPerm("accessMusic") || isManager(),
    ajustes: getPerm("accessAjustes") || isManager()
  };

  menuItems.forEach(item => {
    const ok = rules[item.dataset.tab] !== false;
    item.style.display = ok ? "" : "none";
  });
}

function setActiveTab(tabName) {
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

function applySettings() {
  document.documentElement.style.setProperty("--primary", settingsData.themeColor || "#8B252C");
  document.documentElement.style.setProperty("--font-main", settingsData.fontFamily || "Inter, sans-serif");
  if (themeColorInput) themeColorInput.value = settingsData.themeColor || "#8B252C";
  if (fontSelect) fontSelect.value = settingsData.fontFamily || "Inter, sans-serif";
  localStorage.setItem("agenda-settings", JSON.stringify(settingsData));
}

async function loadSettings() {
  const local = localStorage.getItem("agenda-settings");
  if (local) {
    try { settingsData = { ...settingsData, ...JSON.parse(local) }; } catch {}
  }
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) settingsData = { ...settingsData, ...snap.data() };
  } catch (e) { console.warn("Ajustes carregados localmente."); }
  applySettings();
}

async function saveSettings() {
  if (!getPerm("canEditAjustes") && !isManager()) return;
  settingsData.themeColor = themeColorInput?.value || "#8B252C";
  settingsData.fontFamily = fontSelect?.value || "Inter, sans-serif";
  applySettings();
  try {
    await setDoc(doc(db, "settings", "global"), settingsData, { merge: true });
    alert("Ajustes salvos.");
  } catch (e) {
    console.warn(e);
    alert("Ajustes salvos localmente. Verifique as rules se quiser salvar no Firebase.");
  }
}

async function bootstrapGestao(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    currentProfile = { id: snap.id, ...snap.data() };
    return;
  }
  if ((user.email || "").toLowerCase() === "gestao@ludo.com") {
    const profile = {
      uid: user.uid,
      username: "gestao",
      name: "Gestão",
      email: user.email,
      role: "gerencia",
      position: "Administrador",
      sector: "Gestão",
      active: true,
      permissions: {
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
      },
      createdAt: serverTimestamp()
    };
    await setDoc(ref, profile, { merge: true });
    currentProfile = { id: user.uid, ...profile };
  } else {
    throw new Error("Perfil do usuário não encontrado. Cadastre-o no RH ou faça login com a gestão.");
  }
}

async function loadCurrentProfile(user) {
  await bootstrapGestao(user);
  if (!currentProfile) throw new Error("Sem perfil.");
  userRoleBadge.textContent = isManager() ? "Gestão Administrador" : "Colaborador";
  currentUserName.textContent = currentProfile.name || "-";
  currentUserLogin.textContent = currentProfile.username || currentProfile.email || "-";
  welcomeText.textContent = `Bem-vindo, ${currentProfile.name || "usuário"}!`;
  homeHello.textContent = `Olá, ${currentProfile.name || "usuário"}!`;
  applyRoleVisibility();
  applyTabVisibility();
}

function showScreen(screen) {
  [loginScreen, dashboardScreen].forEach(s => s?.classList.remove("active"));
  screen?.classList.add("active");
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "";
  const login = trimmedVal("login-username");
  const password = val("login-password");
  if (!login || !password) {
    loginMessage.textContent = "Preencha usuário e senha.";
    return;
  }
  try {
    const email = toHiddenEmail(login);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "Não foi possível entrar. Verifique usuário e senha.";
  }
});

logoutBtn?.addEventListener("click", async () => { await signOut(auth); });

async function loadUsers() {
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("name")));
    usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { usersData = []; console.warn("Sem users:", e.message); }
}

async function loadColaboradores() {
  try {
    const snap = await getDocs(query(collection(db, "colaboradores"), orderBy("name")));
    colaboradoresData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { colaboradoresData = []; console.warn("Sem colaboradores:", e.message); }
}

async function loadTasks() {
  try {
    const snap = await getDocs(query(collection(db, "tasks"), orderBy("date")));
    tasksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { tasksData = []; }
}

async function loadClients() {
  try {
    const snap = await getDocs(query(collection(db, "clients"), orderBy("name")));
    clientsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { clientsData = []; }
}

async function loadBenefits() {
  try {
    const snap = await getDocs(query(collection(db, "benefits"), orderBy("name")));
    benefitsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { benefitsData = []; }
}

async function reloadAllData() {
  await Promise.all([loadUsers(), loadColaboradores(), loadTasks(), loadClients(), loadBenefits(), loadSettings()]);
  renderStats();
  renderClients();
  renderBenefits();
  renderRH();
  fillTaskSelects();
  renderBoard();
  renderDirection();
  renderCalendar();
  initDragAndDrop();
}

function renderStats() {
  const dayTasks = tasksData.filter(t => t.date === todayISO());
  if (statAFazer) statAFazer.textContent = dayTasks.filter(t => t.status === "a_fazer").length;
  if (statAndamento) statAndamento.textContent = dayTasks.filter(t => t.status === "em_andamento").length;
  if (statConcluidas) statConcluidas.textContent = dayTasks.filter(t => t.status === "concluido").length;
}

function fillTaskSelects() {
  if (taskClientSelect) {
    taskClientSelect.innerHTML = `<option value="">Selecione</option>` +
      clientsData.map(c => `<option value="${c.id}">${escapeHtml(c.name || "")}</option>`).join("");
  }
  const ativos = colaboradoresData.filter(c => c.active !== false);
  if (taskResponsibleSelect) {
    taskResponsibleSelect.innerHTML = `<option value="">Selecione</option>` +
      ativos.map(c => `<option value="${c.id}">${escapeHtml(c.name || "")}</option>`).join("");
  }
}

function taskCardTemplate(task, mode = "board") {
  const canEdit = isManager() || getPerm("canEditAgenda");
  const isExtra = task.extraordinary === true;
  return `
    <div class="task-card ${isExtra ? "extraordinary" : ""}" draggable="${canEdit}" data-task-id="${task.id}">
      <div class="task-title">${isExtra ? "⚡ " : ""}${escapeHtml(task.title || "")}</div>
      <div class="task-sub">
        <div><strong>Cliente:</strong> ${escapeHtml(task.clientName || "-")}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(task.responsibleName || "-")}</div>
        <div><strong>Data:</strong> ${formatDateBR(task.date)} ${task.time ? "• " + escapeHtml(task.time) : ""}</div>
        <div><strong>Prioridade:</strong> ${escapeHtml(task.priority || "-")}</div>
        ${task.theme ? `<div><strong>Tema:</strong> ${escapeHtml(task.theme)}</div>` : ""}
      </div>
      ${mode === "board" && canEdit ? `<div class="task-actions">
        <button class="btn btn-light" onclick="window.editTask('${task.id}')">Editar</button>
        <button class="btn btn-light" onclick="window.advanceTask('${task.id}')">Avançar</button>
        <button class="btn btn-light" onclick="window.deleteTask('${task.id}')">Excluir</button>
      </div>` : ""}
    </div>`;
}

function renderBoard() {
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
  if (!directionList || !directionDateInput) return;
  const selectedDate = directionDateInput.value || todayISO();
  directionDateInput.value = selectedDate;
  const filtered = tasksData.filter(task => task.date === selectedDate).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  if (!filtered.length) {
    directionList.className = "list empty-state";
    directionList.textContent = "Nenhuma demanda nesta data.";
    return;
  }
  directionList.className = "list";
  directionList.innerHTML = filtered.map(task => `<div class="direction-item">${taskCardTemplate(task, "direction")}</div>`).join("");
}

function renderCalendar() {
  if (!calendarGrid || !calendarMonthInput) return;
  const current = calendarMonthInput.value || new Date().toISOString().slice(0, 7);
  calendarMonthInput.value = current;
  const [year, month] = current.split("-").map(Number);
  const total = monthDays(year, month);
  calendarGrid.innerHTML = "";
  for (let day = 1; day <= total; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayTasks = tasksData.filter(task => task.date === date);
    const div = document.createElement("div");
    div.className = "calendar-cell";
    div.innerHTML = `
      <div class="day-number">${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}</div>
      ${dayTasks.length ? dayTasks.slice(0, 4).map(task => `
        <div class="calendar-mini">
          ${task.extraordinary ? "⚡ " : ""}
          <strong>${escapeHtml(task.title || "")}</strong><br>
          ${escapeHtml(task.time || "--:--")} • ${escapeHtml(task.status || "")}
        </div>
      `).join("") : `<div class="empty-state">Sem demanda</div>`}
    `;
    calendarGrid.appendChild(div);
  }
}

function renderClients() {
  if (!clientsList) return;
  if (!clientsData.length) {
    clientsList.innerHTML = `<div class="empty-state">Nenhum cliente cadastrado.</div>`;
    return;
  }
  const canEdit = isManager() || getPerm("canEditClientes");
  clientsList.innerHTML = clientsData.map(client => `
    <div class="client-card">
      <div class="card-top-line">
        <div>
          <h3>${escapeHtml(client.name || "")}</h3>
          <p class="muted">${escapeHtml(client.contractType || "-")} • ${escapeHtml(client.plan || "-")}</p>
        </div>
        ${canEdit ? `<div class="card-actions">
          <button class="icon-btn" onclick="window.editClient('${client.id}')">✎</button>
          <button class="icon-btn danger" onclick="window.deleteClient('${client.id}')">🗑</button>
        </div>` : ""}
      </div>
      <div class="muted"><strong>Serviços:</strong> ${escapeHtml(client.services || "-")}</div>
      <div class="muted"><strong>Docs:</strong> ${escapeHtml(client.docs || "-")}</div>
    </div>`).join("");
}

function renderBenefits() {
  if (!benefitsList) return;
  if (!benefitsData.length) {
    benefitsList.innerHTML = `<div class="empty-state">Nenhum benefício cadastrado.</div>`;
    return;
  }
  const canEdit = isManager() || getPerm("canEditBeneficios");
  benefitsList.innerHTML = benefitsData.map(benefit => `
    <div class="benefit-card">
      <div class="card-top-line">
        <div>
          <h3>${escapeHtml(benefit.name || "")}</h3>
          <p class="muted">${escapeHtml(benefit.type || "-")} • ${escapeHtml(benefit.value || "-")}</p>
        </div>
        ${canEdit ? `<div class="card-actions">
          <button class="icon-btn" onclick="window.editBenefit('${benefit.id}')">✎</button>
          <button class="icon-btn danger" onclick="window.deleteBenefit('${benefit.id}')">🗑</button>
        </div>` : ""}
      </div>
      <span class="pill ${benefit.status === "ativo" ? "green" : "yellow"}">${escapeHtml(benefit.status || "ativo")}</span>
      <div class="muted">${escapeHtml(benefit.description || "-")}</div>
    </div>`).join("");
}

function renderRH() {
  if (!rhList) return;
  if (!colaboradoresData.length) {
    rhList.innerHTML = `<div class="empty-state">Nenhum colaborador cadastrado.</div>`;
    return;
  }
  const canEdit = isManager() || getPerm("canEditRh");
  rhList.innerHTML = colaboradoresData.map(user => `
    <div class="rh-card">
      <div class="card-top-line">
        <div>
          <h3>${escapeHtml(user.name || "")}</h3>
          <p class="muted">Usuário: ${escapeHtml(user.username || "-")}</p>
        </div>
        ${canEdit ? `<div class="card-actions">
          <button class="icon-btn" onclick="window.editUserProfile('${user.id}')">✎</button>
          <button class="icon-btn" onclick="window.toggleUserActive('${user.id}')">${user.active === false ? "▶" : "⏸"}</button>
          <button class="icon-btn danger" onclick="window.deleteUserProfile('${user.id}')">🗑</button>
        </div>` : ""}
      </div>
      <div class="muted"><strong>Perfil:</strong> ${escapeHtml(user.role || "-")}</div>
      <div class="muted"><strong>Cargo:</strong> ${escapeHtml(user.position || "-")}</div>
      <div class="muted"><strong>Setor:</strong> ${escapeHtml(user.sector || "-")}</div>
      <div class="muted"><strong>Status:</strong> ${user.active === false ? "Inativo" : "Ativo"}</div>
      <div class="muted"><strong>Benefícios:</strong> ${escapeHtml(user.benefits || "-")}</div>
      <div class="task-actions">
        ${(user.active !== false) ? `<span class="pill blue">Ativo na agenda</span>` : ""}
        ${user.permissions?.canEditAgenda ? `<span class="pill blue">Editor agenda</span>` : ""}
        ${user.permissions?.canEditClientes ? `<span class="pill blue">Editor clientes</span>` : ""}
        ${user.permissions?.canEditBeneficios ? `<span class="pill blue">Editor benefícios</span>` : ""}
        ${user.permissions?.canEditRh ? `<span class="pill blue">Editor RH</span>` : ""}
        ${user.permissions?.canEditAjustes ? `<span class="pill blue">Editor ajustes</span>` : ""}
      </div>
    </div>`).join("");
}

function initDragAndDrop() {
  document.querySelectorAll(".task-card[draggable='true']").forEach(card => {
    card.addEventListener("dragstart", () => { draggedTaskId = card.dataset.taskId; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => { draggedTaskId = null; card.classList.remove("dragging"); });
  });
  document.querySelectorAll(".droppable").forEach(zone => {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => { zone.classList.remove("drag-over"); });
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      if (!draggedTaskId) return;
      if (!(isManager() || getPerm("canEditAgenda"))) return;
      const newStatus = zone.dataset.status;
      try {
        await updateDoc(doc(db, "tasks", draggedTaskId), { status: newStatus, updatedAt: serverTimestamp() });
        await reloadAllData();
      } catch (err) {
        console.error(err);
        alert("Não foi possível mover o card. Verifique as rules.");
      }
    });
  });
}

function resetTaskForm() {
  taskForm?.reset();
  byId("task-id").value = "";
  byId("task-status").value = "a_fazer";
  byId("task-priority").value = "media";
  byId("task-date").value = todayISO();
}
function resetClientForm() { clientForm?.reset(); byId("client-id").value = ""; }
function resetBenefitForm() { benefitForm?.reset(); byId("benefit-id").value = ""; byId("benefit-status").value = "ativo"; }
function resetUserForm() {
  userForm?.reset();
  byId("user-id").value = "";
  byId("user-role").value = "colaborador";
  byId("user-active").checked = true;
  [
    "perm-accessInicio","perm-accessAgenda","perm-accessClientes","perm-accessBeneficios","perm-accessRh",
    "perm-accessMusic","perm-accessAjustes","perm-canViewDirecao",
    "perm-canEditAgenda","perm-canEditClientes","perm-canEditBeneficios","perm-canEditRh","perm-canEditAjustes"
  ].forEach(id => { const el = byId(id); if (el) el.checked = false; });
  byId("perm-accessInicio").checked = true;
  byId("perm-accessAgenda").checked = true;
  byId("perm-accessMusic").checked = true;
}

window.editTask = function(id) {
  if (!(isManager() || getPerm("canEditAgenda"))) return;
  const task = tasksData.find(t => t.id === id);
  if (!task) return;
  byId("task-id").value = task.id;
  byId("task-title").value = task.title || "";
  byId("task-client").value = task.clientId || "";
  byId("task-description").value = task.description || "";
  byId("task-responsible").value = task.responsibleId || "";
  byId("task-status").value = task.status || "a_fazer";
  byId("task-priority").value = task.priority || "media";
  byId("task-date").value = task.date || "";
  byId("task-time").value = task.time || "";
  byId("task-theme").value = task.theme || "";
  byId("task-extraordinary").checked = task.extraordinary === true;
  openModal(taskModal);
};

window.editClient = function(id) {
  if (!(isManager() || getPerm("canEditClientes"))) return;
  const client = clientsData.find(c => c.id === id);
  if (!client) return;
  byId("client-id").value = client.id;
  byId("client-name").value = client.name || "";
  byId("client-contract").value = client.contractType || "";
  byId("client-plan").value = client.plan || "";
  byId("client-docs").value = client.docs || "";
  byId("client-services").value = client.services || "";
  openModal(clientModal);
};

window.editBenefit = function(id) {
  if (!(isManager() || getPerm("canEditBeneficios"))) return;
  const benefit = benefitsData.find(b => b.id === id);
  if (!benefit) return;
  byId("benefit-id").value = benefit.id;
  byId("benefit-name").value = benefit.name || "";
  byId("benefit-type").value = benefit.type || "";
  byId("benefit-value").value = benefit.value || "";
  byId("benefit-status").value = benefit.status || "ativo";
  byId("benefit-description").value = benefit.description || "";
  openModal(benefitModal);
};

window.editUserProfile = function(id) {
  if (!(isManager() || getPerm("canEditRh"))) return;
  const user = colaboradoresData.find(u => u.id === id);
  if (!user) return;
  byId("user-id").value = user.id;
  byId("user-name").value = user.name || "";
  byId("user-username").value = user.username || "";
  byId("user-password").value = "";
  byId("user-email").value = user.email || "";
  byId("user-role").value = user.role || "colaborador";
  byId("user-position").value = user.position || "";
  byId("user-sector").value = user.sector || "";
  byId("user-birthday").value = user.birthday || "";
  byId("user-photo").value = user.photoUrl || "";
  byId("user-benefits").value = user.benefits || "";
  byId("user-active").checked = user.active !== false;
  const p = user.permissions || {};
  byId("perm-accessInicio").checked = !!p.accessInicio;
  byId("perm-accessAgenda").checked = !!p.accessAgenda;
  byId("perm-accessClientes").checked = !!p.accessClientes;
  byId("perm-accessBeneficios").checked = !!p.accessBeneficios;
  byId("perm-accessRh").checked = !!p.accessRh;
  byId("perm-accessMusic").checked = !!p.accessMusic;
  byId("perm-accessAjustes").checked = !!p.accessAjustes;
  byId("perm-canViewDirecao").checked = !!p.canViewDirecao;
  byId("perm-canEditAgenda").checked = !!p.canEditAgenda;
  byId("perm-canEditClientes").checked = !!p.canEditClientes;
  byId("perm-canEditBeneficios").checked = !!p.canEditBeneficios;
  byId("perm-canEditRh").checked = !!p.canEditRh;
  byId("perm-canEditAjustes").checked = !!p.canEditAjustes;
  openModal(userModal);
};

async function saveTask(e) {
  e.preventDefault();
  if (!(isManager() || getPerm("canEditAgenda"))) return;
  const responsibleId = val("task-responsible");
  const responsible = colaboradoresData.find(c => c.id === responsibleId);
  const clientId = val("task-client");
  const client = clientsData.find(c => c.id === clientId);
  const payload = {
    title: trimmedVal("task-title"),
    clientId,
    clientName: client?.name || "",
    description: trimmedVal("task-description"),
    responsibleId,
    responsibleName: responsible?.name || "",
    status: val("task-status"),
    priority: val("task-priority"),
    date: val("task-date"),
    time: val("task-time"),
    theme: trimmedVal("task-theme"),
    extraordinary: checkedVal("task-extraordinary"),
    updatedAt: serverTimestamp()
  };
  if (!payload.title || !payload.date) { alert("Preencha título e data."); return; }
  try {
    const id = trimmedVal("task-id");
    if (id) await updateDoc(doc(db, "tasks", id), payload);
    else await addDoc(collection(db, "tasks"), { ...payload, createdAt: serverTimestamp(), createdBy: currentUser.uid });
    closeModal(taskModal);
    resetTaskForm();
    await reloadAllData();
  } catch (e2) {
    console.error(e2);
    alert("Não foi possível salvar a atividade. Verifique as rules.");
  }
}

window.advanceTask = async function(id) {
  if (!(isManager() || getPerm("canEditAgenda"))) return;
  const task = tasksData.find(item => item.id === id);
  if (!task) return;
  const steps = ["a_fazer", "em_andamento", "revisao", "publicado", "concluido"];
  const currentIndex = steps.indexOf(task.status);
  const nextStatus = steps[Math.min(currentIndex + 1, steps.length - 1)];
  try {
    await updateDoc(doc(db, "tasks", id), { status: nextStatus, updatedAt: serverTimestamp() });
    await reloadAllData();
  } catch (e) { alert("Não foi possível atualizar o status."); }
};

window.deleteTask = async function(id) {
  if (!(isManager() || getPerm("canEditAgenda"))) return;
  if (!confirm("Deseja excluir esta demanda?")) return;
  try { await deleteDoc(doc(db, "tasks", id)); await reloadAllData(); } catch (e) { alert("Não foi possível excluir."); }
};

async function saveClient(e) {
  e.preventDefault();
  if (!(isManager() || getPerm("canEditClientes"))) return;
  const payload = {
    name: trimmedVal("client-name"),
    contractType: trimmedVal("client-contract"),
    plan: trimmedVal("client-plan"),
    docs: trimmedVal("client-docs"),
    services: trimmedVal("client-services"),
    updatedAt: serverTimestamp()
  };
  if (!payload.name) { alert("Informe o nome do cliente."); return; }
  try {
    const id = trimmedVal("client-id");
    if (id) await updateDoc(doc(db, "clients", id), payload);
    else await addDoc(collection(db, "clients"), { ...payload, createdAt: serverTimestamp() });
    closeModal(clientModal);
    resetClientForm();
    await reloadAllData();
  } catch (e2) { alert("Não foi possível salvar o cliente."); }
}

window.deleteClient = async function(id) {
  if (!(isManager() || getPerm("canEditClientes"))) return;
  if (!confirm("Deseja excluir este cliente?")) return;
  try { await deleteDoc(doc(db, "clients", id)); await reloadAllData(); } catch (e) { alert("Não foi possível excluir o cliente."); }
};

async function saveBenefit(e) {
  e.preventDefault();
  if (!(isManager() || getPerm("canEditBeneficios"))) return;
  const payload = {
    name: trimmedVal("benefit-name"),
    type: trimmedVal("benefit-type"),
    value: trimmedVal("benefit-value"),
    status: val("benefit-status"),
    description: trimmedVal("benefit-description"),
    updatedAt: serverTimestamp()
  };
  if (!payload.name) { alert("Informe o nome do benefício."); return; }
  try {
    const id = trimmedVal("benefit-id");
    if (id) await updateDoc(doc(db, "benefits", id), payload);
    else await addDoc(collection(db, "benefits"), { ...payload, createdAt: serverTimestamp() });
    closeModal(benefitModal);
    resetBenefitForm();
    await reloadAllData();
  } catch (e2) { alert("Não foi possível salvar o benefício."); }
}

window.deleteBenefit = async function(id) {
  if (!(isManager() || getPerm("canEditBeneficios"))) return;
  if (!confirm("Deseja excluir este benefício?")) return;
  try { await deleteDoc(doc(db, "benefits", id)); await reloadAllData(); } catch (e) { alert("Não foi possível excluir o benefício."); }
};

function collectPermissions() {
  return {
    accessInicio: checkedVal("perm-accessInicio"),
    accessAgenda: checkedVal("perm-accessAgenda"),
    accessClientes: checkedVal("perm-accessClientes"),
    accessBeneficios: checkedVal("perm-accessBeneficios"),
    accessRh: checkedVal("perm-accessRh"),
    accessMusic: checkedVal("perm-accessMusic"),
    accessAjustes: checkedVal("perm-accessAjustes"),
    canViewDirecao: checkedVal("perm-canViewDirecao"),
    canEditAgenda: checkedVal("perm-canEditAgenda"),
    canEditClientes: checkedVal("perm-canEditClientes"),
    canEditBeneficios: checkedVal("perm-canEditBeneficios"),
    canEditRh: checkedVal("perm-canEditRh"),
    canEditAjustes: checkedVal("perm-canEditAjustes")
  };
}

async function saveUserProfile(e) {
  e.preventDefault();
  if (!(isManager() || getPerm("canEditRh"))) return;
  const editingId = trimmedVal("user-id");
  const name = trimmedVal("user-name");
  const usernameRaw = trimmedVal("user-username");
  const username = normalizeUsername(usernameRaw);
  const password = val("user-password");
  const emailOptional = trimmedVal("user-email");
  if (!name) { alert("Informe o nome do colaborador."); return; }
  const permissions = collectPermissions();
  const basePayload = {
    name,
    username,
    email: emailOptional || (username ? toHiddenEmail(username) : ""),
    role: val("user-role") || "colaborador",
    position: trimmedVal("user-position"),
    sector: trimmedVal("user-sector"),
    birthday: val("user-birthday"),
    photoUrl: trimmedVal("user-photo"),
    benefits: trimmedVal("user-benefits"),
    active: checkedVal("user-active"),
    permissions,
    updatedAt: serverTimestamp()
  };
  try {
    if (editingId) {
      await updateDoc(doc(db, "colaboradores", editingId), basePayload);
      await updateDoc(doc(db, "users", editingId), {
        name: basePayload.name,
        username: basePayload.username,
        email: basePayload.email,
        role: basePayload.role,
        position: basePayload.position,
        sector: basePayload.sector,
        active: basePayload.active,
        permissions: basePayload.permissions,
        updatedAt: serverTimestamp()
      });
      closeModal(userModal); resetUserForm(); await reloadAllData(); alert("Colaborador atualizado."); return;
    }
    if (username && !password) { alert("Se informar um usuário, informe também a senha inicial."); return; }
    let uid;
    if (username && password) {
      const hiddenEmail = toHiddenEmail(username);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, hiddenEmail, password);
      uid = cred.user.uid;
      await signOut(secondaryAuth);
    } else {
      uid = doc(collection(db, "colaboradores")).id;
    }
    await setDoc(doc(db, "colaboradores", uid), { uid, ...basePayload, createdAt: serverTimestamp() });
    await setDoc(doc(db, "users", uid), {
      uid,
      username: basePayload.username,
      name: basePayload.name,
      email: basePayload.email,
      role: basePayload.role,
      position: basePayload.position,
      sector: basePayload.sector,
      active: basePayload.active,
      permissions: basePayload.permissions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    closeModal(userModal); resetUserForm(); await reloadAllData(); alert("Colaborador salvo com sucesso.");
  } catch (err) {
    console.error(err);
    alert("Não foi possível salvar o colaborador. Verifique Authentication e as rules do Firestore.");
  }
}

window.toggleUserActive = async function(id) {
  if (!(isManager() || getPerm("canEditRh"))) return;
  const user = colaboradoresData.find(u => u.id === id);
  if (!user) return;
  try {
    await updateDoc(doc(db, "colaboradores", id), { active: !(user.active !== false), updatedAt: serverTimestamp() });
    await updateDoc(doc(db, "users", id), { active: !(user.active !== false), updatedAt: serverTimestamp() });
    await reloadAllData();
  } catch (e) { alert("Não foi possível alterar o status."); }
};

window.deleteUserProfile = async function(id) {
  if (!(isManager() || getPerm("canEditRh"))) return;
  if (!confirm("Deseja excluir esta ficha de colaborador?")) return;
  try {
    await deleteDoc(doc(db, "colaboradores", id));
    await deleteDoc(doc(db, "users", id));
    await reloadAllData();
  } catch (e) { alert("Não foi possível excluir a ficha."); }
};

menuItems.forEach(item => item.addEventListener("click", () => setActiveTab(item.dataset.tab)));

agendaViewSelect?.addEventListener("change", () => {
  const value = agendaViewSelect.value;
  agendaBoardView?.classList.toggle("active", value === "board");
  agendaCalendarView?.classList.toggle("active", value === "calendar");
  agendaDirecaoView?.classList.toggle("active", value === "direcao");
});

document.querySelectorAll("[data-close-modal]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(byId(btn.getAttribute("data-close-modal"))));
});

openTaskModalBtn?.addEventListener("click", () => { resetTaskForm(); openModal(taskModal); });
openClientModalBtn?.addEventListener("click", () => { resetClientForm(); openModal(clientModal); });
openBenefitModalBtn?.addEventListener("click", () => { resetBenefitForm(); openModal(benefitModal); });
openUserModalBtn?.addEventListener("click", () => { resetUserForm(); openModal(userModal); });

taskForm?.addEventListener("submit", saveTask);
clientForm?.addEventListener("submit", saveClient);
benefitForm?.addEventListener("submit", saveBenefit);
userForm?.addEventListener("submit", saveUserProfile);
saveSettingsBtn?.addEventListener("click", saveSettings);
directionDateInput?.addEventListener("change", renderDirection);
calendarMonthInput?.addEventListener("change", renderCalendar);
loadMusicBtn?.addEventListener("click", () => {
  const url = trimmedVal("music-url");
  if (!url || !musicFrame) { alert("Cole uma URL válida."); return; }
  musicFrame.src = url;
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    currentProfile = null;
    showScreen(loginScreen);
    return;
  }
  currentUser = user;
  try {
    await loadCurrentProfile(user);
    await reloadAllData();
    if (!directionDateInput.value) directionDateInput.value = todayISO();
    if (!calendarMonthInput.value) calendarMonthInput.value = new Date().toISOString().slice(0, 7);
    renderDirection();
    renderCalendar();
    setActiveTab("inicio");
    showScreen(dashboardScreen);
  } catch (e) {
    console.error(e);
    alert(e.message || "Erro ao carregar o sistema.");
    await signOut(auth);
  }
});
