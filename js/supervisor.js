let ME = null;

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

// Admin-only: adding a new supervisor account is an org-wide action, so this
// button/modal only appears for admins viewing Team Overview, not for
// regular supervisors managing their own direct reports.
function ensureAddSupervisorUI() {
  if (ME.role !== "admin") return;
  if (document.getElementById("showAddSupervisorTeamBtn")) return;

  const usersBody = document.getElementById("usersBody");
  if (!usersBody) return;
  const panel = usersBody.closest(".panel");
  const usersHeading = panel ? panel.querySelector("h2") : null;
  if (!usersHeading) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "showAddSupervisorTeamBtn";
  btn.className = "btn btn-primary";
  btn.textContent = "+ Add Supervisor";
  btn.style.cssText = "width:200px; margin-inline-start:12px";
  usersHeading.parentNode.insertBefore(btn, usersHeading.nextSibling);

  const overlay = document.createElement("div");
  overlay.id = "addSupervisorTeamOverlay";
  overlay.className = "modal-overlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <h2 style="margin:0 0 14px">Add New Supervisor</h2>
      <form id="addSupervisorTeamForm">
        <label for="supTeamFullName">Full name</label>
        <input type="text" id="supTeamFullName" required>
        <label for="supTeamEmail" style="margin-top:12px">Email</label>
        <input type="text" id="supTeamEmail" required>
        <label for="supTeamCompany" style="margin-top:12px">Company client</label>
        <select id="supTeamCompany" required><option value="">Select company…</option></select>
        <label for="supTeamDepartment" style="margin-top:12px">Department</label>
        <select id="supTeamDepartment" required></select>
        <div style="display:flex; gap:10px; margin-top:18px">
          <button type="button" class="btn btn-danger" id="cancelAddSupervisorTeamBtn" style="width:220px">Cancel</button>
          <button type="submit" class="btn btn-primary" id="addSupervisorTeamBtn" style="width:220px">Create</button>
        </div>
        <div class="error-msg" id="addSupervisorTeamError"></div>
      </form>
      <div class="success-msg" id="supervisorTeamCredentialsBox" style="margin-top:20px">
        <p style="margin:0 0 8px"><strong>Supervisor created. Share these with them — they can change the password after logging in.</strong></p>
        <p style="margin:0">File number: <strong id="supTeamCredFileNumber"></strong></p>
        <p style="margin:0">Initial password: <strong id="supTeamCredPassword"></strong></p>
        <p style="margin:8px 0 0"><button type="button" class="btn btn-blue btn-sm" id="copySupTeamCredsBtn">Copy details</button></p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  btn.addEventListener("click", async () => {
    document.getElementById("addSupervisorTeamForm").reset();
    document.getElementById("addSupervisorTeamForm").style.display = "";
    document.getElementById("addSupervisorTeamError").classList.remove("show");
    document.getElementById("supervisorTeamCredentialsBox").classList.remove("show");

    const companySelect = document.getElementById("supTeamCompany");
    const { data: companies } = await db.from("client_companies").select("name").order("name");
    companySelect.innerHTML = `<option value="">Select company…</option>` +
      (companies || []).map(c => `<option value="${c.name}">${c.name}</option>`).join("");
    populateDepartmentOptions(document.getElementById("supTeamDepartment"), "", null);

    overlay.style.display = "flex";
  });

  document.getElementById("cancelAddSupervisorTeamBtn").addEventListener("click", () => {
    overlay.style.display = "none";
  });

  document.getElementById("supTeamCompany").addEventListener("change", (e) => {
    populateDepartmentOptions(document.getElementById("supTeamDepartment"), e.target.value, null);
  });

  document.getElementById("addSupervisorTeamForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = document.getElementById("addSupervisorTeamError");
    const credBox = document.getElementById("supervisorTeamCredentialsBox");
    errBox.classList.remove("show");
    credBox.classList.remove("show");

    const full_name = document.getElementById("supTeamFullName").value.trim();
    const email = document.getElementById("supTeamEmail").value.trim();
    const client_company = document.getElementById("supTeamCompany").value;
    const department = document.getElementById("supTeamDepartment").value;

    if (!client_company) {
      errBox.textContent = "Please select a company.";
      errBox.classList.add("show");
      return;
    }

    const submitBtn = document.getElementById("addSupervisorTeamBtn");
    setBtnLoading(submitBtn, true, "Creating…");

    const { data, error } = await db.functions.invoke("clever-action", {
      body: { action: "create_employee", full_name, email, role: "supervisor", department, client_company }
    });

    setBtnLoading(submitBtn, false);

    if (error || (data && data.error)) {
      errBox.textContent = (data && data.error) ? data.error : "Something went wrong creating this supervisor.";
      errBox.classList.add("show");
      return;
    }

    document.getElementById("supTeamCredFileNumber").textContent = data.file_number;
    document.getElementById("supTeamCredPassword").textContent = data.password;
    credBox.classList.add("show");
    document.getElementById("addSupervisorTeamForm").style.display = "none";
    document.getElementById("copySupTeamCredsBtn").onclick = () => {
      navigator.clipboard.writeText(`File number: ${data.file_number}\nInitial password: ${data.password}\nSign in at: ${window.location.origin}`);
      showToast(t("copiedToast"));
    };

    await refreshAll();
  });
}

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
  const { data, error } = ME.role === "admin"
    ? await query.neq("role", "admin")
    : await query.eq("supervisor_id", ME.id);

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

