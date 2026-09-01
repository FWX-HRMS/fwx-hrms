let ME = null;
let SUPERVISORS = [];

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

async function loadDirectory() {
  const { data, error } = await db
    .from("employees")
    .select("id, file_number, full_name, role, department, supervisor_id")
    .order("full_name");

  const body = document.getElementById("directoryBody");
  body.innerHTML = "";
  if (error || !data) return;

  const byId = Object.fromEntries(data.map(e => [e.id, e]));

  for (const e of data) {
    const supervisorName = e.supervisor_id && byId[e.supervisor_id] ? byId[e.supervisor_id].full_name : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.full_name}</td>
      <td>${e.file_number}</td>
      <td style="text-transform:capitalize">${e.role}</td>
      <td>${e.department || "—"}</td>
      <td>${supervisorName}</td>
    `;
    body.appendChild(tr);
  }
}

document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("addError");
  const credBox = document.getElementById("credentialsBox");
  errBox.classList.remove("show");
  credBox.classList.remove("show");

  const full_name = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const dob = document.getElementById("dob").value || null;
  const department = document.getElementById("department").value.trim() || null;
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

  const { data, error } = await db.functions.invoke("admin-create-employee", {
    body: { full_name, email, role, dob, department, supervisor_file_number, annual_entitlement }
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

  await Promise.all([loadSupervisors(), loadDirectory()]);
});

(async () => {
  ME = await requireSession("admin");
  if (!ME) return;
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  toggleSupervisorField();
  await Promise.all([loadSupervisors(), loadDirectory()]);
})();
