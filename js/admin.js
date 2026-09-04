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

document.getElementById("directorySearchInput").addEventListener("input", () => { DIRECTORY_PAGE = 0; renderDirectory(); });
document.getElementById("leaveRequestsSearchInput").addEventListener("input", () => { LEAVE_REQUESTS_PAGE = 0; renderLeaveRequests(); });
document.getElementById("contractsSearchInput").addEventListener("input", () => { CONTRACTS_PAGE = 0; renderContracts(); });
document.getElementById("warningsSearchInput").addEventListener("input", () => { WARNINGS_PAGE = 0; renderWarnings(); });

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- Custom confirm/info modal (replaces browser confirm()/alert()) ----------
function showInfo(title, messageHTML, copyText = null) {
  return new Promise((resolve) => {
    document.getElementById("actionTitle").textContent = title;
    document.getElementById("actionMessage").innerHTML = messageHTML;
    const btns = document.getElementById("actionButtons");
    btns.innerHTML = "";
    if (copyText) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "btn btn-blue btn-sm";
      copyBtn.textContent = t("copyDetailsBtn");
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(copyText);
        showToast(t("copiedToast"));
      };
      btns.appendChild(copyBtn);
    }
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
    cancel.className = danger ? "btn btn-primary btn-sm" : "btn btn-danger btn-sm";
    cancel.textContent = danger ? "Discard" : t("cancel");
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
  document.getElementById("showAddFormBtn").style.display = tab === "supervisors" ? "none" : "";
  document.getElementById("showAddSupervisorAdminBtn").style.display = tab === "supervisors" ? "" : "none";
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

function matchesTableSearch(query, fileNumber, company, role, name) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (fileNumber || "").toLowerCase().includes(q) ||
         (company || "").toLowerCase().includes(q) ||
         (role || "").toLowerCase().includes(q) ||
         (name || "").toLowerCase().includes(q);
}

