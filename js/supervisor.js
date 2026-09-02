let ME = null;
let TEAM_BY_ID = {};
let TEAM_BALANCE_ROWS = [];
let PENDING_REQUESTS = [];
let HISTORY_REQUESTS = [];
let PENDING_PAGE = 0;
let HISTORY_PAGE = 0;
let BALANCES_PAGE = 0;
const PAGE_SIZE = 10;

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
  document.getElementById("teamCount").textContent = ME.role === "admin"
    ? `${data.length} ${data.length === 1 ? t("employeeCountSuffix") : t("employeeCountSuffixPlural")}`
    : `${data.length} ${data.length === 1 ? t("directReportsSuffix") : t("directReportsSuffixPlural")}`;
  return data;
}

async function loadBalances() {
  const { data, error } = await db.from("leave_balances").select("*");
  if (error || !data) { TEAM_BALANCE_ROWS = []; renderBalances(); return; }

  // leave_balances RLS already restricts this to "my team + me"
  TEAM_BALANCE_ROWS = data.filter(r => TEAM_BY_ID[r.employee_id]);
  BALANCES_PAGE = 0;
  renderBalances();
}

function renderBalances() {
  const body = document.getElementById("teamBody");
  body.innerHTML = "";

  const start = BALANCES_PAGE * PAGE_SIZE;
  const pageItems = TEAM_BALANCE_ROWS.slice(start, start + PAGE_SIZE);
  for (const r of pageItems) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.full_name}</td>
      <td>${r.file_number}</td>
      <td>${r.annual_entitlement}</td>
      <td>${r.taken}</td>
      <td>${r.remaining}</td>
      <td>${r.pending}</td>
      <td>${r.sick_entitlement}</td>
      <td>${r.sick_taken}</td>
      <td>${r.sick_remaining}</td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("balances", BALANCES_PAGE, TEAM_BALANCE_ROWS.length);
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
  noPending.style.display = PENDING_REQUESTS.length ? "none" : "block";

  const start = PENDING_PAGE * PAGE_SIZE;
  const pageItems = PENDING_REQUESTS.slice(start, start + PAGE_SIZE);

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
      <td>${r.document_path ? `<button type="button" class="btn btn-blue btn-sm" data-doc="${r.document_path}">${t("view")}</button>` : "—"}</td>
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
      const { error } = await db
        .from("leave_requests")
        .update({ status: btn.dataset.action, decided_by: ME.id, decided_at: new Date().toISOString() })
        .eq("id", btn.dataset.id);
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

  updatePaginationControls("pending", PENDING_PAGE, PENDING_REQUESTS.length);
}

function renderHistory() {
  const historyBody = document.getElementById("historyBody");
  const noHistory = document.getElementById("noHistory");
  historyBody.innerHTML = "";
  noHistory.style.display = HISTORY_REQUESTS.length ? "none" : "block";

  const start = HISTORY_PAGE * PAGE_SIZE;
  const pageItems = HISTORY_REQUESTS.slice(start, start + PAGE_SIZE);

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

  updatePaginationControls("history", HISTORY_PAGE, HISTORY_REQUESTS.length);
}

document.getElementById("pendingPrevBtn").addEventListener("click", () => { if (PENDING_PAGE > 0) { PENDING_PAGE--; renderPending(); } });
document.getElementById("pendingNextBtn").addEventListener("click", () => { if ((PENDING_PAGE + 1) * PAGE_SIZE < PENDING_REQUESTS.length) { PENDING_PAGE++; renderPending(); } });
document.getElementById("historyPrevBtn").addEventListener("click", () => { if (HISTORY_PAGE > 0) { HISTORY_PAGE--; renderHistory(); } });
document.getElementById("historyNextBtn").addEventListener("click", () => { if ((HISTORY_PAGE + 1) * PAGE_SIZE < HISTORY_REQUESTS.length) { HISTORY_PAGE++; renderHistory(); } });
document.getElementById("balancesPrevBtn").addEventListener("click", () => { if (BALANCES_PAGE > 0) { BALANCES_PAGE--; renderBalances(); } });
document.getElementById("balancesNextBtn").addEventListener("click", () => { if ((BALANCES_PAGE + 1) * PAGE_SIZE < TEAM_BALANCE_ROWS.length) { BALANCES_PAGE++; renderBalances(); } });

function showDateRangePrompt(title) {
  return new Promise((resolve) => {
    document.getElementById("dateRangeTitle").textContent = title;
    document.getElementById("rangeFromInput").value = "";
    document.getElementById("rangeToInput").value = "";
    document.getElementById("rangeEmployeeIdInput").value = "";
    document.getElementById("dateRangeOverlay").style.display = "flex";

    const generateBtn = document.getElementById("rangeGenerateBtn");
    const cancelBtn = document.getElementById("rangeCancelBtn");

    const cleanup = () => {
      document.getElementById("dateRangeOverlay").style.display = "none";
      generateBtn.removeEventListener("click", onGenerate);
      cancelBtn.removeEventListener("click", onCancel);
    };
    const onGenerate = () => {
      const from = document.getElementById("rangeFromInput").value || null;
      const to = document.getElementById("rangeToInput").value || null;
      const employeeId = document.getElementById("rangeEmployeeIdInput").value.trim() || null;
      cleanup();
      resolve({ from, to, employeeId });
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

document.getElementById("downloadReportBtn").addEventListener("click", async () => {
  const range = await showDateRangePrompt(t("selectReportPeriodTitle"));
  if (!range) return;

  let source = range.employeeId
    ? TEAM_BALANCE_ROWS.filter(r => r.file_number === range.employeeId)
    : TEAM_BALANCE_ROWS;
  if (range.from) source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.hiring_date && emp.hiring_date >= range.from; });
  if (range.to) source = source.filter(r => { const emp = TEAM_BY_ID[r.employee_id]; return emp && emp.hiring_date && emp.hiring_date <= range.to; });

  if (source.length === 0) {
    showToast(t("noMatchingEmployeeToast"));
    return;
  }

  const rows = source.map(r => [r.full_name, r.file_number, String(r.annual_entitlement), String(r.taken), String(r.remaining), String(r.pending), String(r.sick_entitlement), String(r.sick_taken), String(r.sick_remaining)]);
  const rangeNote = (range.from || range.to) ? ` — Period: ${range.from || "…"} to ${range.to || "…"}` : "";
  downloadPDF(
    "My Team — Leave Report",
    `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}${rangeNote}`,
    ["Employee Name", "ID #", "Annual", "Taken", "Available Balance", "Pending", "Sick", "Sick Taken", "Sick Remaining"],
    rows,
    "my_team_leave_report.pdf"
  );
});

async function refreshAll() {
  await loadTeam();
  await Promise.all([loadBalances(), loadRequests()]);
}

(async () => {
  ME = await requireSession("supervisor");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  if (ME.role === "admin") document.getElementById("adminLink").style.display = "";
  if (ME.role === "admin") document.getElementById("clientsLink").style.display = "";
  document.getElementById("pendingActionsHeader").textContent = ME.role === "admin" ? t("colStatus") : "";
  await refreshAll();
})();
