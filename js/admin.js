let ME = null;
let SUPERVISORS = [];
let DIRECTORY = [];
let BALANCES_BY_ID = {};
let ACTIVE_TAB = "all"; // "all" | "supervisors"
const COMPANY_FILTER = new URLSearchParams(window.location.search).get("company");

const PAGE_SIZE = 10;
let DIRECTORY_PAGE = 0;
let LEAVE_REQUESTS_PAGE = 0;
let CONTRACTS_PAGE = 0;
let WARNINGS_PAGE = 0;

function updatePaginationControls(prefix, page, totalCount) {
  const wrap = document.getElementById(`${prefix}Pagination`);
  const info = document.getElementById(`${prefix}PageInfo`);
  const prevBtn = document.getElementById(`${prefix}PrevBtn`);
  const nextBtn = document.getElementById(`${prefix}NextBtn`);
  if (!wrap) return;

  if (totalCount <= PAGE_SIZE) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "flex";
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalCount);
  info.textContent = tv("showingRangeLabel", { start, end, total: totalCount });
  prevBtn.disabled = page === 0;
  nextBtn.disabled = end >= totalCount;
}

document.getElementById("directoryPrevBtn").addEventListener("click", () => { if (DIRECTORY_PAGE > 0) { DIRECTORY_PAGE--; renderDirectory(); } });
document.getElementById("directoryNextBtn").addEventListener("click", () => { DIRECTORY_PAGE++; renderDirectory(); });
document.getElementById("leaveRequestsPrevBtn").addEventListener("click", () => { if (LEAVE_REQUESTS_PAGE > 0) { LEAVE_REQUESTS_PAGE--; renderLeaveRequests(); } });
document.getElementById("leaveRequestsNextBtn").addEventListener("click", () => { LEAVE_REQUESTS_PAGE++; renderLeaveRequests(); });
document.getElementById("contractsPrevBtn").addEventListener("click", () => { if (CONTRACTS_PAGE > 0) { CONTRACTS_PAGE--; renderContracts(); } });
document.getElementById("contractsNextBtn").addEventListener("click", () => { CONTRACTS_PAGE++; renderContracts(); });
document.getElementById("warningsPrevBtn").addEventListener("click", () => { if (WARNINGS_PAGE > 0) { WARNINGS_PAGE--; renderWarnings(); } });
document.getElementById("warningsNextBtn").addEventListener("click", () => { WARNINGS_PAGE++; renderWarnings(); });

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- Custom confirm/info modal (replaces browser confirm()/alert()) ----------
function showInfo(title, messageHTML) {
  return new Promise((resolve) => {
    document.getElementById("actionTitle").textContent = title;
    document.getElementById("actionMessage").innerHTML = messageHTML;
    const btns = document.getElementById("actionButtons");
    btns.innerHTML = "";
    const ok = document.createElement("button");
    ok.className = "btn btn-primary btn-sm";
    ok.textContent = t("okBtn");
    ok.onclick = () => { document.getElementById("actionOverlay").style.display = "none"; resolve(); };
    btns.appendChild(ok);
    document.getElementById("actionOverlay").style.display = "flex";
  });
}

function showConfirm(title, message, confirmLabel = t("confirmBtn"), danger = false) {
  return new Promise((resolve) => {
    document.getElementById("actionTitle").textContent = title;
    document.getElementById("actionMessage").textContent = message;
    const btns = document.getElementById("actionButtons");
    btns.innerHTML = "";
    const cancel = document.createElement("button");
    cancel.className = "btn btn-danger btn-sm";
    cancel.textContent = t("cancel");
    cancel.onclick = () => { document.getElementById("actionOverlay").style.display = "none"; resolve(false); };
    const ok = document.createElement("button");
    ok.className = danger ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm";
    ok.textContent = confirmLabel;
    ok.onclick = () => { document.getElementById("actionOverlay").style.display = "none"; resolve(true); };
    btns.appendChild(cancel);
    btns.appendChild(ok);
    document.getElementById("actionOverlay").style.display = "flex";
  });
}

// ---------- Tabs ----------
function applyTab(tab) {
  ACTIVE_TAB = tab;
  document.getElementById("tabAllBtn").classList.toggle("active", tab === "all");
  document.getElementById("tabSupervisorsBtn").classList.toggle("active", tab === "supervisors");
  document.getElementById("tabLeaveBtn").classList.toggle("active", tab === "leave");
  document.getElementById("tabContractsBtn").classList.toggle("active", tab === "contracts");
  document.getElementById("tabWarningsBtn").classList.toggle("active", tab === "warnings");

  const isLeave = tab === "leave";
  const isContracts = tab === "contracts";
  const isWarnings = tab === "warnings";
  document.getElementById("directoryPanel").style.display = (isLeave || isContracts || isWarnings) ? "none" : "";
  document.getElementById("addPanel").style.display = "none";
  document.getElementById("leavePanel").style.display = isLeave ? "" : "none";
  document.getElementById("contractsPanel").style.display = isContracts ? "" : "none";
  document.getElementById("warningsPanel").style.display = isWarnings ? "" : "none";

  if (isLeave) {
    loadLeaveRequests();
    return;
  }
  if (isContracts) {
    loadContracts();
    return;
  }
  if (isWarnings) {
    loadWarnings();
    return;
  }

  document.getElementById("tableTitle").textContent = tab === "supervisors" ? t("tabSupervisors") : t("tabEmployees");
  document.getElementById("showAddFormBtn").textContent = tab === "supervisors" ? t("addNewSupervisorBtn") : t("addNewEmployeeBtn");
  document.getElementById("addPanelTitle").textContent = tab === "supervisors" ? t("newSupervisorDetailsTitle") : t("newEmployeeDetailsTitle");
  document.getElementById("hiringDateRow").style.display = tab === "supervisors" ? "none" : "";
  document.getElementById("entitlementRow").style.display = tab === "supervisors" ? "none" : "";
  if (tab === "supervisors") document.getElementById("takenThisYearRow").style.display = "none";
  DIRECTORY_PAGE = 0;
  renderDirectory();
}
document.getElementById("tabAllBtn").addEventListener("click", () => applyTab("all"));
document.getElementById("tabSupervisorsBtn").addEventListener("click", () => applyTab("supervisors"));
document.getElementById("tabContractsBtn").addEventListener("click", () => applyTab("contracts"));
document.getElementById("tabWarningsBtn").addEventListener("click", () => applyTab("warnings"));
document.getElementById("tabLeaveBtn").addEventListener("click", () => applyTab("leave"));

function roleLabel(role) {
  if (role === "supervisor") return t("roleSupervisor");
  if (role === "staff") return t("roleStaff");
  return role;
}

function badgeFor(status) {
  const key = "status" + status[0].toUpperCase() + status.slice(1);
  return `<span class="badge badge-${status}">${t(key)}</span>`;
}

let LEAVE_REQUESTS_LIST = [];

async function loadLeaveRequests() {
  const { data, error } = await db
    .from("leave_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error || !data) {
    LEAVE_REQUESTS_LIST = [];
    LEAVE_REQUESTS_PAGE = 0;
    renderLeaveRequests();
    return;
  }

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  let rows = data;
  if (COMPANY_FILTER) {
    rows = rows.filter(r => byId[r.employee_id] && byId[r.employee_id].client_company === COMPANY_FILTER);
  }
  LEAVE_REQUESTS_LIST = rows;
  LEAVE_REQUESTS_PAGE = 0;
  renderLeaveRequests();
}

