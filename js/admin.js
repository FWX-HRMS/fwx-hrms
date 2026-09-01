let ME = null;
let SUPERVISORS = [];
let DIRECTORY = [];
let BALANCES_BY_ID = {};
let ACTIVE_TAB = "all"; // "all" | "supervisors"
const COMPANY_FILTER = new URLSearchParams(window.location.search).get("company");

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
    ok.textContent = "OK";
    ok.onclick = () => { document.getElementById("actionOverlay").style.display = "none"; resolve(); };
    btns.appendChild(ok);
    document.getElementById("actionOverlay").style.display = "flex";
  });
}

function showConfirm(title, message, confirmLabel = "Confirm", danger = false) {
  return new Promise((resolve) => {
    document.getElementById("actionTitle").textContent = title;
    document.getElementById("actionMessage").textContent = message;
    const btns = document.getElementById("actionButtons");
    btns.innerHTML = "";
    const cancel = document.createElement("button");
    cancel.className = "btn btn-danger btn-sm";
    cancel.textContent = "Cancel";
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
  document.getElementById("tableTitle").textContent = tab === "supervisors" ? "Supervisors" : "Employees";
  document.getElementById("showAddFormBtn").textContent = tab === "supervisors" ? "+ Add new supervisor" : "+ Add new employee";
  document.getElementById("addPanelTitle").textContent = tab === "supervisors" ? "New supervisor details" : "New employee details";
  renderDirectory();
}
document.getElementById("tabAllBtn").addEventListener("click", () => applyTab("all"));
document.getElementById("tabSupervisorsBtn").addEventListener("click", () => applyTab("supervisors"));

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
  select.innerHTML = '<option value="">Select a company…</option>';
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
    select.innerHTML = '<option value="">Select a company first…</option>';
    return;
  }

  const matches = SUPERVISORS.filter(s => s.client_company === companyFilter);
  select.innerHTML = matches.length
    ? '<option value="">Select a supervisor…</option>'
    : '<option value="">No supervisors yet in this company</option>';
  for (const s of matches) {
    const opt = document.createElement("option");
    opt.value = s.file_number;
    opt.textContent = `${s.full_name} (#${s.file_number})`;
    select.appendChild(opt);
  }
}
document.getElementById("clientCompany").addEventListener("change", populateSupervisorOptions);

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
  let rows = ACTIVE_TAB === "supervisors"
    ? DIRECTORY.filter(e => e.role === "supervisor")
    : DIRECTORY.filter(e => e.role !== "admin");
  if (COMPANY_FILTER) rows = rows.filter(e => e.client_company === COMPANY_FILTER);

  for (const e of rows) {
    const supervisorName = e.supervisor_id && byId[e.supervisor_id] ? byId[e.supervisor_id].full_name : "—";
    const isSelf = e.id === ME.id;
    const bal = BALANCES_BY_ID[e.id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.full_name}</td>
      <td>${e.file_number}</td>
      <td style="text-transform:capitalize">${e.role}</td>
      <td>${e.client_company || "—"}</td>
      <td>${e.department || "—"}</td>
      <td>${supervisorName}</td>
      <td>${e.annual_entitlement ?? "—"}</td>
      <td>${bal ? bal.taken : "—"}</td>
      <td>${bal ? bal.remaining : "—"}</td>
      <td class="row-actions">
        <button class="btn btn-blue btn-sm" data-view="${e.id}">View</button>
        <button class="btn btn-blue btn-sm" data-reset="${e.id}">Reset password</button>
        <button class="btn btn-danger btn-sm" data-delete="${e.id}" ${isSelf ? 'style="visibility:hidden"' : ""}>Delete</button>
      </td>
    `;
    body.appendChild(tr);
  }

  body.querySelectorAll("button[data-view]").forEach(btn => {
    btn.addEventListener("click", () => showDetails(btn.dataset.view));
  });
  body.querySelectorAll("button[data-reset]").forEach(btn => {
    btn.addEventListener("click", () => resetPassword(btn.dataset.reset, byId[btn.dataset.reset]));
  });
  body.querySelectorAll("button[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => deleteEmployee(btn.dataset.delete, byId[btn.dataset.delete]));
  });
}

async function showDetails(id) {
  const e = DIRECTORY.find(x => x.id === id);
  if (!e) return;
  const bal = BALANCES_BY_ID[id];
  const sup = e.supervisor_id ? DIRECTORY.find(x => x.id === e.supervisor_id) : null;

  document.getElementById("detailsTitle").textContent = e.full_name;
  document.getElementById("detailsBody").innerHTML = `
    <div class="detail-row"><span class="label">File number</span><span class="value">${e.file_number}</span></div>
    <div class="detail-row"><span class="label">Email</span><span class="value">${e.email || "—"}</span></div>
    <div class="detail-row"><span class="label">Role</span><span class="value" style="text-transform:capitalize">${e.role}</span></div>
    <div class="detail-row"><span class="label">Company client</span><span class="value">${e.client_company || "—"}</span></div>
    <div class="detail-row"><span class="label">Department</span><span class="value">${e.department || "—"}</span></div>
    <div class="detail-row"><span class="label">Supervisor</span><span class="value">${sup ? sup.full_name : "—"}</span></div>
    <div class="detail-row"><span class="label">Hiring date</span><span class="value">${fmtDate(e.hiring_date)}</span></div>
    <div class="detail-row"><span class="label">Date of birth</span><span class="value">${fmtDate(e.dob)}</span></div>
    <div class="detail-row"><span class="label">Nationality</span><span class="value">${e.nationality || "—"}</span></div>
    <div class="detail-row"><span class="label">Education</span><span class="value">${e.education || "—"}</span></div>
    <div class="detail-row"><span class="label">Salary</span><span class="value">${fmtMoney(e.salary)}</span></div>
    <div class="detail-row"><span class="label">Annual leave days</span><span class="value">${e.annual_entitlement}</span></div>
    <div class="detail-row"><span class="label">Taken this year</span><span class="value">${bal ? bal.taken : "—"}</span></div>
    <div class="detail-row"><span class="label">Remaining</span><span class="value">${bal ? bal.remaining : "—"}</span></div>
  `;
  document.getElementById("detailsOverlay").style.display = "flex";

  const historyBox = document.getElementById("detailsLeaveHistory");
  historyBox.innerHTML = "<div class='empty-state'>Loading…</div>";
  const { data: history, error } = await db
    .from("leave_requests")
    .select("*")
    .eq("employee_id", id)
    .order("start_date", { ascending: false });

  if (error || !history || history.length === 0) {
    historyBox.innerHTML = "<div class='empty-state'>No leave requests on file.</div>";
    return;
  }

  const badgeFor = (status) => `<span class="badge badge-${status}">${status[0].toUpperCase()}${status.slice(1)}</span>`;
  historyBox.innerHTML = `
    <table>
      <thead><tr><th>Dates</th><th>Days</th><th>Type</th><th>Status</th></tr></thead>
      <tbody>
        ${history.map(r => `
          <tr>
            <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
            <td>${r.days_requested}</td>
            <td style="text-transform:capitalize">${r.leave_type}</td>
            <td>${badgeFor(r.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function resetPassword(id, employee) {
  const ok = await showConfirm(
    "Reset password?",
    `Generate a new password for ${employee.full_name}? Their current password will stop working.`,
    "Reset password"
  );
  if (!ok) return;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "reset_password", target_id: id }
  });

  if (error || (data && data.error)) {
    showToast("Could not reset that password.");
    return;
  }

  await showInfo(
    "New password generated",
    `${employee.full_name} (#${employee.file_number}) — new password: <strong>${data.password}</strong><br><br>Share this with them securely.`
  );
}

async function deleteEmployee(id, employee) {
  const ok = await showConfirm(
    "Delete employee?",
    `Delete ${employee.full_name} (#${employee.file_number})? This permanently removes their login and records. This can't be undone.`,
    "Delete",
    true
  );
  if (!ok) return;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "delete_employee", target_id: id }
  });

  if (error || (data && data.error)) {
    showToast((data && data.error) ? data.error : "Could not delete that employee.");
    return;
  }

  showToast("Employee deleted.");
  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
}

