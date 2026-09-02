let ME = null;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

async function loadBalance() {
  const { data, error } = await db
    .from("leave_balances")
    .select("*")
    .eq("employee_id", ME.id)
    .single();

  if (error || !data) return;
  document.getElementById("statEntitlement").textContent = data.annual_entitlement;
  document.getElementById("statTaken").textContent = data.taken;
  document.getElementById("statRemaining").textContent = data.remaining;
  document.getElementById("statPending").textContent = data.pending;
  document.getElementById("statSickEntitlement").textContent = data.sick_entitlement;
  document.getElementById("statSickRemaining").textContent = data.sick_remaining;
}

function badgeFor(status) {
  const key = "status" + status[0].toUpperCase() + status.slice(1);
  return `<span class="badge badge-${status}">${t(key)}</span>`;
}

async function loadRequests() {
  const { data, error } = await db
    .from("leave_requests")
    .select("*")
    .eq("employee_id", ME.id)
    .order("requested_at", { ascending: false });

  const body = document.getElementById("requestsBody");
  const empty = document.getElementById("noRequests");
  body.innerHTML = "";

  if (error || !data || data.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const r of data) {
    const tr = document.createElement("tr");
    const canCancel = r.status === "pending";
    tr.innerHTML = `
      <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
      <td>${r.days_requested}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${badgeFor(r.status)}</td>
      <td>${canCancel ? `<button class="btn btn-danger btn-sm" data-id="${r.id}">${t("cancelBtn")}</button>` : ""}</td>
    `;
    body.appendChild(tr);
  }

  body.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const { error } = await db
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", btn.dataset.id);
      if (error) { showToast(t("couldNotCancelToast")); btn.disabled = false; return; }
      showToast(t("requestCancelledToast"));
      await Promise.all([loadRequests(), loadBalance()]);
    });
  });
}

document.getElementById("leaveType").addEventListener("change", (e) => {
  const isSick = e.target.value === "sick";
  document.getElementById("documentLabel").textContent = isSick ? t("attachDocRequiredLabel") : t("attachDocOptionalLabel");
});

document.getElementById("leaveForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("leaveError");
  errBox.classList.remove("show");

  const start_date = document.getElementById("startDate").value;
  const end_date = document.getElementById("endDate").value;
  const leave_type = document.getElementById("leaveType").value;
  const reason = document.getElementById("reason").value.trim();

  if (end_date < start_date) {
    errBox.textContent = t("endDateBeforeStart");
    errBox.classList.add("show");
    return;
  }

  const fileInput = document.getElementById("document");
  const file = fileInput.files[0];

  if (leave_type === "sick" && !file) {
    errBox.textContent = t("documentRequiredForSick");
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("applyBtn");
  btn.disabled = true;
  btn.textContent = t("submitting");

  let document_path = null;

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    document_path = `${ME.id}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await db.storage.from("leave-documents").upload(document_path, file);
    if (uploadError) {
      btn.disabled = false;
      btn.textContent = t("submitRequestBtn");
      errBox.textContent = t("couldNotUploadDoc");
      errBox.classList.add("show");
      return;
    }
  }

  const { data: inserted, error } = await db.from("leave_requests").insert({
    employee_id: ME.id,
    start_date, end_date, leave_type,
    reason: reason || null,
    document_path
  }).select().single();

  btn.disabled = false;
  btn.textContent = t("submitRequestBtn");

  if (error) {
    errBox.textContent = t("somethingWrongSubmitting");
    errBox.classList.add("show");
    return;
  }

  // Best-effort email to the supervisor — doesn't block the UI if it fails.
  db.functions.invoke("clever-api", {
    body: { leave_request_id: inserted.id, type: "submitted" }
  }).catch(() => {});

  document.getElementById("leaveForm").reset();
  fileInput.value = "";
  showToast(t("leaveRequestSubmittedToast"));
  await Promise.all([loadRequests(), loadBalance()]);
});

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;

  let supervisorName = "—";
  if (ME.supervisor_id) {
    const { data: sup } = await db.from("employees").select("full_name").eq("id", ME.supervisor_id).maybeSingle();
    if (sup) supervisorName = sup.full_name;
  }

  document.getElementById("whoami").innerHTML = `
    ${ME.full_name} · #${ME.file_number}<br>
    <span style="opacity:.7">${ME.client_company || ""}</span><br>
    <span style="opacity:.7">${t("colHiringDate")}: ${fmtDate(ME.hiring_date)}</span><br>
    <span style="opacity:.7">${t("colSupervisor")}: ${supervisorName}</span>
  `;
  document.getElementById("deptLine").textContent = ME.department ? `${ME.department}` : "";
  await Promise.all([loadBalance(), loadRequests()]);
})();
