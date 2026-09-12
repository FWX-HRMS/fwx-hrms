let ME = null;
// Reusable search bar injector — creates a 🔍 search input right above the
// given table (if not already present) and wires it to re-render on input.
// Works without needing the HTML file, so it can be dropped onto any table.
function ensureTableSearch(tbodyId, inputId, onQuery) {
  let input = document.getElementById(inputId);
  if (input) return input;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return null;
  const table = tbody.closest("table");
  if (!table) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative; max-width:480px; margin-bottom:14px";
  wrap.innerHTML = `
    <span style="position:absolute; inset-inline-start:12px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:.55">🔍</span>
    <input type="text" id="${inputId}" placeholder="Name, file #, company, role, or department" style="width:100%; padding-inline-start:36px">
  `;
  table.parentNode.insertBefore(wrap, table);
  input = document.getElementById(inputId);
  input.addEventListener("input", onQuery);
  return input;
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
  const { data, error } = ME.role === "admin"
    ? await query.neq("role", "admin")
    : await query.eq("supervisor_id", ME.id).eq("frozen", false);

  if (error || !data) return [];
  TEAM_BY_ID = Object.fromEntries(data.map(e => [e.id, e]));
  TEAM_LIST = data;
  USERS_PAGE = 0;
  document.getElementById("teamCount").textContent = ME.role === "admin"
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
  employeeIdInput.parentNode.insertBefore(wrap, employeeIdInput.nextSibling);
  return document.getElementById("rangeCompanySelect");
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

function showDateRangePrompt(title) {
  return new Promise(async (resolve) => {
    document.getElementById("dateRangeTitle").textContent = title;
    document.getElementById("rangeFromInput").value = "";
    document.getElementById("rangeToInput").value = "";
    document.getElementById("rangeEmployeeIdInput").value = "";
    document.getElementById("rangeEmployeeIdInput").placeholder = ME.role === "admin"
      ? "e.g. 6002 (F.W.X), 1003 (Zain)"
      : employeeIdPlaceholderFor();
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
      const company = ME.role === "admin" ? ((document.getElementById("rangeCompanySelect") || {}).value || null) : null;
      cleanup();
      resolve({ from, to, employeeId, company, wantPdf, wantExcel });
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };
    generateBtn.addEventListener("click", onGenerate);
    cancelBtn.addEventListener("click", onCancel);
  });
}

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(text || "");
}

// jsPDF's built-in fonts have no Arabic glyphs at all, so passing Arabic
// text straight to doc.text()/autoTable renders it as corrupted
// characters. This draws the line onto a canvas instead — the browser's
// own text engine correctly shapes Arabic (and any mixed Latin/Arabic
// run) — and places the result into the PDF as an image. Ported directly
// from admin.js's existing, already-working solution to this same
// problem, so both reports render Arabic identically.
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

