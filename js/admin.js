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

function newBadge(dateStr) {
  if (!dateStr) return "";
  const ageMs = Date.now() - new Date(dateStr).getTime();
  if (ageMs < 0 || ageMs > 24 * 60 * 60 * 1000) return "";
  return ` <span style="display:inline-block; background:#1f9d55; color:#fff; font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:10px; vertical-align:middle; margin-inline-start:6px">NEW</span>`;
}

function matchesTableSearch(query, fileNumber, company, role, name, department) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (fileNumber || "").toLowerCase().includes(q) ||
         (company || "").toLowerCase().includes(q) ||
         (role || "").toLowerCase().includes(q) ||
         (name || "").toLowerCase().includes(q) ||
         (department || "").toLowerCase().includes(q);
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
        return matchesTableSearch(leaveQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : LEAVE_REQUESTS_LIST;
  notifyIfNoSearchResults(document.getElementById("leaveRequestsSearchInput"), leaveQuery, filteredLeave.length);

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
      <td>${badgeFor(r.status)}${newBadge(r.requested_at)}</td>
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

function countActiveWarnings(employeeId) {
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  return WARNINGS_LIST.filter(w => {
    if (w.employee_id !== employeeId || w.status !== "sent") return false;
    const dateStr = w.sent_at || w.created_at;
    if (!dateStr) return false;
    return new Date(dateStr).getTime() >= cutoff;
  }).length;
}

function hasActiveWarning(employeeId) {
  return countActiveWarnings(employeeId) > 0;
}

function activeWarningBadge(employeeId) {
  const count = Math.min(countActiveWarnings(employeeId), 3);
  if (count === 0) return "";
  const circle = `<span style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:#c0392b; color:#fff; font-size:11px; font-weight:700; vertical-align:middle">W</span>`;
  return ` <span title="${count} active warning${count > 1 ? "s" : ""} within the last year" style="display:inline-flex; gap:2px; margin-inline-start:6px">${circle.repeat(count)}</span>`;
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
  if (directoryQuery) allRows = allRows.filter(e => matchesTableSearch(directoryQuery, e.file_number, e.client_company, e.role, e.full_name, e.department));
  notifyIfNoSearchResults(document.getElementById("directorySearchInput"), directoryQuery, allRows.length);

  const start = DIRECTORY_PAGE * PAGE_SIZE;
  const rows = allRows.slice(start, start + PAGE_SIZE);

  for (const e of rows) {
    const supervisorName = e.supervisor_id && byId[e.supervisor_id] ? byId[e.supervisor_id].full_name : "—";
    const isSelf = e.id === ME.id;
    const bal = BALANCES_BY_ID[e.id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.full_name}${activeWarningBadge(e.id)}${e.frozen ? ` <span class="badge badge-frozen">${t("statusFrozenBadge")} - ${e.frozen_reason === "termination" ? "T" : e.frozen_reason === "resignation" ? "R" : e.frozen_reason === "end_of_contract" ? "E" : "?"}</span>` : ""}</td>
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
            ${e.role === "staff" && !CONTRACTS_LIST.some(c => c.employee_id === e.id) ? `<button type="button" data-contract="${e.id}">${t("shareContractBtn")}</button>` : ""}
            ${e.role === "staff" && CONTRACTS_LIST.some(c => c.employee_id === e.id) ? `<button type="button" data-renew-contract="${e.id}">Renew Contract</button>` : ""}
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
  body.querySelectorAll("button[data-renew-contract]").forEach(btn => {
    btn.addEventListener("click", async () => { closeActionMenus(); await openRenewContractModal(btn.dataset.renewContract); });
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

// Opens the same contract form used for creating a new contract, but
// pre-filled from the employee's most recent signed contract (carrying
// over salary, job title, and period), with the new start date set to the
// day right after the expiring contract ends. Deliberately does not apply
// the "active contract already exists" block from openContractCreateModal,
// since renewing is meant to work even while the current contract is still
// technically active — that's the whole point of proactive renewal.
async function openRenewContractModal(employeeId) {
  const e = DIRECTORY.find(x => x.id === employeeId);
  if (!e) return;

  const { data: contracts } = await db
    .from("contracts")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "signed")
    .order("end_date", { ascending: false })
    .limit(1);
  const expiring = contracts && contracts[0];

  document.getElementById("contractCreateForm").reset();
  document.getElementById("contractCreateError").classList.remove("show");
  document.getElementById("contractCreateForm").dataset.targetId = employeeId;
  delete document.getElementById("contractCreateForm").dataset.editContractId;
  document.getElementById("contractCreateTitle").textContent = "Renew Contract";
  document.getElementById("contractCreateBtn").textContent = "Prepare Renewal";
  document.getElementById("contractCreateEmployeeInfo").textContent =
    `${e.full_name} · #${e.file_number}${e.client_company ? " · " + e.client_company : ""}`;

  document.getElementById("contractDob").value = e.dob || "";
  document.getElementById("contractEducation").value = e.education || "";
  document.getElementById("contractAddress").value = e.address || "";
  document.getElementById("contractSalary").value = expiring ? (expiring.salary ?? "") : (e.salary || "");
  document.getElementById("contractJobTitle").value = expiring ? (expiring.job_title || "") : "";
  document.getElementById("contractPeriodMonths").value = expiring ? (expiring.contract_period_months ?? "") : "";

  let newStartDate = new Date().toISOString().slice(0, 10);
  if (expiring && expiring.end_date) {
    const d = new Date(expiring.end_date);
    d.setDate(d.getDate() + 1);
    newStartDate = d.toISOString().slice(0, 10);
  }
  document.getElementById("contractStartDate").value = newStartDate;

  document.getElementById("contractCreateOverlay").style.display = "flex";
}

// Builds the exact FWX outsourcing contract text (from the company's
// official Arabic template), substituting in this specific employee's
// details. Called right after create/update_contract, then saved over
// whatever the server generated via the existing update_contract action —
// this lets us guarantee exact wording without needing to touch the
// Edge Function that runs server-side.
function buildFullContractText({ employeeName, nationalId, jobTitle, salary, startDate, contractPeriodMonths, companyName }) {
  const fmtDMY = (isoDate) => {
    if (!isoDate) return "......................";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  };
  const endDateIso = (() => {
    if (!startDate || !contractPeriodMonths) return null;
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + Number(contractPeriodMonths));
    return d.toISOString().slice(0, 10);
  })();

  const startDisplay = fmtDMY(startDate);
  const endDisplay = fmtDMY(endDateIso);
  const nationalIdDisplay = nationalId || "......................";
  const salaryDisplay = salary ? String(salary) : "      ";
  const jobTitlePhrase = jobTitle
    ? `كـ ${jobTitle}`
    : "كـ فني إتصالات و/او كـ مهندس اتصالات موظف مبيعات";
  const companyDisplay = companyName || "الشركة المشغلة";

  return `عقد مصادر خارجية محدد المدة

الفريق الأول :- Force Work Experts و يشار أليها فيما بعد بالشركة

الفريق الثاني : ${employeeName}
رقم وطني : ${nationalIdDisplay}
ويشار اليه فيما بعد بالموظف

التوطئة :

حيث أن الفريق الاول هي شركة تجارية معروفة وتقوم بتأجير طواقم فنية للشركات المهتمه و حيث أن الفريق الثاني يجب ان يكون مؤهل فنيا وعمليا وأكاديميا (ما لم يثبت العكس) وبناءا عليه تعاقد الفريقين على ان يعين الفريق الاول الفريق الثاني لدية كاحد افراد المصادر الخارجية المؤجرة خبراتهم وخدماتهم لدى احدى الشركات اعلاة مقابل أجرمحدد الثمن غيرقابل لاي نوع من انواع الزيادات القانونيه المنصوص عليها اوغيرالمنصوص عليها من أجل تنفيذ المهام والأعمال المسنده إليه داخل او لدى الشركة والتي تعتبر أحد زبائن الفريق الاول الذي يقوم بدوره بتزويد ${companyDisplay} موظفين مصادر خارجية بموجب أتفاقيه فيما بينهم بالفِرق الفنية سواء كانت من مهندسين اوفنيين و موظفيين مبييعات والمعدات والسيارات والوقود وكل ما يلزم لذلك لتنفيذ مشاريعها وبناءاً على هذا فأن الفريق الثاني يوافق ابتداءا وعند توقيع العقد بانه يحق للفريق الاول انهاء خدماته باي مرحلة من مراحل التعاقد كون الفريق الثاني يعلم بان الفريق الاول مجبر على تغيير الموظف او استبداله فب حال طلب منه ذلك من قبل احدى الشركات المشغله لهذا الموظف ولا يستطيع الفريق الاول الرفض وعلى هذا فانه في حال انتهاء العقد او قام الموظف بتقديم استقالته او اذا طلبت او رغبت احدى هذه الشركات المشغله والتي يتبع لها الفريق الثاني باستبدال او تغيير هذا الموظف لاي سبب كان يتعلق بعدم كفائته ااو انتهاء المشروع او العمل الذي عين من اجله او اذا تسبب باحداث ضرر لها و يوافق على هذا الشرط الفريق الثاني ويقر و يعترف و يبدي موافقته ابتداءا وبمجرد توقيعه على هذا العقد بأنه لا يجوز له الطعن ولا باي شكل من الاشكال على ما تقدم و أنه موافق ولا يمانع بأنه يحق للفريق الاول و/او لـ ${companyDisplay} حق قبول او رفض استمرارية الفريق الثاني لديها في العمل ورغبتها في تجديد العقد له ام عدم تجديده وحقها ايضا باستبداله باي وقت ترغب بذلك لاي سبب كان حتى لو لم تنتهي مدة العقد او بعد انتهائها وبأي وقت كان وعلى هذا يحق للفريق الاول فسخ العقد وانهاء استخدام الفريق الثاني لديها دون اشعار او تعويض اوأنذار وذلك كون الفريق الثاني يبدي موافقته ابتداءاً على انهاء خدماته في اي وقت كان كونه موافق ويعلم أن الفريق الاول مرتبط بعطاء من ${companyDisplay} ويجدد كل شهرين او ثلاثة او سته او سنة حسب المشروع وفي حال تم انهاء هذا العطاء فهذا يعني أنتهاء عمل الشركة وعدم حاجتها للأستعانه بمصادر خارجيه (مهندسين و فنيين او موظفيين مبيعات او غير ذلك ) لتنفيذ أعمال العطاء المطروح ولكي لا يقع العطل و الضرر على اي أحد من طرفين هذا العقد وكون العقد يعتبر شريعة المتعاقدين فان هذا العقد و الأتفاق يعتبر نافذ بحق المتعاقدين ولا يجوز الطعن به ولا باي شكل من الاشكال بمجرد التوقيع عليه فقد تم الاتفاق والأيضاح بشكل جيد جدا لهذه النقطه تحديدا وهي ( الغاء باقي مدة العقد اوعدم تجديد العقد او أيقاف الموظف او أنهاء خدماته او تسريح الفريق الثاني من العمل ولاي سبب كان او فصله ولاي سبب كان واي حالة اخرة قد تتسبب بانهاء عمل الفريق الثاني لدى الفريق الاول ) ولكل ما جاء في ها العقد ابتداءاً للفريق الثاني وقبل قيامه بالتوقيع على هذا العقد وعند التعاقد مع الفريق الثاني على انه في حال تم انهاء عمل الشركه لدى ${companyDisplay} او تقلييل العطاء او الغاءه او رغبوا باستبدال الفريق الثاني بشخص اخر لأي سبب كان سواء لقلة خبرته بالعمل او لتصرفه تصرف سيء او لعدم انتاجيته او لاي سبب كان فأن الفريق الثاني يبدي موافقته وقبوله لكل ما سبق ذكره ولكل ما سيلحق ذكره كون تعاقد فريقين هذا العقد مشروط بموافقه احدى الشركات المشغلة او عدم موافقتها ومن ثم موافقة الفريق الاول على استخدام الفريق الثاني لذا يحق للفريق الاول ان ينهي عمل الفريق الثاني دون اي اشعار او تعويض كونه على علم مسبق بطبيعة عمل الاستعانه بمصادر خارجيه ويحق للفريق الاول انهاء عمله او استبداله بآخر او ايقافه عن العمل او أستبعاده دون اي تعويض او أي التزام أتجاه الفريق الثاني بإستثناء الأجر المتفق عليه عن المدة التي عملها بالفعل فقط وحيث أن الفريق الثاني قد تقدم بطلب توظيف لأنجاز الاعمال وتنفيذها داخل احدى هذه الشركات او لصالحها مقابل راتب او أجر ثابت ومحدد الثمن / ${jobTitlePhrase} وبغض النظر عن عدد سنوات الخبرة له وحسب العمل الموكل إليه من الفريق الأول او احدى الشركات التابع لها و ضمن الشروط المبينة أدناه والسابق ذكرها و بناء على ما تقدم فقد أجتمعت إرادة الفريقين على الألتزام بالنصوص و البنود التالية ذكرها :-

تعتبر مقدمة هذا العقد جزء لا يتجزاء منة وتقراء معه .

مادة (1) تاريخ ومدة سريان العقد :- يبداء في تاريخ ${startDisplay} السـ08:00ــاعه صباحا وينتهي بتاريخ ${endDisplay} السـ05:00ــاعه مساءا

وبمجرد التوقيع على هذا العقد فانه يلغي اي تعاقد او اي عقد عمل سابق لتاريخ هذا العقد ويصبح غير قانوني ولا يجوز الاحتجاج به ولا قيمة له لكلا الطرفين ويصبح هذا العقد بمثابة مخالصه وقطع مدة وابراء من الفريق الثاني للفريق الأول عن المدة التي سبقت هذا العقد ويصبح هذا العقد هو العقد الوحيد الذي يحتج به وساري المفعول بين الفريقين .

أتفق الفريقين على أن يستعين الفريق الاول بخبرة الفريق الثاني لتنفيذ اعمال الشركة وفقا للأحكام و الشروط التالية :-

1. يلتزم الفريق الثاني بأداء العمل كاملا دون نقص كما هو مطلوب منه ومسند اليه من قبل الفريق الأول تبعا" لتوجيهه وإشرافه ولا يحق للفريق الثاني الأعتراض على العمل او طبيعتة او الامتناع عن تنفيذه او ترك الموقع وعدم اكمال العمل انما يحق للموظف تقديم طلب استقاله واعطاء شهر انذار للفريق الاول بعدم رغبته باكمال العمال اذا رغب بذلك دون الاضرار بالفريق الاول وفي حال قام بالحاق ضرر بالفريق الاول فان الفريق الثاني ملزم بتعويض الفريق الاول عن حجم الضرر الذي لحق به جراء ذلك .

2. يلتزم الفريق الثاني بالدوام والعمل الكامل من ( السبت إلى الخميس) من الساعة الـ 8 صباحا و حتى الـ 5 مساءا من كل يوم عمل دون استحقاق اي عمل اضافي لذلك ويلتزم باجراءات الختم اليومي دون تقديم اعذار لعدم قيامه بالختم الدوام اليومي وعليه ان يعمل بمعدل 48 ساعه اسبوعيا .

3. يلتزم ويقر الفريق الثاني ويبدي موافقته ابتداءا على هذه النقطه بمجرد التوقيع على العقد ولا يجوز الاعتراض عليها او الطعن بها فيما بعد وهو انه في حال عمل ساعات عمل اضافيه ستدفعها له شركة المشغلة وليس الفريق الاول ولا يجوز الرجوع على الفريق الاول ولا باي شكل من الاشكال في ما يخص العمل الاضافي وما يتعلق به وستحسب له كمايلي :-

أ) ان لا يتجاوز عدد عمل ساعات العمل الاضافي لكل شهر ولا باي شكل من الاشكال عن ثلاثين ساعه قبل المعادله الحسابيه و خمسة واربعون ساعه بعد المعادله الحسابيه للعمل الاضافي وفي حال عمل الموظف اكثر من ذلك فلن يتم احتساب ايه مبالغ له عن تلك الساعات المتجاوزة الحد ويتحمل الموظف مسؤولية تجاوزه لعدد ساعات العمل الاضافي ولا يحق له مطالبه الفريق الاول او الرجوع عليه باي مطالبات تخص عدد ساعات العمل الاضافي كما وان عملية احتساب عدد ساعات العمل الاضافي هي ( اذا عمل الفريق الثاني من بعد الساعه الخامسة مساءا ولغاية الساعه الثانيه عشر ليلا او من السادسه صباحا حتى الثامنه صباحا تحسب كل ساعه كانها ساعه وربع و اذا عمل الفريق الثاني من الساعه الثانية عشر ليلا الى السادسه صباحا تحسب كل ساعه كانها ساعه ونصف واذا عمل في ايام الجمعه او العطل الرسميه والدينيه تحسب الساعه بساعه ونصف ايضا ويجب على الموظف أحضار كشف موقع ومختوم من مدرائه داخل الذي يتبع لهم يبين تفاصيل العمل الاضافي وعدد الساعات التي عملها ليتم احتسابها له ودفعها له بعد استلامها من الشركة كون من يدفع العمل الاضافي للموظف هي الشركة المشغله وليس الفريق الاول وانما يقتصر دور الفريق الاول بتولي اليه الفوتره ودفعها للموظف منه ومن ثم تحصيل ما تم دفعه للفربق الثاني واستلامها من شركة المشغله كما ان الفريق الثاني يقر اقرار كاملا وموافقته وعلمة لكل ما ذكر في هذه النقطه لذلك لا يحق للفريق الثاني الاعتراض او الرجوع على الفريق الاول باية مبالغ تذكر فيما يخص العمل الاضافي كما ويجوز فيما يخص الفريق الثاني والشركة المشغله دون ادنى مسؤولية تجاه الفريق الاول انه في حال عمل الموظف ساعات عمل إضافيه ستقوم الشركة المشغله بتجميعها له وإعطاءه إجازات أو مغادرات مقابلها وليس مبالغ نقديه وحسب ترتيب الإدارة وبما لا يتعارض مع حاجات العمل او دفعها .

4. يلتزم الفريق الثاني بإرتداء ألبسة السلامة العامة وعدم العمل بدونها قطعيا وتحت طائلة المسؤوليه ويقرعند توقيع العقد انه استلمها كامله وكما يجب من حيث المواصفات وهي حذاء امان وقفازات وخوذه وسترة عاكسه وبراشوت تسلق وشريط تحذيري ولافته تحذيريه للعمل وطفاية كما ويمنع العمل قطعيا في الظروف الجويه السيئه وفي حال عدم لباس البسة السلامه العامه كما يقر الموظف بمجرد توقيعه هذا العقد انه تم اعطائه دورة تدريبه للسلامه العامه من قبل الفريق الاول ومن قبل ${companyDisplay} واعطاءاه جميع تعليمات السلامه العامه وانه يتم زيارة المواقع بشكل مفاجاء من قبل الفريق الاول ومن قبل ${companyDisplay} للتاكد من التزام الموظفين والمقاولين والفريق الثاني من ارتداء البسه السلامه العامه ويقر الموظف هنا بانه في حال تم ظبطه بارتكاب اي مخالفه لشروط السلامه العامه فانه ستم انذارة لمره واحده فقط و/او انهاء خدماته وتسريحه او فصله او ايقافه من العمل فورا كونها مساله لا يستهان بها وبناءا عليه فلا يحق للفريق الثاني الاعتراض على ذلك او الرجوع على الفريق الاول بفصل تعسفي او اي مطالبات اخرى نتيجه لذلك .

5. يلتزم الفريق الثاني بعدم إلحاق أضرار بممتلكات أو حقوق الغير او الفريق الاول او الشركة المشغله في مكان العمل المسند إليه اوفي حالة تسبب الموظف بعمد أو بغيرعمد بإلحاق الأضرار يتحمل الموظف المسؤولية كاملة كما يتوجب على الفريق الثاني الحفاظ على الأجهزة والمعدات والسيارات من الضياع والسرقة, ويمنع أخذ أي قطعة من الموقع من معدات أو كوابل وإذا حدث ذلك تعتبر سرقة من الفريق الثاني للشركة ويجب على الفريق الثاني تسليم المواد الزائدة وإعادتها إلى المخزن ويلتزم بالواجبات المطلوبة منه ما دام التعطيل ليس من قبل الشركة وفي حال تم انهاء عمله او باي وقت يطلب منه اعادة جميع ما كان لديه من عدد او اجهزة او معدات او معلومات عمل او تقارير او كشوفات او حسابات كانت تحت يده واشرافه ومن ضمن عمل فيتوجب اعادتها على الفور دون تاخير او تقديم اي حجج لذلك كونها مسالها لا يستهان بها وتمس الشركة المشغله والفريق الاول معا .

6. يجب على الفريق الثاني التواصل مع الإدراة وإعطائهم المعلومات المتعلقة بالعمل وفي حالة تعرضت الشركة لأي أضرار أو إنذارات ويكون المتسبب بها الفريق الثاني يتحمل الفريق الثاني المسؤولية كاملة فيجب على الفريق الثاني الإلتزام بالعمل والمحافظة على القواعد والشروط حتى لا يتسبب بهذه الأضرار والإنذرارات.

7. لا يجوز التغيب عن العمل لأي سبب من الأسباب بدون أخذ موافقة الإدارة ويعتبر التبليغ بالرسائل القصيره أو الإيميل غير معتمد ولا صفه إداريه له ويحق للشركة خصم كل يوم غياب على الموظف وانما يجب التغيب بعد اخذ موافقة ${companyDisplay} والفريق الاول معا ومجتمعين ولا يجوز الغياب لفترة تتجاوز ال 3 ايام متتاليه وانما على فترات سواء اكانت اجازات مستحقة او غير مستحقة او مرضية او غير ذلك وبخلاف ذلك ستخصم على الموظف كون طبيعة العمل حساسه ولا تتحمل غياب الموظف لفترات طويله ولا مانع من التغيب ضمن حدود اجازات الفريق الثاني على فترات متواتره وفي حال تغيب الموظف بدون أخذ موافقه الإدارة سيتم حسم راتب يومين عمل بدل كل يوم غياب و إذا تكرر غياب الموظف بدون عذر أكثر من 3 أيام متواصله أو متقطعه يعتبر مستنكف عن العمل ويحق للشركة إنهاذ خدماته بدون إنذار ويحق للموظف رصيد 14 يوم إجازة عن كل سنه عقدية ولا يجوز للموظف استخدام اجازاته قبل موافقه الإدارة والترتيب معها على كيفية الاجازة حيث انه لا يجوز التغيب لاكثر من 3 ايام متتاليه كون ذلك يضر بالعمل ويجب تقديم طلب رسمي موقع ولا ستعتبر غياب وليس اجازة وفي حال رغب الموظف تقديم استقالته فيتوجب علية اعطاء الشركة شهر انذار كاملا وعدم استخدام رصيد اجازاته ضمن هذا الشهر كون هذا يضر بالعمل ولا يتم تعويض الموظف عن رصيد الاجازات نقدا وانما يستحقهم ايام اجازة عن العمل ويستحقهم قبل تاريخ مدة شهر الانذار كما ويجب على الموظف الالتزام بالدخول على نظام الموظفين من خلال الموبايل او اي جهاز اخر يوميا للبصمه واثبات الدوام من عدمه حيث انه سيكون هو المعتمد والفيصل في رصيد اجازات الموظف من عدمها ولا يجوز للموظف الاحتجاج بغير ذلك وكما يتوجب عدم ترك العمل لحين ايجاد موظف بديل آخر مكانه وانهاء اجراءات تبرئة الذمة له ويتحمل الموظف غرامة ماليه قدرها الفين دينار في حال ترك العمل دون علم او خبر او تقديم استقاله او بشكل مفاجئ وقبل تبرئة ذمتة من الشركة.

8. على الموظف الذي بحوزته مركبه من مركبات الشركة المشغله وتحت طائلة المسؤولية في حال الحاق الاضرار بها عمدا او ارتكاب المخالفات او اتلاف اي اجزاء بالمركبه او إستخدام المركبة لأغراض شخصيه قطعيا وعدم العبث في جهاز ال GPS الخاص بالمركبه وفي حال إكتشفت الشركة اي مما ذكر سابقا فيترتب عليه غرامة مادية 35 دينار عن كل يوم استخدام بالاضافة لقيمة الاضرار ولا يجوز للموظف الاعتراض على ذلك كونه يعتبر استئجر المركبة لاغراضه الشخصيه ودون علم الشركة ايضا كما ويحق للشركة انهاء خدمات الموظف او تسريحه او فصله او طرده ان لزم الامر دون اي اشعار او انذار او اي التزام مادي أتجاه الموظف كونه يبدي موافقته على هذا الشرط بمجرد توقيعه على العقد وانه تم تنبيهه لهذا الشرط و قد وافق عليه وقبل توقيعه على العقد كون انتهاكة لمثل هذه المسائل يعتبر من الاضرار بالشركة وبمجرد توقيعه على هذا العقد يعتبر تنازل واضح وصريح منه للفريق الاول عن اي حق له يخالف قانون العمل لمثل هذه المساله .

9. سوف تدفع الشركة للموظف مبلغا شهريا إجماليًا مقداره (${salaryDisplay}) دينار أردني كراتب اساسي مع جميع البدلات ويخضع هذا الراتب الى الاقتطاعات القانونية حسب النسب المحددة في التعليمات المرعية من الضمان الاجتماعي والتامين الصحي على ان لا يقل اقتطاع التامين الصحي عن ثمانية عشر دينار شهريا وفي حال رغب الموظف تامين عائلته معه فانه يتحمل تكلفة قيمة التامين كامله كما ستدفع الشركة للموظف مبلغ غير ثابت القيمة شهريا ومقدارة من دينار واحد الى مائة دينار تقريبا وهذا المبلغ غيرخاضع اوشامل لاي من الاقتطاعات سواء كان ضمان اجتماعي اوالتامين الصحي او ضريبي وذلك يعتبر بدل استئجار مركبة الموظف و/او بدل تقيم الموظف بالتزامه لاجراءات السلامه العامه او القيادة الامنه او تعامله مع زملائة ومدرائة ...الخ و/او عمل اضافي و/او بدل مكافئة لعمل ما و/او اي مبلغ ترغب الشركة بدفعه للموظف بشكل غير ملزم وغير منتظم و غير اجباري للشركة بدفعه للموظف وانما هو كحافز او مشاركة من الشركه للموظف وليس بالضروره ان تقوم الشركة بدفع اي من هذه المبالغ للموظف وفي حال قررت الشركة دفع مثل هذه المبالغ لاي من الموظفين فانه سيتم تسليمه للموظف بشكل شهري او لبعض الاشهر فقط مع الراتب الشهري او منفصل عنه على رقم حسابه البنكي تسهيلا للاجراءات ولكن لا يعني ضم المبلغ مع الراتب انه جزء من الراتب الاساسي و يحق للشركة ايقاف هذا المبلغ في اي وقت ترغب بذلك دون اي اعتراض من الموظف كونه ليس من الراتب الاساسي ولا علاقة له بحقوقه العماليه , كما يحق للشركة خصم اي يوم تعطيل عن العمل من المبلغ المتفق عليه شهريا او في حال ارتكب مخالفة سير او تخريب او فقدان او كسر اي شي من العهده المسلمه له ، وفي حال تسبب الموظف باي خسارة للشركه أو لم يلتزم بالعمل المطلوب منه يحق للشركة الرواد الاستغناء عن خدماته و استبداله بموظف آخر دون اشعار .

10. الجدولة الماليه :-
الراتب الاساسي الخاضع للضمان: ${salaryDisplay} دينار
بدل اقتطاع ضمان: 7.5%
اقتطاع تامين صحي شخصي او عائلي: 18 دينار

الفريق الأول: FWX GM                                   الفريق الثاني: ${employeeName}

التوقيع (صاحب العمل) - FWX GM:                          توقيع الموظف - ${employeeName}:`;
}

// Professional English translation of the same contract, for the
// Convert to English / Convert to Arabic toggle. Preserves every
// substantive term (penalties, percentages, deadlines) from the Arabic
// original — this is a faithful translation, not a summary.
function buildFullContractTextEnglish({ employeeName, nationalId, jobTitle, salary, startDate, contractPeriodMonths, companyName }) {
  const fmtDMY = (isoDate) => {
    if (!isoDate) return "......................";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  };
  const endDateIso = (() => {
    if (!startDate || !contractPeriodMonths) return null;
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + Number(contractPeriodMonths));
    return d.toISOString().slice(0, 10);
  })();

  const startDisplay = fmtDMY(startDate);
  const endDisplay = fmtDMY(endDateIso);
  const nationalIdDisplay = nationalId || "......................";
  const salaryDisplay = salary ? String(salary) : "      ";
  const jobTitlePhrase = jobTitle
    ? jobTitle
    : "Telecommunications Technician and/or Telecommunications Engineer, Sales Employee";
  const companyDisplay = companyName || "the operating company";

  return `FIXED-TERM OUTSOURCING (EXTERNAL RESOURCES) AGREEMENT

First Party: Force Work Experts, hereinafter referred to as "the Company."

Second Party: ${employeeName}
National ID number: ${nationalIdDisplay}
Hereinafter referred to as "the Employee."

RECITALS:

Whereas the First Party is a well-known commercial company engaged in the outsourcing of technical staff to interested companies; and whereas the Second Party must be technically, practically, and academically qualified (unless proven otherwise); the two Parties have agreed that the First Party shall appoint the Second Party as one of its outsourced personnel, leased with their expertise and services to one of the above companies, for a fixed, non-negotiable wage, in order to carry out the tasks and duties assigned within or for that company (which is considered a client of the First Party). The First Party in turn supplies its client companies with outsourced personnel — whether engineers, technicians, or sales staff — together with equipment, vehicles, fuel, and everything necessary to carry out its projects, under agreements between them.

Accordingly, the Second Party agrees, from the outset and upon signing this Agreement, that the First Party has the right to terminate the Employee's services at any stage of the engagement, since the Second Party is aware that the First Party may be required to change or replace the Employee if requested to do so by any of the client companies operating this Employee, and the First Party cannot refuse such a request. Therefore, in the event the Agreement ends, the Employee resigns, or any client company requests replacement or change of this Employee for any reason (whether related to insufficient competence, completion of the project or work for which he was assigned, or if he causes damage to it), the Second Party agrees to this condition and acknowledges, from the outset and upon signing this Agreement, that he may not challenge or dispute the foregoing in any manner whatsoever, and that he agrees and does not object that the First Party and/or ${companyDisplay} have the right to accept or refuse the continuation of the Second Party's employment with them, to renew or not renew his contract, and to replace him at any time they wish for any reason, even if the contract term has not ended or after it has ended, at any time. Accordingly, the First Party has the right to terminate this Agreement and end the Second Party's engagement without notice, compensation, or warning, given that the Second Party agrees from the outset to the termination of his services at any time, knowing that the First Party is bound by a tender from ${companyDisplay} which is renewed every two, three, six months or a year depending on the project, and that if this tender ends, this means the end of that company's work and its lack of need for outsourced resources (engineers, technicians, sales staff, or otherwise) to carry out the work of the tender in question.

So that neither Party suffers disruption or harm, and since a contract is binding upon its parties, this Agreement is effective and binding upon the Parties and may not be challenged in any way once signed. It has been clearly explained and agreed, specifically on this point — namely (cancellation of the remaining contract term, non-renewal of the contract, suspension of the Employee, termination of his services, dismissal of the Second Party from work for any reason, or any other situation that may lead to ending the Second Party's work with the First Party) — and all that is stated in this Agreement, from the outset, for the Second Party and before signing this Agreement, and upon contracting with the Second Party, that in the event the Company's work with ${companyDisplay} ends, or the tender is reduced or cancelled, or they wish to replace the Second Party with another person for any reason (whether due to lack of experience, misconduct, lack of productivity, or any other reason), the Second Party expresses his agreement and acceptance of all of the foregoing and all that follows, given that this Agreement between the two Parties is conditional upon the approval — or non-approval — of one of the operating companies, followed by the First Party's approval of engaging the Second Party. The First Party therefore has the right to end the Second Party's employment without any notice or compensation, being aware in advance of the nature of outsourcing work. The First Party has the right to terminate his employment, replace him, suspend him from work, or exclude him, without any compensation or obligation toward the Second Party, except for the agreed wage for the period actually worked only.

And whereas the Second Party has applied for employment to carry out and perform work within one of these companies or for its benefit, in exchange for a fixed and specified salary or wage / as ${jobTitlePhrase}, regardless of years of experience, and according to the work assigned to him by the First Party or one of its affiliated companies, and within the terms set out below and previously mentioned; based on the foregoing, the will of the two Parties has come together to commit to the following provisions and clauses:-

The preamble of this Agreement is considered an integral part of it and is to be read together with it.

Article (1) — Effective Date and Term of the Agreement:- It begins on ${startDisplay} at 08:00 AM and ends on ${endDisplay} at 05:00 PM.

Upon signing this Agreement, it cancels any prior engagement or employment contract predating this Agreement, which becomes unlawful and may not be relied upon or given any value by either Party. This Agreement shall constitute a full and final settlement and release by the Second Party of the First Party for the period preceding this Agreement, and this Agreement becomes the sole agreement relied upon and in force between the Parties.

The two Parties agree that the First Party shall engage the expertise of the Second Party to carry out the Company's work in accordance with the following terms and conditions:-

1. The Second Party undertakes to perform the work in full, without shortfall, as required and assigned by the First Party, in accordance with its direction and supervision. The Second Party may not object to the work or its nature, refuse to perform it, or abandon the site without completing the work; however, the Employee may submit a resignation request and give one month's notice to the First Party if he does not wish to complete the work, without causing harm to the First Party. If he causes harm to the First Party, the Second Party is obligated to compensate the First Party for the extent of the damage caused.

2. The Second Party undertakes to attend and work full-time from Saturday to Thursday, from 8:00 AM to 5:00 PM each working day, without entitlement to any overtime for this, and undertakes to comply with daily clock-in/clock-out procedures without excuse for failing to record daily attendance, and shall work at a rate of 48 hours per week.

3. The Second Party undertakes and acknowledges, agreeing from the outset upon signing the Agreement — and this point may not be objected to or challenged thereafter — that in the event of working overtime hours, these shall be paid by the operating company and not the First Party, and no claim may be made against the First Party in any way regarding overtime, which shall be calculated as follows:-

a) The number of overtime hours per month may not exceed, in any way, thirty hours before the overtime calculation formula and forty-five hours after the overtime calculation formula. If the Employee works beyond this, no amounts shall be calculated for those excess hours, and the Employee bears responsibility for exceeding the overtime hour limit and may not claim against the First Party for hours exceeding this limit. The overtime calculation method is: if the Second Party works after 5:00 PM until 12:00 midnight, or from 6:00 AM to 8:00 AM, each hour is counted as one and a quarter hours; if the Second Party works from 12:00 midnight to 6:00 AM, each hour is counted as one and a half hours; and if he works on Fridays or official/religious holidays, the hour is likewise counted as one and a half hours. The Employee must bring a site report, stamped by his direct manager, showing the overtime details and number of hours worked so that it can be calculated and paid to him after being received from the company — since it is the operating company, not the First Party, that pays overtime to the Employee; the First Party's role is limited to handling the invoicing and paying the Second Party, then collecting what was paid from the operating company. The Second Party fully acknowledges and agrees to everything stated in this point, and therefore the Second Party may not object to or claim against the First Party for any amounts regarding overtime. It is also understood, without any liability toward the First Party, that if the Employee works overtime hours, the operating company may accumulate them and grant him leave or time off in lieu rather than cash payment, as arranged by management, provided this does not conflict with work requirements.

4. The Second Party undertakes to wear general safety equipment and not to work without it under any circumstances, and under full liability, and acknowledges upon signing this Agreement that he has received it complete and as required in terms of specifications — namely safety shoes, gloves, a helmet, a reflective vest, a climbing harness, warning tape, a warning sign for work, and a fire extinguisher. Work is strictly prohibited in severe weather conditions, and in the event of not wearing general safety equipment, the Employee likewise acknowledges upon signing this Agreement that he has been given general safety training by the First Party and by ${companyDisplay}, and has been given all general safety instructions, and that sites are visited unannounced by the First Party and by ${companyDisplay} to confirm compliance by employees, contractors, and the Second Party with wearing general safety equipment. The Employee acknowledges here that if he is caught committing any violation of the general safety conditions, he shall be warned once only and/or his services terminated, and he shall be dismissed, discharged, or suspended from work immediately, this being a matter that is not to be taken lightly; accordingly, the Second Party may not object to this or bring any claim against the First Party for wrongful dismissal or any other claims as a result.

5. The Second Party undertakes not to cause damage to the property or rights of others, the First Party, or the operating company at the assigned workplace; in the event the Employee causes damage, whether intentionally or unintentionally, the Employee bears full responsibility. The Second Party must also safeguard devices, equipment, and vehicles from loss and theft, and taking any item from the site — equipment or cables — is prohibited; if this occurs it is considered theft by the Second Party from the Company. The Second Party must hand over and return surplus materials to the warehouse, and must comply with the duties required of him so long as any disruption is not caused by the Company. In the event his employment is terminated, or at any time he is asked to do so, he must immediately return all equipment, devices, work information, reports, statements, or accounts that were in his possession and under his supervision, without delay or excuse, this being a matter that is not to be taken lightly and which affects both the operating company and the First Party.

6. The Second Party must communicate with management and provide them with information related to the work; in the event the Company suffers any damages or warnings caused by the Second Party, the Second Party bears full responsibility. The Second Party must therefore commit to the work and maintain the rules and conditions so as not to cause such damages and warnings.

7. Absence from work for any reason without obtaining management's approval is not permitted. Notification by SMS or email is not recognized and has no administrative standing, and the Company has the right to deduct each day of absence from the Employee. Absence must be approved jointly by ${companyDisplay} and the First Party together, and absence may not exceed 3 consecutive days, but rather in periods, whether as due or non-due leave, sick leave, or otherwise; otherwise it shall be deducted from the Employee, given the sensitive nature of the work, which cannot tolerate prolonged absence. There is no objection to absence within the limits of the Second Party's leave balance, taken in intermittent periods. In the event the Employee is absent without obtaining management's approval, two working days' wages shall be deducted for each day of absence, and if the Employee's unexcused absence recurs for more than 3 consecutive or non-consecutive days, he is considered to have abandoned his work, and the Company has the right to terminate his services without notice. The Employee is entitled to a balance of 14 days' leave for each contractual year, and the Employee may not use his leave without management's approval and arrangement as to how the leave will be taken, given that absence for more than 3 consecutive days is not permitted, as this harms the work, and a signed formal request must be submitted, otherwise it shall be considered absence and not leave. In the event the Employee wishes to submit his resignation, he must give the Company one full month's notice and must not use his leave balance during this month, as this harms the work; the Employee shall not be compensated in cash for his leave balance but is instead entitled to days of leave from work, due before the end of the one-month notice period. The Employee must also comply with logging into the employee system via mobile phone or any other device daily to record attendance, as this shall be the authoritative and decisive record of the Employee's leave balance, and the Employee may not dispute this by any other means. The Employee must also not leave work until a replacement employee is found and clearance procedures are completed; the Employee bears a financial penalty of two thousand Jordanian Dinars in the event he leaves work without notice, without submitting a resignation, or suddenly, and before obtaining clearance from the Company.

8. An Employee in possession of a vehicle belonging to the operating company, and under full liability, in the event of intentionally causing damage to it, committing violations, damaging any parts of the vehicle, or using the vehicle for personal purposes under any circumstances, and not tampering with the vehicle's GPS device — in the event the Company discovers any of the foregoing, a financial penalty of 35 Jordanian Dinars per day of use shall apply, in addition to the value of any damages. The Employee may not object to this, as it is considered renting the vehicle for personal purposes without the Company's knowledge. The Company also has the right to terminate the Employee's services, dismiss him, or discharge him if necessary, without any notice, warning, or financial obligation toward the Employee, given that he expresses his agreement to this condition upon signing the Agreement, and that he was alerted to this condition and agreed to it prior to signing the Agreement, as a violation of such matters is considered harm to the Company; upon signing this Agreement, this is considered a clear and explicit waiver by him, toward the First Party, of any right he may have that conflicts with labor law regarding this matter.

9. The Company shall pay the Employee a total monthly amount of (${salaryDisplay}) Jordanian Dinars as a basic salary inclusive of all allowances, and this salary is subject to the statutory deductions according to the rates specified in the applicable regulations for social security and health insurance, provided the health insurance deduction is not less than eighteen Jordanian Dinars per month; if the Employee wishes to insure his family with him, he bears the full cost of that insurance. The Company shall also pay the Employee a variable monthly amount of approximately one to one hundred Jordanian Dinars, and this amount is not subject to or inclusive of any deductions, whether social security, health insurance, or tax, and is considered an allowance for the Employee's vehicle rental and/or an assessment of the Employee's compliance with general safety procedures, safe driving, or dealing with colleagues and managers, etc., and/or overtime, and/or a bonus for certain work, and/or any amount the Company wishes to pay the Employee on a non-binding, irregular, and non-obligatory basis, being instead an incentive or a form of profit-sharing from the Company to the Employee; the Company is not necessarily obligated to pay any of these amounts to the Employee. If the Company decides to pay such amounts to any employee, it shall be delivered to the Employee monthly, or for some months only, together with the monthly salary or separately, into his bank account number for ease of process; however, combining this amount with the salary does not mean it is part of the basic salary, and the Company has the right to stop this amount at any time it wishes, without any objection from the Employee, as it is not part of the basic salary and is not related to his labor rights. The Company also has the right to deduct any day of work disruption from the monthly agreed amount, or in the event of a traffic violation, sabotage, loss, or breakage of any item entrusted to him; and in the event the Employee causes any loss to the Company or fails to comply with the work required of him, the Company has the right to dispense with his services and replace him with another employee without notice.

10. Financial Schedule:-
Basic salary subject to social security: ${salaryDisplay} JOD
Social security contribution: 7.5%
Personal or family health insurance deduction: 18 JOD

First Party: FWX GM                                    Second Party: ${employeeName}

Signature (Employer) - FWX GM:                          Employee's Signature - ${employeeName}:`;
}

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

  // Overwrite whatever text the server generated with our exact template,
  // substituting this employee's details, via the same update_contract
  // action already used for manual edits. Build both languages so the
  // Convert to English/Arabic toggle has real content either way.
  const emp = DIRECTORY.find(x => x.id === target_id);
  const templateArgs = {
    employeeName: emp ? emp.full_name : "",
    nationalId: emp ? emp.national_id : null,
    jobTitle: job_title,
    salary,
    startDate: start_date,
    contractPeriodMonths: contract_period_months,
    companyName: emp ? emp.client_company : null,
  };
  const exactText = buildFullContractText(templateArgs);
  const exactTextEnglish = buildFullContractTextEnglish(templateArgs);
  const { data: updatedData, error: updateErr } = await db.functions.invoke("clever-action", {
    body: { action: "update_contract", contract_id: data.contract.id, contract_text: exactText, contract_text_alt: exactTextEnglish, language: "ar" }
  });
  if (!updateErr && updatedData && updatedData.contract) {
    data.contract = updatedData.contract;
  } else {
    data.contract.contract_text = exactText;
    data.contract.contract_text_alt = exactTextEnglish;
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

function stripDraftDisclaimer(text) {
  if (!text) return text;
  // The server always appends this disclaimer as the last block, in
  // whichever language the warning was generated in — strip it (and any
  // leading "---" separator) so it never appears to the employee or admin.
  return text
    .replace(/\n?-{2,}\s*\n?\s*مسودة وثيقة[\s\S]*$/, "")
    .replace(/\n?-{2,}\s*\n?\s*DRAFT DOCUMENT[\s\S]*$/i, "")
    .replace(/\n\s*مسودة وثيقة[\s\S]*$/, "")
    .replace(/\n\s*DRAFT DOCUMENT[\s\S]*$/i, "")
    .trim();
}

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

  // Strip the draft-disclaimer the server always appends, saving the
  // cleaned text back via the same update_warning action used for manual
  // edits, so it's never shown to anyone from this point on.
  const cleanedText = stripDraftDisclaimer(data.warning.warning_text);
  const cleanedAltText = stripDraftDisclaimer(data.warning.warning_text_alt);
  if (cleanedText !== data.warning.warning_text || cleanedAltText !== data.warning.warning_text_alt) {
    const { data: updatedData, error: updateErr } = await db.functions.invoke("clever-action", {
      body: { action: "update_warning", warning_id: data.warning.id, warning_text: cleanedText, warning_text_alt: cleanedAltText, language: data.warning.language }
    });
    if (!updateErr && updatedData && updatedData.warning) {
      data.warning = updatedData.warning;
    } else {
      data.warning.warning_text = cleanedText;
      data.warning.warning_text_alt = cleanedAltText;
    }
  }

  if (ACTIVE_TAB === "warnings") await loadWarnings();
  openWarningViewModal(data.warning.id, data.warning);
});

let WARNINGS_LIST = [];

async function loadWarningsDataOnly() {
  const { data } = await db.from("warnings").select("*").order("created_at", { ascending: false });
  WARNINGS_LIST = data || [];
}

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
        return matchesTableSearch(warningsQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : WARNINGS_LIST;
  notifyIfNoSearchResults(document.getElementById("warningsSearchInput"), warningsQuery, filteredWarnings.length);
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
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}${newBadge(w.created_at)}</td>
      <td>${fmtDate(w.created_at ? w.created_at.slice(0,10) : null)}</td>
      <td>
        <button type="button" class="btn btn-blue btn-sm" data-view-warning="${w.id}">View Warning</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete-warning="${w.id}">${t("deleteBtn")}</button>
        ${w.status === "sent" && !w.acknowledged_at ? `<div style="margin-top:4px; font-size:11.5px; color:#A5402B; font-weight:600">Needs action from Employee</div>` : ""}
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
  let text = document.getElementById("warningTextArea").value;
  const overlay = document.getElementById("warningViewOverlay");
  const warningId = overlay.dataset.warningId;
  const warning = WARNINGS_LIST.find(w => w.id === warningId);
  if (warning && warning.acknowledged_at) {
    const isArabicDoc = detectDominantScript(text) === "ar";
    const ackLine = isArabicDoc
      ? `\n\n---\nتم إقرار الموظف بالاطلاع على هذا الإنذار بتاريخ ${fmtDate(warning.acknowledged_at.slice(0,10))}.`
      : `\n\n---\nAcknowledged by employee on ${fmtDate(warning.acknowledged_at.slice(0,10))}.`;
    text += ackLine;
  }
  const btn = document.getElementById("warningDownloadBtn");
  setBtnLoading(btn, true, t("preparing"));
  setTimeout(async () => {
    try {
      await downloadContractPDF("Warning", overlay.dataset.fileNumber, overlay.dataset.employeeName, text);
    } finally {
      setBtnLoading(btn, false);
    }
  }, 30);
});