function renderLeaveRequests() {
  const body = document.getElementById("leaveRequestsBody");
  const empty = document.getElementById("noLeaveRequests");
  body.innerHTML = "";

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const leaveQuery = document.getElementById("leaveRequestsSearchInput").value.trim();
  const filteredLeave = leaveQuery
    ? LEAVE_REQUESTS_LIST.filter(r => {
        const emp = byId[r.employee_id];
        return matchesTableSearch(leaveQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name);
      })
    : LEAVE_REQUESTS_LIST;

  if (filteredLeave.length === 0) {
    empty.style.display = "block";
    updatePaginationControls("leaveRequests", 0, 0);
    return;
  }
  empty.style.display = "none";

  const start = LEAVE_REQUESTS_PAGE * PAGE_SIZE;
  const rows = filteredLeave.slice(start, start + PAGE_SIZE);

  for (const r of rows) {
    const emp = byId[r.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${emp ? emp.file_number : "—"}</td>
      <td>${emp ? (emp.client_company || "—") : "—"}</td>
      <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
      <td>${r.days_requested}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${r.reason ? r.reason : "—"}</td>
      <td>${r.document_path ? `<button type="button" class="btn btn-blue btn-sm" data-doc="${r.document_path}">View Attachment</button>` : "—"}</td>
      <td>${badgeFor(r.status)}</td>
      <td><button type="button" class="btn btn-danger btn-sm" data-delete-leave="${r.id}">${t("deleteBtn")}</button></td>
    `;
    body.appendChild(tr);
  }

  updatePaginationControls("leaveRequests", LEAVE_REQUESTS_PAGE, filteredLeave.length);

  body.querySelectorAll("button[data-doc]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data, error } = await db.storage.from("leave-documents").createSignedUrl(btn.dataset.doc, 60);
      if (error || !data) { showToast(t("couldNotOpenDoc")); return; }
      window.open(data.signedUrl, "_blank");
    });
  });

  body.querySelectorAll("button[data-delete-leave]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!(await showConfirm(t("deleteBtn"), t("confirmDeleteLeaveRequest"), t("deleteBtn"), true))) return;
      showGlobalSpinner();
      const { data, error } = await db.functions.invoke("clever-action", {
        body: { action: "delete_leave_request", leave_request_id: btn.dataset.deleteLeave }
      });
      hideGlobalSpinner();
      if (error || (data && data.error)) {
        showToast((data && data.error) ? data.error : t("somethingWrongDeletingLeaveRequest"));
        return;
      }
      showToast(t("leaveRequestDeletedToast"));
      await loadLeaveRequests();
    });
  });
}

document.getElementById("closeDetailsBtn").addEventListener("click", () => {
  document.getElementById("detailsOverlay").style.display = "none";
});

// ---------- Data loading ----------
async function loadSupervisors() {
  const { data, error } = await db
    .from("employees")
    .select("id, file_number, full_name, role, client_company")
    .in("role", ["supervisor", "admin"])
    .order("full_name");

  if (error || !data) return;
  SUPERVISORS = data;
}

function supervisorsForCompany(companyName) {
  return SUPERVISORS.filter(s => s.client_company === companyName);
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
  const placeholder = `<option value="">Select department…</option>`;
  selectEl.innerHTML = placeholder + list.map(d => `<option value="${d}">${d}</option>`).join("");
  if (current && list.includes(current)) selectEl.value = current;
}

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
    : DIRECTORY.filter(e => e.role === "staff");
  if (COMPANY_FILTER) allRows = allRows.filter(e => e.client_company === COMPANY_FILTER);
  const directoryQuery = document.getElementById("directorySearchInput").value.trim();
  if (directoryQuery) allRows = allRows.filter(e => matchesTableSearch(directoryQuery, e.file_number, e.client_company, e.role, e.full_name));

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
    btn.addEventListener("click", async () => { closeActionMenus(); await openContractCreateModal(btn.dataset.contract); });
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

async function openContractCreateModal(employeeId) {
  const e = DIRECTORY.find(x => x.id === employeeId);
  if (!e) return;

  const today = new Date().toISOString().slice(0, 10);
  const { data: existingContracts, error: checkErr } = await db
    .from("contracts")
    .select("id, status, end_date")
    .eq("employee_id", employeeId);

  // A contract counts as "active" if it's still in progress (draft/shared/
  // commented) or if it's signed and hasn't reached its end date yet.
  const blockingContract = !checkErr && (existingContracts || []).find(c =>
    c.status !== "signed" || !c.end_date || c.end_date >= today
  );

  if (blockingContract) {
    await showInfo(
      t("activeContractBlockTitle"),
      tv("activeContractBlockMsg", { name: e.full_name })
    );
    return;
  }

  document.getElementById("contractCreateForm").reset();
  document.getElementById("contractCreateError").classList.remove("show");
  document.getElementById("contractCreateForm").dataset.targetId = employeeId;
  delete document.getElementById("contractCreateForm").dataset.editContractId;
  document.getElementById("contractCreateTitle").textContent = t("createContractTitle");
  document.getElementById("contractCreateBtn").textContent = t("prepareContractBtn");
  document.getElementById("contractCreateEmployeeInfo").textContent =
    `${e.full_name} · #${e.file_number}${e.client_company ? " · " + e.client_company : ""}`;

  // Pull whatever we already have on file for this employee so the admin
  // isn't retyping data that's already stored. Anything not on file (job
  // title, contract period) is simply left blank for the admin to fill in.
  document.getElementById("contractDob").value = e.dob || "";
  document.getElementById("contractEducation").value = e.education || "";
  document.getElementById("contractAddress").value = e.address || "";
  document.getElementById("contractSalary").value = e.salary || "";
  document.getElementById("contractStartDate").value = e.hiring_date || "";

  document.getElementById("contractCreateOverlay").style.display = "flex";
}
document.getElementById("contractCreateCancelBtn").addEventListener("click", () => {
  document.getElementById("contractCreateOverlay").style.display = "none";
});

document.getElementById("contractCreateForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const errBox = document.getElementById("contractCreateError");
  errBox.classList.remove("show");

  const formEl = document.getElementById("contractCreateForm");
  const target_id = formEl.dataset.targetId;
  const editContractId = formEl.dataset.editContractId;
  const dob = document.getElementById("contractDob").value || null;
  const education = document.getElementById("contractEducation").value.trim() || null;
  const address = document.getElementById("contractAddress").value.trim() || null;
  const salary = document.getElementById("contractSalary").value;
  const job_title = document.getElementById("contractJobTitle").value.trim();
  const start_date = document.getElementById("contractStartDate").value;
  const contract_period_months = document.getElementById("contractPeriodMonths").value;

  const btn = document.getElementById("contractCreateBtn");
  setBtnLoading(btn, true, editContractId ? t("saving") : t("preparing"));

  const { data, error } = await db.functions.invoke("clever-action", {
    body: editContractId
      ? { action: "update_contract_details", contract_id: editContractId, target_id, dob, education, address, salary, job_title, start_date, contract_period_months, lang: getLang() }
      : { action: "create_contract", target_id, dob, education, address, salary, job_title, start_date, contract_period_months, lang: getLang() }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongCreatingContract");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("contractCreateOverlay").style.display = "none";
  showToast(editContractId ? t("contractSavedToast") : t("contractPreparedToast"));
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

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const warningsQuery = document.getElementById("warningsSearchInput").value.trim();
  const filteredWarnings = warningsQuery
    ? WARNINGS_LIST.filter(w => {
        const emp = byId[w.employee_id];
        return matchesTableSearch(warningsQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name);
      })
    : WARNINGS_LIST;
  empty.style.display = filteredWarnings.length ? "none" : "block";

  const start = WARNINGS_PAGE * PAGE_SIZE;
  const pageItems = filteredWarnings.slice(start, start + PAGE_SIZE);
  for (const w of pageItems) {
    const emp = byId[w.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${emp ? emp.file_number : "—"}</td>
      <td>${emp ? (emp.client_company || "—") : "—"}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}</td>
      <td>${fmtDate(w.created_at ? w.created_at.slice(0,10) : null)}</td>
      <td>
        <button type="button" class="btn btn-blue btn-sm" data-view-warning="${w.id}">${t("view")}</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete-warning="${w.id}">${t("deleteBtn")}</button>
      </td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("warnings", WARNINGS_PAGE, filteredWarnings.length);
  body.querySelectorAll("button[data-view-warning]").forEach(btn => {
    btn.addEventListener("click", () => openWarningViewModal(btn.dataset.viewWarning));
  });
  body.querySelectorAll("button[data-delete-warning]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!(await showConfirm(t("deleteBtn"), t("confirmDeleteWarning"), t("deleteBtn"), true))) return;
      showGlobalSpinner();
      const { data, error } = await db.functions.invoke("clever-action", {
        body: { action: "delete_warning", warning_id: btn.dataset.deleteWarning }
      });
      hideGlobalSpinner();
      if (error || (data && data.error)) {
        showToast((data && data.error) ? data.error : t("somethingWrongDeletingWarning"));
        return;
      }
      showToast(t("warningDeletedToast"));
      await loadWarnings();
    });
  });
}

let WARNING_ALT_TEXT = "";
let WARNING_LANG = "ar";

function updateWarningConvertBtnLabel() {
  document.getElementById("warningConvertBtn").textContent = WARNING_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
}

function ensureWarningAckNote() {
  let note = document.getElementById("warningAckNote");
  if (!note) {
    note = document.createElement("div");
    note.id = "warningAckNote";
    note.className = "success-msg";
    note.style.marginTop = "10px";
    note.style.marginBottom = "10px";
    note.style.fontWeight = "600";
    const statusLine = document.getElementById("warningStatusLine");
    statusLine.parentNode.insertBefore(note, statusLine.nextSibling);
  }
  return note;
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
  document.getElementById("warningViewOverlay").dataset.fileNumber = emp ? emp.file_number : "";
  document.getElementById("warningViewOverlay").dataset.employeeName = emp ? emp.full_name : "";

  const statusLabel = t("warningStatus" + w.status[0].toUpperCase() + w.status.slice(1));
  document.getElementById("warningStatusLine").textContent = `${t("colStatus")}: ${statusLabel}` + (w.sent_at ? ` — ${fmtDate(w.sent_at.slice(0,10))}` : "");

  const ackNote = ensureWarningAckNote();
  if (w.acknowledged_at) {
    ackNote.textContent = `✓ Acknowledged by employee on ${fmtDate(w.acknowledged_at.slice(0,10))}`;
    ackNote.classList.add("show");
  } else {
    ackNote.classList.remove("show");
  }

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
  const overlay = document.getElementById("warningViewOverlay");
  downloadContractPDF("Warning", overlay.dataset.fileNumber, overlay.dataset.employeeName, text);
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

  const byId = Object.fromEntries(DIRECTORY.map(e => [e.id, e]));
  const contractsQuery = document.getElementById("contractsSearchInput").value.trim();
  const filteredContracts = contractsQuery
    ? CONTRACTS_LIST.filter(c => {
        const emp = byId[c.employee_id];
        return matchesTableSearch(contractsQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name);
      })
    : CONTRACTS_LIST;
  empty.style.display = filteredContracts.length ? "none" : "block";

  const start = CONTRACTS_PAGE * PAGE_SIZE;
  const pageItems = filteredContracts.slice(start, start + PAGE_SIZE);
  for (const c of pageItems) {
    const emp = byId[c.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${emp ? emp.file_number : "—"}</td>
      <td>${emp ? (emp.client_company || "—") : "—"}</td>
      <td>${contractStatusBadge(c.status)}</td>
      <td>${fmtDate(c.created_at ? c.created_at.slice(0,10) : null)}</td>
      <td>${c.contract_period_months ? `${c.contract_period_months} ${t("monthsLabel")}` : "—"}</td>
      <td>
        <button type="button" class="btn btn-blue btn-sm" data-view-contract="${c.id}">${t("view")}</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete-contract="${c.id}">${t("deleteBtn")}</button>
      </td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("contracts", CONTRACTS_PAGE, filteredContracts.length);
  body.querySelectorAll("button[data-view-contract]").forEach(btn => {
    btn.addEventListener("click", () => openContractViewModal(btn.dataset.viewContract));
  });
  body.querySelectorAll("button[data-delete-contract]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!(await showConfirm(t("deleteBtn"), t("confirmDeleteContract"), t("deleteBtn"), true))) return;
      showGlobalSpinner();
      const { data, error } = await db.functions.invoke("clever-action", {
        body: { action: "delete_contract", contract_id: btn.dataset.deleteContract }
      });
      hideGlobalSpinner();
      if (error || (data && data.error)) {
        showToast((data && data.error) ? data.error : t("somethingWrongDeletingContract"));
        return;
      }
      showToast(t("contractDeletedToast"));
      await loadContracts();
    });
  });
}

let CONTRACT_ALT_TEXT = "";
let CONTRACT_LANG = "ar";

function updateContractConvertBtnLabel() {
  document.getElementById("contractConvertBtn").textContent = CONTRACT_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
}

let CURRENT_VIEWED_CONTRACT = null;

function openContractViewModal(contractId, contractData) {
  const c = contractData || CONTRACTS_LIST.find(x => x.id === contractId);
  if (!c) return;
  CURRENT_VIEWED_CONTRACT = c;

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
  document.getElementById("contractViewOverlay").dataset.fileNumber = emp ? emp.file_number : "";
  document.getElementById("contractViewOverlay").dataset.employeeName = emp ? emp.full_name : "";

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
  document.getElementById("contractShareBtn").style.display = isSigned ? "none" : "";
  document.getElementById("contractShareBtn").textContent = (c.status === "commented" || c.status === "shared") ? t("shareAgainBtn") : t("shareWithEmployeeBtn");

  document.getElementById("contractViewOverlay").style.display = "flex";
}
document.getElementById("closeContractViewBtn").addEventListener("click", () => {
  document.getElementById("contractViewOverlay").style.display = "none";
});
document.getElementById("contractEditBtn").addEventListener("click", () => {
  if (!CURRENT_VIEWED_CONTRACT) return;
  const c = CURRENT_VIEWED_CONTRACT;
  document.getElementById("contractViewOverlay").style.display = "none";

  document.getElementById("contractCreateForm").reset();
  document.getElementById("contractCreateError").classList.remove("show");
  document.getElementById("contractDob").value = c.dob || "";
  document.getElementById("contractEducation").value = c.education || "";
  document.getElementById("contractAddress").value = c.address || "";
  document.getElementById("contractSalary").value = c.salary || "";
  document.getElementById("contractJobTitle").value = c.job_title || "";
  document.getElementById("contractStartDate").value = c.start_date || "";
  document.getElementById("contractPeriodMonths").value = c.contract_period_months || "";
  document.getElementById("contractCreateForm").dataset.targetId = c.employee_id;
  document.getElementById("contractCreateForm").dataset.editContractId = c.id;
  document.getElementById("contractCreateTitle").textContent = t("editContractFormTitle");
  document.getElementById("contractCreateBtn").textContent = t("saveChangesBtn");
  const editEmp = DIRECTORY.find(x => x.id === c.employee_id);
  document.getElementById("contractCreateEmployeeInfo").textContent = editEmp
    ? `${editEmp.full_name} · #${editEmp.file_number}${editEmp.client_company ? " · " + editEmp.client_company : ""}`
    : "";
  document.getElementById("contractCreateOverlay").style.display = "flex";
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
  const overlay = document.getElementById("contractViewOverlay");
  const signatureImage = CURRENT_VIEWED_CONTRACT ? CURRENT_VIEWED_CONTRACT.signature_image : null;
  downloadContractPDF("Contract", overlay.dataset.fileNumber, overlay.dataset.employeeName, text, signatureImage);
});

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(text || "");
}

