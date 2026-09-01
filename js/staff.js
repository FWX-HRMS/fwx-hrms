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
}

function badgeFor(status) {
  return `<span class="badge badge-${status}">${status[0].toUpperCase()}${status.slice(1)}</span>`;
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
      <td>${canCancel ? `<button class="btn btn-ghost btn-sm" data-id="${r.id}">Cancel</button>` : ""}</td>
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
      if (error) { showToast("Could not cancel that request."); btn.disabled = false; return; }
      showToast("Request cancelled.");
      await Promise.all([loadRequests(), loadBalance()]);
    });
  });
}

document.getElementById("leaveForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("leaveError");
  errBox.classList.remove("show");

  const start_date = document.getElementById("startDate").value;
  const end_date = document.getElementById("endDate").value;
  const leave_type = document.getElementById("leaveType").value;
  const reason = document.getElementById("reason").value.trim();

  if (end_date < start_date) {
    errBox.textContent = "End date can't be before the start date.";
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("applyBtn");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  const { error } = await db.from("leave_requests").insert({
    employee_id: ME.id,
    start_date, end_date, leave_type,
    reason: reason || null
  });

  btn.disabled = false;
  btn.textContent = "Submit request";

  if (error) {
    errBox.textContent = "Something went wrong submitting your request.";
    errBox.classList.add("show");
    return;
  }

  document.getElementById("leaveForm").reset();
  showToast("Leave request submitted.");
  await Promise.all([loadRequests(), loadBalance()]);
});

document.getElementById("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("pwError");
  errBox.classList.remove("show");

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    errBox.textContent = "Passwords don't match.";
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("pwBtn");
  btn.disabled = true;
  btn.textContent = "Updating…";

  const { error } = await db.auth.updateUser({ password: newPassword });

  btn.disabled = false;
  btn.textContent = "Update password";

  if (error) {
    errBox.textContent = "Something went wrong updating your password.";
    errBox.classList.add("show");
    return;
  }

  document.getElementById("passwordForm").reset();
  showToast("Password updated.");
});

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  document.getElementById("deptLine").textContent = ME.department ? `${ME.department}` : "";
  await Promise.all([loadBalance(), loadRequests()]);
})();