function renderLeaveRequests() {
  const body = document.getElementById("leaveRequestsBody");
  const empty = document.getElementById("noLeaveRequests");
  body.innerHTML = "";

  if (LEAVE_REQUESTS_LIST.length === 0) {
    empty.style.display = "block";
    updatePaginationControls("leaveRequests", 0, 0);
    return;
  }
  empty.style.display = "none";

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const start = LEAVE_REQUESTS_PAGE * PAGE_SIZE;
  const rows = LEAVE_REQUESTS_LIST.slice(start, start + PAGE_SIZE);

  for (const r of rows) {
    const emp = byId[r.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${emp ? (emp.client_company || "—") : "—"}</td>
      <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
      <td>${r.days_requested}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${r.reason ? r.reason : "—"}</td>
      <td>${r.document_path ? `<button type="button" class="btn btn-blue btn-sm" data-doc="${r.document_path}">${t("view")}</button>` : "—"}</td>
      <td>${badgeFor(r.status)}</td>
    `;
    body.appendChild(tr);
  }

  updatePaginationControls("leaveRequests", LEAVE_REQUESTS_PAGE, LEAVE_REQUESTS_LIST.length);

  body.querySelectorAll("button[data-doc]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data, error } = await db.storage.from("leave-documents").createSignedUrl(btn.dataset.doc, 60);
      if (error || !data) { showToast(t("couldNotOpenDoc")); return; }
      window.open(data.signedUrl, "_blank");
    });
  });
}

function computeAnnualEntitlementClientSide(hiringDateStr) {
  if (!hiringDateStr) return 14;
  const hire = new Date(hiringDateStr);
  const years = (Date.now() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return years >= 5 ? 21 : 14;
}
function toggleTakenThisYearField() {
  const carryover = Number(document.getElementById("carryoverBalance").value) || 0;
  const row = document.getElementById("takenThisYearRow");
  row.style.display = carryover === 0 ? "" : "none";
  if (carryover > 0) document.getElementById("takenThisYear").value = 0;
}
document.getElementById("carryoverBalance").addEventListener("input", toggleTakenThisYearField);

document.getElementById("hiringDate").addEventListener("change", (e) => {
  document.getElementById("annualEntitlement").value = computeAnnualEntitlementClientSide(e.target.value);
});

function toggleSupervisorField() {
  const role = document.getElementById("role").value;
  document.getElementById("supervisorField").style.display = (role === "staff") ? "" : "none";
}
document.getElementById("role").addEventListener("change", toggleSupervisorField);

document.getElementById("showAddFormBtn").addEventListener("click", () => {
  document.getElementById("addPanel").style.display = "";
  const roleSelect = document.getElementById("role");
  const companySelect = document.getElementById("clientCompany");
  if (COMPANY_FILTER) {
    companySelect.value = COMPANY_FILTER;
    companySelect.disabled = true;
  } else {
    companySelect.value = "";
    companySelect.disabled = false;
  }
  if (ACTIVE_TAB === "supervisors") {
    roleSelect.value = "supervisor";
    document.getElementById("roleField").style.display = "none";
  } else {
    roleSelect.value = "staff";
    document.getElementById("roleField").style.display = "";
  }
  toggleSupervisorField();
  populateSupervisorOptions();
  populateDepartmentOptions(document.getElementById("department"), companySelect.value, null);
  document.getElementById("annualEntitlement").value = computeAnnualEntitlementClientSide(document.getElementById("hiringDate").value);
  document.getElementById("carryoverBalance").value = 0;
  document.getElementById("takenThisYear").value = 0;
  document.getElementById("hiringDateRow").style.display = ACTIVE_TAB === "supervisors" ? "none" : "";
  document.getElementById("entitlementRow").style.display = ACTIVE_TAB === "supervisors" ? "none" : "";
  if (ACTIVE_TAB === "supervisors") {
    document.getElementById("takenThisYearRow").style.display = "none";
  } else {
    toggleTakenThisYearField();
  }
  document.getElementById("addPanel").scrollIntoView({ behavior: "smooth" });
});
document.getElementById("cancelAddBtn").addEventListener("click", () => {
  document.getElementById("addPanel").style.display = "none";
  document.getElementById("addForm").reset();
  document.getElementById("credentialsBox").classList.remove("show");
});
document.getElementById("closeDetailsBtn").addEventListener("click", () => {
  document.getElementById("detailsOverlay").style.display = "none";
});

// ---------- Data loading ----------
async function loadCompanyOptions() {
  const { data, error } = await db.from("client_companies").select("name").order("name");
  const select = document.getElementById("clientCompany");
  const current = select.value;
  select.innerHTML = `<option value="">${t("selectCompanyPlaceholder")}</option>`;
  if (error || !data) return;
  for (const c of data) {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
  if (current) select.value = current;
}

async function loadSupervisors() {
  const { data, error } = await db
    .from("employees")
    .select("id, file_number, full_name, role, client_company")
    .in("role", ["supervisor", "admin"])
    .order("full_name");

  if (error || !data) return;
  SUPERVISORS = data;
  populateSupervisorOptions();
}

function populateSupervisorOptions() {
  const companyFilter = document.getElementById("clientCompany").value;
  const select = document.getElementById("supervisor");

  if (!companyFilter) {
    select.innerHTML = `<option value="">${t("selectCompanyFirstPlaceholder")}</option>`;
    return;
  }

  const matches = SUPERVISORS.filter(s => s.client_company === companyFilter);
  select.innerHTML = matches.length
    ? `<option value="">${t("selectSupervisorPlaceholder")}</option>`
    : `<option value="">${t("noSupervisorsYetPlaceholder")}</option>`;
  for (const s of matches) {
    const opt = document.createElement("option");
    opt.value = s.file_number;
    opt.textContent = `${s.full_name} (#${s.file_number})`;
    select.appendChild(opt);
  }
}
const DEPARTMENTS_BY_COMPANY = {
  "Umniah": ["Battery Rescue Power Planning", "Transmission & OMC", "Network Maintenance", "Network- Power & Energy Planning", "RA Network", "Transport Planning", "Transmission", "Rent Site", "Civil", "TDD Visit", "Wherhouse", "Tele Sales", "Direct Sales", "Preventive Maintenance", "N.W Rollout Acceptance", "Network Planning & Maintenance", "Drive Test", "MDS", "Selection", "Quality", "Data Centre", "Office"],
  "Zain": ["Fiber acceptance", "Fiber Support", "FiberTech", "Power", "Bunker", "Tele Sales", "Direct Sales", "Shop Maintenance", "IBS", "TXM", "Network Maintenance", "Preventive Maintenance", "Data Centre", "Office"],
  "Fiber-Tech": ["Field", "Rollout and Acceptance", "Fiber"],
};
const DEFAULT_DEPARTMENTS = ["Technical", "Sales", "Marketing", "HR", "Finance", "IT", "Administration"];

function populateDepartmentOptions(selectEl, companyName, selectedValue) {
  const list = DEPARTMENTS_BY_COMPANY[companyName] || DEFAULT_DEPARTMENTS;
  const current = selectedValue !== undefined ? selectedValue : selectEl.value;
  selectEl.innerHTML = list.map(d => `<option value="${d}">${d}</option>`).join("");
  if (current && list.includes(current)) selectEl.value = current;
}

document.getElementById("clientCompany").addEventListener("change", populateSupervisorOptions);
document.getElementById("clientCompany").addEventListener("change", () => {
  populateDepartmentOptions(document.getElementById("department"), document.getElementById("clientCompany").value, null);
});

async function loadBalances() {
  const { data, error } = await db.from("leave_balances").select("*");
  if (error || !data) return;
  BALANCES_BY_ID = Object.fromEntries(data.map(b => [b.employee_id, b]));
}

async function loadDirectory() {
  const { data, error } = await db
    .from("employees")
    .select("*")
    .order("full_name");
  if (error || !data) return;
  DIRECTORY = data;
  renderDirectory();
}

function renderDirectory() {
  const body = document.getElementById("directoryBody");
  body.innerHTML = "";

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  let allRows = ACTIVE_TAB === "supervisors"
    ? DIRECTORY.filter(e => e.role === "supervisor")
    : DIRECTORY.filter(e => e.role !== "admin");
  if (COMPANY_FILTER) allRows = allRows.filter(e => e.client_company === COMPANY_FILTER);

  const start = DIRECTORY_PAGE * PAGE_SIZE;
  const rows = allRows.slice(start, start + PAGE_SIZE);

  for (const e of rows) {
    const supervisorName = e.supervisor_id && byId[e.supervisor_id] ? byId[e.supervisor_id].full_name : "—";
    const isSelf = e.id === ME.id;
    const bal = BALANCES_BY_ID[e.id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.full_name}${e.frozen ? ` <span class="badge badge-rejected">${t("statusFrozenBadge")} - ${e.frozen_reason === "termination" ? "T" : e.frozen_reason === "resignation" ? "R" : e.frozen_reason === "end_of_contract" ? "E" : "?"}</span>` : ""}</td>
      <td>${e.file_number}</td>
      <td>${roleLabel(e.role)}</td>
      <td>${e.client_company || "—"}</td>
      <td>${e.department || "—"}</td>
      <td>${supervisorName}</td>
      <td style="white-space:nowrap">${e.frozen ? fmtDate(e.frozen_at ? e.frozen_at.slice(0,10) : null) : "—"}</td>
      <td>${e.role === "supervisor" ? "—" : (e.carryover_balance !== null && e.carryover_balance !== undefined ? e.carryover_balance : 0)}</td>
      <td>${e.role === "supervisor" ? "—" : (bal ? bal.annual_entitlement : "—")}</td>
      <td>${e.role === "supervisor" ? "—" : (bal ? bal.taken : "—")}</td>
      <td>${e.role === "supervisor" ? "—" : (bal ? bal.remaining : "—")}</td>
      <td>${e.role === "supervisor" ? "—" : (bal ? bal.sick_entitlement : "—")}</td>
      <td>${e.role === "supervisor" ? "—" : (bal ? bal.sick_taken : "—")}</td>
      <td>${e.role === "supervisor" ? "—" : (bal ? bal.sick_remaining : "—")}</td>
      <td class="row-actions">
        <div class="action-menu-wrap">
          <button type="button" class="btn btn-blue btn-sm" data-action-toggle="${e.id}">${t("actionsBtn")} ▾</button>
          <div class="action-menu" id="actionMenu-${e.id}">
            <button type="button" data-view="${e.id}">${t("view")}</button>
            <button type="button" data-edit="${e.id}">${t("editBtn")}</button>
            ${e.role === "staff" ? `<button type="button" data-contract="${e.id}">${t("shareContractBtn")}</button>` : ""}
            ${e.role === "staff" ? `<button type="button" class="danger" data-warning="${e.id}">${t("giveWarningBtn")}</button>` : ""}
            <button type="button" data-reset="${e.id}">${t("resetPasswordBtn")}</button>
            ${!isSelf ? (e.frozen
              ? `<button type="button" data-unfreeze="${e.id}">${t("unfreezeBtn")}</button>`
              : `<button type="button" data-freeze="${e.id}">${t("freezeBtn")}</button>`) : ""}
            ${!isSelf ? `<button type="button" class="danger" data-delete="${e.id}">${t("deleteBtn")}</button>` : ""}
          </div>
        </div>
      </td>
    `;
    body.appendChild(tr);
  }

  updatePaginationControls("directory", DIRECTORY_PAGE, allRows.length);

  body.querySelectorAll("button[data-action-toggle]").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const menu = document.getElementById(`actionMenu-${btn.dataset.actionToggle}`);
      const wasOpen = menu.classList.contains("open");
      document.querySelectorAll(".action-menu.open").forEach(m => m.classList.remove("open"));
      if (wasOpen) return;

      const rect = btn.getBoundingClientRect();
      const menuWidth = Math.max(190, rect.width);
      menu.style.minWidth = `${menuWidth}px`;
      menu.classList.add("open");

      // Measure after making visible so offsetHeight is accurate.
      const menuHeight = menu.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow;

      let top = openUpward ? rect.top - menuHeight - 6 : rect.bottom + 6;
      // Always clamp fully inside the viewport, even if neither side has
      // perfect room — this guarantees the menu is never cut off.
      if (top + menuHeight > window.innerHeight - 8) top = window.innerHeight - menuHeight - 8;
      if (top < 8) top = 8;
      menu.style.bottom = "auto";
      menu.style.top = `${top}px`;

      // Keep it on-screen horizontally: align to the button's right edge by
      // default (matches LTR reading), but flip to the left edge if that
      // would push the menu off the right side of the viewport.
      let left = document.documentElement.dir === "rtl" ? rect.left : rect.right - menuWidth;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      if (left < 8) left = 8;
      menu.style.left = `${left}px`;
    });
  });

  body.querySelectorAll("button[data-view]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); showDetails(btn.dataset.view); });
  });
  body.querySelectorAll("button[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); openEditModal(btn.dataset.edit); });
  });
  body.querySelectorAll("button[data-contract]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); openContractCreateModal(btn.dataset.contract); });
  });
  body.querySelectorAll("button[data-warning]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); openWarningCreateModal(btn.dataset.warning); });
  });
  body.querySelectorAll("button[data-reset]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); resetPassword(btn.dataset.reset, byId[btn.dataset.reset]); });
  });
  body.querySelectorAll("button[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); deleteEmployee(btn.dataset.delete, byId[btn.dataset.delete]); });
  });
  body.querySelectorAll("button[data-freeze]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); freezeEmployee(btn.dataset.freeze, byId[btn.dataset.freeze]); });
  });
  body.querySelectorAll("button[data-unfreeze]").forEach(btn => {
    btn.addEventListener("click", () => { closeActionMenus(); unfreezeEmployee(btn.dataset.unfreeze, byId[btn.dataset.unfreeze]); });
  });
}

function openContractCreateModal(employeeId) {
  const e = DIRECTORY.find(x => x.id === employeeId);
  if (!e) return;
  document.getElementById("contractCreateForm").reset();
  document.getElementById("contractCreateError").classList.remove("show");
  document.getElementById("contractCreateForm").dataset.targetId = employeeId;
  document.getElementById("contractCreateOverlay").style.display = "flex";
}
document.getElementById("contractCreateCancelBtn").addEventListener("click", () => {
  document.getElementById("contractCreateOverlay").style.display = "none";
});

document.getElementById("contractCreateForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const errBox = document.getElementById("contractCreateError");
  errBox.classList.remove("show");

  const target_id = document.getElementById("contractCreateForm").dataset.targetId;
  const dob = document.getElementById("contractDob").value || null;
  const education = document.getElementById("contractEducation").value.trim() || null;
  const address = document.getElementById("contractAddress").value.trim() || null;
  const salary = document.getElementById("contractSalary").value;
  const job_title = document.getElementById("contractJobTitle").value.trim();
  const start_date = document.getElementById("contractStartDate").value;
  const contract_period_months = document.getElementById("contractPeriodMonths").value;

  const btn = document.getElementById("contractCreateBtn");
  setBtnLoading(btn, true, t("preparing"));

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "create_contract", target_id, dob, education, address, salary, job_title, start_date, contract_period_months, lang: getLang() }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongCreatingContract");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("contractCreateOverlay").style.display = "none";
  showToast(t("contractPreparedToast"));
  if (ACTIVE_TAB === "contracts") await loadContracts();
  openContractViewModal(data.contract.id, data.contract);
});

function warningStatusBadge(status) {
  const cls = { draft: "cancelled", sent: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("warningStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

function openWarningCreateModal(employeeId) {
  const e = DIRECTORY.find(x => x.id === employeeId);
  if (!e) return;
  document.getElementById("warningCreateForm").reset();
  document.getElementById("warningCreateError").classList.remove("show");
  document.getElementById("warningCreateForm").dataset.targetId = employeeId;
  document.getElementById("warningCreateOverlay").style.display = "flex";
}
document.getElementById("warningCreateCancelBtn").addEventListener("click", () => {
  document.getElementById("warningCreateOverlay").style.display = "none";
});

document.getElementById("warningCreateForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const errBox = document.getElementById("warningCreateError");
  errBox.classList.remove("show");

  const target_id = document.getElementById("warningCreateForm").dataset.targetId;
  const reason = document.getElementById("warningReason").value.trim();
  if (!reason) {
    errBox.textContent = t("pleaseEnterWarningReason");
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("warningCreateBtn");
  setBtnLoading(btn, true, t("preparing"));

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "create_warning", target_id, reason, lang: getLang() }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongCreatingWarning");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("warningCreateOverlay").style.display = "none";
  showToast(t("warningPreparedToast"));
  if (ACTIVE_TAB === "warnings") await loadWarnings();
  openWarningViewModal(data.warning.id, data.warning);
});

let WARNINGS_LIST = [];

async function loadWarnings() {
  const { data, error } = await db.from("warnings").select("*").order("created_at", { ascending: false });
  if (error || !data) {
    WARNINGS_LIST = [];
    WARNINGS_PAGE = 0;
    renderWarnings();
    return;
  }
  WARNINGS_LIST = data;
  WARNINGS_PAGE = 0;
  renderWarnings();
}

function renderWarnings() {
  const body = document.getElementById("warningsBody");
  const empty = document.getElementById("noWarnings");
  body.innerHTML = "";
  empty.style.display = WARNINGS_LIST.length ? "none" : "block";

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const start = WARNINGS_PAGE * PAGE_SIZE;
  const pageItems = WARNINGS_LIST.slice(start, start + PAGE_SIZE);
  for (const w of pageItems) {
    const emp = byId[w.employee_id];
    const warningName = emp ? `${emp.file_number} - ${emp.full_name}` : w.id;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${warningName}</td>
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>${warningStatusBadge(w.status)}</td>
      <td>${fmtDate(w.created_at ? w.created_at.slice(0,10) : null)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-warning="${w.id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("warnings", WARNINGS_PAGE, WARNINGS_LIST.length);
  body.querySelectorAll("button[data-view-warning]").forEach(btn => {
    btn.addEventListener("click", () => openWarningViewModal(btn.dataset.viewWarning));
  });
}

let WARNING_ALT_TEXT = "";
let WARNING_LANG = "ar";

function updateWarningConvertBtnLabel() {
  document.getElementById("warningConvertBtn").textContent = WARNING_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
}

function openWarningViewModal(warningId, warningData) {
  const w = warningData || WARNINGS_LIST.find(x => x.id === warningId);
  if (!w) return;

  document.getElementById("warningViewOverlay").dataset.warningId = w.id;
  document.getElementById("warningTextArea").value = w.warning_text || "";
  document.getElementById("warningViewError").classList.remove("show");
  WARNING_ALT_TEXT = w.warning_text_alt || "";
  WARNING_LANG = w.language === "en" ? "en" : "ar";
  document.getElementById("warningTextArea").dir = WARNING_LANG === "ar" ? "rtl" : "ltr";
  document.getElementById("warningTextArea").style.textAlign = WARNING_LANG === "ar" ? "right" : "left";
  updateWarningConvertBtnLabel();

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const emp = byId[w.employee_id];
  document.getElementById("warningViewTitle").textContent = emp ? `${emp.file_number} - ${emp.full_name}` : t("warningDetailsTitle");

  const statusLabel = t("warningStatus" + w.status[0].toUpperCase() + w.status.slice(1));
  document.getElementById("warningStatusLine").textContent = `${t("colStatus")}: ${statusLabel}` + (w.sent_at ? ` — ${fmtDate(w.sent_at.slice(0,10))}` : "");

  const isSent = w.status === "sent";
  document.getElementById("warningTextArea").disabled = true;
  document.getElementById("warningEditBtn").style.display = isSent ? "none" : "";
  document.getElementById("warningViewToggleBtn").style.display = isSent ? "none" : "";
  document.getElementById("warningSaveBtn").style.display = isSent ? "none" : "";
  document.getElementById("warningSendBtn").style.display = isSent ? "none" : "";

  document.getElementById("warningViewOverlay").style.display = "flex";
}
document.getElementById("closeWarningViewBtn").addEventListener("click", () => {
  document.getElementById("warningViewOverlay").style.display = "none";
});
document.getElementById("warningEditBtn").addEventListener("click", () => {
  document.getElementById("warningTextArea").disabled = false;
  document.getElementById("warningTextArea").focus();
});
document.getElementById("warningViewToggleBtn").addEventListener("click", () => {
  document.getElementById("warningTextArea").disabled = true;
});
document.getElementById("warningConvertBtn").addEventListener("click", () => {
  const textarea = document.getElementById("warningTextArea");
  const current = textarea.value;
  textarea.value = WARNING_ALT_TEXT;
  WARNING_ALT_TEXT = current;
  WARNING_LANG = WARNING_LANG === "ar" ? "en" : "ar";
  textarea.dir = WARNING_LANG === "ar" ? "rtl" : "ltr";
  textarea.style.textAlign = WARNING_LANG === "ar" ? "right" : "left";
  updateWarningConvertBtnLabel();
});

document.getElementById("warningSaveBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("warningViewError");
  errBox.classList.remove("show");
  const warning_id = document.getElementById("warningViewOverlay").dataset.warningId;
  const warning_text = document.getElementById("warningTextArea").value;

  const btn = document.getElementById("warningSaveBtn");
  setBtnLoading(btn, true, t("saving"));

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "update_warning", warning_id, warning_text, warning_text_alt: WARNING_ALT_TEXT, language: WARNING_LANG }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongSaving");
    errBox.classList.add("show");
    return;
  }
  document.getElementById("warningTextArea").disabled = true;
  showToast(t("warningSavedToast"));
  await loadWarnings();
});

document.getElementById("warningSendBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("warningViewError");
  errBox.classList.remove("show");
  const warning_id = document.getElementById("warningViewOverlay").dataset.warningId;

  const btn = document.getElementById("warningSendBtn");
  setBtnLoading(btn, true);

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "send_warning", warning_id }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongSendingWarning");
    errBox.classList.add("show");
    return;
  }
  showToast(t("warningSentToast"));
  document.getElementById("warningViewOverlay").style.display = "none";
  await loadWarnings();
});

document.getElementById("warningDownloadBtn").addEventListener("click", () => {
  const text = document.getElementById("warningTextArea").value;
  const title = document.getElementById("warningViewTitle").textContent;
  downloadContractPDF(title, text);
});

function contractStatusBadge(status) {
  const cls = { draft: "cancelled", shared: "pending", commented: "rejected", signed: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("contractStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

let CONTRACTS_LIST = [];

async function loadContracts() {
  const { data, error } = await db.from("contracts").select("*").order("created_at", { ascending: false });
  if (error || !data) {
    CONTRACTS_LIST = [];
    CONTRACTS_PAGE = 0;
    renderContracts();
    return;
  }
  CONTRACTS_LIST = data;
  CONTRACTS_PAGE = 0;
  renderContracts();
}

function renderContracts() {
  const body = document.getElementById("contractsBody");
  const empty = document.getElementById("noContracts");
  body.innerHTML = "";
  empty.style.display = CONTRACTS_LIST.length ? "none" : "block";

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const start = CONTRACTS_PAGE * PAGE_SIZE;
  const pageItems = CONTRACTS_LIST.slice(start, start + PAGE_SIZE);
  for (const c of pageItems) {
    const emp = byId[c.employee_id];
    const contractName = emp ? `${emp.file_number} - ${emp.full_name}` : c.id;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${contractName}</td>
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${c.job_title || "—"}</td>
      <td>${contractStatusBadge(c.status)}</td>
      <td>${fmtDate(c.created_at ? c.created_at.slice(0,10) : null)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-contract="${c.id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("contracts", CONTRACTS_PAGE, CONTRACTS_LIST.length);
  body.querySelectorAll("button[data-view-contract]").forEach(btn => {
    btn.addEventListener("click", () => openContractViewModal(btn.dataset.viewContract));
  });
}

let CONTRACT_ALT_TEXT = "";
let CONTRACT_LANG = "ar";

function updateContractConvertBtnLabel() {
  document.getElementById("contractConvertBtn").textContent = CONTRACT_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
}

function openContractViewModal(contractId, contractData) {
  const c = contractData || CONTRACTS_LIST.find(x => x.id === contractId);
  if (!c) return;

  document.getElementById("contractViewOverlay").dataset.contractId = c.id;
  document.getElementById("contractTextArea").value = c.contract_text || "";
  document.getElementById("contractViewError").classList.remove("show");
  CONTRACT_ALT_TEXT = c.contract_text_alt || "";
  CONTRACT_LANG = c.language === "en" ? "en" : "ar";
  document.getElementById("contractTextArea").dir = CONTRACT_LANG === "ar" ? "rtl" : "ltr";
  document.getElementById("contractTextArea").style.textAlign = CONTRACT_LANG === "ar" ? "right" : "left";
  updateContractConvertBtnLabel();

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const emp = byId[c.employee_id];
  document.getElementById("contractViewTitle").textContent = emp ? `${emp.file_number} - ${emp.full_name}` : t("contractDetailsTitle");

  const statusLabel = t("contractStatus" + c.status[0].toUpperCase() + c.status.slice(1));
  document.getElementById("contractStatusLine").textContent = `${t("colStatus")}: ${statusLabel}` + (c.signed_at ? ` — ${t("signedOnLabel")} ${fmtDate(c.signed_at.slice(0,10))}` : "");

  const commentsBox = document.getElementById("contractEmployeeCommentsBox");
  if (c.employee_comments) {
    commentsBox.style.display = "block";
    commentsBox.textContent = `${t("employeeCommentsLabel")}: ${c.employee_comments}`;
  } else {
    commentsBox.style.display = "none";
  }

  const isSigned = c.status === "signed";
  const sigImg = document.getElementById("adminSignatureDisplay");
  if (isSigned && c.signature_image) {
    sigImg.src = c.signature_image;
    sigImg.style.display = "block";
  } else {
    sigImg.style.display = "none";
  }
  // Always open in read-only "View" mode; admin clicks Edit to unlock.
  document.getElementById("contractTextArea").disabled = true;
  document.getElementById("contractEditBtn").style.display = isSigned ? "none" : "";
  document.getElementById("contractViewToggleBtn").style.display = isSigned ? "none" : "";
  document.getElementById("contractSaveBtn").style.display = isSigned ? "none" : "";
  document.getElementById("contractShareBtn").style.display = (c.status === "draft" || c.status === "commented") ? "" : "none";
  document.getElementById("contractShareBtn").textContent = c.status === "commented" ? t("shareAgainBtn") : t("shareWithEmployeeBtn");

  document.getElementById("contractViewOverlay").style.display = "flex";
}
document.getElementById("closeContractViewBtn").addEventListener("click", () => {
  document.getElementById("contractViewOverlay").style.display = "none";
});
document.getElementById("contractEditBtn").addEventListener("click", () => {
  document.getElementById("contractTextArea").disabled = false;
  document.getElementById("contractTextArea").focus();
});
document.getElementById("contractViewToggleBtn").addEventListener("click", () => {
  document.getElementById("contractTextArea").disabled = true;
});
document.getElementById("contractConvertBtn").addEventListener("click", () => {
  const textarea = document.getElementById("contractTextArea");
  const current = textarea.value;
  textarea.value = CONTRACT_ALT_TEXT;
  CONTRACT_ALT_TEXT = current;
  CONTRACT_LANG = CONTRACT_LANG === "ar" ? "en" : "ar";
  textarea.dir = CONTRACT_LANG === "ar" ? "rtl" : "ltr";
  textarea.style.textAlign = CONTRACT_LANG === "ar" ? "right" : "left";
  updateContractConvertBtnLabel();
});

document.getElementById("contractSaveBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("contractViewError");
  errBox.classList.remove("show");
  const contract_id = document.getElementById("contractViewOverlay").dataset.contractId;
  const contract_text = document.getElementById("contractTextArea").value;

  const btn = document.getElementById("contractSaveBtn");
  setBtnLoading(btn, true, t("saving"));

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "update_contract", contract_id, contract_text, contract_text_alt: CONTRACT_ALT_TEXT, language: CONTRACT_LANG }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongSaving");
    errBox.classList.add("show");
    return;
  }
  document.getElementById("contractTextArea").disabled = true;
  showToast(t("contractSavedToast"));
  await loadContracts();
});

document.getElementById("contractShareBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("contractViewError");
  errBox.classList.remove("show");
  const contract_id = document.getElementById("contractViewOverlay").dataset.contractId;

  const btn = document.getElementById("contractShareBtn");
  setBtnLoading(btn, true);

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "share_contract", contract_id }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongSharing");
    errBox.classList.add("show");
    return;
  }
  showToast(t("contractSharedToast"));
  document.getElementById("contractViewOverlay").style.display = "none";
  await loadContracts();
});

document.getElementById("contractDownloadBtn").addEventListener("click", () => {
  const text = document.getElementById("contractTextArea").value;
  const title = document.getElementById("contractViewTitle").textContent;
  downloadContractPDF(title, text);
});

async function downloadContractPDF(title, text) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const logo = await loadLogoDataURL();
  let y = 20;
  if (logo) {
    const logoHeight = 14;
    const logoWidth = (logo.w / logo.h) * logoHeight;
    doc.addImage(logo.dataUrl, "PNG", 14, 10, logoWidth, logoHeight);
    y = 32;
  }
  doc.setFontSize(11);
  doc.setTextColor(27, 36, 48);
  const lines = doc.splitTextToSize(text, 180);
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const line of lines) {
    if (y > pageHeight - 15) { doc.addPage(); y = 20; }
    doc.text(line, 14, y);
    y += 6;
  }
  doc.save(`contract_${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}

function closeActionMenus() {
  document.querySelectorAll(".action-menu.open").forEach(m => m.classList.remove("open"));
}
document.addEventListener("click", closeActionMenus);

async function showDetails(id) {
  const e = DIRECTORY.find(x => x.id === id);
  if (!e) return;
  const bal = BALANCES_BY_ID[id];
  const sup = e.supervisor_id ? DIRECTORY.find(x => x.id === e.supervisor_id) : null;

  document.getElementById("detailsTitle").textContent = e.full_name;
  document.getElementById("detailsBody").innerHTML = `
    <div class="detail-row"><span class="label">${t("colFileNumber")}</span><span class="value">${e.file_number}</span></div>
    <div class="detail-row"><span class="label">${t("colEmail")}</span><span class="value">${e.email || "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colRole")}</span><span class="value">${roleLabel(e.role)}</span></div>
    <div class="detail-row"><span class="label">${t("companyClientLabel")}</span><span class="value">${e.client_company || "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colDepartment")}</span><span class="value">${e.department || "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colSupervisor")}</span><span class="value">${sup ? sup.full_name : "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colHiringDate")}</span><span class="value">${fmtDate(e.hiring_date)}</span></div>
    <div class="detail-row"><span class="label">${t("colDob")}</span><span class="value">${fmtDate(e.dob)}</span></div>
    <div class="detail-row"><span class="label">${t("colNationality")}</span><span class="value">${e.nationality || "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colEducation")}</span><span class="value">${e.education || "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colSalary")}</span><span class="value">${fmtMoney(e.salary)}</span></div>
    ${e.role !== "supervisor" ? `
    <div class="detail-row"><span class="label">${t("colPrevYearBalance")}</span><span class="value">${e.carryover_balance !== null && e.carryover_balance !== undefined ? e.carryover_balance : 0}</span></div>
    <div class="detail-row"><span class="label">${t("colAnnualLeaveDays")}</span><span class="value">${bal ? bal.annual_entitlement : "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colTakenThisYear")}</span><span class="value">${bal ? bal.taken : "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colRemaining")}</span><span class="value">${bal ? bal.remaining : "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colSickLeaveDays")}</span><span class="value">${bal ? bal.sick_entitlement : "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colSickTakenThisYear")}</span><span class="value">${bal ? bal.sick_taken : "—"}</span></div>
    <div class="detail-row"><span class="label">${t("colSickRemaining")}</span><span class="value">${bal ? bal.sick_remaining : "—"}</span></div>
    ` : ""}
    ${e.frozen ? `
    <div class="detail-row"><span class="label">${t("statusFrozenBadge")}</span><span class="value">${t("reason" + (e.frozen_reason === "resignation" ? "Resignation" : e.frozen_reason === "end_of_contract" ? "EndOfContract" : "Termination"))}</span></div>
    <div class="detail-row"><span class="label">${t("frozenSinceLabel")}</span><span class="value">${fmtDate(e.frozen_at ? e.frozen_at.slice(0,10) : null)}</span></div>
    ` : ""}
  `;
  document.getElementById("detailsOverlay").style.display = "flex";

  const historyBox = document.getElementById("detailsLeaveHistory");
  historyBox.innerHTML = `<div class='empty-state'>${t("loadingText")}</div>`;
  const { data: history, error } = await db
    .from("leave_requests")
    .select("*")
    .eq("employee_id", id)
    .order("start_date", { ascending: false });

  if (error || !history || history.length === 0) {
    historyBox.innerHTML = `<div class='empty-state'>${t("noLeaveHistoryOnFile")}</div>`;
    return;
  }

  const badgeForLocal = (status) => {
    const key = "status" + status[0].toUpperCase() + status.slice(1);
    return `<span class="badge badge-${status}">${t(key)}</span>`;
  };
  historyBox.innerHTML = `
    <table>
      <thead><tr><th>${t("colDates")}</th><th>${t("colDays")}</th><th>${t("colType")}</th><th>${t("colStatus")}</th></tr></thead>
      <tbody>
        ${history.map(r => `
          <tr>
            <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
            <td>${r.days_requested}</td>
            <td style="text-transform:capitalize">${r.leave_type}</td>
            <td>${badgeForLocal(r.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function showFreezePrompt() {
  return new Promise((resolve) => {
    document.getElementById("freezeReasonSelect").value = "";
    document.getElementById("freezeReasonError").classList.remove("show");
    document.getElementById("freezeOverlay").style.display = "flex";

    const confirmBtn = document.getElementById("freezeConfirmBtn");
    const cancelBtn = document.getElementById("freezeCancelBtn");

    const cleanup = () => {
      document.getElementById("freezeOverlay").style.display = "none";
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
    };
    const onConfirm = () => {
      const reason = document.getElementById("freezeReasonSelect").value;
      if (!reason) {
        document.getElementById("freezeReasonError").textContent = t("pleaseSelectReason");
        document.getElementById("freezeReasonError").classList.add("show");
        return;
      }
      cleanup();
      resolve(reason);
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
  });
}

async function freezeEmployee(id, employee) {
  const reason = await showFreezePrompt();
  if (!reason) return;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "freeze_employee", target_id: id, reason }
  });

  if (error || (data && data.error)) {
    showToast((data && data.error) ? data.error : t("couldNotFreezeToast"));
    return;
  }

  showToast(t("accountFrozenToast"));
  await Promise.all([loadDirectory(), loadBalances()]);
}

async function unfreezeEmployee(id, employee) {
  const ok = await showConfirm(
    t("unfreezeConfirmTitle"),
    tv("unfreezeConfirmMsg", { name: employee.full_name }),
    t("unfreezeBtn")
  );
  if (!ok) return;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "unfreeze_employee", target_id: id }
  });

  if (error || (data && data.error)) {
    showToast((data && data.error) ? data.error : t("couldNotUnfreezeToast"));
    return;
  }

  showToast(t("accountUnfrozenToast"));
  await Promise.all([loadDirectory(), loadBalances()]);
}