// jsPDF's built-in fonts have no Arabic glyphs and it doesn't apply Arabic
// text shaping/RTL layout at all — rendering Arabic through doc.text()
// produces mojibake. Instead, we draw the Arabic text onto an HTML canvas
// (the browser's own text engine correctly shapes and right-aligns Arabic)
// and place that rendered image into the PDF, page by page.
async function renderArabicPagesToPdf(doc, text, logo) {
  const pageWidthMm = doc.internal.pageSize.getWidth();
  const pageHeightMm = doc.internal.pageSize.getHeight();
  const marginMm = 14;
  const contentWidthMm = pageWidthMm - marginMm * 2;

  const scale = 3; // render at higher pixel density for crisp text
  const pxPerMm = 3.7795 * scale;
  const canvasWidthPx = Math.round(contentWidthMm * pxPerMm);
  const lineHeightPx = Math.round(7 * pxPerMm);
  const fontSizePx = Math.round(4.2 * pxPerMm);

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = `${fontSizePx}px Tahoma, Arial, sans-serif`;
  mctx.direction = "rtl";

  const allLines = [];
  for (const para of text.split("\n")) {
    if (para.trim() === "") { allLines.push(""); continue; }
    const words = para.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (mctx.measureText(test).width > canvasWidthPx && current) {
        allLines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) allLines.push(current);
  }

  const firstPageTopMm = logo ? 32 : marginMm;
  const laterPageTopMm = marginMm;
  const firstPageLines = Math.floor(((pageHeightMm - firstPageTopMm - marginMm) * pxPerMm) / lineHeightPx);
  const laterPageLines = Math.floor(((pageHeightMm - laterPageTopMm - marginMm) * pxPerMm) / lineHeightPx);

  let i = 0;
  let pageIndex = 0;
  while (i < allLines.length || pageIndex === 0) {
    const linesThisPage = pageIndex === 0 ? firstPageLines : laterPageLines;
    const pageLines = allLines.slice(i, i + linesThisPage);
    i += linesThisPage;

    if (pageIndex > 0) doc.addPage();

    let yStartMm = pageIndex === 0 ? firstPageTopMm : laterPageTopMm;
    if (logo && pageIndex === 0) {
      const logoHeight = 14;
      const logoWidth = (logo.w / logo.h) * logoHeight;
      doc.addImage(logo.dataUrl, "PNG", pageWidthMm - marginMm - logoWidth, 10, logoWidth, logoHeight);
    }

    if (pageLines.length > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidthPx;
      canvas.height = pageLines.length * lineHeightPx;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1b2430";
      ctx.font = `${fontSizePx}px Tahoma, Arial, sans-serif`;
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      pageLines.forEach((line, idx) => ctx.fillText(line, canvas.width, idx * lineHeightPx));

      const imgHeightMm = canvas.height / pxPerMm;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", marginMm, yStartMm, contentWidthMm, imgHeightMm);
    }

    pageIndex++;
    if (allLines.length === 0) break;
  }
}

