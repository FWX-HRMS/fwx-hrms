let ME = null;
// Reusable search bar injector — creates a 🔍 search input (with a small
// "×" clear button that appears once there's text) right above the given
// table, and wires both to re-render on input. Works without needing the
// HTML file, so it can be dropped onto any table.
function ensureTableSearch(tbodyId, inputId, onQuery) {
  let input = document.getElementById(inputId);
  if (input) return input;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return null;
  const table = tbody.closest("table");
  if (!table) return null;
  const clearBtnId = `${inputId}ClearBtn`;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative; max-width:480px; margin-bottom:14px";
  wrap.innerHTML = `
    <span style="position:absolute; inset-inline-start:12px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:.55">🔍</span>
    <input type="text" id="${inputId}" placeholder="Name, file #, company, role, or department" style="width:100%; padding-inline-start:36px; padding-inline-end:32px">
    <button type="button" id="${clearBtnId}" aria-label="Clear search" style="display:none; position:absolute; inset-inline-end:10px; top:50%; transform:translateY(-50%); width:22px; height:22px; border:none; background:transparent; font-size:17px; line-height:1; color:var(--ink-soft, #6b7684); cursor:pointer; padding:0">&times;</button>
  `;
  table.parentNode.insertBefore(wrap, table);
  input = document.getElementById(inputId);
  input.addEventListener("input", onQuery);
  wireSearchClearBtn(inputId, clearBtnId);
  return input;
}

// Shared by every search box built above (and the Employee ID field in
// the report dialog) — shows the "×" whenever the field has text, and
// clicking it empties the field and re-fires "input" so whatever's
// listening (a table re-filter, or the report dialog's Employee ID
// narrowing) reacts exactly as if the text had been deleted by hand.
function wireSearchClearBtn(inputId, clearBtnId) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearBtnId);
  if (!input || !clearBtn) return;
  const toggle = () => { clearBtn.style.display = input.value ? "flex" : "none"; };
  input.addEventListener("input", toggle);
  clearBtn.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.focus();
  });
  toggle();
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
let TEAM_BY_ID = {};
let TEAM_BALANCE_ROWS = [];
let PENDING_REQUESTS = [];
let HISTORY_REQUESTS = [];
let PENDING_PAGE = 0;
let HISTORY_PAGE = 0;
let USERS_PAGE = 0;
let TEAM_LIST = [];
const PAGE_SIZE = 10;

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

