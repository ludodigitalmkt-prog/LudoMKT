import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

const byId = (id) => document.getElementById(id);
const val = (id) => byId(id)?.value ?? "";
const trimmedVal = (id) => val(id).trim();
const checkedVal = (id) => !!byId(id)?.checked;
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthDays = (year, month) => new Date(year, month, 0).getDate();
function escapeHtml(str = "") { return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function formatDateBR(dateString) { if (!dateString) return "-"; const [y,m,d] = dateString.split("-"); return `${d}/${m}/${y}`; }
function weekDayLabel(num) {
  const map = {0:"Dom",1:"Seg",2:"Ter",3:"Qua",4:"Qui",5:"Sex",6:"Sáb"};
  return map[num] || "";
}

function monthLabel(num) {
  const map = {1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"};
  return map[num] || "";
}

function getRepeatDays() {
  return [0,1,2,3,4,5,6].filter(d => checkedVal(`repeat-day-${d}`));
}

function getRepeatMonths() {
  return [1,2,3,4,5,6,7,8,9,10,11,12].filter(m => checkedVal(`repeat-month-${m}`));
}

function clearRepeatChecks() {
  [0,1,2,3,4,5,6].forEach(d => { const el = byId(`repeat-day-${d}`); if (el) el.checked = false; });
  [1,2,3,4,5,6,7,8,9,10,11,12].forEach(m => { const el = byId(`repeat-month-${m}`); if (el) el.checked = false; });
}

function taskOccursByRule(task, dateStr) {
  if (!task) return false;
  if (!task.repeatEnabled) return task.date === dateStr;

  const start = task.repeatStartDate || task.date;
  const end = task.repeatEndDate || task.date;
  if (!start || !end) return task.date === dateStr;
  if (dateStr < start || dateStr > end) return false;

  const dateObj = new Date(`${dateStr}T00:00:00`);
  const weekday = dateObj.getDay();
  const month = Number(dateStr.split('-')[1]);
  const days = Array.isArray(task.repeatWeekdays) ? task.repeatWeekdays : [];
  const months = Array.isArray(task.repeatMonths) ? task.repeatMonths : [];

  const dayOk = days.length ? days.includes(weekday) : true;
  const monthOk = months.length ? months.includes(month) : true;
  return dayOk && monthOk;
}

function taskOccursOnDate(task, dateStr) {
  if (!task) return false;
  if (!task.repeatEnabled) return task.date === dateStr;

  const moved = task.movedOccurrences || {};
  const movedTargets = Object.values(moved || {});
  if (movedTargets.includes(dateStr)) return true;
  if (taskOccursByRule(task, dateStr) && !moved[dateStr]) return true;
  return false;
}

function getOccurrenceStatus(task, dateStr) {
  return task?.occurrenceOverrides?.[dateStr]?.status || task?.status || "a_fazer";
}

function getOccurrenceSourceDate(task, dateStr) {
  if (!task?.repeatEnabled) return task?.date || dateStr;
  const entry = Object.entries(task.movedOccurrences || {}).find(([, target]) => target === dateStr);
  return entry ? entry[0] : dateStr;
}

function repeatSummary(task) {
  if (!task?.repeatEnabled) return "";
  const days = (task.repeatWeekdays || []).map(weekDayLabel).join(", ");
  const months = (task.repeatMonths || []).map(monthLabel).join(", ");
  const period = `${formatDateBR(task.repeatStartDate || task.date)} até ${formatDateBR(task.repeatEndDate || task.date)}`;
  return `<div><strong>Repete:</strong> ${days || "Todos os dias"}</div><div><strong>Meses:</strong> ${months || "Todos"}</div><div><strong>Período:</strong> ${period}</div>`;
}
function statusLabel(status = "a_fazer") {
  const map = { a_fazer: "A fazer", em_andamento: "Em andamento", revisao: "Revisão", publicado: "Publicado", concluido: "Concluído" };
  return map[status] || status;
}

function boardFilteredTasks() {
  const selectedDate = boardDateFilter?.value || "";
  const includeOverdue = !!boardIncludeOverdue?.checked;
  let list = [...tasksData];

  if (selectedDate) {
    list = list.filter(task => taskOccursOnDate(task, selectedDate));
  }

  if (includeOverdue) {
    const today = todayISO();
    list = list.filter(task => (task.date && task.date < today && task.status !== "concluido") || (!selectedDate || taskOccursOnDate(task, selectedDate)));
  }

  return list;
}

function renderAgendaTeamSummary() {
  if (!agendaTeamSummary) return;
  const ativos = usersData.filter(u => u.active !== false);
  if (!ativos.length) {
    agendaTeamSummary.innerHTML = `<div class="empty-state">Nenhum usuário ativo.</div>`;
    return;
  }

  agendaTeamSummary.innerHTML = ativos.map(user => {
    const userTasks = tasksData.filter(task => task.responsibleId === user.id);
    const aFazer = userTasks.filter(t => t.status === "a_fazer").length;
    const andamento = userTasks.filter(t => t.status === "em_andamento").length;
    const revisao = userTasks.filter(t => t.status === "revisao").length;
    const publicado = userTasks.filter(t => t.status === "publicado").length;
    const concluido = userTasks.filter(t => t.status === "concluido").length;
    return `<div class="team-summary-card"><h4>${escapeHtml(user.name || user.username || user.email || "-")}</h4><div class="muted">${escapeHtml(user.position || user.sector || "-")}</div><div class="team-summary-stats"><span class="pill blue">${userTasks.length} atividade(s)</span><span class="pill ${aFazer ? "yellow" : "blue"}">A fazer: ${aFazer}</span><span class="pill blue">Andamento: ${andamento}</span><span class="pill yellow">Revisão: ${revisao}</span><span class="pill blue">Publicado: ${publicado}</span><span class="pill green">Concluído: ${concluido}</span></div></div>`;
  }).join("");
}
function normalizeUsername(v = "") { return String(v).trim().toLowerCase().replace(/\s+/g, "."); }
function normalizeMusicInput(raw = "") {
  const value = String(raw || "").trim();
  if (!value) return "";

  const iframeMatch = value.match(/src=["']([^"']+)["']/i);
  let url = iframeMatch ? iframeMatch[1] : value;

  if (url.includes("open.spotify.com/playlist/") && !url.includes("/embed/")) {
    url = url.replace("open.spotify.com/playlist/", "open.spotify.com/embed/playlist/");
  }
  if (url.includes("open.spotify.com/album/") && !url.includes("/embed/")) {
    url = url.replace("open.spotify.com/album/", "open.spotify.com/embed/album/");
  }
  if (url.includes("open.spotify.com/track/") && !url.includes("/embed/")) {
    url = url.replace("open.spotify.com/track/", "open.spotify.com/embed/track/");
  }

  return url;
}

let currentUser = null;
let currentProfile = null;
let usersData = [];
let tasksData = [];
let clientsData = [];
let benefitsData = [];
let settingsData = { themeColor: "#8B252C", fontFamily: "Inter, sans-serif" };
let draggedTaskId = null;
let draggedOccurrenceDate = null;
let currentCalendarOccurrence = null;

const loginScreen = byId("login-screen");
const dashboardScreen = byId("dashboard-screen");
if (loginScreen) loginScreen.style.display = "grid";
if (dashboardScreen) dashboardScreen.style.display = "none";
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
const accessList = byId("access-list");
const themeColorInput = byId("theme-color-input");
const fontSelect = byId("font-select");
const saveSettingsBtn = byId("save-settings-btn");
const musicUrlInput = byId("music-url");
const loadMusicBtn = byId("load-music-btn");
const musicFrame = byId("music-frame");
const agendaTeamSummary = byId("agenda-team-summary");
const boardDateFilter = byId("board-date-filter");
const boardIncludeOverdue = byId("board-include-overdue");
const clearBoardFiltersBtn = byId("clear-board-filters-btn");
const calendarTaskModal = byId("calendar-task-modal");
const calendarTaskContent = byId("calendar-task-content");
const calendarTaskEditBtn = byId("calendar-task-edit-btn");
const calendarOccurrenceStatus = byId("calendar-occurrence-status");
const calendarTaskStatusBtn = byId("calendar-task-status-btn");

function isManager() { return currentProfile?.role === "gerencia"; }
function getPerm(key) { return isManager() || currentProfile?.permissions?.[key] === true; }
function closeModal(modal) { modal?.classList.add("hidden"); }
function openModal(modal) { modal?.classList.remove("hidden"); }

function applyRoleVisibility() {
  document.querySelectorAll(".manager-only").forEach(el => {
    if (isManager() || getPerm("canEditAgenda") || getPerm("canEditClientes") || getPerm("canEditBeneficios")) el.classList.remove("is-hidden-by-role");
    else el.classList.add("is-hidden-by-role");
  });
}

function applyTabVisibility() {
  const rules = {
    inicio: getPerm("accessInicio") || isManager(),
    agenda: getPerm("accessAgenda") || isManager(),
    clientes: getPerm("accessClientes") || isManager(),
    beneficios: getPerm("accessBeneficios") || isManager(),
    acessos: getPerm("accessRh") || isManager(),
    music: getPerm("accessMusic") || isManager(),
    ajustes: getPerm("accessAjustes") || isManager()
  };
  menuItems.forEach(item => item.style.display = rules[item.dataset.tab] !== false ? "" : "none");
}

function setActiveTab(tabName) {
  menuItems.forEach(item => item.classList.toggle("active", item.dataset.tab === tabName));
  tabs.forEach(tab => tab.classList.toggle("active", tab.id === `tab-${tabName}`));
  const titles = { inicio: "Tela Inicial", agenda: "Agenda", clientes: "Clientes", beneficios: "Benefícios", acessos: "Gestão de Acessos", music: "Music", ajustes: "Ajustes" };
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
  if (local) { try { settingsData = { ...settingsData, ...JSON.parse(local) }; } catch {} }
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) settingsData = { ...settingsData, ...snap.data() };
  } catch {}
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
  } catch {
    alert("Ajustes salvos localmente.");
  }
}