function toggleEditTakenThisYearField() {
  const carryover = Number(document.getElementById("editCarryoverBalance").value) || 0;
  const row = document.getElementById("editTakenThisYearRow");
  row.style.display = carryover === 0 ? "" : "none";
  if (carryover > 0) document.getElementById("editTakenThisYear").value = 0;
}
document.getElementById("editCarryoverBalance").addEventListener("input", toggleEditTakenThisYearField);

function toggleEditLeaveFields() {
  const isSupervisor = document.getElementById("editRole").value === "supervisor";
  document.getElementById("editHiringDateRow").style.display = isSupervisor ? "none" : "";
  document.getElementById("editEntitlementRow").style.display = isSupervisor ? "none" : "";
  if (isSupervisor) document.getElementById("editTakenThisYearRow").style.display = "none";
  document.getElementById("editDobField").style.display = isSupervisor ? "none" : "";
  document.getElementById("editEmployeeTitle").textContent = isSupervisor ? t("editSupervisorInfoTitle") : t("editEmployeeTitle");
}

function toggleEditSupervisorField() {
  document.getElementById("editSupervisorField").style.display = document.getElementById("editRole").value === "staff" ? "" : "none";
}
document.getElementById("editRole").addEventListener("change", toggleEditSupervisorField);
document.getElementById("editRole").addEventListener("change", toggleEditLeaveFields);
document.getElementById("editClientCompany").addEventListener("change", () => {
  populateEditSupervisorOptions(document.getElementById("editClientCompany").value, null);
  populateDepartmentOptions(document.getElementById("editDepartment"), document.getElementById("editClientCompany").value, null);
});