function renderUsers() {
  const body = document.getElementById("usersBody");
  const empty = document.getElementById("noUsers");
  body.innerHTML = "";

  ensureTableSearch("usersBody", "usersSearchInput", () => { USERS_PAGE = 0; renderUsers(); });
  const query = (document.getElementById("usersSearchInput") || {}).value || "";
  const filteredTeam = query
    ? TEAM_LIST.filter(e => matchesTableSearch(query, e.file_number, e.client_company, e.role, e.full_name, e.department))
    : TEAM_LIST;
  empty.style.display = filteredTeam.length ? "none" : "block";

  const balByEmployeeId = Object.fromEntries(TEAM_BALANCE_ROWS.map(r => [r.employee_id, r]));
  const start = USERS_PAGE * PAGE_SIZE;
  const pageItems = filteredTeam.slice(start, start + PAGE_SIZE);
  for (const e of pageItems) {
    const bal = balByEmployeeId[e.id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.full_name}</td>
      <td>${e.file_number}</td>
      <td style="text-transform:capitalize">${e.role}</td>
      <td>${e.client_company || "—"}</td>
      <td>${e.department || "—"}</td>
      <td>${e.carryover_balance !== null && e.carryover_balance !== undefined ? e.carryover_balance : 0}</td>
      <td>${bal ? bal.annual_entitlement : "—"}</td>
      <td>${bal ? bal.taken : "—"}</td>
      <td>${bal ? bal.remaining : "—"}</td>
      <td>${bal ? bal.sick_entitlement : "—"}</td>
      <td>${bal ? bal.sick_taken : "—"}</td>
      <td>${bal ? bal.sick_remaining : "—"}</td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("users", USERS_PAGE, filteredTeam.length);
}

async function loadBalances() {
  const { data, error } = await db.from("leave_balances").select("*");
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

  PENDING_REQUESTS = data.filter(r => r.status === "pending" && TEAM_BY_ID[r.employee_id]);
  HISTORY_REQUESTS = data.filter(r => r.status !== "pending" && TEAM_BY_ID[r.employee_id]);
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
  noPending.style.display = filteredPending.length ? "none" : "block";

  const start = PENDING_PAGE * PAGE_SIZE;
  const pageItems = filteredPending.slice(start, start + PAGE_SIZE);

  for (const r of pageItems) {
    const emp = TEAM_BY_ID[r.employee_id];
    const tr = document.createElement("tr");
    const actionsCell = ME.role === "admin"
      ? `<td>${badgeFor(r.status)}</td>`
      : `<td class="row-actions">
          <button class="btn btn-primary btn-sm" data-action="approved" data-id="${r.id}">${t("approveBtn")}</button>
          <button class="btn btn-danger btn-sm" data-action="rejected" data-id="${r.id}">${t("rejectBtn")}</button>
        </td>`;
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
      <td>${r.days_requested}</td>
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
      const { error } = await db
        .from("leave_requests")
        .update({ status: btn.dataset.action, decided_by: ME.id, decided_at: new Date().toISOString() })
        .eq("id", btn.dataset.id);
      hideGlobalSpinner();
      if (error) { showToast(t("couldNotUpdateRequest")); }
      else {
        showToast(t(btn.dataset.action === "approved" ? "statusApproved" : "statusRejected"));
        db.functions.invoke("clever-api", {
          body: { leave_request_id: btn.dataset.id, type: "decided" }
        }).catch(() => {});
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
  noHistory.style.display = filteredHistory.length ? "none" : "block";

  const start = HISTORY_PAGE * PAGE_SIZE;
  const pageItems = filteredHistory.slice(start, start + PAGE_SIZE);

  for (const r of pageItems) {
    const emp = TEAM_BY_ID[r.employee_id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
      <td>${r.days_requested}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${badgeFor(r.status)}</td>
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

function showDateRangePrompt(title) {
  return new Promise(async (resolve) => {
    document.getElementById("dateRangeTitle").textContent = title;
    document.getElementById("rangeFromInput").value = "";
    document.getElementById("rangeToInput").value = "";
    document.getElementById("rangeEmployeeIdInput").value = "";
    document.getElementById("rangeFormatPdf").checked = true;
    document.getElementById("rangeFormatExcel").checked = false;
    document.getElementById("rangeFormatError").classList.remove("show");

    const companySelect = ensureRangeCompanySelect();
    if (companySelect) {
      const { data: companies } = await db.from("client_companies").select("name").order("name");
      companySelect.innerHTML = `<option value="">All companies</option>` +
        (companies || []).map(c => `<option value="${c.name}">${c.name}</option>`).join("");
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
      const company = (document.getElementById("rangeCompanySelect") || {}).value || null;
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
    ? TEAM_BALANCE_ROWS.filter(r => r.file_number === range.employeeId)
    : TEAM_BALANCE_ROWS;
  if (!range.employeeId && range.company) {
    source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.client_company === range.company; });
  }
  if (range.from) source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.hiring_date && emp.hiring_date >= range.from; });
  if (range.to) source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.hiring_date && emp.hiring_date <= range.to; });

  if (source.length === 0) {
    showToast(t("noMatchingEmployeeToast"));
    return;
  }

  const rows = source.map(r => [r.full_name, r.file_number, String(r.annual_entitlement), String(r.taken), String(r.remaining), String(r.pending), String(r.sick_entitlement), String(r.sick_taken), String(r.sick_remaining)]);
  const rangeNote = (range.from || range.to) ? ` — Period: ${range.from || "…"} to ${range.to || "…"}` : "";
  const columns = ["Employee Name", "ID #", "Annual", "Taken", "Available Balance", "Pending", "Sick", "Sick Taken", "Sick Remaining"];
  const scope = range.company ? `${range.company} — ` : "";
  const filenamePrefix = range.company ? `${range.company.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_` : "";

  if (range.wantPdf) {
    downloadPDF(
      `${scope}My Team — Leave Report`,
      `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}${rangeNote}`,
      columns,
      rows,
      `${filenamePrefix}my_team_leave_report.pdf`
    );
  }
  if (range.wantExcel) {
    downloadExcel(`${scope}My Team — Leave Report`, columns, rows, `${filenamePrefix}my_team_leave_report.xlsx`);
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
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}</td>
      <td>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-team-warning="${w.id}">${t("view")}</button></td>
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

async function checkAdminContractActivity() {
  if (ME.role !== "admin") return;
  const { data } = await db.from("contracts").select("id, status, employee_action_at").in("status", ["signed", "commented"]);
  if (!data || data.length === 0) return;

  const key = `fwx_lastSeenContractActivity_${ME.id}`;
  const lastSeen = localStorage.getItem(key);
  const newOnes = data.filter(c => c.employee_action_at && (!lastSeen || new Date(c.employee_action_at) > new Date(lastSeen)));
  localStorage.setItem(key, new Date().toISOString());
  if (newOnes.length === 0) return;

  showDocActivityPopup("📄", t("docActivityTitle"), tv("adminContractActivityMsg", { n: newOnes.length }));
}

function checkSupervisorWarningNotification() {
  if (ME.role !== "supervisor") return;
  const key = `fwx_lastSeenSupervisorWarnings_${ME.id}`;
  const lastSeen = localStorage.getItem(key);
  const newOnes = TEAM_WARNINGS_LIST.filter(w => w.sent_at && (!lastSeen || new Date(w.sent_at) > new Date(lastSeen)));
  localStorage.setItem(key, new Date().toISOString());
  if (newOnes.length === 0) return;

  showDocActivityPopup("⚠️", t("docActivityTitle"), tv("supervisorWarningNotifyMsg", { n: newOnes.length }));
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
      <td>${docStatusBadge(c.status)}</td>
      <td>${fmtDate(c.created_at ? c.created_at.slice(0,10) : null)}</td>
      <td>${c.contract_period_months ? `${c.contract_period_months} ${t("monthsLabel")}` : "—"}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-admin-contract="${c.id}">${t("view")}</button></td>
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
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}</td>
      <td>${fmtDate(w.created_at ? w.created_at.slice(0,10) : null)}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-admin-warning="${w.id}">${t("view")}</button></td>
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

async function refreshAll() {
  await loadTeam();
  await Promise.allSettled([loadBalances(), loadRequests(), loadTeamWarnings(), loadAdminContracts(), loadAdminWarnings()]);
  await checkAdminContractActivity();
  checkSupervisorWarningNotification();
}

(async () => {
  ME = await requireSession("supervisor");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  if (ME.role === "admin") document.getElementById("adminLink").style.display = "";
  if (ME.role === "admin") document.getElementById("clientsLink").style.display = "";
  document.getElementById("pendingActionsHeader").textContent = ME.role === "admin" ? t("colStatus") : "";
  await refreshAll();
  ensureAddSupervisorUI();
})();