async function bootstrapUserProfile(user) {
  const blockedRef = doc(db, "blocked_users", user.uid);
  const blockedSnap = await getDoc(blockedRef);
  if (blockedSnap.exists()) {
    throw new Error("Seu acesso foi removido pela gestão.");
  }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    currentProfile = { id: snap.id, ...snap.data() };
    if (currentProfile.active === false) {
      throw new Error("Seu acesso está inativo no sistema.");
    }
    return;
  }

  const email = (user.email || "").toLowerCase();
  const username = normalizeUsername(email.split("@")[0] || "usuario");
  const isGestaoLogin = email === "gestao@ludo.com";

  const profile = {
    uid: user.uid,
    name: username.toUpperCase(),
    username,
    email,
    role: isGestaoLogin ? "gerencia" : "colaborador",
    position: isGestaoLogin ? "Administrador" : "",
    sector: isGestaoLogin ? "Gestão" : "",
    birthday: "",
    photoUrl: "",
    benefits: "",
    active: true,
    permissions: isGestaoLogin ? {
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
    } : {
      accessInicio: true,
      accessAgenda: true,
      accessClientes: false,
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
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(ref, profile, { merge: true });
  currentProfile = { id: user.uid, ...profile };
}

async function loadCurrentProfile(user) {
  await bootstrapUserProfile(user);
  userRoleBadge.textContent = isManager() ? "Gestão Administrador" : "Colaborador";
  currentUserName.textContent = currentProfile.name || "-";
  currentUserLogin.textContent = currentProfile.email || "-";
  welcomeText.textContent = `Bem-vindo, ${currentProfile.name || "usuário"}!`;
  homeHello.textContent = `Olá, ${currentProfile.name || "usuário"}!`;
  applyRoleVisibility();
  applyTabVisibility();
}

function showLoginScreen() {
  if (loginScreen) {
    loginScreen.classList.add("active");
    loginScreen.style.display = "grid";
  }
  if (dashboardScreen) {
    dashboardScreen.classList.remove("active");
    dashboardScreen.style.display = "none";
  }
}

function showDashboardScreen() {
  if (loginScreen) {
    loginScreen.classList.remove("active");
    loginScreen.style.display = "none";
  }
  if (dashboardScreen) {
    dashboardScreen.classList.add("active");
    dashboardScreen.style.display = "grid";
  }
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "";
  const email = trimmedVal("login-email").toLowerCase();
  const password = val("login-password");
  if (!email || !password) { loginMessage.textContent = "Preencha e-mail e senha."; return; }
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch (error) { console.error(error); loginMessage.textContent = "Não foi possível entrar. Verifique e-mail e senha."; }
});