async function populateEditCompanyOptions(selected) {
  const { data, error } = await db.from("client_companies").select("name").order("name");
  const select = document.getElementById("editClientCompany");
  select.innerHTML = "";
  if (!error && data) {
    for (const c of data) {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      select.appendChild(opt);
    }
  }
  select.value = selected || "";
}

function populateEditSupervisorOptions(companyFilter, selectedFileNumber) {
  const select = document.getElementById("editSupervisor");
  const matches = SUPERVISORS.filter(s => s.client_company === companyFilter);
  select.innerHTML = `<option value="">${t("selectSupervisorPlaceholder")}</option>` +
    matches.map(s => `<option value="${s.file_number}">${s.full_name} (#${s.file_number})</option>`).join("");
  if (selectedFileNumber) select.value = selectedFileNumber;
}

async function openEditModal(id) {
  const e = DIRECTORY.find(x => x.id === id);
  if (!e) return;
  const bal = BALANCES_BY_ID[e.id];

  document.getElementById("editFullName").value = e.full_name || "";
  document.getElementById("editEmail").value = e.email || "";
  document.getElementById("editHiringDate").value = e.hiring_date || "";
  document.getElementById("editAnnualEntitlement").value = bal ? bal.annual_entitlement : (e.annual_entitlement ?? "");
  document.getElementById("editCarryoverBalance").value = e.carryover_balance ?? 0;
  document.getElementById("editTakenThisYear").value = 0;
  toggleEditTakenThisYearField();
  populateDepartmentOptions(document.getElementById("editDepartment"), e.client_company, e.department);
  document.getElementById("editDob").value = e.dob || "";
  document.getElementById("editNationality").value = e.nationality || "";
  document.getElementById("editEducation").value = e.education || "";
  document.getElementById("editSalary").value = e.salary ?? "";
  document.getElementById("editError").classList.remove("show");

  const roleSelect = document.getElementById("editRole");
  roleSelect.querySelectorAll('option[value="admin"]').forEach(o => o.remove());
  if (e.role === "admin") {
    const opt = document.createElement("option");
    opt.value = "admin";
    opt.textContent = "Admin";
    roleSelect.appendChild(opt);
  }
  roleSelect.value = e.role;

  await populateEditCompanyOptions(e.client_company);
  let supFileNumber = null;
  if (e.supervisor_id) {
    const sup = DIRECTORY.find(x => x.id === e.supervisor_id);
    if (sup) supFileNumber = sup.file_number;
  }
  populateEditSupervisorOptions(e.client_company, supFileNumber);
  toggleEditSupervisorField();
  toggleEditLeaveFields();

  document.getElementById("editOverlay").dataset.targetId = id;
  document.getElementById("editOverlay").style.display = "flex";
}