function contractStatusBadge(status) {
  const cls = { draft: "cancelled", shared: "pending", commented: "rejected", signed: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("contractStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

let CONTRACTS_LIST = [];

async function loadContractsDataOnly() {
  const { data } = await db.from("contracts").select("*").order("created_at", { ascending: false });
  CONTRACTS_LIST = data || [];
}

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
        return matchesTableSearch(contractsQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : CONTRACTS_LIST;
  notifyIfNoSearchResults(document.getElementById("contractsSearchInput"), contractsQuery, filteredContracts.length);
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
      <td>${contractStatusBadge(c.status)}${newBadge(c.created_at)}</td>
      <td>${fmtDate(c.created_at ? c.created_at.slice(0,10) : null)}</td>
      <td>${c.contract_period_months ? `${c.contract_period_months} ${t("monthsLabel")}` : "—"}</td>
      <td>
        <button type="button" class="btn btn-blue btn-sm" data-view-contract="${c.id}">View Contract</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete-contract="${c.id}">${t("deleteBtn")}</button>
        ${c.status === "shared" ? `<div style="margin-top:4px; font-size:11.5px; color:#A5402B; font-weight:600">Needs action from Employee</div>` : ""}
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
  CONTRACT_LANG = detectDominantScript(c.contract_text);
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
  CONTRACT_LANG = detectDominantScript(textarea.value);
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
  const btn = document.getElementById("contractDownloadBtn");
  setBtnLoading(btn, true, t("preparing"));
  // Yield one frame so the spinner actually paints before the (synchronous,
  // potentially slow) PDF rendering work blocks the main thread.
  setTimeout(async () => {
    try {
      await downloadContractPDF("Contract", overlay.dataset.fileNumber, overlay.dataset.employeeName, text, signatureImage);
    } finally {
      setBtnLoading(btn, false);
    }
  }, 30);
});

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(text || "");
}

// More robust than containsArabic() for deciding overall text direction:
// counts Arabic-script vs Latin-script characters and picks whichever is
// dominant, so a handful of stray Arabic characters left over in an older
// contract's "English" text (e.g. from before a wording fix) don't flip
// the whole document to RTL.
function detectDominantScript(text) {
  const s = text || "";
  const arabicCount = (s.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (s.match(/[A-Za-z]/g) || []).length;
  return arabicCount > latinCount ? "ar" : "en";
}

// jsPDF's built-in fonts have no Arabic glyphs and it doesn't apply Arabic
// text shaping/RTL layout at all — rendering Arabic through doc.text()
// produces mojibake. Instead, we draw the Arabic text onto an HTML canvas
// (the browser's own text engine correctly shapes and right-aligns Arabic)
// and place that rendered image into the PDF, page by page.
async function renderArabicPagesToPdf(doc, text, logo, startYOverride) {
  const pageWidthMm = doc.internal.pageSize.getWidth();
  const pageHeightMm = doc.internal.pageSize.getHeight();
  const marginMm = 14;
  const contentWidthMm = pageWidthMm - marginMm * 2;

  const scale = 3; // render at higher pixel density for crisp text
  const pxPerMm = 3.7795 * scale;
  const canvasWidthPx = Math.round(contentWidthMm * pxPerMm);
  const lineHeightPx = Math.round(7 * pxPerMm);
  const fontSizePx = Math.round(4.2 * pxPerMm);
  const titleFontSizePx = Math.round(5.6 * pxPerMm);

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");

  // Classify each paragraph so headers/titles render distinctly: the very
  // first paragraph is the document title (centered, bold, larger); any
  // paragraph starting with "مادة" (Article) is a bold section header.
  const paragraphs = text.split("\n");
  const allLines = []; // { text, style: "normal" | "bold" | "title" }
  paragraphs.forEach((para, pIdx) => {
    const trimmed = para.trim();
    if (trimmed === "") { allLines.push({ text: "", style: "normal" }); return; }
    const style = trimmed === "عقد مصادر خارجية محدد المدة" ? "title" : /^مادة\s*\(/.test(trimmed) ? "bold" : "normal";
    const fontForMeasure = style === "title" ? `bold ${titleFontSizePx}px Tahoma, Arial, sans-serif` : style === "bold" ? `bold ${fontSizePx}px Tahoma, Arial, sans-serif` : `${fontSizePx}px Tahoma, Arial, sans-serif`;
    mctx.font = fontForMeasure;
    mctx.direction = "rtl";
    const words = para.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (mctx.measureText(test).width > canvasWidthPx && current) {
        allLines.push({ text: current, style });
        current = word;
      } else {
        current = test;
      }
    }
    if (current) allLines.push({ text: current, style });
  });

  const firstPageTopMm = startYOverride != null ? startYOverride : (logo ? 32 : marginMm);
  const laterPageTopMm = marginMm;
  const firstPageLines = Math.max(1, Math.floor(((pageHeightMm - firstPageTopMm - marginMm) * pxPerMm) / lineHeightPx));
  const laterPageLines = Math.floor(((pageHeightMm - laterPageTopMm - marginMm) * pxPerMm) / lineHeightPx);

  let i = 0;
  let pageIndex = 0;
  let lastContentBottomMm = firstPageTopMm;
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
      ctx.direction = "rtl";
      ctx.textBaseline = "top";
      pageLines.forEach((line, idx) => {
        if (line.style === "title") {
          ctx.font = `bold ${titleFontSizePx}px Tahoma, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(line.text, canvas.width / 2, idx * lineHeightPx);
        } else if (line.style === "bold") {
          ctx.font = `bold ${fontSizePx}px Tahoma, Arial, sans-serif`;
          ctx.textAlign = "right";
          ctx.fillText(line.text, canvas.width, idx * lineHeightPx);
        } else {
          ctx.font = `${fontSizePx}px Tahoma, Arial, sans-serif`;
          ctx.textAlign = "right";
          ctx.fillText(line.text, canvas.width, idx * lineHeightPx);
        }
      });

      const imgHeightMm = canvas.height / pxPerMm;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", marginMm, yStartMm, contentWidthMm, imgHeightMm);
      lastContentBottomMm = yStartMm + imgHeightMm;
    }

    pageIndex++;
    if (allLines.length === 0) return lastContentBottomMm;
  }

  return lastContentBottomMm;
}

// jsPDF's plain doc.text() cannot shape Arabic glyphs, so any Arabic string
// drawn with it (even a short table label) comes out as corrupted/mojibake
// characters. This renders a single line of Arabic text onto a canvas
// (correct shaping + RTL) and returns it as an image sized in mm, so short
// strings like table titles/labels/values can be placed precisely without
// going through the paragraph-flow renderer.
function arabicTextToImageMm(text, { bold = false, sizeMm = 4.2, color = "#1b2430" } = {}) {
  const scale = 3;
  const pxPerMm = 3.7795 * scale;
  const fontSizePx = Math.round(sizeMm * pxPerMm);
  const font = `${bold ? "bold " : ""}${fontSizePx}px Tahoma, Arial, sans-serif`;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = font;
  mctx.direction = "rtl";
  const textWidthPx = Math.max(1, Math.ceil(mctx.measureText(text || "").width) + 6);
  const heightPx = Math.ceil(fontSizePx * 1.4);

  const canvas = document.createElement("canvas");
  canvas.width = textWidthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.direction = "rtl";
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText(text || "", textWidthPx - 3, heightPx / 2);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: textWidthPx / pxPerMm,
    heightMm: heightPx / pxPerMm
  };
}

// Draws a line of Arabic text into the PDF at (xMm, yMm), where yMm is the
// vertical center of the line and xMm is the anchor edge given by `align`
// ("right" = xMm is the right edge, "center" = xMm is the horizontal center).
function drawArabicLine(doc, text, { xMm, yMm, align = "right", bold = false, sizeMm = 4.2, color = "#1b2430" } = {}) {
  const img = arabicTextToImageMm(text, { bold, sizeMm, color });
  let left = xMm;
  if (align === "right") left = xMm - img.widthMm;
  else if (align === "center") left = xMm - img.widthMm / 2;
  doc.addImage(img.dataUrl, "PNG", left, yMm - img.heightMm / 2, img.widthMm, img.heightMm);
}

async function downloadContractPDF(kind, fileNumber, employeeName, text, signatureImage) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const logo = await loadLogoDataURL();
  let lastY;
  // Use dominant-script detection rather than "does this text contain any
  // Arabic characters at all": an English contract still embeds the
  // employee's name, which is very often written in Arabic, so a naive
  // Arabic-character check would misclassify English contracts as Arabic
  // and send them through the RTL rendering path (wrong alignment/direction
  // for an otherwise-English document).
  const isArabicDoc = detectDominantScript(text) === "ar";

  if (isArabicDoc) {
    // The "financial schedule" section reads much better as an actual
    // bordered table than as flowing paragraph text — pull it out of the
    // stream, render everything else normally, then draw it as a real
    // table with jsPDF's native drawing primitives.
    const tableMatch = text.match(/\n([^\n]*الجدولة الماليه[^\n]*)\n([\s\S]*?)\n\n(الفريق الأول[\s\S]*)$/);
    if (tableMatch) {
      const beforeTable = text.slice(0, tableMatch.index);
      const tableRows = tableMatch[2].split("\n").map(line => {
        const parts = line.split(":");
        return { label: (parts[0] || "").trim(), value: (parts.slice(1).join(":") || "").trim() };
      }).filter(r => r.label);
      const signatureSection = tableMatch[3];

      lastY = await renderArabicPagesToPdf(doc, beforeTable, logo);

      const marginMm = 14;
      const pageWidthMm = doc.internal.pageSize.getWidth();
      const pageHeightMm = doc.internal.pageSize.getHeight();
      const tableWidthMm = pageWidthMm - marginMm * 2;
      const rowHeightMm = 9;
      const headerHeightMm = 9;
      const tableHeightNeeded = headerHeightMm + tableRows.length * rowHeightMm + 10;

      let tableTopMm = lastY + 10;
      if (tableTopMm + tableHeightNeeded > pageHeightMm - marginMm) {
        doc.addPage();
        tableTopMm = marginMm + 10;
      }

      drawArabicLine(doc, "الجدولة الماليه", {
        xMm: pageWidthMm - marginMm, yMm: tableTopMm, align: "right", bold: true, sizeMm: 4.4
      });

      let rowY = tableTopMm + 6;
      const colSplitMm = marginMm + tableWidthMm * 0.62;
      doc.setDrawColor(200, 205, 212);
      doc.setLineWidth(0.3);
      doc.rect(marginMm, rowY, tableWidthMm, tableRows.length * rowHeightMm);
      doc.line(colSplitMm, rowY, colSplitMm, rowY + tableRows.length * rowHeightMm);
      for (let r = 1; r < tableRows.length; r++) {
        doc.line(marginMm, rowY + r * rowHeightMm, marginMm + tableWidthMm, rowY + r * rowHeightMm);
      }

      tableRows.forEach((row, idx) => {
        const cellY = rowY + idx * rowHeightMm + rowHeightMm / 2;
        drawArabicLine(doc, row.label, { xMm: marginMm + tableWidthMm - 3, yMm: cellY, align: "right", sizeMm: 3.7 });
        drawArabicLine(doc, row.value, { xMm: colSplitMm - 3, yMm: cellY, align: "right", sizeMm: 3.7 });
      });

      lastY = rowY + tableRows.length * rowHeightMm;
      lastY = await renderArabicPagesToPdf(doc, "\n" + signatureSection, null, lastY);
    } else {
      lastY = await renderArabicPagesToPdf(doc, text, logo);
    }
  } else {
    const marginMm = 14;
    let y = 20;
    if (logo) {
      const logoHeight = 14;
      const logoWidth = (logo.w / logo.h) * logoHeight;
      doc.addImage(logo.dataUrl, "PNG", 14, 10, logoWidth, logoHeight);
      y = 32;
    }
    doc.setTextColor(27, 36, 48);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginMm * 2;
    const paragraphs = text.split("\n");
    paragraphs.forEach((para) => {
      const trimmed = para.trim();
      if (trimmed === "") { y += 6; return; }
      // The very first line of the English contract is its title — give it
      // the same bold, centered treatment the Arabic contract's title gets,
      // instead of flowing it in as plain left-aligned body text.
      const isTitle = trimmed === "FIXED-TERM OUTSOURCING (EXTERNAL RESOURCES) AGREEMENT";
      doc.setFont(undefined, isTitle ? "bold" : "normal");
      doc.setFontSize(isTitle ? 14 : 11);
      const lines = doc.splitTextToSize(para, contentWidth);
      for (const line of lines) {
        if (y > pageHeight - 15) { doc.addPage(); y = 20; }
        if (isTitle) {
          doc.text(line, pageWidth / 2, y, { align: "center" });
        } else {
          doc.text(line, marginMm, y);
        }
        y += isTitle ? 8 : 6;
      }
    });
    doc.setFont(undefined, "normal");
    doc.setFontSize(11);
    lastY = y;
  }

  if (signatureImage) {
    const marginMm = 14;
    const pageHeight = doc.internal.pageSize.getHeight();
    let imgWidth = 60, imgHeight = 20;
    let imageOk = true;
    try {
      const imgProps = doc.getImageProperties(signatureImage);
      const maxWidth = 80;
      imgWidth = Math.min(maxWidth, imgProps.width);
      imgHeight = (imgProps.height / imgProps.width) * imgWidth;
    } catch (e) {
      imageOk = false;
    }

    // Arabic contracts already end with their own proper signature line
    // (rendered correctly via the canvas-based Arabic text flow) — adding
    // separate plain-text English labels here would both duplicate that
    // line and risk garbling the employee's name if it contains Arabic
    // characters, since jsPDF's plain text() doesn't shape Arabic. So for
    // Arabic contracts we only place the image itself, right under the
    // text's own signature line; English contracts get the labels since
    // no such line exists in their plain-text body.
    const labelHeight = isArabicDoc ? 0 : 8;
    const nameLineHeight = isArabicDoc ? 0 : 8;
    const gapBeforeBlock = 10;
    const blockHeight = nameLineHeight + labelHeight + imgHeight + 5;

    let sigY = lastY + gapBeforeBlock;
    if (sigY + blockHeight > pageHeight - marginMm) {
      doc.addPage();
      sigY = marginMm + 10;
    }

    if (!isArabicDoc) {
      doc.setFontSize(11);
      doc.setTextColor(27, 36, 48);
      doc.text(`Employee Name: ${employeeName || "—"}`, marginMm, sigY);
      sigY += nameLineHeight;
      doc.text("Employee Signature:", marginMm, sigY);
      sigY += 4;
    }

    if (imageOk) {
      try {
        doc.addImage(signatureImage, marginMm, sigY, imgWidth, imgHeight);
      } catch (e) {
        doc.setFontSize(9);
        doc.text("(Signature image could not be embedded)", marginMm, sigY + 6);
      }
    } else {
      doc.setFontSize(9);
      doc.text("(Signature image could not be embedded)", marginMm, sigY + 6);
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
  document.getElementById("editNationalId").value = e.national_id || "";
  document.getElementById("editIdNumber").value = e.id_number || "";
  document.getElementById("editEmergencyContactName").value = e.emergency_contact_name || "";
  document.getElementById("editEmergencyContactPhone").value = e.emergency_contact_phone || "";
  document.getElementById("editSocialSecurityNumber").value = e.social_security_number || "";
  document.getElementById("editBankAccountNumber").value = e.bank_account_number || "";
  document.getElementById("editIban").value = e.iban || "";
  document.getElementById("editEmploymentType").value = e.employment_type || "";
  document.getElementById("editHazardousOccupation").value = e.hazardous_occupation ? "true" : "false";
  document.getElementById("editVehicleStatus").value = e.vehicle_status || "";
  document.getElementById("editSpouseEmployed").value = e.spouse_employed ? "true" : "false";
  document.getElementById("editSpouseSalary").value = e.spouse_salary ?? "";
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
  const national_id = document.getElementById("editNationalId").value.trim() || null;
  const id_number = document.getElementById("editIdNumber").value.trim() || null;
  const emergency_contact_name = document.getElementById("editEmergencyContactName").value.trim() || null;
  const emergency_contact_phone = document.getElementById("editEmergencyContactPhone").value.trim() || null;
  const social_security_number = document.getElementById("editSocialSecurityNumber").value.trim() || null;
  const bank_account_number = document.getElementById("editBankAccountNumber").value.trim() || null;
  const iban = document.getElementById("editIban").value.trim() || null;
  const employment_type = document.getElementById("editEmploymentType").value || null;
  const hazardous_occupation = document.getElementById("editHazardousOccupation").value === "true";
  const vehicle_status = document.getElementById("editVehicleStatus").value || null;
  const spouse_employed = document.getElementById("editSpouseEmployed").value === "true";
  const spouse_salary = document.getElementById("editSpouseSalary").value !== "" ? Number(document.getElementById("editSpouseSalary").value) : null;

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
    body: {
      action: "update_employee", target_id, full_name, email, hiring_date, department, client_company, role,
      supervisor_file_number, annual_entitlement_override, carryover_balance, dob, nationality, address, education,
      salary, taken_this_year, national_id, id_number, emergency_contact_name, emergency_contact_phone,
      social_security_number, bank_account_number, iban, employment_type, hazardous_occupation, vehicle_status,
      spouse_employed, spouse_salary,
    }
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
    showInfoPopup(t("noResultsTitle"), t("noMatchingEmployeeToast"));
    return;
  }

  const redRowIndices = new Set();
  const rows = source.map((e, i) => {
    if (e.frozen) redRowIndices.add(i);
    const bal = BALANCES_BY_ID[e.id] || {};
    return [e.full_name, e.file_number, e.client_company || "—", e.department || "—", e.role, fmtDate(e.hiring_date), e.frozen ? fmtDate(e.frozen_at ? e.frozen_at.slice(0,10) : null) : "—", "W".repeat(Math.min(countActiveWarnings(e.id), 3)) || "—", String(e.carryover_balance ?? 0), String(bal.annual_entitlement ?? "—"), String(bal.taken ?? "—"), String(bal.remaining ?? "—"), String(bal.sick_entitlement ?? "—"), String(bal.sick_taken ?? "—"), String(bal.sick_remaining ?? "—")];
  });
  const scope = companyToApply ? `${companyToApply} — ` : "";
  const title = scope + (ACTIVE_TAB === "supervisors" ? "Supervisors — Leave Report" : "Employees — Leave Report");
  const filenamePrefix = companyToApply ? `${companyToApply.toLowerCase()}_` : "";
  const rangeNote = (range.from || range.to) ? ` — Period: ${range.from || "…"} to ${range.to || "…"}` : "";
  const columns = ["Employee Name", "ID #", "Company", "Department", "Role", "Hiring Date", "Frozen Date", "Active Warning", "Prev. Balance", "Annual", "Ann. Taken", "Available Balance", "Sick", "Sick Taken", "Sick Left"];
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
    showInfoPopup(t("noResultsTitle"), t("noMatchingRequestsToast"));
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
  ewSimpleField("national_id", "National ID number", "National ID number", "text", true),
  ewSimpleField("id_number", "ID number", "ID number", "text", false),
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
    key: "emergency_contact", title: "Emergency contact", required: false,
    render(container) {
      container.innerHTML = `
        <label for="ew_emergency_contact_name">Emergency contact name</label>
        <input type="text" id="ew_emergency_contact_name" value="${escapeHtml(EMP_WIZARD.values.emergency_contact_name || "")}">
        <label for="ew_emergency_contact_phone" style="margin-top:12px">Emergency contact phone</label>
        <input type="text" id="ew_emergency_contact_phone" value="${escapeHtml(EMP_WIZARD.values.emergency_contact_phone || "")}">
      `;
      setTimeout(() => document.getElementById("ew_emergency_contact_name").focus(), 0);
    },
    save() {
      EMP_WIZARD.values.emergency_contact_name = document.getElementById("ew_emergency_contact_name").value.trim();
      EMP_WIZARD.values.emergency_contact_phone = document.getElementById("ew_emergency_contact_phone").value.trim();
    },
    valid() { return true; },
  },
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
  ewSimpleField("bank_account_number", "Bank account number", "Bank account number", "text", false),
  ewSimpleField("iban", "IBAN", "IBAN", "text", false),
  {
    ...ewSimpleField("carryover", t("carryoverLabel"), t("carryoverLabel"), "number", false),
    showIf: (v) => yearsSinceHire(v.hiring_date) >= 1,
  },
  {
    ...ewSimpleField("taken_this_year", t("takenThisYearLabel"), t("takenThisYearLabel"), "number", false),
    showIf: (v) => !(yearsSinceHire(v.hiring_date) >= 1 && Number(v.carryover) > 0),
  },
  ewSimpleField("social_security_number", "Social security number", "Social security number", "text", false),
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
    key: "additional_details", title: "Additional details", required: false,
    render(container) {
      const v = EMP_WIZARD.values;
      container.innerHTML = `
        <label for="ew_employment_type">Employment type</label>
        <select id="ew_employment_type">
          <option value="">Select employment type…</option>
          <option value="full_time" ${v.employment_type === "full_time" ? "selected" : ""}>Full-time</option>
          <option value="part_time" ${v.employment_type === "part_time" ? "selected" : ""}>Part-time</option>
          <option value="contractor" ${v.employment_type === "contractor" ? "selected" : ""}>Contractor</option>
        </select>

        <label for="ew_hazardous_occupation" style="margin-top:12px">Hazardous occupation?</label>
        <select id="ew_hazardous_occupation">
          <option value="false" ${!v.hazardous_occupation ? "selected" : ""}>No</option>
          <option value="true" ${v.hazardous_occupation ? "selected" : ""}>Yes</option>
        </select>

        <label for="ew_vehicle_status" style="margin-top:12px">Vehicle</label>
        <select id="ew_vehicle_status">
          <option value="" ${!v.vehicle_status ? "selected" : ""}>None</option>
          <option value="company_provided" ${v.vehicle_status === "company_provided" ? "selected" : ""}>Company-provided vehicle</option>
          <option value="employee_rented" ${v.vehicle_status === "employee_rented" ? "selected" : ""}>Employee's own vehicle (rented)</option>
        </select>

        <label for="ew_spouse_employed" style="margin-top:12px">Is spouse employed?</label>
        <select id="ew_spouse_employed">
          <option value="false" ${!v.spouse_employed ? "selected" : ""}>No</option>
          <option value="true" ${v.spouse_employed ? "selected" : ""}>Yes</option>
        </select>

        <label for="ew_spouse_salary" style="margin-top:12px">Spouse salary (if employed)</label>
        <input type="number" id="ew_spouse_salary" min="0" step="1" value="${v.spouse_salary || ""}">
      `;
    },
    save() {
      EMP_WIZARD.values.employment_type = document.getElementById("ew_employment_type").value || null;
      EMP_WIZARD.values.hazardous_occupation = document.getElementById("ew_hazardous_occupation").value === "true";
      EMP_WIZARD.values.vehicle_status = document.getElementById("ew_vehicle_status").value || null;
      EMP_WIZARD.values.spouse_employed = document.getElementById("ew_spouse_employed").value === "true";
      EMP_WIZARD.values.spouse_salary = Number(document.getElementById("ew_spouse_salary").value) || null;
    },
    valid() { return true; },
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
          <p><strong>National ID:</strong> ${v.national_id ? escapeHtml(v.national_id) : "—"}</p>
          <p><strong>ID number:</strong> ${v.id_number ? escapeHtml(v.id_number) : "—"}</p>
          <p><strong>${t("emailLabel")}:</strong> ${escapeHtml(v.email)}</p>
          <p><strong>Address:</strong> ${v.address ? escapeHtml(v.address) : "—"}</p>
          <p><strong>Emergency contact:</strong> ${v.emergency_contact_name ? `${escapeHtml(v.emergency_contact_name)}${v.emergency_contact_phone ? " — " + escapeHtml(v.emergency_contact_phone) : ""}` : "—"}</p>
          <p><strong>Education:</strong> ${v.education ? escapeHtml(v.education) : "—"}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phoneDisplay)}</p>
          <p><strong>Social security number:</strong> ${v.social_security_number ? escapeHtml(v.social_security_number) : "—"}</p>
          <p><strong>${t("hiringDateLabel")}:</strong> ${v.hiring_date || "—"}</p>
          <p><strong>Job Title:</strong> ${v.job_title ? escapeHtml(v.job_title) : "—"}</p>
          <p><strong>Contract period:</strong> ${v.contract_period_months ? v.contract_period_months + " months" : "—"}</p>
          <p><strong>Salary:</strong> ${v.salary ? v.salary + " JOD" : "—"}</p>
          <p><strong>Bank account number:</strong> ${v.bank_account_number ? escapeHtml(v.bank_account_number) : "—"}</p>
          <p><strong>IBAN:</strong> ${v.iban ? escapeHtml(v.iban) : "—"}</p>
          <p><strong>${t("companyClientLabel")}:</strong> ${escapeHtml(v.company)}</p>
          <p><strong>${t("departmentLabel")}:</strong> ${escapeHtml(v.department)}</p>
          <p><strong>Employment type:</strong> ${v.employment_type || "—"}</p>
          <p><strong>Hazardous occupation:</strong> ${v.hazardous_occupation ? "Yes" : "No"}</p>
          <p><strong>Vehicle:</strong> ${v.vehicle_status === "company_provided" ? "Company-provided" : v.vehicle_status === "employee_rented" ? "Employee's own (rented)" : "None"}</p>
          <p><strong>Spouse employed:</strong> ${v.spouse_employed ? `Yes${v.spouse_salary ? " — " + v.spouse_salary + " JOD" : ""}` : "No"}</p>
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
      national_id: v.national_id || null,
      id_number: v.id_number || null,
      social_security_number: v.social_security_number || null,
      emergency_contact_name: v.emergency_contact_name || null,
      emergency_contact_phone: v.emergency_contact_phone || null,
      employment_type: v.employment_type || null,
      bank_account_number: v.bank_account_number || null,
      iban: v.iban || null,
      hazardous_occupation: !!v.hazardous_occupation,
      vehicle_status: v.vehicle_status || null,
      spouse_employed: !!v.spouse_employed,
      spouse_salary: v.spouse_salary || null,
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

// Notifies the admin when a signed contract is entering its final 30 days,
// so they can decide to renew (via the Renew Contract action) or prepare
// end-of-service. Uses a per-contract dismissed-list rather than a single
// "last seen" timestamp, since this is a standing state to address, not a
// one-off event — it should keep reappearing each visit until acted on,
// but only for contracts the admin hasn't already dismissed individually.
async function checkContractExpiryNotifications() {
  try {
    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);
    const todayIso = today.toISOString().slice(0, 10);
    const in30Iso = in30Days.toISOString().slice(0, 10);

    const { data: expiringContracts, error } = await db
      .from("contracts")
      .select("id, employee_id, end_date")
      .eq("status", "signed")
      .gte("end_date", todayIso)
      .lte("end_date", in30Iso);

    if (error || !expiringContracts || expiringContracts.length === 0) return;

    const dismissedKey = `fwx_dismissedExpiryContracts_${ME.id}`;
    let dismissed = [];
    try { dismissed = JSON.parse(localStorage.getItem(dismissedKey) || "[]"); } catch (e) { dismissed = []; }
    const dismissedSet = new Set(dismissed);
    const stillRelevant = expiringContracts.filter(c => !dismissedSet.has(c.id));
    if (stillRelevant.length === 0) return;

    const nameFor = (employeeId) => {
      const emp = DIRECTORY.find(x => x.id === employeeId);
      return emp ? emp.full_name : "An employee";
    };
    const lines = stillRelevant
      .map(c => `${nameFor(c.employee_id)} — expires ${fmtDate(c.end_date)}`)
      .join("\n");

    showInfoPopup(
      "Contracts expiring soon",
      `${stillRelevant.length} contract${stillRelevant.length > 1 ? "s are" : " is"} expiring within 30 days:\n${lines}\n\nUse "Renew Contract" from the employee's Actions menu to prepare a renewal, or prepare end-of-service if the employee is leaving.`,
      "⏰",
      () => {
        const updated = [...dismissedSet, ...stillRelevant.map(c => c.id)];
        localStorage.setItem(dismissedKey, JSON.stringify(updated));
      }
    );
  } catch (err) {
    console.error("checkContractExpiryNotifications: unexpected error", err);
  }
}

async function checkAdminEmployeeActionNotifications() {
  try {
    const lastSeenKey = `fwx_adminLastSeenActions_${ME.id}`;
    const lastSeen = localStorage.getItem(lastSeenKey);
    const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
    const nowIso = new Date().toISOString();

    // Reuse the exact same warnings fetch that already powers the admin's
    // own Warnings tab correctly (confirmed working), rather than a
    // separate raw query — and re-run it fresh on every check so polling
    // doesn't just re-filter a stale snapshot from page load.
    const [{ data: signedContracts, error: contractsErr }] = await Promise.all([
      db.from("contracts").select("id, employee_id, signed_at").eq("status", "signed").not("signed_at", "is", null),
      loadWarningsDataOnly(),
    ]);
    const ackedWarnings = WARNINGS_LIST.filter(w => !!w.acknowledged_at);

    if (contractsErr) console.error("checkAdminEmployeeActionNotifications: contracts query failed", contractsErr);

    const nameFor = (employeeId) => {
      const emp = DIRECTORY.find(e => e.id === employeeId);
      return emp ? emp.full_name : "An employee";
    };

    const namesList = (names) => {
      const unique = [...new Set(names)];
      if (unique.length <= 3) return unique.join(", ");
      return `${unique.slice(0, 3).join(", ")}, and ${unique.length - 3} more`;
    };

    const newSigned = (signedContracts || []).filter(c => !lastSeenDate || new Date(c.signed_at) > lastSeenDate);
    const newAcked = (ackedWarnings || []).filter(w => !lastSeenDate || new Date(w.acknowledged_at) > lastSeenDate);

    console.log(`checkAdminEmployeeActionNotifications: lastSeen=${lastSeen || "never"}, signedContracts=${(signedContracts||[]).length}, ackedWarnings=${(ackedWarnings||[]).length}, newSigned=${newSigned.length}, newAcked=${newAcked.length}`);

    if (newSigned.length === 0 && newAcked.length === 0) {
      localStorage.setItem(lastSeenKey, nowIso);
      return;
    }

    const parts = [];
    if (newSigned.length > 0) {
      const names = namesList(newSigned.map(c => nameFor(c.employee_id)));
      parts.push(`${newSigned.length} contract${newSigned.length > 1 ? "s" : ""} newly signed (${names})`);
    }
    if (newAcked.length > 0) {
      const names = namesList(newAcked.map(w => nameFor(w.employee_id)));
      parts.push(`${newAcked.length} warning${newAcked.length > 1 ? "s" : ""} newly acknowledged (${names})`);
    }

    showInfoPopup(t("docActivityTitle"), `${parts.join(" · ")} since your last visit.`, "🔔", () => {
      localStorage.setItem(lastSeenKey, nowIso);
    });
  } catch (err) {
    console.error("checkAdminEmployeeActionNotifications: unexpected error", err);
  }
}

(async () => {
  ME = await requireSession("admin");
  if (!ME) return;
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  if (COMPANY_FILTER) {
    document.getElementById("pageTitle").textContent = `${COMPANY_FILTER} — ${t("companyScopedTitleSuffix")}`;
    document.getElementById("pageSub").textContent = tv("companyScopedSub", { company: COMPANY_FILTER });
  }
  await Promise.all([loadSupervisors(), loadBalances(), loadWarningsDataOnly(), loadContractsDataOnly()]);
  await loadDirectory();
  checkAdminEmployeeActionNotifications();
  setInterval(checkAdminEmployeeActionNotifications, 8000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkAdminEmployeeActionNotifications();
  });
  window.addEventListener("focus", () => checkAdminEmployeeActionNotifications());
  checkContractExpiryNotifications();
  setInterval(checkContractExpiryNotifications, 60000);

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