logoutBtn?.addEventListener("click", async () => { await signOut(auth); });

async function loadUsers() {
  try { const snap = await getDocs(query(collection(db, "users"), orderBy("name"))); usersData = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch { usersData = []; }
}
async function loadTasks() {
  try { const snap = await getDocs(query(collection(db, "tasks"), orderBy("date"))); tasksData = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch { tasksData = []; }
}
async function loadClients() {
  try { const snap = await getDocs(query(collection(db, "clients"), orderBy("name"))); clientsData = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch { clientsData = []; }
}
async function loadBenefits() {
  try { const snap = await getDocs(query(collection(db, "benefits"), orderBy("name"))); benefitsData = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch { benefitsData = []; }
}

async function reloadAllData() {
  await Promise.all([loadUsers(), loadTasks(), loadClients(), loadBenefits(), loadSettings()]);
  renderStats();
  renderClients();
  renderBenefits();
  renderAccesses();
  fillTaskSelects();
  renderBoard();
  renderDirection();
  renderCalendar();
  renderAgendaTeamSummary();
  initDragAndDrop();
}

function renderStats() {
  const dayTasks = tasksData.filter(t => taskOccursOnDate(t, todayISO()));
  statAFazer.textContent = dayTasks.filter(t => t.status === "a_fazer").length;
  statAndamento.textContent = dayTasks.filter(t => t.status === "em_andamento").length;
  statConcluidas.textContent = dayTasks.filter(t => t.status === "concluido").length;
}

function fillTaskSelects() {
  taskClientSelect.innerHTML = `<option value="">Selecione</option>` + clientsData.map(c => `<option value="${c.id}">${escapeHtml(c.name || "")}</option>`).join("");
  const ativos = usersData.filter(u => u.active !== false);
  taskResponsibleSelect.innerHTML = `<option value="">Selecione</option>` + ativos.map(u => `<option value="${u.id}">${escapeHtml(u.name || u.username || u.email || "")}</option>`).join("");
}

function taskCardTemplate(task, mode = "board") {
  const canEdit = isManager() || getPerm("canEditAgenda");
  const isExtra = task.extraordinary === true;
  const status = task.status || "a_fazer";

  return `
    <div class="task-card status-${status}" draggable="${canEdit}" data-task-id="${task.id}">
      <div class="task-card-header">
        <div>
          <div class="task-title">${isExtra ? "⚡ " : ""}${escapeHtml(task.title || "")}</div>
          <div class="task-sub">${formatDateBR(task.date)} ${task.time ? "• " + escapeHtml(task.time) : ""}</div>
        </div>
        <button class="btn btn-light" type="button" onclick="window.toggleTaskCard('${task.id}')">Detalhes</button>
      </div>
      <div class="task-actions">
        <span class="task-status-badge status-${status}">${statusLabel(status)}</span>
        ${task.clientName ? `<span class="pill blue">${escapeHtml(task.clientName)}</span>` : ""}
        ${task.responsibleName ? `<span class="pill blue">${escapeHtml(task.responsibleName)}</span>` : ""}
      </div>
      <div class="task-card-body" id="task-body-${task.id}">
        <div class="task-sub">
          ${task.description ? `<div><strong>Descrição:</strong> ${escapeHtml(task.description)}</div>` : ""}
          <div><strong>Prioridade:</strong> ${escapeHtml(task.priority || "-")}</div>
          ${task.theme ? `<div><strong>Tema:</strong> ${escapeHtml(task.theme)}</div>` : ""}
          ${repeatSummary(task)}
        </div>
        ${mode === "board" && canEdit ? `<div class="task-actions"><button class="btn btn-light" onclick="window.editTask('${task.id}')">Editar</button><button class="btn btn-light" onclick="window.advanceTask('${task.id}')">Avançar</button><button class="btn btn-light" onclick="window.deleteTask('${task.id}')">Excluir</button></div>` : ""}
      </div>
    </div>`;
}

function renderBoard() {
  document.querySelectorAll(".task-list").forEach(list => {
    const status = list.dataset.status;
    const filtered = boardFilteredTasks().filter(task => task.status === status);
    list.innerHTML = filtered.length ? filtered.map(task => taskCardTemplate(task, "board")).join("") : `<div class="empty-state">Sem itens</div>`;
  });
}

function renderDirection() {
  const selectedDate = directionDateInput.value || todayISO();
  directionDateInput.value = selectedDate;
  const filtered = tasksData.filter(task => taskOccursOnDate(task, selectedDate)).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  if (!filtered.length) { directionList.className = "list empty-state"; directionList.textContent = "Nenhuma demanda nesta data."; return; }
  directionList.className = "list";
  directionList.innerHTML = filtered.map(task => `<div class="direction-item">${taskCardTemplate(task, "direction")}</div>`).join("");
}

function renderCalendar() {
  const current = calendarMonthInput.value || new Date().toISOString().slice(0, 7);
  calendarMonthInput.value = current;
  const [year, month] = current.split("-").map(Number);
  const total = monthDays(year, month);
  calendarGrid.innerHTML = "";
  for (let day = 1; day <= total; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayTasks = tasksData.filter(task => taskOccursOnDate(task, date));
    const div = document.createElement("div");
    div.className = "calendar-cell droppable-calendar";
    div.dataset.date = date;
    div.innerHTML = `<div class="day-number">${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}</div>${dayTasks.length ? dayTasks.slice(0, 4).map(task => `<div class="calendar-mini clickable status-${getOccurrenceStatus(task, date)}" draggable="${isManager() || getPerm("canEditAgenda")}" data-task-id="${task.id}" data-occurrence-date="${date}" onclick="window.openCalendarTask('${task.id}', '${date}')">${task.extraordinary ? "⚡ " : ""}<strong>${escapeHtml(task.title || "")}</strong><br>${escapeHtml(task.time || "--:--")} • ${statusLabel(getOccurrenceStatus(task, date))}</div>`).join("") : `<div class="empty-state">Sem demanda</div>`}`;
    calendarGrid.appendChild(div);
  }
}

function formatMultilineText(text = "") {
  return escapeHtml(text || "-").split("\n").join("<br>");
}

function paymentPill(status = "pendente") {
  if (status === "pago") return `<span class="pill green">Pago</span>`;
  if (status === "parcial") return `<span class="pill yellow">Pago parcial</span>`;
  return `<span class="pill yellow">Pendente</span>`;
}

function renderClients() {
  if (!clientsData.length) { clientsList.innerHTML = `<div class="empty-state">Nenhum cliente cadastrado.</div>`; return; }
  const canEdit = isManager() || getPerm("canEditClientes");
  clientsList.innerHTML = clientsData.map(client => `<div class="client-card"><div class="card-top-line"><div><h3>${escapeHtml(client.name || "")}</h3><p class="muted">${escapeHtml(client.contractType || "-")} • ${escapeHtml(client.plan || "-")}</p></div>${canEdit ? `<div class="card-actions"><button class="icon-btn" onclick="window.printClient('${client.id}')">🖨</button><button class="icon-btn" onclick="window.editClient('${client.id}')">✎</button><button class="icon-btn danger" onclick="window.deleteClient('${client.id}')">🗑</button></div>` : `<div class="card-actions"><button class="icon-btn" onclick="window.printClient('${client.id}')">🖨</button></div>`}</div><div class="task-actions">${paymentPill(client.paymentStatus || "pendente")}${client.paymentValue ? `<span class="pill blue">${escapeHtml(client.paymentValue)}</span>` : ""}</div><div class="muted multiline-text"><strong>Serviços:</strong><br>${formatMultilineText(client.services || "-")}</div><div class="muted multiline-text"><strong>Observações:</strong><br>${formatMultilineText(client.notes || "-")}</div><div class="muted multiline-text"><strong>Docs:</strong><br>${formatMultilineText(client.docs || "-")}</div></div>`).join("");
}

function renderBenefits() {
  if (!benefitsData.length) { benefitsList.innerHTML = `<div class="empty-state">Nenhum benefício cadastrado.</div>`; return; }
  const canEdit = isManager() || getPerm("canEditBeneficios");
  benefitsList.innerHTML = benefitsData.map(benefit => `<div class="benefit-card"><div class="card-top-line"><div><h3>${escapeHtml(benefit.name || "")}</h3><p class="muted">${escapeHtml(benefit.type || "-")} • ${escapeHtml(benefit.value || "-")}</p></div>${canEdit ? `<div class="card-actions"><button class="icon-btn" onclick="window.editBenefit('${benefit.id}')">✎</button><button class="icon-btn danger" onclick="window.deleteBenefit('${benefit.id}')">🗑</button></div>` : ""}</div><span class="pill ${benefit.status === "ativo" ? "green" : "yellow"}">${escapeHtml(benefit.status || "ativo")}</span><div class="muted">${escapeHtml(benefit.description || "-")}</div></div>`).join("");
}

function renderAccesses() {
  if (!accessList) return;
  if (!usersData.length) { accessList.innerHTML = `<div class="empty-state">Nenhum usuário encontrado. Eles aparecem aqui depois do primeiro login.</div>`; return; }
  if (!(isManager() || getPerm("canEditRh"))) { accessList.innerHTML = `<div class="empty-state">Sem permissão para visualizar esta área.</div>`; return; }
  accessList.innerHTML = usersData.map(user => `<div class="rh-card"><div class="card-top-line"><div><h3>${escapeHtml(user.name || user.username || user.email || "")}</h3><p class="muted">${escapeHtml(user.email || "-")}</p></div><div class="card-actions"><button class="icon-btn" onclick="window.editUserProfile('${user.id}')">✎</button><button class="icon-btn" onclick="window.toggleUserActive('${user.id}')">${user.active === false ? "▶" : "⏸"}</button><button class="icon-btn danger" onclick="window.deleteUserProfile('${user.id}')">🗑</button></div></div><div class="muted"><strong>Perfil:</strong> ${escapeHtml(user.role || "-")}</div><div class="muted"><strong>Cargo:</strong> ${escapeHtml(user.position || "-")}</div><div class="muted"><strong>Setor:</strong> ${escapeHtml(user.sector || "-")}</div><div class="muted"><strong>Status:</strong> ${user.active === false ? "Inativo" : "Ativo"}</div><div class="task-actions">${user.permissions?.canEditAgenda ? `<span class="pill blue">Editor agenda</span>` : ""}${user.permissions?.canEditClientes ? `<span class="pill blue">Editor clientes</span>` : ""}${user.permissions?.canEditBeneficios ? `<span class="pill blue">Editor benefícios</span>` : ""}${user.permissions?.canEditRh ? `<span class="pill blue">Editor acessos</span>` : ""}${user.permissions?.canEditAjustes ? `<span class="pill blue">Editor ajustes</span>` : ""}</div></div>`).join("");
}

function initDragAndDrop() {
  document.querySelectorAll(".task-card[draggable='true']").forEach(card => {
    card.addEventListener("dragstart", () => { draggedTaskId = card.dataset.taskId; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => { draggedTaskId = null; draggedOccurrenceDate = null; card.classList.remove("dragging"); });
  });

  document.querySelectorAll(".calendar-mini[draggable='true']").forEach(card => {
    card.addEventListener("dragstart", (e) => {
      draggedTaskId = card.dataset.taskId;
      draggedOccurrenceDate = card.dataset.occurrenceDate || null;
      card.classList.add("dragging");
      e.stopPropagation();
    });
    card.addEventListener("dragend", () => { draggedTaskId = null; draggedOccurrenceDate = null; card.classList.remove("dragging"); });
  });

  document.querySelectorAll(".droppable").forEach(zone => {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      if (!draggedTaskId || !(isManager() || getPerm("canEditAgenda"))) return;
      try {
        await updateDoc(doc(db, "tasks", draggedTaskId), { status: zone.dataset.status, updatedAt: serverTimestamp() });
        await reloadAllData();
      } catch (err) {
        console.error(err);
        alert("Não foi possível mover o card. Verifique as rules.");
      }
    });
  });

  document.querySelectorAll(".droppable-calendar").forEach(cell => {
    cell.addEventListener("dragover", (e) => { e.preventDefault(); cell.classList.add("drag-over"); });
    cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
    cell.addEventListener("drop", async (e) => {
      e.preventDefault();
      cell.classList.remove("drag-over");
      if (!draggedTaskId || !(isManager() || getPerm("canEditAgenda"))) return;

      const task = tasksData.find(t => t.id === draggedTaskId);
      if (!task) return;
      const newDate = cell.dataset.date;

      try {
        if (task.repeatEnabled && draggedOccurrenceDate) {
          const movedOccurrences = { ...(task.movedOccurrences || {}) };
          movedOccurrences[draggedOccurrenceDate] = newDate;
          await updateDoc(doc(db, "tasks", draggedTaskId), { movedOccurrences, updatedAt: serverTimestamp() });
        } else {
          await updateDoc(doc(db, "tasks", draggedTaskId), { date: newDate, updatedAt: serverTimestamp() });
        }
        await reloadAllData();
      } catch (err) {
        console.error(err);
        alert("Não foi possível mover a atividade para outra data.");
      }
    });
  });
}

function resetTaskForm() { taskForm?.reset(); byId("task-id").value = ""; byId("task-status").value = "a_fazer"; byId("task-priority").value = "media"; byId("task-date").value = todayISO(); byId("task-repeat-enabled").checked = false; byId("task-repeat-start").value = todayISO(); byId("task-repeat-end").value = todayISO(); clearRepeatChecks(); }
function resetClientForm() { clientForm?.reset(); byId("client-id").value = ""; }
function resetBenefitForm() { benefitForm?.reset(); byId("benefit-id").value = ""; byId("benefit-status").value = "ativo"; }

window.editTask = function(id) {
  if (!(isManager() || getPerm("canEditAgenda"))) return;
  const task = tasksData.find(t => t.id === id); if (!task) return;
  byId("task-id").value = task.id; byId("task-title").value = task.title || ""; byId("task-client").value = task.clientId || ""; byId("task-description").value = task.description || ""; byId("task-responsible").value = task.responsibleId || ""; byId("task-status").value = task.status || "a_fazer"; byId("task-priority").value = task.priority || "media"; byId("task-date").value = task.date || ""; byId("task-time").value = task.time || ""; byId("task-theme").value = task.theme || ""; byId("task-repeat-enabled").checked = task.repeatEnabled === true; byId("task-repeat-start").value = task.repeatStartDate || task.date || ""; byId("task-repeat-end").value = task.repeatEndDate || task.date || ""; clearRepeatChecks(); (task.repeatWeekdays || []).forEach(d => { const el = byId(`repeat-day-${d}`); if (el) el.checked = true; }); (task.repeatMonths || []).forEach(m => { const el = byId(`repeat-month-${m}`); if (el) el.checked = true; }); byId("task-extraordinary").checked = task.extraordinary === true; openModal(taskModal);
};
window.editClient = function(id) {
  if (!(isManager() || getPerm("canEditClientes"))) return;
  const client = clientsData.find(c => c.id === id); if (!client) return;
  byId("client-id").value = client.id; byId("client-name").value = client.name || ""; byId("client-contract").value = client.contractType || ""; byId("client-plan").value = client.plan || ""; byId("client-docs").value = client.docs || ""; byId("client-payment-status").value = client.paymentStatus || "pendente"; byId("client-payment-value").value = client.paymentValue || ""; byId("client-services").value = client.services || ""; byId("client-notes").value = client.notes || ""; openModal(clientModal);
};
window.editBenefit = function(id) {
  if (!(isManager() || getPerm("canEditBeneficios"))) return;
  const benefit = benefitsData.find(b => b.id === id); if (!benefit) return;
  byId("benefit-id").value = benefit.id; byId("benefit-name").value = benefit.name || ""; byId("benefit-type").value = benefit.type || ""; byId("benefit-value").value = benefit.value || ""; byId("benefit-status").value = benefit.status || "ativo"; byId("benefit-description").value = benefit.description || ""; openModal(benefitModal);
};
window.editUserProfile = function(id) {
  if (!(isManager() || getPerm("canEditRh"))) return;
  const user = usersData.find(u => u.id === id); if (!user) return;
  byId("user-id").value = user.id; byId("user-name").value = user.name || ""; byId("user-username").value = user.username || ""; byId("user-email").value = user.email || ""; byId("user-role").value = user.role || "colaborador"; byId("user-position").value = user.position || ""; byId("user-sector").value = user.sector || ""; byId("user-birthday").value = user.birthday || ""; byId("user-photo").value = user.photoUrl || ""; byId("user-benefits").value = user.benefits || ""; byId("user-active").checked = user.active !== false;
  const p = user.permissions || {};
  ["accessInicio","accessAgenda","accessClientes","accessBeneficios","accessRh","accessMusic","accessAjustes","canViewDirecao","canEditAgenda","canEditClientes","canEditBeneficios","canEditRh","canEditAjustes"].forEach(k => { const el = byId(`perm-${k}`); if (el) el.checked = !!p[k]; });
  openModal(userModal);
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

async function saveTask(e) {
  e.preventDefault();
  if (!(isManager() || getPerm("canEditAgenda"))) return;
  const responsibleId = val("task-responsible");
  const responsible = usersData.find(u => u.id === responsibleId);
  const clientId = val("task-client");
  const client = clientsData.find(c => c.id === clientId);
  const repeatEnabled = checkedVal("task-repeat-enabled");
  const payload = { title: trimmedVal("task-title"), clientId, clientName: client?.name || "", description: trimmedVal("task-description"), responsibleId, responsibleName: responsible?.name || responsible?.username || "", status: val("task-status"), priority: val("task-priority"), date: val("task-date"), time: val("task-time"), theme: trimmedVal("task-theme"), repeatEnabled, repeatStartDate: repeatEnabled ? (val("task-repeat-start") || val("task-date")) : "", repeatEndDate: repeatEnabled ? (val("task-repeat-end") || val("task-date")) : "", repeatWeekdays: repeatEnabled ? getRepeatDays() : [], repeatMonths: repeatEnabled ? getRepeatMonths() : [], extraordinary: checkedVal("task-extraordinary"), updatedAt: serverTimestamp() };
  if (!payload.title || !payload.date) { alert("Preencha título e data."); return; }
  if (payload.repeatEnabled && payload.repeatEndDate < payload.repeatStartDate) { alert("O período final da repetição não pode ser menor que o inicial."); return; }
  try {
    const id = trimmedVal("task-id");
    if (id) await updateDoc(doc(db, "tasks", id), payload);
    else await addDoc(collection(db, "tasks"), { ...payload, createdAt: serverTimestamp(), createdBy: currentUser.uid });
    closeModal(taskModal); resetTaskForm(); await reloadAllData();
  } catch { alert("Não foi possível salvar a atividade."); }
}

window.advanceTask = async function(id) {
  if (!(isManager() || getPerm("canEditAgenda"))) return;
  const task = tasksData.find(item => item.id === id); if (!task) return;
  const steps = ["a_fazer","em_andamento","revisao","publicado","concluido"];
  const nextStatus = steps[Math.min(steps.indexOf(task.status) + 1, steps.length - 1)];
  try { await updateDoc(doc(db, "tasks", id), { status: nextStatus, updatedAt: serverTimestamp() }); await reloadAllData(); } catch { alert("Não foi possível atualizar o status."); }
};
window.deleteTask = async function(id) { if (!(isManager() || getPerm("canEditAgenda"))) return; if (!confirm("Deseja excluir esta demanda?")) return; try { await deleteDoc(doc(db, "tasks", id)); await reloadAllData(); } catch { alert("Não foi possível excluir."); } };

window.toggleTaskCard = function(id) {
  const card = document.querySelector(`[data-task-id="${id}"]`);
  const body = byId(`task-body-${id}`);
  if (!card || !body) return;
  card.classList.toggle("expanded");
};

window.openCalendarTask = function(id, occurrenceDate = null) {
  const task = tasksData.find(t => t.id === id);
  if (!task || !calendarTaskContent) return;

  const dateRef = occurrenceDate || task.date;
  currentCalendarOccurrence = { taskId: id, date: dateRef };

  calendarTaskContent.innerHTML = `
    <div class="field"><label>Título</label><div>${escapeHtml(task.title || "-")}</div></div>
    <div class="field"><label>Cliente</label><div>${escapeHtml(task.clientName || "-")}</div></div>
    <div class="field"><label>Responsável</label><div>${escapeHtml(task.responsibleName || "-")}</div></div>
    <div class="field"><label>Status atual deste dia</label><div>${statusLabel(getOccurrenceStatus(task, dateRef))}</div></div>
    <div class="field"><label>Data</label><div>${formatDateBR(dateRef)} ${task.time ? "• " + escapeHtml(task.time) : ""}</div></div>
    <div class="field"><label>Descrição</label><div>${escapeHtml(task.description || "-")}</div></div>
    <div class="field"><label>Tema</label><div>${escapeHtml(task.theme || "-")}</div></div>
    ${task.repeatEnabled ? `<div class="field"><label>Repetição</label><div>${repeatSummary(task)}</div></div>` : ""}
  `;

  if (calendarOccurrenceStatus) {
    calendarOccurrenceStatus.value = getOccurrenceStatus(task, dateRef);
  }

  if (calendarTaskEditBtn) {
    calendarTaskEditBtn.onclick = () => {
      closeModal(calendarTaskModal);
      window.editTask(id);
    };
  }

  openModal(calendarTaskModal);
};

async function saveClient(e) {
  e.preventDefault(); if (!(isManager() || getPerm("canEditClientes"))) return;
  const payload = { name: trimmedVal("client-name"), contractType: trimmedVal("client-contract"), plan: trimmedVal("client-plan"), docs: trimmedVal("client-docs"), paymentStatus: val("client-payment-status"), paymentValue: trimmedVal("client-payment-value"), services: trimmedVal("client-services"), notes: trimmedVal("client-notes"), updatedAt: serverTimestamp() };
  if (!payload.name) { alert("Informe o nome do cliente."); return; }
  try { const id = trimmedVal("client-id"); if (id) await updateDoc(doc(db, "clients", id), payload); else await addDoc(collection(db, "clients"), { ...payload, createdAt: serverTimestamp() }); closeModal(clientModal); resetClientForm(); await reloadAllData(); } catch { alert("Não foi possível salvar o cliente."); }
}
window.deleteClient = async function(id) { if (!(isManager() || getPerm("canEditClientes"))) return; if (!confirm("Deseja excluir este cliente?")) return; try { await deleteDoc(doc(db, "clients", id)); await reloadAllData(); } catch { alert("Não foi possível excluir o cliente."); } };

window.printClient = function(id) {
  const client = clientsData.find(c => c.id === id);
  if (!client) return;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const html = `
    <html>
      <head>
        <title>Cliente - ${escapeHtml(client.name || "")}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #1f2937; }
          h1 { margin-bottom: 8px; }
          .muted { color: #6b7280; margin-bottom: 20px; }
          .box { border: 1px solid #d8e0eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
          .label { font-weight: bold; margin-bottom: 8px; }
          .multiline { white-space: pre-line; line-height: 1.6; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(client.name || "-")}</h1>
        <div class="muted">${escapeHtml(client.contractType || "-")} • ${escapeHtml(client.plan || "-")}</div>
        <div class="box"><div class="label">Status de pagamento</div><div>${escapeHtml(client.paymentStatus || "pendente")}</div></div>
        <div class="box"><div class="label">Valor</div><div>${escapeHtml(client.paymentValue || "-")}</div></div>
        <div class="box"><div class="label">Serviços</div><div class="multiline">${escapeHtml(client.services || "-")}</div></div>
        <div class="box"><div class="label">Observações</div><div class="multiline">${escapeHtml(client.notes || "-")}</div></div>
        <div class="box"><div class="label">Docs</div><div class="multiline">${escapeHtml(client.docs || "-")}</div></div>
        <script>window.onload = () => window.print();<\/script>
      </body>
    </html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
};

async function saveBenefit(e) {
  e.preventDefault(); if (!(isManager() || getPerm("canEditBeneficios"))) return;
  const payload = { name: trimmedVal("benefit-name"), type: trimmedVal("benefit-type"), value: trimmedVal("benefit-value"), status: val("benefit-status"), description: trimmedVal("benefit-description"), updatedAt: serverTimestamp() };
  if (!payload.name) { alert("Informe o nome do benefício."); return; }
  try { const id = trimmedVal("benefit-id"); if (id) await updateDoc(doc(db, "benefits", id), payload); else await addDoc(collection(db, "benefits"), { ...payload, createdAt: serverTimestamp() }); closeModal(benefitModal); resetBenefitForm(); await reloadAllData(); } catch { alert("Não foi possível salvar o benefício."); }
}
window.deleteBenefit = async function(id) { if (!(isManager() || getPerm("canEditBeneficios"))) return; if (!confirm("Deseja excluir este benefício?")) return; try { await deleteDoc(doc(db, "benefits", id)); await reloadAllData(); } catch { alert("Não foi possível excluir o benefício."); } };

async function saveUserProfile(e) {
  e.preventDefault();
  if (!(isManager() || getPerm("canEditRh"))) return;
  const id = trimmedVal("user-id");
  if (!id) return;
  const existing = usersData.find(u => u.id === id) || {};
  const payload = {
    uid: id,
    name: trimmedVal("user-name"),
    username: normalizeUsername(trimmedVal("user-username") || existing.username || existing.email?.split("@")[0] || "usuario"),
    email: trimmedVal("user-email") || existing.email || "",
    role: val("user-role") || "colaborador",
    position: trimmedVal("user-position"),
    sector: trimmedVal("user-sector"),
    birthday: val("user-birthday"),
    photoUrl: trimmedVal("user-photo"),
    benefits: trimmedVal("user-benefits"),
    active: checkedVal("user-active"),
    permissions: collectPermissions(),
    updatedAt: serverTimestamp(),
    createdAt: existing.createdAt || serverTimestamp()
  };
  try { await setDoc(doc(db, "users", id), payload, { merge: true }); closeModal(userModal); await reloadAllData(); alert("Usuário atualizado com sucesso."); } catch (err) { console.error(err); alert("Não foi possível salvar o usuário. Verifique as rules."); }
}

window.toggleUserActive = async function(id) {
  if (!(isManager() || getPerm("canEditRh"))) return;
  const user = usersData.find(u => u.id === id); if (!user) return;
  try { await updateDoc(doc(db, "users", id), { active: !(user.active !== false), updatedAt: serverTimestamp() }); await reloadAllData(); } catch { alert("Não foi possível alterar o status."); }
};

window.deleteUserProfile = async function(id) {
  if (!(isManager() || getPerm("canEditRh"))) return;
  const user = usersData.find(u => u.id === id);
  if (!user) return;
  if (!confirm(`Deseja remover o acesso de ${user.name || user.email || 'este usuário'}?`)) return;

  try {
    await setDoc(doc(db, "blocked_users", id), {
      uid: id,
      email: user.email || "",
      username: user.username || "",
      name: user.name || "",
      removedAt: serverTimestamp(),
      removedBy: currentUser?.uid || ""
    }, { merge: true });

    await deleteDoc(doc(db, "users", id));

    if (currentUser?.uid === id) {
      await signOut(auth);
      return;
    }

    await reloadAllData();
    alert("Acesso removido do painel. Se quiser impedir o login também no Firebase, exclua o usuário no Authentication.");
  } catch (err) {
    console.error(err);
    alert("Não foi possível remover o acesso.");
  }
};

menuItems.forEach(item => item.addEventListener("click", () => setActiveTab(item.dataset.tab)));
agendaViewSelect?.addEventListener("change", () => {
  const value = agendaViewSelect.value;
  agendaBoardView?.classList.toggle("active", value === "board");
  agendaCalendarView?.classList.toggle("active", value === "calendar");
  agendaDirecaoView?.classList.toggle("active", value === "direcao");
});
document.querySelectorAll("[data-close-modal]").forEach(btn => btn.addEventListener("click", () => closeModal(byId(btn.getAttribute("data-close-modal")))));
openTaskModalBtn?.addEventListener("click", () => { resetTaskForm(); openModal(taskModal); });
openClientModalBtn?.addEventListener("click", () => { resetClientForm(); openModal(clientModal); });
openBenefitModalBtn?.addEventListener("click", () => { resetBenefitForm(); openModal(benefitModal); });

taskForm?.addEventListener("submit", saveTask);
clientForm?.addEventListener("submit", saveClient);
benefitForm?.addEventListener("submit", saveBenefit);
userForm?.addEventListener("submit", saveUserProfile);
saveSettingsBtn?.addEventListener("click", saveSettings);
directionDateInput?.addEventListener("change", renderDirection);
calendarMonthInput?.addEventListener("change", renderCalendar);
loadMusicBtn?.addEventListener("click", () => { const url = normalizeMusicInput(trimmedVal("music-url")); if (!url || !musicFrame) { alert("Cole um link ou iframe válido."); return; } musicFrame.src = url; });
boardDateFilter?.addEventListener("change", renderBoard);
boardIncludeOverdue?.addEventListener("change", renderBoard);
clearBoardFiltersBtn?.addEventListener("click", () => { if (boardDateFilter) boardDateFilter.value = ""; if (boardIncludeOverdue) boardIncludeOverdue.checked = false; renderBoard(); });
calendarTaskStatusBtn?.addEventListener("click", async () => {
  if (!currentCalendarOccurrence || !(isManager() || getPerm("canEditAgenda"))) return;
  const task = tasksData.find(t => t.id === currentCalendarOccurrence.taskId);
  if (!task) return;
  const newStatus = calendarOccurrenceStatus?.value || task.status || "a_fazer";

  try {
    if (task.repeatEnabled) {
      const occurrenceOverrides = { ...(task.occurrenceOverrides || {}) };
      occurrenceOverrides[currentCalendarOccurrence.date] = {
        ...(occurrenceOverrides[currentCalendarOccurrence.date] || {}),
        status: newStatus
      };
      await updateDoc(doc(db, "tasks", task.id), { occurrenceOverrides, updatedAt: serverTimestamp() });
    } else {
      await updateDoc(doc(db, "tasks", task.id), { status: newStatus, updatedAt: serverTimestamp() });
    }
    closeModal(calendarTaskModal);
    await reloadAllData();
  } catch (err) {
    console.error(err);
    alert("Não foi possível atualizar o status deste dia.");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { currentUser = null; currentProfile = null; showLoginScreen(); return; }
  currentUser = user;
  try {
    await loadCurrentProfile(user);
    await reloadAllData();
    if (!directionDateInput.value) directionDateInput.value = todayISO();
    if (!calendarMonthInput.value) calendarMonthInput.value = new Date().toISOString().slice(0, 7);
    renderDirection(); renderCalendar(); setActiveTab("inicio"); showDashboardScreen();
  } catch (e) { console.error(e); alert(e.message || "Erro ao carregar o sistema."); await signOut(auth); }
});