function updatePaginationControls(prefix, page, totalCount) {
  const wrap = document.getElementById(`${prefix}Pagination`);
  const info = document.getElementById(`${prefix}PageInfo`);
  const prevBtn = document.getElementById(`${prefix}PrevBtn`);
  const nextBtn = document.getElementById(`${prefix}NextBtn`);

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

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function badgeFor(status) {
  const key = "status" + status[0].toUpperCase() + status.slice(1);
  return `<span class="badge badge-${status}">${t(key)}</span>`;
}

async function loadTeam() {
  const query = db.from("employees").select("*").order("full_name");
  // Admin still needs to see frozen employees (to unfreeze them) — only
  // the supervisor's own team view hides them, since a frozen employee
  // is no longer active and shouldn't clutter a supervisor's day-to-day
  // team list.
  let data, error;
  if (ME.role === "admin") {
    ({ data, error } = await query.neq("role", "admin"));
  } else if (ME.role === "company_admin") {
    ({ data, error } = await query.eq("client_company", ME.client_company).eq("frozen", false));
  } else {
    ({ data, error } = await query.eq("supervisor_id", ME.id).eq("frozen", false));
  }

  if (error || !data) return [];

  if (ME.role === "company_admin") {
    // A company admin only manages a chosen subset of their own
    // company's departments — stored as a comma-separated list in their
    // own `department` field (reusing the existing column rather than
    // needing a new one; see admin.js's Add Company Admin modal) — and
    // never sees other admin-tier accounts. Matching is case- and
    // whitespace-tolerant so a minor difference in how a department was
    // typed elsewhere (extra space, different casing) doesn't silently
    // drop someone who should actually be visible.
    const normalize = (s) => (s || "").trim().toLowerCase();
    const allowedDepartments = (ME.department || "").split(",").map(normalize).filter(Boolean);
    data = data.filter(e => allowedDepartments.includes(normalize(e.department)) && e.role !== "admin" && e.role !== "company_admin");
  }

  TEAM_BY_ID = Object.fromEntries(data.map(e => [e.id, e]));
  TEAM_LIST = data;
  USERS_PAGE = 0;
  document.getElementById("teamCount").textContent = (ME.role === "admin" || ME.role === "company_admin")
    ? `${data.length} ${data.length === 1 ? t("employeeCountSuffix") : t("employeeCountSuffixPlural")}`
    : `${data.length} ${data.length === 1 ? t("directReportsSuffix") : t("directReportsSuffixPlural")}`;
  renderUsers();
  return data;
}

function supervisorNameFor(e) {
  if (e.role === "supervisor") return "—";
  if (!e.supervisor_id) return "—";
  if (e.supervisor_id === ME.id) return ME.full_name;
  const sup = TEAM_BY_ID[e.supervisor_id];
  return sup ? sup.full_name : "—";
}

function ensureUsersSupervisorHeader() {
  const body = document.getElementById("usersBody");
  const table = body && body.closest("table");
  const headerRow = table && table.querySelector("thead tr");
  if (!headerRow || headerRow.dataset.supervisorColAdded) return;
  // Department is the 5th header cell (index 4) in this table's existing
  // column order — insert Supervisor right after it, before Prev. Year Balance.
  const departmentTh = headerRow.children[4];
  if (!departmentTh) return;
  const th = document.createElement("th");
  th.textContent = "Supervisor";
  departmentTh.parentNode.insertBefore(th, departmentTh.nextSibling);
  headerRow.dataset.supervisorColAdded = "1";
}

function countActiveWarnings(employeeId) {
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const source = ME.role === "admin" ? ADMIN_WARNINGS_LIST : TEAM_WARNINGS_LIST;
  return source.filter(w => {
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

function renderUsers() {
  const body = document.getElementById("usersBody");
  const empty = document.getElementById("noUsers");
  body.innerHTML = "";

  ensureUsersSupervisorHeader();
  ensureTableSearch("usersBody", "usersSearchInput", () => { USERS_PAGE = 0; renderUsers(); });
  const query = (document.getElementById("usersSearchInput") || {}).value || "";
  const activeTeam = TEAM_LIST.filter(e => !e.frozen);
  const filteredTeam = query
    ? activeTeam.filter(e => matchesTableSearch(query, e.file_number, e.client_company, e.role, e.full_name, e.department))
    : activeTeam;
  notifyIfNoSearchResults(document.getElementById("usersSearchInput"), query, filteredTeam.length);
  empty.style.display = filteredTeam.length ? "none" : "block";

  const balByEmployeeId = Object.fromEntries(TEAM_BALANCE_ROWS.map(r => [r.employee_id, r]));
  const start = USERS_PAGE * PAGE_SIZE;
  const pageItems = filteredTeam.slice(start, start + PAGE_SIZE);
  for (const e of pageItems) {
    const bal = balByEmployeeId[e.id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.full_name}${activeWarningBadge(e.id)}${e.frozen ? ` <span class="badge badge-frozen">Frozen - ${e.frozen_reason === "termination" ? "T" : e.frozen_reason === "resignation" ? "R" : e.frozen_reason === "end_of_contract" ? "E" : "?"}</span>` : ""}</td>
      <td>${e.file_number}</td>
      <td style="text-transform:capitalize">${e.role}</td>
      <td>${e.client_company || "—"}</td>
      <td>${e.department || "—"}</td>
      <td>${supervisorNameFor(e)}</td>
      <td>${bal ? bal.remaining : "—"}</td>
      <td>${bal ? bal.annual_entitlement : "—"}</td>
      <td>${bal ? bal.taken : "—"}</td>
      <td>${e.carryover_balance !== null && e.carryover_balance !== undefined ? e.carryover_balance : 0}</td>
      <td>${bal ? bal.sick_entitlement : "—"}</td>
      <td>${bal ? bal.sick_taken : "—"}</td>
      <td>${bal ? bal.sick_remaining : "—"}</td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("users", USERS_PAGE, filteredTeam.length);
}

async function loadBalances() {
  const { data, error } = await db.from("leave_balances_calendar_year").select("*");
  if (error || !data) { TEAM_BALANCE_ROWS = []; renderUsers(); return; }

  // leave_balances RLS already restricts this to "my team + me"
  TEAM_BALANCE_ROWS = data.filter(r => TEAM_BY_ID[r.employee_id]);
  renderUsers();
}

async function loadRequests() {
  const { data, error } = await db
    .from("leave_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error || !data) { PENDING_REQUESTS = []; HISTORY_REQUESTS = []; renderPending(); renderHistory(); return; }

  // Admin viewing this page also needs to see pending_admin rows here
  // (the unpaid-leave second approval step) — a regular supervisor only
  // ever sees plain "pending" items awaiting their own action.
  PENDING_REQUESTS = data.filter(r => TEAM_BY_ID[r.employee_id] && (r.status === "pending" || (ME.role === "admin" && r.status === "pending_admin")));
  HISTORY_REQUESTS = data.filter(r => r.status !== "pending" && r.status !== "pending_admin" && TEAM_BY_ID[r.employee_id]);
  PENDING_PAGE = 0;
  HISTORY_PAGE = 0;
  renderPending();
  renderHistory();
}

function renderPending() {
  const pendingBody = document.getElementById("pendingBody");
  const noPending = document.getElementById("noPending");
  pendingBody.innerHTML = "";

  ensureTableSearch("pendingBody", "pendingSearchInput", () => { PENDING_PAGE = 0; renderPending(); });
  const pendingQuery = (document.getElementById("pendingSearchInput") || {}).value || "";
  const filteredPending = pendingQuery
    ? PENDING_REQUESTS.filter(r => {
        const emp = TEAM_BY_ID[r.employee_id];
        return matchesTableSearch(pendingQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : PENDING_REQUESTS;
  notifyIfNoSearchResults(document.getElementById("pendingSearchInput"), pendingQuery, filteredPending.length);
  noPending.style.display = filteredPending.length ? "none" : "block";

  const start = PENDING_PAGE * PAGE_SIZE;
  const pageItems = filteredPending.slice(start, start + PAGE_SIZE);

  for (const r of pageItems) {
    const emp = TEAM_BY_ID[r.employee_id];
    const tr = document.createElement("tr");
    const actionsCell = ME.role === "admin"
      ? (r.status === "pending_admin"
          ? `<td class="row-actions">
              <button class="btn btn-primary btn-sm" data-admin-action="approved" data-admin-id="${r.id}">${t("approveBtn")}</button>
              <button class="btn btn-danger btn-sm" data-admin-action="rejected" data-admin-id="${r.id}">${t("rejectBtn")}</button>
              ${newBadge(r.requested_at)}
            </td>`
          : `<td>${badgeFor(r.status)}${newBadge(r.requested_at)}</td>`)
      : `<td class="row-actions">
          <button class="btn btn-primary btn-sm" data-action="approved" data-id="${r.id}">${t("approveBtn")}</button>
          <button class="btn btn-danger btn-sm" data-action="rejected" data-id="${r.id}">${t("rejectBtn")}</button>
          ${newBadge(r.requested_at)}
        </td>`;
    const isHourly = r.leave_type === "hourly";
    const dateCell = isHourly
      ? `${fmtDate(r.start_date)} (${r.time_from ? r.time_from.slice(0,5) : "—"}–${r.time_to ? r.time_to.slice(0,5) : "—"})`
      : `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}`;
    const amountCell = isHourly ? `${r.hours_requested}h` : r.days_requested;
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${dateCell}</td>
      <td>${amountCell}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${r.reason ? r.reason : "—"}</td>
      <td>${r.document_path ? `<button type="button" class="btn btn-blue btn-sm" data-doc="${r.document_path}">View Attachment</button>` : "—"}</td>
      ${actionsCell}
    `;
    pendingBody.appendChild(tr);
  }

  pendingBody.querySelectorAll("button[data-doc]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data, error } = await db.storage.from("leave-documents").createSignedUrl(btn.dataset.doc, 60);
      if (error || !data) { showToast(t("couldNotOpenDoc")); return; }
      window.open(data.signedUrl, "_blank");
    });
  });

  pendingBody.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      pendingBody.querySelectorAll("button").forEach(b => b.disabled = true);
      showGlobalSpinner();

      // Unpaid AND "other" leave both need a second sign-off from admin
      // before they're truly approved — "other" is treated identically to
      // unpaid here per an explicit request to make them behave exactly
      // the same. Annual and sick still go straight to approved/rejected.
      const req = PENDING_REQUESTS.find(r => r.id === btn.dataset.id);
      const needsAdminApproval = btn.dataset.action === "approved" && req && (req.leave_type === "unpaid" || req.leave_type === "other");
      const newStatus = needsAdminApproval ? "pending_admin" : btn.dataset.action;

      const { error } = await db
        .from("leave_requests")
        .update({ status: newStatus, decided_by: ME.id, decided_at: new Date().toISOString() })
        .eq("id", btn.dataset.id);
      hideGlobalSpinner();
      if (error) { showToast(t("couldNotUpdateRequest")); }
      else {
        showToast(needsAdminApproval ? t("statusSentToAdmin") : t(btn.dataset.action === "approved" ? "statusApproved" : "statusRejected"));
        db.functions.invoke("clever-api", {
          body: { leave_request_id: btn.dataset.id, type: "decided" }
        }).catch(() => {});
        // Only notify on a genuinely final outcome — unpaid leave moving
        // to pending_admin is still awaiting a second decision, not done yet.
        if (req && !needsAdminApproval) {
          const emp = TEAM_BY_ID[req.employee_id];
          db.from("notifications").insert({
            type: newStatus === "approved" ? "leave_approved" : "leave_rejected",
            employee_id: req.employee_id,
            target_role: "admin",
            title: `Leave request ${newStatus}`,
            message: `${emp ? emp.full_name : "Your"} ${req.leave_type} leave request (${req.start_date} to ${req.end_date}) was ${newStatus}.`,
            status: "resolved",
            read: false,
          }).then(() => {});
        }
      }
      await refreshAll();
    });
  });

  pendingBody.querySelectorAll("button[data-admin-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      pendingBody.querySelectorAll("button").forEach(b => b.disabled = true);
      showGlobalSpinner();
      const adminReq = PENDING_REQUESTS.find(r => r.id === btn.dataset.adminId);
      const { error } = await db
        .from("leave_requests")
        .update({ status: btn.dataset.adminAction, decided_by: ME.id, decided_at: new Date().toISOString() })
        .eq("id", btn.dataset.adminId);
      hideGlobalSpinner();
      if (error) { showToast(t("couldNotUpdateRequest")); }
      else {
        showToast(t(btn.dataset.adminAction === "approved" ? "statusApproved" : "statusRejected"));
        db.functions.invoke("clever-api", {
          body: { leave_request_id: btn.dataset.adminId, type: "decided" }
        }).catch(() => {});
        if (adminReq) {
          const emp = TEAM_BY_ID[adminReq.employee_id];
          db.from("notifications").insert({
            type: btn.dataset.adminAction === "approved" ? "leave_approved" : "leave_rejected",
            employee_id: adminReq.employee_id,
            target_role: "admin",
            title: `Unpaid leave request ${btn.dataset.adminAction}`,
            message: `${emp ? emp.full_name : "Your"} unpaid leave request (${adminReq.start_date} to ${adminReq.end_date}) was ${btn.dataset.adminAction} by admin.`,
            status: "resolved",
            read: false,
          }).then(() => {});
        }
      }
      await refreshAll();
    });
  });

  updatePaginationControls("pending", PENDING_PAGE, filteredPending.length);
}

function renderHistory() {
  const historyBody = document.getElementById("historyBody");
  const noHistory = document.getElementById("noHistory");
  historyBody.innerHTML = "";

  ensureTableSearch("historyBody", "historySearchInput", () => { HISTORY_PAGE = 0; renderHistory(); });
  const historyQuery = (document.getElementById("historySearchInput") || {}).value || "";
  const filteredHistory = historyQuery
    ? HISTORY_REQUESTS.filter(r => {
        const emp = TEAM_BY_ID[r.employee_id];
        return matchesTableSearch(historyQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : HISTORY_REQUESTS;
  notifyIfNoSearchResults(document.getElementById("historySearchInput"), historyQuery, filteredHistory.length);
  noHistory.style.display = filteredHistory.length ? "none" : "block";

  const start = HISTORY_PAGE * PAGE_SIZE;
  const pageItems = filteredHistory.slice(start, start + PAGE_SIZE);

  for (const r of pageItems) {
    const emp = TEAM_BY_ID[r.employee_id];
    const tr = document.createElement("tr");
    const isHourly = r.leave_type === "hourly";
    const dateCell = isHourly
      ? `${fmtDate(r.start_date)} (${r.time_from ? r.time_from.slice(0,5) : "—"}–${r.time_to ? r.time_to.slice(0,5) : "—"})`
      : `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}`;
    const amountCell = isHourly ? `${r.hours_requested}h` : r.days_requested;
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${dateCell}</td>
      <td>${amountCell}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${badgeFor(r.status)}${newBadge(r.requested_at)}</td>
    `;
    historyBody.appendChild(tr);
  }

  updatePaginationControls("history", HISTORY_PAGE, filteredHistory.length);
}

document.getElementById("pendingPrevBtn").addEventListener("click", () => { if (PENDING_PAGE > 0) { PENDING_PAGE--; renderPending(); } });
document.getElementById("pendingNextBtn").addEventListener("click", () => { if ((PENDING_PAGE + 1) * PAGE_SIZE < PENDING_REQUESTS.length) { PENDING_PAGE++; renderPending(); } });
document.getElementById("historyPrevBtn").addEventListener("click", () => { if (HISTORY_PAGE > 0) { HISTORY_PAGE--; renderHistory(); } });
document.getElementById("historyNextBtn").addEventListener("click", () => { if ((HISTORY_PAGE + 1) * PAGE_SIZE < HISTORY_REQUESTS.length) { HISTORY_PAGE++; renderHistory(); } });
document.getElementById("usersPrevBtn").addEventListener("click", () => { if (USERS_PAGE > 0) { USERS_PAGE--; renderUsers(); } });
document.getElementById("usersNextBtn").addEventListener("click", () => { if ((USERS_PAGE + 1) * PAGE_SIZE < TEAM_LIST.length) { USERS_PAGE++; renderUsers(); } });
document.getElementById("teamWarningsPrevBtn").addEventListener("click", () => { if (TEAM_WARNINGS_PAGE > 0) { TEAM_WARNINGS_PAGE--; renderTeamWarnings(); } });
document.getElementById("teamWarningsNextBtn").addEventListener("click", () => { if ((TEAM_WARNINGS_PAGE + 1) * PAGE_SIZE < TEAM_WARNINGS_LIST.length) { TEAM_WARNINGS_PAGE++; renderTeamWarnings(); } });

const DEPARTMENTS_BY_COMPANY = {
  "Umniah": ["Battery Rescue Power Planning", "Transmission & OMC", "Network Maintenance", "Network- Power & Energy Planning", "RA Network", "Transport Planning", "Transmission", "Rent Site", "Civil", "TDD Visit", "Wherhouse", "Tele Sales", "Direct Sales", "Preventive Maintenance", "N.W Rollout Acceptance", "Network Planning & Maintenance", "Drive Test", "MDS", "Selection", "Quality", "Data Centre", "Office"],
  "Zain": ["Fiber acceptance", "Fiber Support", "FiberTech", "Power", "Bunker", "Tele Sales", "Direct Sales", "Shop Maintenance", "IBS", "TXM", "Network Maintenance", "Preventive Maintenance", "Data Centre", "Office"],
  "Fiber-Tech": ["Field", "Rollout and Acceptance", "Fiber"],
};
const DEFAULT_DEPARTMENTS = ["Technical", "Sales", "Marketing", "HR", "Finance", "IT", "Administration"];

function ensureRangeCompanySelect() {
  let select = document.getElementById("rangeCompanySelect");
  if (select) return select;
  const employeeIdInput = document.getElementById("rangeEmployeeIdInput");
  if (!employeeIdInput) return null;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <label for="rangeCompanySelect">Company</label>
    <select id="rangeCompanySelect" style="margin-bottom:14px; width:100%"></select>
  `;
  // Anchor on the *wrapper* div (position:relative, holding the Employee
  // ID input plus its clear button), not the bare input — inserting
  // relative to the input itself would land this new block inside that
  // wrapper instead of after it, which drags the clear button's
  // absolute-positioning context down with it (it ends up floating next
  // to whatever got nested in with it instead of next to the input).
  const anchor = employeeIdInput.closest("div");
  anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  return document.getElementById("rangeCompanySelect");
}

// Department checkboxes are injected the same lazy, one-time way as the
// company <select> above — right after whichever of the Company select
// (admin) or the Employee ID field (regular supervisor, who has no
// company picker since their team is already one company) is present.
function ensureRangeDepartmentCheckboxes() {
  let container = document.getElementById("rangeDepartmentCheckboxes");
  if (container) return container;
  const employeeIdInput = document.getElementById("rangeEmployeeIdInput");
  if (!employeeIdInput) return null;
  const wrap = document.createElement("div");
  const companySelect = document.getElementById("rangeCompanySelect");
  // Same reasoning as ensureRangeCompanySelect above: anchor on the
  // wrapper div, never the bare input.
  const anchor = companySelect ? companySelect.closest("div") : employeeIdInput.closest("div");
  wrap.innerHTML = `
    <label>Department</label>
    <div id="rangeDepartmentCheckboxes" style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin-bottom:14px; padding:2px"></div>
  `;
  anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  return document.getElementById("rangeDepartmentCheckboxes");
}

function employeeIdPlaceholderFor() {
  // Derive an example from the supervisor's own file number so it's always
  // a plausible, in-range number for their exact company — but offset by
  // one rather than showing their own literal ID as "the example".
  if (!ME.file_number) return "e.g. 1003";
  const num = parseInt(ME.file_number, 10);
  if (isNaN(num)) return `e.g. ${ME.file_number}`;
  const example = String(num + 1).padStart(ME.file_number.length, "0");
  return `e.g. ${example}`;
}

// Captured lazily the first time the report dialog opens, so a report
// that doesn't ask for custom From/To wording still shows the right
// default text instead of a leftover override from a previous report.
let DEFAULT_RANGE_FROM_LABEL = null;
let DEFAULT_RANGE_TO_LABEL = null;

function showDateRangePrompt(title, dateLabels) {
  return new Promise(async (resolve) => {
    document.getElementById("dateRangeTitle").textContent = title;
    if (DEFAULT_RANGE_FROM_LABEL === null) {
      DEFAULT_RANGE_FROM_LABEL = document.getElementById("rangeFromLabel").textContent;
      DEFAULT_RANGE_TO_LABEL = document.getElementById("rangeToLabel").textContent;
    }
    document.getElementById("rangeFromLabel").textContent = (dateLabels && dateLabels.from) || DEFAULT_RANGE_FROM_LABEL;
    document.getElementById("rangeToLabel").textContent = (dateLabels && dateLabels.to) || DEFAULT_RANGE_TO_LABEL;
    document.getElementById("rangeFromInput").value = "";
    document.getElementById("rangeToInput").value = "";
    document.getElementById("rangeEmployeeIdInput").value = "";
    document.getElementById("rangeEmployeeIdInput").placeholder = ME.role === "admin"
      ? "e.g. 6002 (F.W.X), 1003 (Zain)"
      : employeeIdPlaceholderFor();
    document.getElementById("rangeIncludeHourly").checked = true;
    document.getElementById("rangeFormatPdf").checked = true;
    document.getElementById("rangeFormatExcel").checked = false;
    document.getElementById("rangeFormatError").classList.remove("show");

    // A regular supervisor's team is always within their own company, so
    // the company filter only adds value for admins viewing across
    // companies — keep it hidden entirely for supervisors.
    const existingCompanySelect = document.getElementById("rangeCompanySelect");
    if (ME.role === "admin") {
      const companySelect = ensureRangeCompanySelect();
      if (companySelect) {
        const { data: companies } = await db.from("client_companies").select("name").order("name");
        companySelect.innerHTML = `<option value="">All companies</option>` +
          (companies || []).map(c => `<option value="${c.name}">${c.name}</option>`).join("");
        companySelect.closest("div").style.display = "";
      }
    } else if (existingCompanySelect) {
      existingCompanySelect.closest("div").style.display = "none";
    }

    const employeeIdInput = document.getElementById("rangeEmployeeIdInput");
    const companySelectEl = document.getElementById("rangeCompanySelect");

    // lockedCompany: when set, the dropdown shows only that one company
    // (used once an Employee ID narrows things down to a single person)
    // instead of the full list. Only relevant for admins — a regular
    // supervisor never has this select in the first place.
    const renderCompanyOptions = async (lockedCompany) => {
      if (!companySelectEl) return;
      if (lockedCompany) {
        companySelectEl.innerHTML = `<option value="${lockedCompany}">${lockedCompany}</option>`;
        companySelectEl.value = lockedCompany;
        companySelectEl.disabled = true;
      } else {
        companySelectEl.disabled = false;
        const { data: companies } = await db.from("client_companies").select("name").order("name");
        companySelectEl.innerHTML = `<option value="">All companies</option>` +
          (companies || []).map(c => `<option value="${c.name}">${c.name}</option>`).join("");
      }
    };

    // Checkbox grid rather than a native multi-select, matching the same
    // pattern used on the Users (admin) report dialog. lockedDepartment
    // narrows this to a single, pre-checked, non-interactive entry the
    // same way renderCompanyOptions does for the company dropdown.
    const renderDepartmentCheckboxes = (lockedDepartment) => {
      const departmentContainer = ensureRangeDepartmentCheckboxes();
      if (!departmentContainer) return;
      const companyForList = ME.role === "admin" ? (companySelectEl ? companySelectEl.value : "") : ME.client_company;
      // A company admin's own department list is a comma-separated
      // subset (see admin.js's Add Company Admin modal), not the full
      // company list every other role sees here — offering a checkbox
      // for a department they don't have access to would be misleading
      // even though TEAM_LIST itself already excludes anyone in it.
      const list = lockedDepartment
        ? [lockedDepartment]
        : ME.role === "company_admin"
        ? (ME.department || "").split(",").map(s => s.trim()).filter(Boolean)
        : (DEPARTMENTS_BY_COMPANY[companyForList] || DEFAULT_DEPARTMENTS);
      departmentContainer.innerHTML = list.map(d => `
        <label style="display:flex; align-items:center; gap:6px; font-size:13.5px; font-weight:400">
          <input type="checkbox" class="range-department-checkbox" value="${d}" checked ${lockedDepartment ? "disabled" : ""} style="width:auto">
          <span>${d}</span>
        </label>
      `).join("");
    };

    // Once a typed Employee ID matches exactly one person on the team in
    // scope (their own team for a supervisor, everyone for an admin),
    // narrow the Company/Department pickers down to just that person's
    // own company and department, the same way the admin Users page
    // report dialog does.
    const applyEmployeeIdFilter = async () => {
      const idValue = employeeIdInput.value.trim();
      const matches = idValue ? TEAM_LIST.filter(e => e.file_number === idValue && e.role === "staff") : [];
      if (matches.length === 1) {
        await renderCompanyOptions(matches[0].client_company || null);
        renderDepartmentCheckboxes(matches[0].department || null);
      } else {
        await renderCompanyOptions(null);
        renderDepartmentCheckboxes(null);
      }
    };

    const onCompanyChange = () => renderDepartmentCheckboxes(null);

    await applyEmployeeIdFilter();
    if (companySelectEl) companySelectEl.addEventListener("change", onCompanyChange);
    employeeIdInput.addEventListener("input", applyEmployeeIdFilter);

    document.getElementById("dateRangeOverlay").style.display = "flex";

    const generateBtn = document.getElementById("rangeGenerateBtn");
    const cancelBtn = document.getElementById("rangeCancelBtn");
    const closeBtn = document.getElementById("rangeCloseBtn");

    const cleanup = () => {
      document.getElementById("dateRangeOverlay").style.display = "none";
      generateBtn.removeEventListener("click", onGenerate);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn.removeEventListener("click", onCancel);
      if (companySelectEl) companySelectEl.removeEventListener("change", onCompanyChange);
      employeeIdInput.removeEventListener("input", applyEmployeeIdFilter);
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
      const company = ME.role === "admin" ? ((document.getElementById("rangeCompanySelect") || {}).value || null) : null;
      // All-checked (the default) means "no department filter" — same
      // convention as the admin Users page report — so nobody is
      // silently dropped just because their department string isn't in
      // the predefined list for their company.
      const allDeptBoxes = document.querySelectorAll(".range-department-checkbox");
      const checkedDeptBoxes = document.querySelectorAll(".range-department-checkbox:checked");
      const departments = (checkedDeptBoxes.length === allDeptBoxes.length)
        ? []
        : Array.from(checkedDeptBoxes).map(el => el.value);
      const includeHourly = document.getElementById("rangeIncludeHourly").checked;
      cleanup();
      resolve({ from, to, employeeId, company, departments, includeHourly, wantPdf, wantExcel });
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    generateBtn.addEventListener("click", onGenerate);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn.addEventListener("click", onCancel);
  });
}

// PDF and Excel are mutually exclusive — checking one unchecks the
// other, matching the same behavior as the admin Users page report.
document.getElementById("rangeFormatPdf").addEventListener("change", (e) => {
  if (e.target.checked) document.getElementById("rangeFormatExcel").checked = false;
});
document.getElementById("rangeFormatExcel").addEventListener("change", (e) => {
  if (e.target.checked) document.getElementById("rangeFormatPdf").checked = false;
});

// Employee ID field inside the report dialog gets the same clear "×"
// as every table search box above — see wireSearchClearBtn.
wireSearchClearBtn("rangeEmployeeIdInput", "rangeEmployeeIdClearBtn");

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

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(text || "");
}

// Sorts by file number, smallest first — numerically when both sides
// parse as numbers (the normal case), falling back to a plain string
// compare for anything that doesn't (so a stray non-numeric ID doesn't
// throw off the whole sort, just sorts alongside the numeric ones by
// its text).
function compareFileNumberAsc(a, b) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

// Leave type/status values come out of the database lowercase
// ("annual", "rejected", etc.) — this capitalizes just the first letter
// for display in reports, without touching the underlying value used
// anywhere else (filtering, styling classes, etc. all still compare
// against the raw lowercase string).
function capitalizeWord(s) {
  const str = String(s ?? "");
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// An "English" document (or a mostly-English cell) can still contain an
// employee's name written in Arabic. jsPDF's plain doc.text()/autoTable
// have no Arabic glyphs at all, so those names come out as corrupted
// characters (see the mojibake in a report's Employee Name column)
// even though the surrounding table is plain LTR text. This draws such
// text onto a canvas — the browser's own text engine correctly shapes
// the Arabic run — and places it as an image, left-anchored at
// (xMm, yMm) where yMm matches jsPDF's usual text-baseline convention.
function drawMixedLine(doc, text, { xMm, yMm, bold = false, sizeMm = 3.8, color = "#1b2430" } = {}) {
  const scale = 3;
  const pxPerMm = 3.7795 * scale;
  const fontSizePx = Math.round(sizeMm * pxPerMm);
  const font = `${bold ? "bold " : ""}${fontSizePx}px Tahoma, Arial, sans-serif`;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = font;
  const textWidthPx = Math.max(1, Math.ceil(mctx.measureText(text || "").width) + 6);
  const ascentPx = Math.round(fontSizePx * 0.82);
  const heightPx = Math.round(fontSizePx * 1.3);

  const canvas = document.createElement("canvas");
  canvas.width = textWidthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(text || "", 2, ascentPx);

  const widthMm = textWidthPx / pxPerMm;
  const heightMm = heightPx / pxPerMm;
  const topMm = yMm - ascentPx / pxPerMm;
  doc.addImage(canvas.toDataURL("image/png"), "PNG", xMm, topMm, widthMm, heightMm);
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

  const tableStartY = 32;

  // Font size and margins scale with how many columns there are, so a
  // wide report gets small enough text and tight enough margins to fit
  // every column without truncating, while a narrow report still gets a
  // comfortably larger, more readable size.
  const colCount = columns.length;
  const fontSize = colCount <= 6 ? 9 : colCount <= 9 ? 8 : colCount <= 12 ? 7 : colCount <= 16 ? 6 : 5;
  const marginSide = colCount <= 9 ? 14 : 8;

  // Pre-measure every Arabic cell's actual rendered width (same font/size
  // math drawMixedLine uses internally) so autoTable can be told the real
  // minimum width each column needs — otherwise a column with Arabic
  // content, which autoTable can't measure itself, could end up narrower
  // than the name actually needs, clipping it.
  const measureArabicWidthMm = (text, sizeMm) => {
    const scale = 3;
    const pxPerMm = 3.7795 * scale;
    const fontSizePx = Math.round(sizeMm * pxPerMm);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${fontSizePx}px Tahoma, Arial, sans-serif`;
    return ctx.measureText(text || "").width / pxPerMm;
  };
  const columnStyles = {};
  const arabicSizeMm = fontSize * 0.34;
  // A column is treated as "numeric" (and centered) only when every
  // actual value in it looks like a number, a percentage, an hour count
  // ("2h"), or is blank/"—" — anything else (names, companies, dates,
  // statuses) stays left-aligned, matching how the table read before
  // this was added.
  const isNumericCell = (v) => {
    const s = String(v ?? "").trim();
    if (s === "" || s === "—" || s === "-") return true;
    return /^-?\d+(\.\d+)?%?h?$/.test(s);
  };
  columns.forEach((_, colIndex) => {
    let maxWidthMm = 0;
    const values = [];
    for (const row of rows) {
      const raw = String(row[colIndex] ?? "");
      values.push(raw);
      if (!containsArabic(raw)) continue;
      const w = measureArabicWidthMm(raw, arabicSizeMm) + 4; // 4mm padding
      if (w > maxWidthMm) maxWidthMm = w;
    }
    const nonBlank = values.filter(v => v.trim() !== "" && v.trim() !== "—" && v.trim() !== "-");
    const numeric = nonBlank.length > 0 && nonBlank.every(isNumericCell);
    columnStyles[colIndex] = { halign: numeric ? "center" : "left" };
    if (maxWidthMm > 0) columnStyles[colIndex].minCellWidth = Math.min(maxWidthMm, 70);
  });

  doc.autoTable({
    head: [columns],
    body: rows,
    startY: tableStartY,
    theme: "striped",
    headStyles: { fillColor: [47, 111, 94], fontSize, halign: "left", cellPadding: colCount > 9 ? 2 : 3 },
    styles: { fontSize, cellPadding: colCount > 9 ? 2 : 3, overflow: "linebreak" },
    columnStyles,
    margin: { left: marginSide, right: marginSide },
    didParseCell: (data) => {
      if (redRowIndices && data.section === "body" && redRowIndices.has(data.row.index)) {
        data.cell.styles.textColor = [165, 64, 43];
      }
      // jsPDF's built-in fonts have no Arabic glyphs at all — left as
      // plain text, Arabic cell content (employee names) renders as
      // corrupted characters. Blank the cell's own text out here; the
      // actual text gets drawn as a canvas-rendered image in
      // didDrawCell instead, which correctly shapes Arabic.
      if (data.section === "body" && typeof data.cell.text === "object" && containsArabic(String(data.cell.raw ?? ""))) {
        data.cell.text = [""];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const raw = String(data.cell.raw ?? "");
      if (!containsArabic(raw)) return;
      const redColor = redRowIndices && redRowIndices.has(data.row.index) ? "#A5402B" : "#1b2430";
      drawMixedLine(doc, raw, {
        xMm: data.cell.x + 2,
        yMm: data.cell.y + data.cell.height / 2 + 1.1,
        sizeMm: arabicSizeMm,
        color: redColor,
      });
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

// Both report buttons below share the same scoping: TEAM_LIST (and
// TEAM_BY_ID) already come out of loadTeam() restricted to "my direct
// reports" for a regular supervisor, or "everyone but other admins" for
// an admin — so filtering against them, rather than querying the whole
// employees table fresh, is what keeps a supervisor's report limited to
// their own team automatically. Both also drop non-staff (supervisor)
// rows, matching the same "reports never include supervisors" rule the
// admin Users page follows.
document.getElementById("downloadBalanceReportBtn").addEventListener("click", async () => {
  const range = await showDateRangePrompt(
    ME.role === "admin" ? "Employees — Leave Balance Report" : "My Team — Leave Balance Report",
    { from: "Hiring Date From", to: "Hiring Date To" }
  );
  if (!range) return;

  let source = TEAM_LIST.filter(e => e.role === "staff");
  if (range.employeeId) {
    // A file number isn't guaranteed unique across companies, so pair it
    // with the selected company whenever one is available (admins only
    // — see showDateRangePrompt, which hides the company picker for
    // regular supervisors entirely since their team is one company).
    source = source.filter(e => e.file_number === range.employeeId && (!range.company || e.client_company === range.company));
  } else {
    if (range.company) source = source.filter(e => e.client_company === range.company);
    if (range.departments && range.departments.length > 0) source = source.filter(e => range.departments.includes(e.department));
  }
  if (range.from) source = source.filter(e => e.hiring_date && e.hiring_date >= range.from);
  if (range.to) source = source.filter(e => e.hiring_date && e.hiring_date <= range.to);

  source = [...source].sort((a, b) => compareFileNumberAsc(a.file_number, b.file_number));

  if (source.length === 0) {
    await showInfo(t("noResultsTitle"), t("noMatchingEmployeeToast"));
    return;
  }

  const balByEmployeeId = Object.fromEntries(TEAM_BALANCE_ROWS.map(r => [r.employee_id, r]));
  const columns = ["Employee Name", "ID #", "Company", "Department", "Available Balance", "Annual Entitlement", "Taken", "Prev. Year Balance", "Sick", "Sick Taken", "Sick Remaining"];
  const rows = source.map(e => {
    const bal = balByEmployeeId[e.id];
    return [
      e.full_name, e.file_number, e.client_company || "—", e.department || "—",
      bal ? bal.remaining : "—", bal ? bal.annual_entitlement : "—", bal ? bal.taken : "—",
      String(e.carryover_balance ?? 0),
      bal ? bal.sick_entitlement : "—", bal ? bal.sick_taken : "—", bal ? bal.sick_remaining : "—"
    ];
  });

  const scopeLabel = ME.role === "admin" ? (range.company || "") : `${ME.full_name}'s Team`;
  const title = (scopeLabel ? `${scopeLabel} — ` : "") + "Leave Balance Report";
  const rangeNote = ` — Period: ${range.from || "the beginning"} to ${range.to || "today"}`;
  const filenamePrefix = `${range.company ? range.company.toLowerCase().replace(/\s+/g, "-") + "_" : ""}${range.employeeId ? range.employeeId + "_" : ""}`;
  const baseFilename = `${filenamePrefix}leave_balance_report`;

  if (range.wantPdf) {
    await downloadPDF(title, `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}${rangeNote}`, columns, rows, `${baseFilename}.pdf`);
  }
  if (range.wantExcel) {
    downloadExcel(title, columns, rows, `${baseFilename}.xlsx`);
  }
});

document.getElementById("downloadDetailReportBtn").addEventListener("click", async () => {
  const range = await showDateRangePrompt(
    ME.role === "admin" ? "Employees — Leave Detail Report" : "My Team — Leave Detail Report",
    { from: "Date From", to: "Date To" }
  );
  if (!range) return;

  const { data, error } = await db.from("leave_requests").select("*").order("requested_at", { ascending: false });
  if (error || !data) { showToast(t("couldNotLoadLeaveRequests")); return; }

  let rows = data.filter(r => TEAM_BY_ID[r.employee_id] && TEAM_BY_ID[r.employee_id].role === "staff");
  if (range.employeeId) {
    rows = rows.filter(r => TEAM_BY_ID[r.employee_id].file_number === range.employeeId && (!range.company || TEAM_BY_ID[r.employee_id].client_company === range.company));
  } else {
    if (range.company) rows = rows.filter(r => TEAM_BY_ID[r.employee_id].client_company === range.company);
    if (range.departments && range.departments.length > 0) rows = rows.filter(r => range.departments.includes(TEAM_BY_ID[r.employee_id].department));
  }
  if (range.from) rows = rows.filter(r => r.end_date >= range.from);
  if (range.to) rows = rows.filter(r => r.start_date <= range.to);
  // Applies even when an Employee ID is set — it's not an identity
  // filter, it's asking "which of this person's requests do you want,"
  // so it stays in effect no matter how narrowly the rest of the report
  // is scoped.
  if (!range.includeHourly) rows = rows.filter(r => r.leave_type !== "hourly");

  rows = [...rows].sort((a, b) => compareFileNumberAsc(TEAM_BY_ID[a.employee_id].file_number, TEAM_BY_ID[b.employee_id].file_number));

  if (rows.length === 0) {
    await showInfo(t("noResultsTitle"), t("noMatchingRequestsToast"));
    return;
  }

  const columns = ["Employee Name", "ID #", "Company", "Date From", "Date To", "Days", "Type", "Status"];
  const pdfRows = rows.map(r => {
    const emp = TEAM_BY_ID[r.employee_id];
    const isHourly = r.leave_type === "hourly";
    return [
      emp.full_name, emp.file_number, emp.client_company || "—",
      isHourly ? `${fmtDate(r.start_date)} ${r.time_from ? r.time_from.slice(0,5) : "—"}` : fmtDate(r.start_date),
      isHourly ? `${fmtDate(r.start_date)} ${r.time_to ? r.time_to.slice(0,5) : "—"}` : fmtDate(r.end_date),
      isHourly ? `${r.hours_requested}h` : String(r.days_requested),
      capitalizeWord(r.leave_type),
      capitalizeWord(r.status)
    ];
  });

  const scopeLabel = ME.role === "admin" ? (range.company || "") : `${ME.full_name}'s Team`;
  const title = (scopeLabel ? `${scopeLabel} — ` : "") + "Leave Detail Report";
  const filenamePrefix = `${range.company ? range.company.toLowerCase().replace(/\s+/g, "-") + "_" : ""}${range.employeeId ? range.employeeId + "_" : ""}`;
  const baseFilename = `${filenamePrefix}leave_detail_report`;

  if (range.wantPdf) {
    await downloadPDF(
      title,
      `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}`,
      columns,
      pdfRows,
      `${baseFilename}.pdf`
    );
  }
  if (range.wantExcel) {
    downloadExcel(title, columns, pdfRows, `${baseFilename}.xlsx`);
  }
});

let TEAM_WARNINGS_LIST = [];
let TEAM_WARNINGS_PAGE = 0;

function ensureTeamWarningAckNote() {
  let note = document.getElementById("teamWarningAckNote");
  if (!note) {
    note = document.createElement("div");
    note.id = "teamWarningAckNote";
    note.className = "success-msg show";
    note.style.marginTop = "10px";
    note.style.fontWeight = "600";
    const display = document.getElementById("teamWarningTextDisplay");
    display.parentNode.insertBefore(note, display.nextSibling);
  }
  return note;
}

async function loadTeamWarnings() {
  if (ME.role !== "supervisor") { document.getElementById("teamWarningsPanel").style.display = "none"; return; }
  document.getElementById("teamWarningsPanel").style.display = "";

  const { data, error } = await db.from("warnings").select("*").order("sent_at", { ascending: false });
  if (error || !data) {
    document.getElementById("noTeamWarnings").style.display = "block";
    return;
  }
  TEAM_WARNINGS_LIST = data.filter(w => TEAM_BY_ID[w.employee_id]);
  TEAM_WARNINGS_PAGE = 0;
  renderTeamWarnings();
}

function renderTeamWarnings() {
  const body = document.getElementById("teamWarningsBody");
  const empty = document.getElementById("noTeamWarnings");
  body.innerHTML = "";

  ensureTableSearch("teamWarningsBody", "teamWarningsSearchInput", () => { TEAM_WARNINGS_PAGE = 0; renderTeamWarnings(); });
  const query = (document.getElementById("teamWarningsSearchInput") || {}).value || "";
  const filtered = query
    ? TEAM_WARNINGS_LIST.filter(w => {
        const emp = TEAM_BY_ID[w.employee_id];
        return matchesTableSearch(query, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : TEAM_WARNINGS_LIST;
  notifyIfNoSearchResults(document.getElementById("teamWarningsSearchInput"), query, filtered.length);
  empty.style.display = filtered.length ? "none" : "block";

  const start = TEAM_WARNINGS_PAGE * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  for (const w of pageItems) {
    const emp = TEAM_BY_ID[w.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${emp.file_number}</td>
      <td>${emp.client_company || "—"}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}${newBadge(w.created_at)}</td>
      <td>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</td>
      <td>
        <button type="button" class="btn btn-blue btn-sm" data-view-team-warning="${w.id}">View Warning</button>
        ${w.status === "sent" && !w.acknowledged_at ? `<div style="margin-top:4px; font-size:11.5px; color:#A5402B; font-weight:600">Needs action from Employee</div>` : ""}
      </td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("teamWarnings", TEAM_WARNINGS_PAGE, filtered.length);
  body.querySelectorAll("button[data-view-team-warning]").forEach(btn => {
    btn.addEventListener("click", () => {
      const w = TEAM_WARNINGS_LIST.find(x => x.id === btn.dataset.viewTeamWarning);
      if (!w) return;
      const emp = TEAM_BY_ID[w.employee_id];
      document.getElementById("teamWarningViewTitle").textContent = emp ? emp.full_name : t("warningDetailsTitle");
      const display = document.getElementById("teamWarningTextDisplay");
      display.textContent = w.warning_text || w.reason;
      const ackNote = ensureTeamWarningAckNote();
      ackNote.textContent = w.acknowledged_at ? `Acknowledged by employee on ${fmtDate(w.acknowledged_at.slice(0,10))}` : "";
      ackNote.style.display = w.acknowledged_at ? "" : "none";
      TEAM_WARNING_ALT_TEXT = w.warning_text_alt || "";
      TEAM_WARNING_LANG = w.language === "en" ? "en" : "ar";
      display.dir = TEAM_WARNING_LANG === "ar" ? "rtl" : "ltr";
      display.style.textAlign = TEAM_WARNING_LANG === "ar" ? "right" : "left";
      const convertBtn = document.getElementById("teamWarningConvertBtn");
      convertBtn.style.display = TEAM_WARNING_ALT_TEXT ? "" : "none";
      convertBtn.textContent = TEAM_WARNING_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
      document.getElementById("teamWarningViewOverlay").style.display = "flex";
    });
  });
}
let TEAM_WARNING_ALT_TEXT = "";
let TEAM_WARNING_LANG = "ar";
document.getElementById("teamWarningConvertBtn").addEventListener("click", () => {
  const display = document.getElementById("teamWarningTextDisplay");
  const current = display.textContent;
  display.textContent = TEAM_WARNING_ALT_TEXT;
  TEAM_WARNING_ALT_TEXT = current;
  TEAM_WARNING_LANG = TEAM_WARNING_LANG === "ar" ? "en" : "ar";
  display.dir = TEAM_WARNING_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = TEAM_WARNING_LANG === "ar" ? "right" : "left";
  document.getElementById("teamWarningConvertBtn").textContent = TEAM_WARNING_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
});
document.getElementById("closeTeamWarningViewBtn").addEventListener("click", () => {
  document.getElementById("teamWarningViewOverlay").style.display = "none";
});

document.getElementById("closeDocActivityBtn").addEventListener("click", () => {
  document.getElementById("docActivityOverlay").style.display = "none";
});

function showDocActivityPopup(icon, title, text) {
  document.getElementById("docActivityIcon").textContent = icon;
  document.getElementById("docActivityTitle").textContent = title;
  document.getElementById("docActivityText").textContent = text;
  document.getElementById("docActivityOverlay").style.display = "flex";
}

async function checkAdminEmployeeActionNotifications() {
  if (ME.role !== "admin") return;
  try {
    const lastSeenKey = `fwx_adminLastSeenActions_${ME.id}`;
    const lastSeen = localStorage.getItem(lastSeenKey);
    const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
    const nowIso = new Date().toISOString();

    // Reuse the already-loaded admin-scope lists (ADMIN_CONTRACTS_LIST /
    // ADMIN_WARNINGS_LIST) rather than a fresh query — same data source
    // that already powers this page's own Admin Contracts/Warnings tables.
    const signedContracts = ADMIN_CONTRACTS_LIST.filter(c => c.status === "signed" && c.signed_at);
    const ackedWarnings = ADMIN_WARNINGS_LIST.filter(w => !!w.acknowledged_at);

    const nameFor = (employeeId) => {
      const emp = TEAM_BY_ID[employeeId];
      return emp ? emp.full_name : "An employee";
    };
    const namesList = (names) => {
      const unique = [...new Set(names)];
      return unique.length <= 3 ? unique.join(", ") : `${unique.slice(0, 3).join(", ")}, and ${unique.length - 3} more`;
    };

    const newSigned = signedContracts.filter(c => !lastSeenDate || new Date(c.signed_at) > lastSeenDate);
    const newAcked = ackedWarnings.filter(w => !lastSeenDate || new Date(w.acknowledged_at) > lastSeenDate);

    if (newSigned.length === 0 && newAcked.length === 0) {
      localStorage.setItem(lastSeenKey, nowIso);
      return;
    }

    const parts = [];
    if (newSigned.length > 0) parts.push(`${newSigned.length} contract${newSigned.length > 1 ? "s" : ""} newly signed (${namesList(newSigned.map(c => nameFor(c.employee_id)))})`);
    if (newAcked.length > 0) parts.push(`${newAcked.length} warning${newAcked.length > 1 ? "s" : ""} newly acknowledged (${namesList(newAcked.map(w => nameFor(w.employee_id)))})`);

    showInfoPopup(t("docActivityTitle"), `${parts.join(" · ")} since your last visit.`, "🔔", () => {
      localStorage.setItem(lastSeenKey, nowIso);
    });
  } catch (err) {
    console.error("checkAdminEmployeeActionNotifications: unexpected error", err);
  }
}

async function checkAdminContractActivity() {
  if (ME.role !== "admin") return;
  const { data } = await db.from("contracts").select("id, employee_id, status, employee_action_at").in("status", ["signed", "commented"]);
  if (!data || data.length === 0) return;

  const key = `fwx_lastSeenContractActivity_${ME.id}`;
  const lastSeen = localStorage.getItem(key);
  const newOnes = data.filter(c => c.employee_action_at && (!lastSeen || new Date(c.employee_action_at) > new Date(lastSeen)));
  localStorage.setItem(key, new Date().toISOString());
  if (newOnes.length === 0) return;

  const names = [...new Set(newOnes.map(c => { const emp = TEAM_BY_ID[c.employee_id]; return emp ? emp.full_name : "An employee"; }))];
  const namesList = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")}, and ${names.length - 3} more`;

  showDocActivityPopup("📄", t("docActivityTitle"), tv("adminContractActivityMsg", { n: newOnes.length, names: namesList }));
}

function checkSupervisorWarningNotification() {
  if (ME.role !== "supervisor") return;

  const sentKey = `fwx_lastSeenSupervisorWarnings_${ME.id}`;
  const lastSeenSent = localStorage.getItem(sentKey);
  const newSent = TEAM_WARNINGS_LIST.filter(w => w.sent_at && (!lastSeenSent || new Date(w.sent_at) > new Date(lastSeenSent)));
  localStorage.setItem(sentKey, new Date().toISOString());

  const ackKey = `fwx_lastSeenSupervisorAcks_${ME.id}`;
  const lastSeenAck = localStorage.getItem(ackKey);
  const newAcked = TEAM_WARNINGS_LIST.filter(w => w.acknowledged_at && (!lastSeenAck || new Date(w.acknowledged_at) > new Date(lastSeenAck)));
  localStorage.setItem(ackKey, new Date().toISOString());

  if (newSent.length === 0 && newAcked.length === 0) return;

  const namesList = (warnings) => {
    const names = [...new Set(warnings.map(w => { const emp = TEAM_BY_ID[w.employee_id]; return emp ? emp.full_name : "An employee"; }))];
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")}, and ${names.length - 3} more`;
  };

  const parts = [];
  if (newSent.length > 0) parts.push(tv("supervisorWarningNotifyMsg", { n: newSent.length, names: namesList(newSent) }));
  if (newAcked.length > 0) parts.push(tv("supervisorAckNotifyMsg", { n: newAcked.length, names: namesList(newAcked) }));

  showDocActivityPopup(newAcked.length > 0 && newSent.length === 0 ? "✅" : "⚠️", t("docActivityTitle"), parts.join(" "));
}

let ADMIN_CONTRACTS_LIST = [];
let ADMIN_CONTRACTS_PAGE = 0;
let ADMIN_WARNINGS_LIST = [];
let ADMIN_WARNINGS_PAGE = 0;
let DOC_ALT_TEXT = "";
let DOC_LANG = "ar";

function docStatusBadge(status) {
  const cls = { draft: "cancelled", shared: "pending", commented: "rejected", signed: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("contractStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

function warningStatusBadge(status) {
  const cls = { draft: "cancelled", sent: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("warningStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

async function loadAdminContracts() {
  if (ME.role !== "admin") { document.getElementById("adminContractsPanel").style.display = "none"; return; }
  document.getElementById("adminContractsPanel").style.display = "";

  const { data, error } = await db.from("contracts").select("*").order("created_at", { ascending: false });
  if (error || !data) {
    document.getElementById("noAdminContracts").style.display = "block";
    return;
  }
  ADMIN_CONTRACTS_LIST = data;
  ADMIN_CONTRACTS_PAGE = 0;
  renderAdminContracts();
}

function renderAdminContracts() {
  const body = document.getElementById("adminContractsBody");
  const empty = document.getElementById("noAdminContracts");
  body.innerHTML = "";

  const byId = TEAM_BY_ID;
  ensureTableSearch("adminContractsBody", "adminContractsSearchInput", () => { ADMIN_CONTRACTS_PAGE = 0; renderAdminContracts(); });
  const acQuery = (document.getElementById("adminContractsSearchInput") || {}).value || "";
  const filteredContracts = acQuery
    ? ADMIN_CONTRACTS_LIST.filter(c => {
        const emp = byId[c.employee_id];
        return matchesTableSearch(acQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : ADMIN_CONTRACTS_LIST;
  notifyIfNoSearchResults(document.getElementById("adminContractsSearchInput"), acQuery, filteredContracts.length);
  empty.style.display = filteredContracts.length ? "none" : "block";

  const start = ADMIN_CONTRACTS_PAGE * PAGE_SIZE;
  const pageItems = filteredContracts.slice(start, start + PAGE_SIZE);
  for (const c of pageItems) {
    const emp = byId[c.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${emp ? emp.file_number : "—"}</td>
      <td>${emp ? (emp.client_company || "—") : "—"}</td>
      <td>${docStatusBadge(c.status)}${newBadge(c.created_at)}</td>
      <td>${fmtDate(c.created_at ? c.created_at.slice(0,10) : null)}</td>
      <td>${c.contract_period_months ? `${c.contract_period_months} ${t("monthsLabel")}` : "—"}</td>
      <td>
        <button type="button" class="btn btn-blue btn-sm" data-view-admin-contract="${c.id}">View Contract</button>
        ${c.status === "shared" ? `<div style="margin-top:4px; font-size:11.5px; color:#A5402B; font-weight:600">Needs action from Employee</div>` : ""}
      </td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("adminContracts", ADMIN_CONTRACTS_PAGE, filteredContracts.length);
  body.querySelectorAll("button[data-view-admin-contract]").forEach(btn => {
    btn.addEventListener("click", () => {
      window.location.href = `admin.html?tab=contracts&contractId=${encodeURIComponent(btn.dataset.viewAdminContract)}`;
    });
  });
}

async function loadAdminWarnings() {
  if (ME.role !== "admin") { document.getElementById("adminWarningsPanel").style.display = "none"; return; }
  document.getElementById("adminWarningsPanel").style.display = "";

  const { data, error } = await db.from("warnings").select("*").order("created_at", { ascending: false });
  if (error || !data) {
    document.getElementById("noAdminWarnings").style.display = "block";
    return;
  }
  ADMIN_WARNINGS_LIST = data;
  ADMIN_WARNINGS_PAGE = 0;
  renderAdminWarnings();
}

function renderAdminWarnings() {
  const body = document.getElementById("adminWarningsBody");
  const empty = document.getElementById("noAdminWarnings");
  body.innerHTML = "";

  const byId = TEAM_BY_ID;
  ensureTableSearch("adminWarningsBody", "adminWarningsSearchInput", () => { ADMIN_WARNINGS_PAGE = 0; renderAdminWarnings(); });
  const awQuery = (document.getElementById("adminWarningsSearchInput") || {}).value || "";
  const filteredWarnings = awQuery
    ? ADMIN_WARNINGS_LIST.filter(w => {
        const emp = byId[w.employee_id];
        return matchesTableSearch(awQuery, emp && emp.file_number, emp && emp.client_company, emp && emp.role, emp && emp.full_name, emp && emp.department);
      })
    : ADMIN_WARNINGS_LIST;
  notifyIfNoSearchResults(document.getElementById("adminWarningsSearchInput"), awQuery, filteredWarnings.length);
  empty.style.display = filteredWarnings.length ? "none" : "block";

  const start = ADMIN_WARNINGS_PAGE * PAGE_SIZE;
  const pageItems = filteredWarnings.slice(start, start + PAGE_SIZE);
  for (const w of pageItems) {
    const emp = byId[w.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp ? emp.full_name : "—"}</td>
      <td>${emp ? emp.file_number : "—"}</td>
      <td>${emp ? (emp.client_company || "—") : "—"}</td>
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}${newBadge(w.created_at)}</td>
      <td>${fmtDate(w.created_at ? w.created_at.slice(0,10) : null)}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>
        <button type="button" class="btn btn-blue btn-sm" data-view-admin-warning="${w.id}">View Warning</button>
        ${w.status === "sent" && !w.acknowledged_at ? `<div style="margin-top:4px; font-size:11.5px; color:#A5402B; font-weight:600">Needs action from Employee</div>` : ""}
      </td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("adminWarnings", ADMIN_WARNINGS_PAGE, filteredWarnings.length);
  body.querySelectorAll("button[data-view-admin-warning]").forEach(btn => {
    btn.addEventListener("click", () => {
      window.location.href = `admin.html?tab=warnings&warningId=${encodeURIComponent(btn.dataset.viewAdminWarning)}`;
    });
  });
}

function openDocView(title, text, altText, lang) {
  document.getElementById("docViewTitle").textContent = title;
  const display = document.getElementById("docTextDisplay");
  display.textContent = text || "";
  DOC_ALT_TEXT = altText || "";
  DOC_LANG = lang === "en" ? "en" : "ar";
  display.dir = DOC_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = DOC_LANG === "ar" ? "right" : "left";
  const convertBtn = document.getElementById("docConvertBtn");
  convertBtn.style.display = DOC_ALT_TEXT ? "" : "none";
  convertBtn.textContent = DOC_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
  document.getElementById("docViewOverlay").style.display = "flex";
}
document.getElementById("closeDocViewBtn").addEventListener("click", () => {
  document.getElementById("docViewOverlay").style.display = "none";
});
document.getElementById("docConvertBtn").addEventListener("click", () => {
  const display = document.getElementById("docTextDisplay");
  const current = display.textContent;
  display.textContent = DOC_ALT_TEXT;
  DOC_ALT_TEXT = current;
  DOC_LANG = DOC_LANG === "ar" ? "en" : "ar";
  display.dir = DOC_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = DOC_LANG === "ar" ? "right" : "left";
  document.getElementById("docConvertBtn").textContent = DOC_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
});
document.getElementById("adminContractsPrevBtn").addEventListener("click", () => { if (ADMIN_CONTRACTS_PAGE > 0) { ADMIN_CONTRACTS_PAGE--; renderAdminContracts(); } });
document.getElementById("adminContractsNextBtn").addEventListener("click", () => { if ((ADMIN_CONTRACTS_PAGE + 1) * PAGE_SIZE < ADMIN_CONTRACTS_LIST.length) { ADMIN_CONTRACTS_PAGE++; renderAdminContracts(); } });
document.getElementById("adminWarningsPrevBtn").addEventListener("click", () => { if (ADMIN_WARNINGS_PAGE > 0) { ADMIN_WARNINGS_PAGE--; renderAdminWarnings(); } });
document.getElementById("adminWarningsNextBtn").addEventListener("click", () => { if ((ADMIN_WARNINGS_PAGE + 1) * PAGE_SIZE < ADMIN_WARNINGS_LIST.length) { ADMIN_WARNINGS_PAGE++; renderAdminWarnings(); } });

async function loadContractRenewalTable() {
  const panel = document.getElementById("contractRenewalPanel");
  if (ME.role !== "admin") { panel.style.display = "none"; return; }
  panel.style.display = "";

  const { data, error } = await db.functions.invoke("clever-action", { body: { action: "get_expiring_contracts_list" } });
  const body = document.getElementById("contractRenewalBody");
  const empty = document.getElementById("noContractRenewal");
  body.innerHTML = "";

  if (error || (data && data.error) || !data || !data.contracts || data.contracts.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const c of data.contracts) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.full_name}</td>
      <td>${c.file_number}</td>
      <td>${c.supervisor_name}</td>
      <td>${c.client_company || "—"}</td>
      <td>${c.days_left}</td>
      <td class="row-actions">
        <button class="btn btn-primary btn-sm" data-renew-employee="${c.employee_id}" data-renew-contract="${c.contract_id}">Renew</button>
        <button class="btn btn-danger btn-sm" data-donotrenew-employee="${c.employee_id}" data-donotrenew-contract="${c.contract_id}">Do Not Renew</button>
      </td>
    `;
    body.appendChild(tr);
  }

  body.querySelectorAll("button[data-renew-employee]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("renewChoiceOverlay").dataset.employeeId = btn.dataset.renewEmployee;
      document.getElementById("renewChoiceOverlay").dataset.contractId = btn.dataset.renewContract;
      document.getElementById("renewChoiceOverlay").style.display = "flex";
    });
  });
  body.querySelectorAll("button[data-donotrenew-employee]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const target_id = btn.dataset.donotrenewEmployee;
      const contract_id = btn.dataset.donotrenewContract;
      const ok = await showConfirm(
        "Do Not Renew",
        "This schedules the employee to be frozen automatically once their current contract ends, and sends them a notification that their contract won't be renewed. This can't be undone.",
        "Yes, Do Not Renew",
        true
      );
      if (!ok) return;
      showGlobalSpinner();
      const { data: result, error: err } = await db.functions.invoke("clever-action", {
        body: { action: "schedule_do_not_renew", target_id, contract_id }
      });
      hideGlobalSpinner();
      if (err || (result && result.error)) {
        showToast((result && result.error) ? result.error : "Something went wrong.");
        return;
      }
      showToast("Scheduled — employee will be frozen and notified when their contract ends.");
      await loadContractRenewalTable();
    });
  });
}

document.getElementById("renewChoiceCancelBtn").addEventListener("click", () => {
  document.getElementById("renewChoiceOverlay").style.display = "none";
});
document.getElementById("renewChoiceEditBtn").addEventListener("click", () => {
  const employeeId = document.getElementById("renewChoiceOverlay").dataset.employeeId;
  document.getElementById("renewChoiceOverlay").style.display = "none";
  openRenewContractForm(employeeId);
});

// Shared by "Renew with Same Terms" and "Renew and Reset Vacation
// Balance" — identical form (start date + period), the only difference
// is a flag on the overlay telling the submit handler whether to also
// zero out the balance afterward.
async function openRenewSameTermsModal(resetVacation) {
  const choiceOverlay = document.getElementById("renewChoiceOverlay");
  const target_id = choiceOverlay.dataset.employeeId;
  const contract_id = choiceOverlay.dataset.contractId;
  choiceOverlay.style.display = "none";

  const { data: contract } = await db.from("contracts").select("end_date, contract_period_months, employee_id").eq("id", contract_id).maybeSingle();
  const emp = TEAM_BY_ID[target_id];

  const periodSelect = document.getElementById("renewSameTermsPeriodMonths");
  periodSelect.innerHTML = Array.from({ length: 60 }, (_, i) => i + 1).map(n => `<option value="${n}">${n}</option>`).join("");

  const nextStart = contract && contract.end_date ? new Date(contract.end_date) : new Date();
  if (contract && contract.end_date) nextStart.setDate(nextStart.getDate() + 1);

  const overlay = document.getElementById("renewSameTermsOverlay");
  overlay.dataset.employeeId = target_id;
  overlay.dataset.contractId = contract_id;
  overlay.dataset.resetVacation = resetVacation ? "1" : "";
  document.getElementById("renewSameTermsTitle").textContent = resetVacation ? "Renew and Reset Vacation Balance" : "Renew with Same Terms";
  document.getElementById("renewSameTermsSubmitBtn").textContent = resetVacation ? "Renew, Reset Balance & Share" : "Renew & Share";
  document.getElementById("renewSameTermsEmployeeInfo").textContent = emp ? `${emp.full_name} · #${emp.file_number}` : "";
  document.getElementById("renewSameTermsStartDate").value = nextStart.toISOString().slice(0, 10);
  periodSelect.value = contract && contract.contract_period_months ? String(contract.contract_period_months) : "12";
  document.getElementById("renewSameTermsError").classList.remove("show");
  overlay.style.display = "flex";
}
document.getElementById("renewChoiceSameBtn").addEventListener("click", () => openRenewSameTermsModal(false));
document.getElementById("renewChoiceResetBtn").addEventListener("click", () => openRenewSameTermsModal(true));

document.getElementById("renewSameTermsCancelBtn").addEventListener("click", () => {
  document.getElementById("renewSameTermsOverlay").style.display = "none";
});

// Shows the "Contract Renewed" result step (View Contract / Close)
// instead of just a toast, and reloads the Contract Renewal table
// underneath either way.
function showRenewResult(contractId, message) {
  document.getElementById("renewResultMsg").textContent = message;
  document.getElementById("renewResultOverlay").dataset.contractId = contractId || "";
  document.getElementById("renewResultViewBtn").style.display = contractId ? "" : "none";
  document.getElementById("renewResultOverlay").style.display = "flex";
  loadContractRenewalTable();
}
document.getElementById("renewResultCloseBtn").addEventListener("click", () => {
  document.getElementById("renewResultOverlay").style.display = "none";
});
document.getElementById("renewResultViewBtn").addEventListener("click", () => {
  const contractId = document.getElementById("renewResultOverlay").dataset.contractId;
  document.getElementById("renewResultOverlay").style.display = "none";
  if (contractId) window.location.href = `admin.html?tab=contracts&contractId=${contractId}`;
});

document.getElementById("renewSameTermsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const overlay = document.getElementById("renewSameTermsOverlay");
  const target_id = overlay.dataset.employeeId;
  const contract_id = overlay.dataset.contractId;
  const resetVacation = overlay.dataset.resetVacation === "1";
  const start_date = document.getElementById("renewSameTermsStartDate").value;
  const contract_period_months = Number(document.getElementById("renewSameTermsPeriodMonths").value);
  const errBox = document.getElementById("renewSameTermsError");
  errBox.classList.remove("show");

  const submitBtn = document.getElementById("renewSameTermsSubmitBtn");
  setBtnLoading(submitBtn, true);
  showGlobalSpinner();
  // Previously this whole sequence had no try/catch — if invoke() threw
  // (network hiccup, unexpected response) instead of resolving with an
  // {error} field, hideGlobalSpinner() never ran and the modal was
  // already hidden by the choice screen before it, so the admin was
  // left staring at a stuck spinner with zero feedback and no way
  // forward. Wrapping this guarantees the spinner always comes down and
  // a real error always shows.
  try {
    const { data, error } = await db.functions.invoke("clever-action", {
      body: { action: "renew_same_terms", target_id, contract_id, start_date, contract_period_months }
    });

    if (error || (data && data.error)) {
      throw new Error((data && data.error) ? data.error : (error && error.message) ? error.message : "Something went wrong.");
    }

    if (resetVacation) {
      const { data: resetData, error: resetErr } = await db.functions.invoke("clever-action", {
        body: { action: "reset_vacation_balance", target_id, reset_date: start_date }
      });
      if (resetErr || (resetData && resetData.error)) {
        // The renewal itself already succeeded — don't lose that, just
        // tell the admin the balance reset specifically didn't go through.
        overlay.style.display = "none";
        showRenewResult(
          data && data.contract ? data.contract.id : null,
          "Contract renewed and shared, but resetting the vacation balance failed — you can reset it separately from the employee's profile."
        );
        return;
      }
    }

    overlay.style.display = "none";
    showRenewResult(
      data && data.contract ? data.contract.id : null,
      resetVacation
        ? "Renewed contract created, vacation balance reset, and shared with the employee."
        : "Renewed contract created and shared with the employee."
    );
  } catch (err) {
    console.error("renewSameTermsForm submit failed:", err);
    errBox.textContent = (err && err.message) ? err.message : "Something went wrong. Please try again.";
    errBox.classList.add("show");
  } finally {
    hideGlobalSpinner();
    setBtnLoading(submitBtn, false);
  }
});

async function openRenewContractForm(employeeId) {
  const { data: contract } = await db
    .from("contracts")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "signed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const emp = TEAM_BY_ID[employeeId] || (await db.from("employees").select("*").eq("id", employeeId).maybeSingle()).data;
  if (!emp) return;

  document.getElementById("renewContractOverlay").dataset.employeeId = employeeId;
  document.getElementById("renewContractEmployeeInfo").textContent = `${emp.full_name} · #${emp.file_number}`;
  document.getElementById("renewContractDob").value = contract?.dob || emp.dob || "";
  document.getElementById("renewContractEducation").value = contract?.education || emp.education || "";
  document.getElementById("renewContractAddress").value = contract?.address || emp.address || "";
  document.getElementById("renewContractSalary").value = contract?.salary || emp.salary || "";
  document.getElementById("renewContractJobTitle").value = contract?.job_title || "";
  // New contract starts the day after the current one ends, so there's
  // no gap or overlap between the two.
  const nextStart = contract?.end_date ? new Date(contract.end_date) : new Date();
  if (contract?.end_date) nextStart.setDate(nextStart.getDate() + 1);
  document.getElementById("renewContractStartDate").value = nextStart.toISOString().slice(0, 10);
  document.getElementById("renewContractPeriodMonths").value = contract?.contract_period_months || emp.contract_period_months || "";
  document.getElementById("renewContractError").classList.remove("show");
  document.getElementById("renewContractOverlay").style.display = "flex";
}

document.getElementById("renewContractForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("renewContractError");
  errBox.classList.remove("show");
  const target_id = document.getElementById("renewContractOverlay").dataset.employeeId;

  const submitBtn = document.getElementById("renewContractForm").querySelector("button[type=submit]");
  if (submitBtn) setBtnLoading(submitBtn, true);
  showGlobalSpinner();
  // Same fix as renewSameTermsForm above — everything from here on is
  // wrapped so a thrown error (not just an {error} response) can never
  // leave the spinner stuck up with the modal already closed and no
  // feedback at all.
  try {
    const { data, error } = await db.functions.invoke("clever-action", {
      body: {
        action: "create_contract",
        target_id,
        dob: document.getElementById("renewContractDob").value || null,
        education: document.getElementById("renewContractEducation").value || null,
        address: document.getElementById("renewContractAddress").value || null,
        salary: Number(document.getElementById("renewContractSalary").value),
        job_title: document.getElementById("renewContractJobTitle").value,
        start_date: document.getElementById("renewContractStartDate").value,
        contract_period_months: Number(document.getElementById("renewContractPeriodMonths").value),
      }
    });

    if (error || (data && data.error)) {
      throw new Error((data && data.error) ? data.error : (error && error.message) ? error.message : "Something went wrong.");
    }

    // Renewals share immediately rather than sitting as a draft — the
    // admin has already decided to renew by submitting this form, no
    // separate review/share step needed afterward.
    if (data && data.contract) {
      await db.functions.invoke("clever-action", { body: { action: "share_contract", contract_id: data.contract.id } });
    }

    // Same immediate employee notification as "Renew — Same Terms",
    // supervisor excluded — this form is reached from the Contract
    // Renewal table's "Renew and Edit Profile" choice, so the same rule
    // applies regardless of which of the two options was picked.
    try {
      const emp = TEAM_BY_ID[target_id];
      await db.from("notifications").insert({
        type: "contract_renewed",
        contract_id: (data && data.contract) ? data.contract.id : null,
        employee_id: target_id,
        target_role: "employee",
        exclude_supervisor: true,
        title: "Your job contract has been renewed",
        message: `${emp ? emp.full_name : "Your"} job contract has been renewed and shared for review and signature.`,
        status: "resolved",
        read: false,
      });
    } catch (_e) { /* best-effort */ }

    document.getElementById("renewContractOverlay").style.display = "none";
    showRenewResult(data && data.contract ? data.contract.id : null, "Renewed contract created and shared with the employee.");
  } catch (err) {
    console.error("renewContractForm submit failed:", err);
    errBox.textContent = (err && err.message) ? err.message : "Something went wrong. Please try again.";
    errBox.classList.add("show");
  } finally {
    hideGlobalSpinner();
    if (submitBtn) setBtnLoading(submitBtn, false);
  }
});

async function refreshAll() {
  await loadTeam();
  await Promise.allSettled([loadBalances(), loadRequests(), loadTeamWarnings(), loadAdminContracts(), loadAdminWarnings(), loadContractRenewalTable()]);
  renderUsers();
  await checkAdminContractActivity();
  checkSupervisorWarningNotification();
}

(async () => {
  // NOTE: requireSession("supervisor") is in auth-guard.js, which I
  // don't have the source for in this session — if it validates the
  // role against a fixed allowed list for this page, "company_admin"
  // may be rejected before ME is even set below, sending the account
  // back to the login page. This needs verifying against the real file.
  ME = await requireSession("supervisor");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  if (ME.role === "admin") document.getElementById("adminLink").style.display = "";
  if (ME.role === "admin") document.getElementById("clientsLink").style.display = "";
  if (ME.role === "admin") document.getElementById("sourcingCandidatesLink").style.display = "";
  document.getElementById("pendingActionsHeader").textContent = ME.role === "admin" ? t("colStatus") : "";
  // A company admin only gets the Users list (scoped to their company +
  // departments) and the two report buttons — approving leave requests
  // and viewing decided-request history aren't part of what was asked
  // for, so both are hidden outright rather than left showing scoped
  // (but still actionable) data.
  if (ME.role === "company_admin") {
    document.getElementById("pendingRequestsPanel").style.display = "none";
    document.getElementById("requestHistoryPanel").style.display = "none";
  }
  await refreshAll();
  if (ME.role === "admin") {
    // Applies any scheduled freezes whose date has arrived (from "Do Not
    // Renew"), and refreshes the table if any were applied — same
    // once-per-day pattern the contract-expiry check uses, for the same
    // reason (no reliable cron available).
    const todayIso = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("fwx_scheduledFreezeLastChecked") !== todayIso) {
      localStorage.setItem("fwx_scheduledFreezeLastChecked", todayIso);
      db.functions.invoke("clever-action", { body: { action: "apply_scheduled_freezes" } })
        .then(({ data }) => { if (data && data.frozen_count > 0) refreshAll(); })
        .catch(() => {});
    }
  }
  checkAdminEmployeeActionNotifications();
  setInterval(checkAdminEmployeeActionNotifications, 8000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkAdminEmployeeActionNotifications();
  });
  window.addEventListener("focus", () => checkAdminEmployeeActionNotifications());
})();