async function downloadPDF(title, subtitle, columns, rows, filename) {
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
  if (containsArabic(title)) {
    drawMixedLine(doc, title, { xMm: textStartX, yMm: 18, sizeMm: 5.6, color: "#1b2430" });
  } else {
    doc.text(title, textStartX, 18);
  }
  doc.setFontSize(10);
  doc.setTextColor(75, 87, 104);
  if (containsArabic(subtitle)) {
    drawMixedLine(doc, subtitle, { xMm: textStartX, yMm: 25, sizeMm: 3.5, color: "#4b5768" });
  } else {
    doc.text(subtitle, textStartX, 25);
  }

  // Same Arabic-column-width pre-measurement admin.js uses, so a column
  // holding Arabic names (which autoTable's own font can't measure) still
  // ends up wide enough to fit them instead of clipping.
  const fontSize = 9;
  const arabicSizeMm = fontSize * 0.34;
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
  columns.forEach((_, colIndex) => {
    let maxWidthMm = 0;
    for (const row of rows) {
      const raw = String(row[colIndex] ?? "");
      if (!containsArabic(raw)) continue;
      const w = measureArabicWidthMm(raw, arabicSizeMm) + 4;
      if (w > maxWidthMm) maxWidthMm = w;
    }
    if (maxWidthMm > 0) columnStyles[colIndex] = { minCellWidth: Math.min(maxWidthMm, 70) };
  });

  doc.autoTable({
    head: [columns],
    body: rows,
    startY: 32,
    theme: "striped",
    headStyles: { fillColor: [47, 111, 94] },
    styles: { fontSize, cellPadding: 4, overflow: "linebreak" },
    columnStyles,
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      // jsPDF's built-in fonts have no Arabic glyphs — blank the cell's
      // own text here; didDrawCell below redraws it as a canvas image
      // instead, which correctly shapes Arabic.
      if (data.section === "body" && typeof data.cell.text === "object" && containsArabic(String(data.cell.raw ?? ""))) {
        data.cell.text = [""];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const raw = String(data.cell.raw ?? "");
      if (!containsArabic(raw)) return;
      drawMixedLine(doc, raw, {
        xMm: data.cell.x + 2,
        yMm: data.cell.y + data.cell.height / 2 + 1.1,
        sizeMm: arabicSizeMm,
        color: "#1b2430",
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

document.getElementById("downloadReportBtn").addEventListener("click", async () => {
  const range = await showDateRangePrompt(t("selectReportPeriodTitle"));
  if (!range) return;

  let source = range.employeeId
    ? TEAM_BALANCE_ROWS.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.file_number === range.employeeId; })
    : TEAM_BALANCE_ROWS;
  // General report shows employee info only — supervisors aren't
  // included here (matches admin.js's default/"All Team" report; the
  // dedicated Supervisors tab report is unaffected by this).
  source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.role === "staff"; });
  if (!range.employeeId && range.company) {
    source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.client_company === range.company; });
  }
  if (range.from) source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.hiring_date && emp.hiring_date >= range.from; });
  if (range.to) source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.hiring_date && emp.hiring_date <= range.to; });
  source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return !(emp && emp.frozen); });

  if (source.length === 0) {
    showInfoPopup(t("noResultsTitle"), t("noMatchingEmployeeToast"));
    return;
  }

  // Name and file number live on the employee record (TEAM_BY_ID), not
  // on these balance-only rows — pulling them straight from `r` left
  // those two columns blank in the generated report.
  const rows = source.map(r => {
    const emp = TEAM_BY_ID[r.employee_id] || {};
    return [emp.full_name || "—", emp.file_number || "—", "W".repeat(Math.min(countActiveWarnings(r.employee_id), 3)) || "—", String(r.annual_entitlement), String(r.taken), String(r.remaining), String(r.pending), String(r.sick_entitlement), String(r.sick_taken), String(r.sick_remaining)];
  });
  const rangeNote = (range.from || range.to) ? ` — Period: ${range.from || "…"} to ${range.to || "…"}` : "";
  const columns = ["Employee Name", "ID #", "Active Warning", "Annual", "Taken", "Available Balance", "Pending", "Sick", "Sick Taken", "Sick Remaining"];
  const scope = range.company ? `${range.company} — ` : "";

  const selectedEmployee = range.employeeId && source[0] ? TEAM_BY_ID[source[0].employee_id] : null;
  const reportName = selectedEmployee ? (selectedEmployee.full_name || "Employee") : "All Team Report";
  const safeReportName = reportName.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
  const filenamePrefix = range.company ? `${range.company.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_` : "";
  const reportTitle = selectedEmployee ? `${scope}${reportName} — Leave Report` : `${scope}All Team Report`;

  if (range.wantPdf) {
    downloadPDF(
      reportTitle,
      `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}${rangeNote}`,
      columns,
      rows,
      `${filenamePrefix}${safeReportName}.pdf`
    );
  }
  if (range.wantExcel) {
    downloadExcel(reportTitle, columns, rows, `${filenamePrefix}${safeReportName}.xlsx`);
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
      const row = btn.closest("tr");
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

      const emp = TEAM_BY_ID[target_id];
      const empLabel = emp ? `${emp.full_name} (#${emp.file_number})` : "The employee";
      document.getElementById("doNotRenewConfirmText").textContent =
        `This contract will not be renewed. ${empLabel} will be notified.`;
      document.getElementById("doNotRenewConfirmOverlay").style.display = "flex";
      document.getElementById("doNotRenewConfirmOkBtn").onclick = () => {
        document.getElementById("doNotRenewConfirmOverlay").style.display = "none";
        if (row) row.remove();
      };
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
document.getElementById("renewChoiceSameBtn").addEventListener("click", async () => {
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

  document.getElementById("renewSameTermsOverlay").dataset.employeeId = target_id;
  document.getElementById("renewSameTermsOverlay").dataset.contractId = contract_id;
  document.getElementById("renewSameTermsEmployeeInfo").textContent = emp ? `${emp.full_name} · #${emp.file_number}` : "";
  document.getElementById("renewSameTermsStartDate").value = nextStart.toISOString().slice(0, 10);
  periodSelect.value = contract && contract.contract_period_months ? String(contract.contract_period_months) : "12";
  document.getElementById("renewSameTermsError").classList.remove("show");
  document.getElementById("renewSameTermsOverlay").style.display = "flex";
});

document.getElementById("renewSameTermsCancelBtn").addEventListener("click", () => {
  document.getElementById("renewSameTermsOverlay").style.display = "none";
});

document.getElementById("renewSameTermsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const overlay = document.getElementById("renewSameTermsOverlay");
  const target_id = overlay.dataset.employeeId;
  const contract_id = overlay.dataset.contractId;
  const start_date = document.getElementById("renewSameTermsStartDate").value;
  const contract_period_months = Number(document.getElementById("renewSameTermsPeriodMonths").value);
  const errBox = document.getElementById("renewSameTermsError");
  errBox.classList.remove("show");

  const submitBtn = document.getElementById("renewSameTermsSubmitBtn");
  const spinner = document.getElementById("renewSameTermsSpinner");
  submitBtn.disabled = true;
  spinner.style.display = "inline-block";

  showGlobalSpinner();
  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "renew_same_terms", target_id, contract_id, start_date, contract_period_months }
  });
  hideGlobalSpinner();

  submitBtn.disabled = false;
  spinner.style.display = "none";

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : "Something went wrong.";
    errBox.classList.add("show");
    return;
  }
  overlay.style.display = "none";
  const emp = TEAM_BY_ID[target_id];
  showContractSharedModal(emp ? emp.full_name : "the employee", emp ? emp.file_number : "—", data && data.contract ? data.contract.id : null);
  await loadContractRenewalTable();
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
  document.getElementById("renewContractOverlay").dataset.contractId = contract ? contract.id : "";
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
  const renewal_contract_id = document.getElementById("renewContractOverlay").dataset.contractId || undefined;

  const submitBtn = document.getElementById("renewContractSubmitBtn");
  const spinner = document.getElementById("renewContractSpinner");
  submitBtn.disabled = true;
  spinner.style.display = "inline-block";

  showGlobalSpinner();
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
      renewal_contract_id,
    }
  });
  hideGlobalSpinner();

  submitBtn.disabled = false;
  spinner.style.display = "none";

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : "Something went wrong.";
    errBox.classList.add("show");
    return;
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
  const emp = TEAM_BY_ID[target_id];
  showContractSharedModal(emp ? emp.full_name : "the employee", emp ? emp.file_number : "—", data && data.contract ? data.contract.id : null);
  await loadContractRenewalTable();
});