async function downloadContractPDF(kind, fileNumber, employeeName, text, signatureImage) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const logo = await loadLogoDataURL();

  if (containsArabic(text)) {
    await renderArabicPagesToPdf(doc, text, logo);
  } else {
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
  }

  if (signatureImage) {
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(27, 36, 48);
    doc.text("Employee Signature", 14, 24);
    try {
      const imgProps = doc.getImageProperties(signatureImage);
      const maxWidth = 100;
      const imgWidth = Math.min(maxWidth, imgProps.width);
      const imgHeight = (imgProps.height / imgProps.width) * imgWidth;
      doc.addImage(signatureImage, 14, 34, imgWidth, imgHeight);
    } catch (e) {
      doc.setFontSize(10);
      doc.text("(Signature image could not be embedded)", 14, 40);
    }
  }

  const safeName = (employeeName || "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const safeFileNumber = (fileNumber || "").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`${kind}-${safeFileNumber}-${safeName}.pdf`);
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

  showGlobalSpinner();
  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "freeze_employee", target_id: id, reason }
  });
  hideGlobalSpinner();

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

  showGlobalSpinner();
  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "unfreeze_employee", target_id: id }
  });
  hideGlobalSpinner();

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
  document.getElementById("editAddress").value = e.address || "";
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
  const address = document.getElementById("editAddress").value.trim() || null;

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
  setBtnLoading(btn, true, t("saving"));

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "update_employee", target_id, full_name, email, hiring_date, department, client_company, role, supervisor_file_number, annual_entitlement_override, carryover_balance, dob, nationality, address, education, salary, taken_this_year }
  });

  setBtnLoading(btn, false);

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

  showGlobalSpinner();
  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "reset_password", target_id: id }
  });
  hideGlobalSpinner();

  if (error || (data && data.error)) {
    showToast(t("couldNotResetPasswordToast"));
    return;
  }

  await showInfo(
    t("newPasswordGeneratedTitle"),
    tv("newPasswordGeneratedMsg", { name: employee.full_name, fileNumber: employee.file_number, password: data.password }),
    `${t("fileNumColonLabel")} ${employee.file_number}\n${t("initialPasswordColonLabel")} ${data.password}`
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

  showGlobalSpinner();
  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "delete_employee", target_id: id }
  });
  hideGlobalSpinner();

  if (error || (data && data.error)) {
    showToast((data && data.error) ? data.error : t("couldNotDeleteEmployee"));
    return;
  }

  showToast(t("employeeDeletedToast"));
  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
}