document.getElementById("closeEditBtn").addEventListener("click", () => {
  document.getElementById("editOverlay").style.display = "none";
});
document.getElementById("cancelEditBtn").addEventListener("click", () => {
  document.getElementById("editOverlay").style.display = "none";
});

document.getElementById("editForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const errBox = document.getElementById("editError");
  errBox.classList.remove("show");

  const target_id = document.getElementById("editOverlay").dataset.targetId;
  const full_name = document.getElementById("editFullName").value.trim();
  const email = document.getElementById("editEmail").value.trim();
  const hiring_date = document.getElementById("editHiringDate").value || null;
  const department = document.getElementById("editDepartment").value;
  const client_company = document.getElementById("editClientCompany").value;
  const role = document.getElementById("editRole").value;
  const supervisor_file_number = role === "staff" ? document.getElementById("editSupervisor").value : null;
  const annual_entitlement_override = document.getElementById("editAnnualEntitlement").value !== "" ? Number(document.getElementById("editAnnualEntitlement").value) : null;
  const carryover_balance = document.getElementById("editCarryoverBalance").value !== "" ? Number(document.getElementById("editCarryoverBalance").value) : 0;
  const taken_this_year = carryover_balance === 0 && document.getElementById("editTakenThisYear").value !== "" ? Number(document.getElementById("editTakenThisYear").value) : 0;
  const dob = document.getElementById("editDob").value || null;
  const nationality = document.getElementById("editNationality").value.trim() || null;
  const education = document.getElementById("editEducation").value.trim() || null;
  const salary = document.getElementById("editSalary").value !== "" ? Number(document.getElementById("editSalary").value) : null;

  if (!client_company) {
    errBox.textContent = t("pleaseSelectCompany");
    errBox.classList.add("show");
    return;
  }
  if (role === "staff" && !supervisor_file_number) {
    errBox.textContent = t("pleaseAssignSupervisor");
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("editSaveBtn");
  btn.disabled = true;
  btn.textContent = t("saving");

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "update_employee", target_id, full_name, email, hiring_date, department, client_company, role, supervisor_file_number, annual_entitlement_override, carryover_balance, dob, nationality, education, salary, taken_this_year }
  });

  btn.disabled = false;
  btn.textContent = t("save");

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongUpdatingEmployee");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("editOverlay").style.display = "none";
  showToast(t("employeeUpdatedToast"));
  await Promise.all([loadDirectory(), loadBalances(), loadSupervisors()]);
});