function downloadPDF(title, subtitle, columns, rows, filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(27, 36, 48);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(75, 87, 104);
  doc.text(subtitle, 14, 25);
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

document.getElementById("downloadReportBtn").addEventListener("click", () => {
  let source = ACTIVE_TAB === "supervisors"
    ? DIRECTORY.filter(e => e.role === "supervisor")
    : DIRECTORY.filter(e => e.role !== "admin");
  if (COMPANY_FILTER) source = source.filter(e => e.client_company === COMPANY_FILTER);
  const rows = source.map(e => {
    const bal = BALANCES_BY_ID[e.id] || {};
    return [e.full_name, e.file_number, e.client_company || "—", e.department || "—", e.role, String(e.annual_entitlement), String(bal.taken ?? "—"), String(bal.remaining ?? "—")];
  });
  const scope = COMPANY_FILTER ? `${COMPANY_FILTER} — ` : "";
  const title = scope + (ACTIVE_TAB === "supervisors" ? "Supervisors — Leave Report" : "Employees — Leave Report");
  const filenamePrefix = COMPANY_FILTER ? `${COMPANY_FILTER.toLowerCase()}_` : "";
  downloadPDF(
    title,
    `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}`,
    ["Name", "File #", "Company", "Department", "Role", "Entitlement", "Taken", "Remaining"],
    rows,
    `${filenamePrefix}${ACTIVE_TAB === "supervisors" ? "supervisors" : "all_employees"}_leave_report.pdf`
  );
});

document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("addError");
  const credBox = document.getElementById("credentialsBox");
  errBox.classList.remove("show");
  credBox.classList.remove("show");

  const first = document.getElementById("firstName").value.trim();
  const middle = document.getElementById("middleName").value.trim();
  const family = document.getElementById("familyName").value.trim();
  const full_name = [first, middle, family].filter(Boolean).join(" ");

  const email = document.getElementById("email").value.trim();
  const hiring_date = document.getElementById("hiringDate").value || null;
  const client_company = document.getElementById("clientCompany").value;
  const department = document.getElementById("department").value;
  const role = document.getElementById("role").value;
  const supervisor_file_number = document.getElementById("supervisor").value || null;
  const annual_entitlement = Number(document.getElementById("entitlement").value) || 30;

  if (!client_company) {
    errBox.textContent = "Please select a company client.";
    errBox.classList.add("show");
    return;
  }

  if (role === "staff" && !supervisor_file_number) {
    errBox.textContent = "Please assign this staff member to a supervisor.";
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("addBtn");
  btn.disabled = true;
  btn.textContent = "Creating…";

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "create_employee", full_name, email, role, hiring_date, department, client_company, supervisor_file_number, annual_entitlement }
  });

  btn.disabled = false;
  btn.textContent = "Create employee";

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : "Something went wrong creating this employee.";
    errBox.classList.add("show");
    return;
  }

  document.getElementById("credFileNumber").textContent = data.file_number;
  document.getElementById("credPassword").textContent = data.password;
  credBox.classList.add("show");
  document.getElementById("copyCredsBtn").onclick = () => {
    navigator.clipboard.writeText(
      `File number: ${data.file_number}\nInitial password: ${data.password}\nSign in at: ${window.location.origin}`
    );
    showToast("Copied.");
  };

  document.getElementById("addForm").reset();
  document.getElementById("entitlement").value = "30";
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
    document.querySelector(".page-title").textContent = `${COMPANY_FILTER} — Employees`;
    document.querySelector(".page-sub").textContent = `Add, manage, and report on ${COMPANY_FILTER} staff and supervisors only.`;
  }
  toggleSupervisorField();
  await Promise.all([loadCompanyOptions(), loadSupervisors(), loadBalances()]);
  await loadDirectory();
  if (COMPANY_FILTER) document.getElementById("clientCompany").value = COMPANY_FILTER;
})();
