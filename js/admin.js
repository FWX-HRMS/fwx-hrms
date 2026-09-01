let ME = null;
let SUPERVISORS = [];
let DIRECTORY = [];
let BALANCES_BY_ID = {};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function toggleSupervisorField() {
  const role = document.getElementById("role").value;
  document.getElementById("supervisorField").style.display = (role === "staff") ? "" : "none";
}
document.getElementById("role").addEventListener("change", toggleSupervisorField);

document.getElementById("showAddFormBtn").addEventListener("click", () => {
  document.getElementById("addPanel").style.display = "";
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

async function loadSupervisors() {
  const { data, error } = await db
    .from("employees")
    .select("id, file_number, full_name, role")
    .in("role", ["supervisor", "admin"])
    .order("full_name");

  if (error || !data) return;
  SUPERVISORS = data;

  const select = document.getElementById("supervisor");
  select.innerHTML = '<option value="">Select a supervisor…</option>';
  for (const s of data) {
    const opt = document.createElement("option");
    opt.value = s.file_number;
    opt.textContent = `${s.full_name} (#${s.file_number})`;
    select.appendChild(opt);
  }
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

  const body = document.getElementById("directoryBody");
  body.innerHTML = "";
  if (error || !data) return;
  DIRECTORY = data;

  const byId = Object.fromEntries(data.map(e => [e.id, e]));

  for (const e of data) {
    const supervisorName = e.supervisor_id && byId[e.supervisor_id] ? byId[e.supervisor_id].full_name : "—";
    const isSelf = e.id === ME.id;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.full_name}</td>
      <td>${e.file_number}</td>
      <td style="text-transform:capitalize">${e.role}</td>
      <td>${e.department || "—"}</td>
      <td>${supervisorName}</td>
      <td class="row-actions">
        <button class="btn btn-ghost btn-sm" data-view="${e.id}">View</button>
        <button class="btn btn-ghost btn-sm" data-reset="${e.id}">Reset password</button>
        ${isSelf ? "" : `<button class="btn btn-danger btn-sm" data-delete="${e.id}">Delete</button>`}
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

function showDetails(id) {
  const e = DIRECTORY.find(x => x.id === id);
  if (!e) return;
  const bal = BALANCES_BY_ID[id];
  const sup = e.supervisor_id ? DIRECTORY.find(x => x.id === e.supervisor_id) : null;

  document.getElementById("detailsTitle").textContent = e.full_name;
  document.getElementById("detailsBody").innerHTML = `
    <div class="detail-row"><span class="label">File number</span><span class="value">${e.file_number}</span></div>
    <div class="detail-row"><span class="label">Email</span><span class="value">${e.email || "—"}</span></div>
    <div class="detail-row"><span class="label">Role</span><span class="value" style="text-transform:capitalize">${e.role}</span></div>
    <div class="detail-row"><span class="label">Department</span><span class="value">${e.department || "—"}</span></div>
    <div class="detail-row"><span class="label">Supervisor</span><span class="value">${sup ? sup.full_name : "—"}</span></div>
    <div class="detail-row"><span class="label">Date of birth</span><span class="value">${fmtDate(e.dob)}</span></div>
    <div class="detail-row"><span class="label">Nationality</span><span class="value">${e.nationality || "—"}</span></div>
    <div class="detail-row"><span class="label">Hiring date</span><span class="value">${fmtDate(e.hiring_date)}</span></div>
    <div class="detail-row"><span class="label">Education</span><span class="value">${e.education || "—"}</span></div>
    <div class="detail-row"><span class="label">Salary</span><span class="value">${fmtMoney(e.salary)}</span></div>
    <div class="detail-row"><span class="label">Annual leave days</span><span class="value">${e.annual_entitlement}</span></div>
    <div class="detail-row"><span class="label">Taken this year</span><span class="value">${bal ? bal.taken : "—"}</span></div>
    <div class="detail-row"><span class="label">Remaining</span><span class="value">${bal ? bal.remaining : "—"}</span></div>
  `;
  document.getElementById("detailsOverlay").style.display = "flex";
}

async function resetPassword(id, employee) {
  if (!confirm(`Generate a new password for ${employee.full_name}? Their current password will stop working.`)) return;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "reset_password", target_id: id }
  });

  if (error || (data && data.error)) {
    showToast("Could not reset that password.");
    return;
  }

  alert(`New password for ${employee.full_name} (#${employee.file_number}):\n\n${data.password}\n\nShare this with them securely.`);
}

async function deleteEmployee(id, employee) {
  if (!confirm(`Delete ${employee.full_name} (#${employee.file_number})? This permanently removes their login and records. This can't be undone.`)) return;

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

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("downloadReportBtn").addEventListener("click", () => {
  const rows = [["Name", "File number", "Department", "Role", "Annual entitlement", "Taken", "Remaining"]];
  for (const e of DIRECTORY) {
    const bal = BALANCES_BY_ID[e.id] || {};
    rows.push([e.full_name, e.file_number, e.department || "", e.role, e.annual_entitlement, bal.taken ?? "", bal.remaining ?? ""]);
  }
  downloadCSV(rows, "all_employees_leave_report.csv");
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
  const dob = document.getElementById("dob").value || null;
  const department = document.getElementById("department").value;
  const role = document.getElementById("role").value;
  const supervisor_file_number = document.getElementById("supervisor").value || null;
  const annual_entitlement = Number(document.getElementById("entitlement").value) || 30;

  if (role === "staff" && !supervisor_file_number) {
    errBox.textContent = "Please assign this staff member to a supervisor.";
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("addBtn");
  btn.disabled = true;
  btn.textContent = "Creating…";

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "create_employee", full_name, email, role, dob, department, supervisor_file_number, annual_entitlement }
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
  toggleSupervisorField();

  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
});

(async () => {
  ME = await requireSession("admin");
  if (!ME) return;
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  toggleSupervisorField();
  await Promise.all([loadSupervisors(), loadDirectory(), loadBalances()]);
})();