async function resetPassword(id, employee) {
  const ok = await showConfirm(
    t("resetPasswordConfirmTitle"),
    tv("resetPasswordConfirmMsg", { name: employee.full_name }),
    t("resetPasswordBtn")
  );
  if (!ok) return;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "reset_password", target_id: id }
  });

  if (error || (data && data.error)) {
    showToast(t("couldNotResetPasswordToast"));
    return;
  }

  await showInfo(
    t("newPasswordGeneratedTitle"),
    tv("newPasswordGeneratedMsg", { name: employee.full_name, fileNumber: employee.file_number, password: data.password })
  );
}

async function deleteEmployee(id, employee) {
  const ok = await showConfirm(
    t("deleteEmployeeConfirmTitle"),
    tv("deleteEmployeeConfirmMsg", { name: employee.full_name, fileNumber: employee.file_number }),
    t("deleteBtn"),
    true
  );
  if (!ok) return;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "delete_employee", target_id: id }
  });

  if (error || (data && data.error)) {
    showToast((data && data.error) ? data.error : t("couldNotDeleteEmployee"));
    return;
  }

  showToast(t("employeeDeletedToast"));
  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
}

function showDateRangePrompt(title) {
  return new Promise((resolve) => {
    document.getElementById("dateRangeTitle").textContent = title;
    document.getElementById("rangeFromInput").value = "";
    document.getElementById("rangeToInput").value = "";
    document.getElementById("rangeEmployeeIdInput").value = "";
    document.getElementById("rangeIncludeFrozen").checked = false;
    document.getElementById("rangeFormatPdf").checked = true;
    document.getElementById("rangeFormatExcel").checked = false;
    document.getElementById("rangeFormatError").classList.remove("show");
    document.getElementById("dateRangeOverlay").style.display = "flex";

    const generateBtn = document.getElementById("rangeGenerateBtn");
    const cancelBtn = document.getElementById("rangeCancelBtn");

    const cleanup = () => {
      document.getElementById("dateRangeOverlay").style.display = "none";
      generateBtn.removeEventListener("click", onGenerate);
      cancelBtn.removeEventListener("click", onCancel);
    };
    const onGenerate = () => {
      const wantPdf = document.getElementById("rangeFormatPdf").checked;
      const wantExcel = document.getElementById("rangeFormatExcel").checked;
      if (!wantPdf && !wantExcel) {
        document.getElementById("rangeFormatError").textContent = t("pleaseSelectFormat");
        document.getElementById("rangeFormatError").classList.add("show");
        return;
      }
      const from = document.getElementById("rangeFromInput").value || null;
      const to = document.getElementById("rangeToInput").value || null;
      const employeeId = document.getElementById("rangeEmployeeIdInput").value.trim() || null;
      const includeFrozen = document.getElementById("rangeIncludeFrozen").checked;
      cleanup();
      resolve({ from, to, employeeId, includeFrozen, wantPdf, wantExcel });
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    generateBtn.addEventListener("click", onGenerate);
    cancelBtn.addEventListener("click", onCancel);
  });
}

function loadLogoDataURL() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      try {
        resolve({ dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = "images/logo.png";
  });
}

async function downloadPDF(title, subtitle, columns, rows, filename, redRowIndices) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  let textStartX = 14;
  const logo = await loadLogoDataURL();
  if (logo) {
    const logoHeight = 14;
    const logoWidth = (logo.w / logo.h) * logoHeight;
    doc.addImage(logo.dataUrl, "PNG", 14, 8, logoWidth, logoHeight);
    textStartX = 14 + logoWidth + 6;
  }

  doc.setFontSize(16);
  doc.setTextColor(27, 36, 48);
  doc.text(title, textStartX, 18);
  doc.setFontSize(10);
  doc.setTextColor(75, 87, 104);
  doc.text(subtitle, textStartX, 25);
  doc.autoTable({
    head: [columns],
    body: rows,
    startY: 32,
    theme: "striped",
    headStyles: { fillColor: [47, 111, 94] },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (redRowIndices && data.section === "body" && redRowIndices.has(data.row.index)) {
        data.cell.styles.textColor = [165, 64, 43];
      }
    },
  });
  doc.save(filename);
}