function showDateRangePrompt(title) {
  return new Promise(async (resolve) => {
    document.getElementById("dateRangeTitle").textContent = title;
    document.getElementById("rangeFromInput").value = "";
    document.getElementById("rangeToInput").value = "";
    document.getElementById("rangeEmployeeIdInput").value = "";
    document.getElementById("rangeIncludeFrozen").checked = false;
    document.getElementById("rangeFormatPdf").checked = true;
    document.getElementById("rangeFormatExcel").checked = false;
    document.getElementById("rangeFormatError").classList.remove("show");

    const companySelect = document.getElementById("rangeCompanySelect");
    const { data: companies } = await db.from("client_companies").select("name").order("name");
    companySelect.innerHTML = `<option value="">All companies</option>` +
      (companies || []).map(c => `<option value="${c.name}">${c.name}</option>`).join("");
    companySelect.value = COMPANY_FILTER || "";

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
      const company = document.getElementById("rangeCompanySelect").value || null;
      const includeFrozen = document.getElementById("rangeIncludeFrozen").checked;
      cleanup();
      resolve({ from, to, employeeId, company, includeFrozen, wantPdf, wantExcel });
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
  const companyToApply = range.company || COMPANY_FILTER;
  if (!range.employeeId && companyToApply) source = source.filter(e => e.client_company === companyToApply);
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
  const scope = companyToApply ? `${companyToApply} — ` : "";
  const title = scope + (ACTIVE_TAB === "supervisors" ? "Supervisors — Leave Report" : "Employees — Leave Report");
  const filenamePrefix = companyToApply ? `${companyToApply.toLowerCase()}_` : "";
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
  } else if (range.company || COMPANY_FILTER) {
    const companyToApply = range.company || COMPANY_FILTER;
    rows = rows.filter(r => byId[r.employee_id] && byId[r.employee_id].client_company === companyToApply);
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

  const companyScope = range.company || COMPANY_FILTER;
  const scope = companyScope ? `${companyScope} — ` : "";
  const rangeNote = (range.from || range.to) ? ` — ${range.from || "…"} to ${range.to || "…"}` : "";
  const columns = ["Employee Name", "Company", "Dates", "Days", "Type", "Status"];
  const baseFilename = `${companyScope ? companyScope.toLowerCase() + "_" : ""}leave_requests_report`;

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

async function populateSupAdminCompanyOptions() {
  const { data } = await db.from("client_companies").select("name").order("name");
  const select = document.getElementById("supAdminCompany");
  select.innerHTML = `<option value="">${t("selectCompanyPlaceholder")}</option>`;
  for (const c of data || []) {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
}

document.getElementById("showAddSupervisorAdminBtn").addEventListener("click", async () => {
  document.getElementById("addSupervisorAdminForm").reset();
  document.getElementById("addSupervisorAdminForm").style.display = "";
  document.getElementById("addSupervisorAdminError").classList.remove("show");
  document.getElementById("supervisorAdminCredentialsBox").classList.remove("show");
  await populateSupAdminCompanyOptions();
  const companySelect = document.getElementById("supAdminCompany");
  if (COMPANY_FILTER) {
    companySelect.value = COMPANY_FILTER;
    companySelect.disabled = true;
  } else {
    companySelect.disabled = false;
  }
  populateDepartmentOptions(document.getElementById("supAdminDepartment"), companySelect.value, null);
  document.getElementById("addSupervisorOverlay").style.display = "flex";
});
document.getElementById("closeAddSupervisorAdminBtn").addEventListener("click", () => {
  document.getElementById("addSupervisorOverlay").style.display = "none";
});
document.getElementById("cancelAddSupervisorAdminBtn").addEventListener("click", async () => {
  document.getElementById("addSupervisorOverlay").style.display = "none";
  const confirmed = await showConfirm(t("cancel"), "Any information entered so far will be lost. Are you sure you want to cancel?", "Yes, Cancel it", true);
  if (!confirmed) {
    document.getElementById("addSupervisorOverlay").style.display = "flex";
  }
});
document.getElementById("supAdminCompany").addEventListener("change", () => {
  populateDepartmentOptions(document.getElementById("supAdminDepartment"), document.getElementById("supAdminCompany").value, null);
});

document.getElementById("addSupervisorAdminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("addSupervisorAdminError");
  const credBox = document.getElementById("supervisorAdminCredentialsBox");
  errBox.classList.remove("show");
  credBox.classList.remove("show");

  const full_name = document.getElementById("supAdminFullName").value.trim();
  const email = document.getElementById("supAdminEmail").value.trim();
  const client_company = document.getElementById("supAdminCompany").value;
  const department = document.getElementById("supAdminDepartment").value;

  if (!client_company) {
    errBox.textContent = t("pleaseSelectCompany");
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("addSupervisorAdminBtn");
  setBtnLoading(btn, true, t("creating"));

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "create_employee", full_name, email, role: "supervisor", department, client_company }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongCreating");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("supAdminCredFileNumber").textContent = data.file_number;
  document.getElementById("supAdminCredPassword").textContent = data.password;
  credBox.classList.add("show");
  document.getElementById("addSupervisorAdminForm").style.display = "none";
  document.getElementById("copySupAdminCredsBtn").onclick = () => {
    navigator.clipboard.writeText(
      `${t("fileNumColonLabel")} ${data.file_number}\n${t("initialPasswordColonLabel")} ${data.password}\nSign in at: ${window.location.origin}`
    );
    showToast(t("copiedToast"));
  };

  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
});

// ================= Add Employee wizard =================
function yearsSinceHire(dateStr) {
  if (!dateStr) return 0;
  const hire = new Date(dateStr);
  return (Date.now() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

const EMP_WIZARD = {
  stepIndex: 0,
  phase: "steps", // "steps" | "creating" | "done"
  values: {},
  stagedFiles: [],
  employeeId: null,
  fileNumber: null,
  password: null,
};

const COUNTRY_CODES = [
  ["+962", "Jordan"], ["+966", "Saudi Arabia"], ["+971", "UAE"], ["+965", "Kuwait"],
  ["+973", "Bahrain"], ["+974", "Qatar"], ["+968", "Oman"], ["+20", "Egypt"],
  ["+961", "Lebanon"], ["+963", "Syria"], ["+964", "Iraq"], ["+970", "Palestine"],
  ["+90", "Turkey"], ["+1", "USA / Canada"], ["+44", "United Kingdom"], ["+49", "Germany"],
  ["+33", "France"], ["+39", "Italy"], ["+34", "Spain"], ["+31", "Netherlands"],
  ["+46", "Sweden"], ["+41", "Switzerland"], ["+91", "India"], ["+92", "Pakistan"],
  ["+86", "China"], ["+81", "Japan"], ["+82", "South Korea"], ["+60", "Malaysia"],
  ["+65", "Singapore"], ["+62", "Indonesia"], ["+63", "Philippines"], ["+880", "Bangladesh"],
  ["+94", "Sri Lanka"], ["+251", "Ethiopia"], ["+254", "Kenya"], ["+27", "South Africa"],
  ["+234", "Nigeria"], ["+212", "Morocco"], ["+216", "Tunisia"], ["+213", "Algeria"],
  ["+7", "Russia"], ["+61", "Australia"], ["+64", "New Zealand"], ["+55", "Brazil"], ["+52", "Mexico"],
];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function ewSimpleField(key, title, label, type, required) {
  return {
    key, title, required,
    render(container) {
      const val = EMP_WIZARD.values[key] ?? (type === "number" ? 0 : "");
      container.innerHTML = `<label for="ew_${key}">${label}</label><input type="${type}" id="ew_${key}" value="${String(val).replace(/"/g, "&quot;")}" ${type === "number" ? 'min="0" step="1"' : ""}>`;
      const input = document.getElementById(`ew_${key}`);
      setTimeout(() => input.focus(), 0);
    },
    save() {
      const input = document.getElementById(`ew_${key}`);
      EMP_WIZARD.values[key] = type === "number" ? (Number(input.value) || 0) : input.value.trim();
    },
    valid() {
      return required ? !!EMP_WIZARD.values[key] : true;
    },
  };
}

const EMP_WIZARD_STEPS = [
  ewSimpleField("full_name", t("fullNameLabel"), t("fullNameLabel"), "text", true),
  ewSimpleField("dob", t("colDob"), t("colDob"), "date", false),
  {
    key: "email", title: t("emailLabel"), required: true,
    render(container) {
      container.innerHTML = `<label for="ew_email">${t("emailLabel")}</label><input type="email" id="ew_email" value="${escapeHtml(EMP_WIZARD.values.email)}">`;
      setTimeout(() => document.getElementById("ew_email").focus(), 0);
    },
    save() { EMP_WIZARD.values.email = document.getElementById("ew_email").value.trim(); },
    valid() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMP_WIZARD.values.email); },
    errorMsg: "Please enter a valid email address (e.g. name@example.com).",
  },
  ewSimpleField("address", "Address", "Address", "text", false),
  {
    key: "education", title: "Education", required: false,
    render(container) {
      const options = ["School", "Diploma", "Bachelor's Degree", "Master's Degree", "PhD"];
      const val = EMP_WIZARD.values.education || "";
      container.innerHTML = `<label>Education</label><select id="ew_education">
        <option value="">Select education…</option>
        ${options.map(o => `<option value="${o}" ${o === val ? "selected" : ""}>${o}</option>`).join("")}
      </select>`;
    },
    save() { EMP_WIZARD.values.education = document.getElementById("ew_education").value; },
    valid() { return true; },
  },
  {
    key: "phone", title: "Phone number", required: true,
    render(container) {
      const prefix = EMP_WIZARD.values.phone_prefix || "+962";
      container.innerHTML = `
        <label>Phone number</label>
        <div style="display:flex; gap:8px">
          <select id="ew_phone_prefix" style="max-width:170px">
            ${COUNTRY_CODES.map(([code, name]) => `<option value="${code}" ${code === prefix ? "selected" : ""}>${code} — ${name}</option>`).join("")}
          </select>
          <input type="tel" id="ew_phone_number" placeholder="7XXXXXXXX" value="${escapeHtml(EMP_WIZARD.values.phone_number)}" style="flex:1">
        </div>
      `;
    },
    save() {
      EMP_WIZARD.values.phone_prefix = document.getElementById("ew_phone_prefix").value;
      EMP_WIZARD.values.phone_number = document.getElementById("ew_phone_number").value.trim();
    },
    valid() { return !!EMP_WIZARD.values.phone_number; },
    errorMsg: "Please enter a phone number.",
  },
  ewSimpleField("hiring_date", t("hiringDateLabel"), t("hiringDateLabel"), "date", true),
  ewSimpleField("job_title", "Job Title", "Job Title", "text", false),
  ewSimpleField("contract_period_months", "Contract period (months)", "Contract period (months)", "number", true),
  ewSimpleField("salary", "Salary (JOD/month)", "Salary (JOD/month)", "number", false),
  {
    ...ewSimpleField("carryover", t("carryoverLabel"), t("carryoverLabel"), "number", false),
    showIf: (v) => yearsSinceHire(v.hiring_date) >= 1,
  },
  {
    ...ewSimpleField("taken_this_year", t("takenThisYearLabel"), t("takenThisYearLabel"), "number", false),
    showIf: (v) => !(yearsSinceHire(v.hiring_date) >= 1 && Number(v.carryover) > 0),
  },
  {
    key: "company", title: t("companyClientLabel"), required: true,
    async render(container) {
      container.innerHTML = `<label>${t("companyClientLabel")}</label><select id="ew_company"><option value="">${t("selectCompanyPlaceholder")}</option></select>`;
      const sel = document.getElementById("ew_company");
      const { data } = await db.from("client_companies").select("name").order("name");
      for (const c of data || []) {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name;
        sel.appendChild(opt);
      }
      if (COMPANY_FILTER) {
        sel.value = COMPANY_FILTER;
        sel.disabled = true;
      } else if (EMP_WIZARD.values.company) {
        sel.value = EMP_WIZARD.values.company;
      }
    },
    save() { EMP_WIZARD.values.company = document.getElementById("ew_company").value; },
    valid() { return !!EMP_WIZARD.values.company; },
  },
  {
    key: "department", title: t("departmentLabel"), required: true,
    render(container) {
      container.innerHTML = `<label>${t("departmentLabel")}</label><select id="ew_department"></select>`;
      populateDepartmentOptions(document.getElementById("ew_department"), EMP_WIZARD.values.company, EMP_WIZARD.values.department || null);
    },
    save() { EMP_WIZARD.values.department = document.getElementById("ew_department").value; },
    valid() { return !!EMP_WIZARD.values.department; },
  },
  {
    key: "supervisor", title: t("assignSupervisorLabel"), required: true,
    render(container) {
      const matches = supervisorsForCompany(EMP_WIZARD.values.company);
      container.innerHTML = `<label>${t("assignSupervisorLabel")}</label><select id="ew_supervisor">
        <option value="">${matches.length ? t("selectSupervisorPlaceholder") : t("noSupervisorsYetPlaceholder")}</option>
        ${matches.map(s => `<option value="${s.file_number}">${s.full_name} (#${s.file_number})</option>`).join("")}
      </select>`;
      if (EMP_WIZARD.values.supervisor_file_number) {
        document.getElementById("ew_supervisor").value = EMP_WIZARD.values.supervisor_file_number;
      }
    },
    save() { EMP_WIZARD.values.supervisor_file_number = document.getElementById("ew_supervisor").value || null; },
    valid() { return !!EMP_WIZARD.values.supervisor_file_number; },
  },
  {
    // Staging only — nothing uploaded yet, no employee exists yet. Files are
    // held client-side; both "Skip" and "Next" here just move on to Review,
    // where the account is actually created (and staged files uploaded).
    key: "documents_staging", title: "Upload Documents",
    render(container) {
      container.innerHTML = `
        <p style="margin:0 0 10px">Attach the employee's CV and certificates, up to 5 documents. This is optional — click Skip if you don't want to attach anything.</p>
        <input type="file" id="ewDocFile" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
        <div id="ewDocStagingList" style="margin-top:14px"></div>
      `;
      document.getElementById("ewDocFile").addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
          if (EMP_WIZARD.stagedFiles.length >= 5) {
            ewShowError("Maximum of 5 documents allowed per employee.");
            break;
          }
          EMP_WIZARD.stagedFiles.push(file);
        }
        e.target.value = "";
        ewRenderStagedList();
        ewUpdateDocStepNextVisibility();
      });
      ewRenderStagedList();
    },
    save() {},
    valid() { return true; },
  },
  {
    key: "review", title: "Review & Create",
    render(container) {
      const v = EMP_WIZARD.values;
      const phoneDisplay = v.phone_number ? `${v.phone_prefix || ""} ${v.phone_number}` : "—";
      container.innerHTML = `
        <div style="font-size:13.5px; line-height:1.9">
          <p><strong>${t("fullNameLabel")}:</strong> ${escapeHtml(v.full_name)}</p>
          <p><strong>${t("colDob")}:</strong> ${v.dob || "—"}</p>
          <p><strong>${t("emailLabel")}:</strong> ${escapeHtml(v.email)}</p>
          <p><strong>Address:</strong> ${v.address ? escapeHtml(v.address) : "—"}</p>
          <p><strong>Education:</strong> ${v.education ? escapeHtml(v.education) : "—"}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phoneDisplay)}</p>
          <p><strong>${t("hiringDateLabel")}:</strong> ${v.hiring_date || "—"}</p>
          <p><strong>Job Title:</strong> ${v.job_title ? escapeHtml(v.job_title) : "—"}</p>
          <p><strong>Contract period:</strong> ${v.contract_period_months ? v.contract_period_months + " months" : "—"}</p>
          <p><strong>Salary:</strong> ${v.salary ? v.salary + " JOD" : "—"}</p>
          <p><strong>${t("companyClientLabel")}:</strong> ${escapeHtml(v.company)}</p>
          <p><strong>${t("departmentLabel")}:</strong> ${escapeHtml(v.department)}</p>
          <p><strong>Documents:</strong> ${EMP_WIZARD.stagedFiles.length ? escapeHtml(EMP_WIZARD.stagedFiles.map(f => f.name).join(", ")) : "None"}</p>
        </div>
      `;
    },
    save() {},
    valid() { return true; },
  },
];

function ewVisibleSteps() {
  return EMP_WIZARD_STEPS.filter(s => !s.showIf || s.showIf(EMP_WIZARD.values));
}

function ewShowError(msg) {
  const box = document.getElementById("empWizardError");
  box.textContent = msg;
  box.classList.add("show");
}

function ewRenderStagedList() {
  const listEl = document.getElementById("ewDocStagingList");
  if (!listEl) return;
  listEl.innerHTML = EMP_WIZARD.stagedFiles.length
    ? EMP_WIZARD.stagedFiles.map((f, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border)">
        <span style="font-size:13.5px">${escapeHtml(f.name)}</span>
        <button type="button" data-remove-staged="${i}" title="Remove" style="background:none; border:none; color:#c0392b; font-size:19px; font-weight:bold; line-height:1; cursor:pointer; padding:0 4px">✕</button>
      </div>
    `).join("")
    : `<p class="help-text" style="margin:0">No documents selected yet.</p>`;

  listEl.querySelectorAll("button[data-remove-staged]").forEach(btn => {
    btn.addEventListener("click", () => {
      EMP_WIZARD.stagedFiles.splice(Number(btn.dataset.removeStaged), 1);
      ewRenderStagedList();
      ewUpdateDocStepNextVisibility();
    });
  });
}

// On the Upload Documents step, "Next" only appears once at least one file
// has been attached — before that, Skip is the only way forward without
// attaching anything.
function ewUpdateDocStepNextVisibility() {
  const nextBtn = document.getElementById("empWizardNextBtn");
  if (!nextBtn) return;
  nextBtn.style.display = EMP_WIZARD.stagedFiles.length > 0 ? "" : "none";
}

function ewRenderSpinner(message) {
  document.getElementById("empWizardStepCounter").textContent = "";
  document.getElementById("empWizardTitle").textContent = "";
  document.getElementById("empWizardError").classList.remove("show");
  document.getElementById("empWizardBody").innerHTML = `
    <div style="text-align:center; padding:10px 0">
      <div class="ew-spinner"></div>
      <p style="margin-top:6px; color:var(--ink-soft)">${message}</p>
    </div>
  `;
  document.getElementById("empWizardBackBtn").style.display = "none";
  document.getElementById("empWizardSkipBtn").style.display = "none";
  document.getElementById("empWizardCancelBtn").style.display = "none";
  document.getElementById("empWizardNextBtn").style.display = "none";
}

// Creates the employee, then uploads whatever is in stagedFiles (which may
// be empty, whether because the admin skipped or just attached nothing).
async function ewFinalizeCreation() {
  EMP_WIZARD.phase = "creating";
  ewRenderSpinner("Creating employee and uploading documents…");

  const v = EMP_WIZARD.values;
  const phone_number = v.phone_number ? `${v.phone_prefix || ""} ${v.phone_number}`.trim() : null;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: {
      action: "create_employee",
      full_name: v.full_name,
      email: v.email,
      phone_number,
      dob: v.dob || null,
      address: v.address || null,
      education: v.education || null,
      salary: v.salary ? Number(v.salary) : null,
      role: "staff",
      hiring_date: v.hiring_date,
      department: v.department,
      client_company: v.company,
      supervisor_file_number: v.supervisor_file_number,
      carryover_balance: v.carryover || 0,
      taken_this_year: v.taken_this_year || 0,
    }
  });

  if (error || (data && data.error)) {
    EMP_WIZARD.phase = "steps";
    await ewRenderCurrentStep();
    ewShowError((data && data.error) ? data.error : t("somethingWrongCreating"));
    return;
  }

  EMP_WIZARD.employeeId = data.target_id;
  EMP_WIZARD.fileNumber = data.file_number;
  EMP_WIZARD.password = data.password;

  const uploadErrors = [];
  for (let i = 0; i < EMP_WIZARD.stagedFiles.length; i++) {
    const file = EMP_WIZARD.stagedFiles[i];
    ewRenderSpinner(`Uploading document ${i + 1} of ${EMP_WIZARD.stagedFiles.length}…`);
    const result = await ewUploadStagedFile(file);
    if (!result.ok) uploadErrors.push(`${file.name}: ${result.error}`);
  }

  EMP_WIZARD.phase = "done";
  await ewRenderDoneScreen(uploadErrors);
}

async function ewUploadStagedFile(file) {
  const { data: urlData, error: urlErr } = await db.functions.invoke("clever-action", {
    body: { action: "get_upload_url", target_id: EMP_WIZARD.employeeId, file_name: file.name }
  });
  if (urlErr || (urlData && urlData.error)) {
    return { ok: false, error: (urlData && urlData.error) || "Could not prepare upload." };
  }

  const { error: upErr } = await db.storage.from("employee-documents").uploadToSignedUrl(urlData.path, urlData.token, file);
  if (upErr) {
    return { ok: false, error: upErr.message || "Upload failed." };
  }

  const { data: recData, error: recErr } = await db.functions.invoke("clever-action", {
    body: { action: "record_document", target_id: EMP_WIZARD.employeeId, file_name: file.name, storage_path: urlData.path }
  });
  if (recErr || (recData && recData.error)) {
    return { ok: false, error: (recData && recData.error) || "Could not save document record." };
  }

  return { ok: true };
}

async function ewRenderDoneScreen(uploadErrors) {
  document.getElementById("empWizardStepCounter").textContent = "";
  document.getElementById("empWizardTitle").textContent = "";
  document.getElementById("empWizardError").classList.remove("show");

  const body = document.getElementById("empWizardBody");
  body.innerHTML = `
    <div class="success-msg show" style="margin-bottom:16px">
      <p style="margin:0 0 6px"><strong>${t("employeeCreatedMsg")}</strong></p>
      <p style="margin:0">${t("fileNumColonLabel")} <strong>${EMP_WIZARD.fileNumber}</strong></p>
      <p style="margin:0">${t("initialPasswordColonLabel")} <strong>${EMP_WIZARD.password}</strong></p>
      <p style="margin:8px 0 0"><button type="button" class="btn btn-blue btn-sm" id="ewCopyCredsBtn">${t("copyDetailsBtn")}</button></p>
    </div>
    ${uploadErrors && uploadErrors.length ? `<div class="error-msg show">Some documents could not be uploaded: ${escapeHtml(uploadErrors.join("; "))}</div>` : ""}
  `;
  document.getElementById("ewCopyCredsBtn").onclick = () => {
    navigator.clipboard.writeText(
      `${t("fileNumColonLabel")} ${EMP_WIZARD.fileNumber}\n${t("initialPasswordColonLabel")} ${EMP_WIZARD.password}\nSign in at: ${window.location.origin}`
    );
    showToast(t("copiedToast"));
  };

  document.getElementById("empWizardBackBtn").style.display = "none";
  document.getElementById("empWizardCancelBtn").style.display = "none";

  const skipBtn = document.getElementById("empWizardSkipBtn");
  skipBtn.textContent = "Share Job Contract";
  skipBtn.style.width = "220px";
  skipBtn.style.display = "";

  const nextBtn = document.getElementById("empWizardNextBtn");
  nextBtn.textContent = "Finish";
  nextBtn.style.display = "";

  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
}

async function ewRenderCurrentStep() {
  const steps = ewVisibleSteps();
  if (EMP_WIZARD.stepIndex >= steps.length) EMP_WIZARD.stepIndex = steps.length - 1;
  const stepDef = steps[EMP_WIZARD.stepIndex];

  document.getElementById("empWizardStepCounter").textContent = `Step ${EMP_WIZARD.stepIndex + 1} of ${steps.length}`;
  document.getElementById("empWizardTitle").textContent = stepDef.title;
  document.getElementById("empWizardError").classList.remove("show");

  const body = document.getElementById("empWizardBody");
  body.innerHTML = "";
  await stepDef.render(body);

  const backBtn = document.getElementById("empWizardBackBtn");
  const skipBtn = document.getElementById("empWizardSkipBtn");
  const nextBtn = document.getElementById("empWizardNextBtn");
  const cancelBtn = document.getElementById("empWizardCancelBtn");

  backBtn.style.display = EMP_WIZARD.stepIndex === 0 ? "none" : "";
  cancelBtn.style.display = "";
  nextBtn.style.display = "";

  const SKIPPABLE_STEPS = ["documents_staging", "dob", "salary", "address", "education", "job_title"];

  if (SKIPPABLE_STEPS.includes(stepDef.key)) {
    skipBtn.textContent = "Skip";
    skipBtn.style.width = "120px";
    skipBtn.style.display = "";
    nextBtn.textContent = "Next ›";
    if (stepDef.key === "documents_staging") {
      ewUpdateDocStepNextVisibility();
    }
  } else if (stepDef.key === "review") {
    skipBtn.style.display = "none";
    nextBtn.textContent = "Create employee";
  } else {
    skipBtn.style.display = "none";
    nextBtn.textContent = "Next ›";
  }
}

document.getElementById("empWizardBackBtn").addEventListener("click", async () => {
  EMP_WIZARD.stepIndex = Math.max(0, EMP_WIZARD.stepIndex - 1);
  await ewRenderCurrentStep();
});

document.getElementById("empWizardCancelBtn").addEventListener("click", async () => {
  document.getElementById("empWizardOverlay").style.display = "none";
  const confirmed = await showConfirm(t("cancel"), "Any information entered so far will be lost. Are you sure you want to cancel?", "Yes, Cancel it", true);
  if (!confirmed) {
    document.getElementById("empWizardOverlay").style.display = "flex";
  }
});

document.getElementById("empWizardSkipBtn").addEventListener("click", async () => {
  if (EMP_WIZARD.phase === "done") {
    // "Share Job Contract" — openContractCreateModal now pulls dob/education/
    // address/salary/start date straight from the employee's stored profile.
    // Contract period isn't a stored profile field, so fill it in here from
    // whatever was entered earlier in this same wizard run.
    document.getElementById("empWizardOverlay").style.display = "none";
    await openContractCreateModal(EMP_WIZARD.employeeId);
    if (EMP_WIZARD.values.job_title) {
      document.getElementById("contractJobTitle").value = EMP_WIZARD.values.job_title;
    }
    if (EMP_WIZARD.values.contract_period_months) {
      document.getElementById("contractPeriodMonths").value = EMP_WIZARD.values.contract_period_months;
    }
    return;
  }

  const steps = ewVisibleSteps();
  const stepDef = steps[EMP_WIZARD.stepIndex];

  if (stepDef.key === "documents_staging") {
    // Discard any staged files, then move on to Review (same destination as
    // clicking Next — nothing is created yet).
    EMP_WIZARD.stagedFiles = [];
    EMP_WIZARD.stepIndex++;
    await ewRenderCurrentStep();
    return;
  }

  if (stepDef.key === "dob" || stepDef.key === "salary" || stepDef.key === "address" || stepDef.key === "education" || stepDef.key === "job_title") {
    // Skip without saving whatever's typed in the box — just move on.
    EMP_WIZARD.stepIndex++;
    await ewRenderCurrentStep();
    return;
  }
});

document.getElementById("empWizardNextBtn").addEventListener("click", async () => {
  if (EMP_WIZARD.phase === "done") {
    document.getElementById("empWizardOverlay").style.display = "none";
    return;
  }

  const steps = ewVisibleSteps();
  const stepDef = steps[EMP_WIZARD.stepIndex];

  if (stepDef.save) stepDef.save();
  if (stepDef.valid && !stepDef.valid()) {
    ewShowError(stepDef.errorMsg || "Please fill in this field before continuing.");
    return;
  }

  if (stepDef.key === "review") {
    await ewFinalizeCreation();
    return;
  }

  EMP_WIZARD.stepIndex++;
  await ewRenderCurrentStep();
});

document.getElementById("showAddFormBtn").addEventListener("click", async () => {
  EMP_WIZARD.stepIndex = 0;
  EMP_WIZARD.phase = "steps";
  EMP_WIZARD.values = {
    full_name: "", dob: "", email: "", address: "", education: "",
    phone_prefix: "+962", phone_number: "", hiring_date: "",
    contract_period_months: "", salary: "",
    carryover: 0, taken_this_year: 0,
    company: COMPANY_FILTER || "", department: "", supervisor_file_number: "", job_title: "",
  };
  EMP_WIZARD.stagedFiles = [];
  EMP_WIZARD.employeeId = null;
  EMP_WIZARD.fileNumber = null;
  EMP_WIZARD.password = null;
  document.getElementById("empWizardOverlay").style.display = "flex";
  await ewRenderCurrentStep();
});

(async () => {
  ME = await requireSession("admin");
  if (!ME) return;
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  if (COMPANY_FILTER) {
    document.getElementById("pageTitle").textContent = `${COMPANY_FILTER} — ${t("companyScopedTitleSuffix")}`;
    document.getElementById("pageSub").textContent = tv("companyScopedSub", { company: COMPANY_FILTER });
  }
  await Promise.all([loadSupervisors(), loadBalances()]);
  await loadDirectory();

  // Deep link from the dashboard's "View" buttons: ?tab=contracts&contractId=... / ?tab=warnings&warningId=...
  const qs = new URLSearchParams(window.location.search);
  const deepLinkTab = qs.get("tab");
  if (deepLinkTab === "contracts") {
    applyTab("contracts");
    await loadContracts();
    const contractId = qs.get("contractId");
    if (contractId) openContractViewModal(contractId);
  } else if (deepLinkTab === "warnings") {
    applyTab("warnings");
    await loadWarnings();
    const warningId = qs.get("warningId");
    if (warningId) openWarningViewModal(warningId);
  }
})();