function showContractSharedModal(empName, fileNumber, contractId) {
  document.getElementById("contractSharedText").textContent =
    `A new contract has been shared with ${empName} (#${fileNumber}).`;
  const viewBtn = document.getElementById("contractSharedViewBtn");
  if (contractId) {
    viewBtn.style.display = "";
    viewBtn.onclick = () => {
      // admin.js reads ?contractId= on load and opens the same contract
      // view/edit modal used everywhere else for contracts — same
      // pattern already used elsewhere in this file (e.g. viewAdminContract).
      window.location.href = `admin.html?tab=contracts&contractId=${encodeURIComponent(contractId)}`;
    };
  } else {
    viewBtn.style.display = "none";
  }
  document.getElementById("contractSharedOverlay").style.display = "flex";
}

document.getElementById("contractSharedOkBtn").addEventListener("click", () => {
  document.getElementById("contractSharedOverlay").style.display = "none";
});

async function refreshAll() {
  await loadTeam();
  await Promise.allSettled([loadBalances(), loadRequests(), loadTeamWarnings(), loadAdminContracts(), loadAdminWarnings(), loadContractRenewalTable()]);
  renderUsers();
  await checkAdminContractActivity();
  checkSupervisorWarningNotification();
}

(async () => {
  ME = await requireSession("supervisor");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  if (ME.role === "admin") document.getElementById("adminLink").style.display = "";
  if (ME.role === "admin") document.getElementById("clientsLink").style.display = "";
  if (ME.role === "admin") document.getElementById("sourcingCandidatesLink").style.display = "";
  document.getElementById("pendingActionsHeader").textContent = ME.role === "admin" ? t("colStatus") : "";
  const downloadReportBtn = document.getElementById("downloadReportBtn");
  if (downloadReportBtn) downloadReportBtn.textContent = "Download Leave Report";
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