function downloadExcel(sheetName, columns, rows, filename) {
  const wsData = [columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

document.getElementById("downloadReportBtn").addEventListener("click", async () => {
  const range = await showDateRangePrompt(t("selectReportPeriodTitle"));
  if (!range) return;

  let source = range.employeeId
    ? DIRECTORY.filter(e => e.file_number === range.employeeId)
    : (ACTIVE_TAB === "supervisors"
        ? DIRECTORY.filter(e => e.role === "supervisor")
        : DIRECTORY.filter(e => e.role !== "admin"));
  if (!range.employeeId && COMPANY_FILTER) source = source.filter(e => e.client_company === COMPANY_FILTER);
  if (range.from) source = source.filter(e => e.hiring_date && e.hiring_date >= range.from);
  if (range.to) source = source.filter(e => e.hiring_date && e.hiring_date <= range.to);
  if (!range.includeFrozen) source = source.filter(e => !e.frozen);

  if (source.length === 0) {
    showToast(t("noMatchingEmployeeToast"));
    return;
  }

  const redRowIndices = new Set();
  const rows = source.map((e, i) => {
    if (e.frozen) redRowIndices.add(i);
    const bal = BALANCES_BY_ID[e.id] || {};
    return [e.full_name, e.file_number, e.client_company || "—", e.department || "—", e.role, fmtDate(e.hiring_date), e.frozen ? fmtDate(e.frozen_at ? e.frozen_at.slice(0,10) : null) : "—", String(e.carryover_balance ?? 0), String(bal.annual_entitlement ?? "—"), String(bal.taken ?? "—"), String(bal.remaining ?? "—"), String(bal.sick_entitlement ?? "—"), String(bal.sick_taken ?? "—"), String(bal.sick_remaining ?? "—")];
  });
  const scope = COMPANY_FILTER ? `${COMPANY_FILTER} — ` : "";
  const title = scope + (ACTIVE_TAB === "supervisors" ? "Supervisors — Leave Report" : "Employees — Leave Report");
  const filenamePrefix = COMPANY_FILTER ? `${COMPANY_FILTER.toLowerCase()}_` : "";
  const rangeNote = (range.from || range.to) ? ` — Period: ${range.from || "…"} to ${range.to || "…"}` : "";
  const columns = ["Employee Name", "ID #", "Company", "Department", "Role", "Hiring Date", "Frozen Date", "Prev. Balance", "Annual", "Ann. Taken", "Available Balance", "Sick", "Sick Taken", "Sick Left"];
  const baseFilename = `${filenamePrefix}${ACTIVE_TAB === "supervisors" ? "supervisors" : "all_employees"}_leave_report`;

  if (range.wantPdf) {
    downloadPDF(
      title,
      `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}${rangeNote}`,
      columns,
      rows,
      `${baseFilename}.pdf`,
      redRowIndices
    );
  }
  if (range.wantExcel) {
    downloadExcel(title, columns, rows, `${baseFilename}.xlsx`);
  }
});

document.getElementById("downloadLeaveReportBtn").addEventListener("click", async () => {
  const range = await showDateRangePrompt(t("selectReportPeriodTitle"));
  if (!range) return;

  const { data, error } = await db.from("leave_requests").select("*").order("requested_at", { ascending: false });
  if (error || !data) { showToast(t("couldNotLoadLeaveRequests")); return; }

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  let rows = data;
  if (range.employeeId) {
    rows = rows.filter(r => byId[r.employee_id] && byId[r.employee_id].file_number === range.employeeId);
  } else if (COMPANY_FILTER) {
    rows = rows.filter(r => byId[r.employee_id] && byId[r.employee_id].client_company === COMPANY_FILTER);
  }
  if (range.from) rows = rows.filter(r => r.end_date >= range.from);
  if (range.to) rows = rows.filter(r => r.start_date <= range.to);
  if (!range.includeFrozen) rows = rows.filter(r => !(byId[r.employee_id] && byId[r.employee_id].frozen));

  if (rows.length === 0) {
    showToast(t("noMatchingRequestsToast"));
    return;
  }

  const redRowIndices = new Set();
  const pdfRows = rows.map((r, i) => {
    const emp = byId[r.employee_id];
    if (emp && emp.frozen) redRowIndices.add(i);
    return [
      emp ? emp.full_name : "—",
      emp ? (emp.client_company || "—") : "—",
      `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}`,
      String(r.days_requested),
      r.leave_type,
      r.status
    ];
  });

  const scope = COMPANY_FILTER ? `${COMPANY_FILTER} — ` : "";
  const rangeNote = (range.from || range.to) ? ` — ${range.from || "…"} to ${range.to || "…"}` : "";
  const columns = ["Employee Name", "Company", "Dates", "Days", "Type", "Status"];
  const baseFilename = `${COMPANY_FILTER ? COMPANY_FILTER.toLowerCase() + "_" : ""}leave_requests_report`;

  if (range.wantPdf) {
    downloadPDF(
      `${scope}Leave Requests`,
      `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}${rangeNote}`,
      columns,
      pdfRows,
      `${baseFilename}.pdf`,
      redRowIndices
    );
  }
  if (range.wantExcel) {
    downloadExcel(`${scope}Leave Requests`, columns, pdfRows, `${baseFilename}.xlsx`);
  }
});

document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("addError");
  const credBox = document.getElementById("credentialsBox");
  errBox.classList.remove("show");
  credBox.classList.remove("show");

  const full_name = document.getElementById("fullName").value.trim();

  const email = document.getElementById("email").value.trim();
  const hiring_date = document.getElementById("hiringDate").value || null;
  const annual_entitlement_override = document.getElementById("annualEntitlement").value !== "" ? Number(document.getElementById("annualEntitlement").value) : null;
  const carryover_balance = document.getElementById("carryoverBalance").value !== "" ? Number(document.getElementById("carryoverBalance").value) : 0;
  const taken_this_year = carryover_balance === 0 && document.getElementById("takenThisYear").value !== "" ? Number(document.getElementById("takenThisYear").value) : 0;
  const client_company = document.getElementById("clientCompany").value;
  const department = document.getElementById("department").value;
  const role = document.getElementById("role").value;
  const supervisor_file_number = document.getElementById("supervisor").value || null;

  if (!client_company) {
    errBox.textContent = t("pleaseSelectCompany");
    errBox.classList.add("show");
    return;
  }

  if (role === "staff" && !supervisor_file_number) {
    errBox.textContent = t("pleaseAssignSupervisor");
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("addBtn");
  btn.disabled = true;
  btn.textContent = t("creating");

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "create_employee", full_name, email, role, hiring_date, department, client_company, supervisor_file_number, annual_entitlement_override, carryover_balance, taken_this_year }
  });

  btn.disabled = false;
  btn.textContent = t("createBtn");

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongCreating");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("credFileNumber").textContent = data.file_number;
  document.getElementById("credPassword").textContent = data.password;
  credBox.classList.add("show");
  document.getElementById("copyCredsBtn").onclick = () => {
    navigator.clipboard.writeText(
      `${t("fileNumColonLabel")} ${data.file_number}\n${t("initialPasswordColonLabel")} ${data.password}\nSign in at: ${window.location.origin}`
    );
    showToast(t("copiedToast"));
  };

  document.getElementById("addForm").reset();
  if (COMPANY_FILTER) document.getElementById("clientCompany").value = COMPANY_FILTER;
  toggleSupervisorField();
  populateSupervisorOptions();

  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
});

(async () => {
  ME = await requireSession("admin");
  if (!ME) return;
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  if (COMPANY_FILTER) {
    document.getElementById("pageTitle").textContent = `${COMPANY_FILTER} — ${t("companyScopedTitleSuffix")}`;
    document.getElementById("pageSub").textContent = tv("companyScopedSub", { company: COMPANY_FILTER });
  }
  toggleSupervisorField();
  await Promise.all([loadCompanyOptions(), loadSupervisors(), loadBalances()]);
  await loadDirectory();
  if (COMPANY_FILTER) document.getElementById("clientCompany").value = COMPANY_FILTER;
})();
