let ME = null;
let TEAM_BY_ID = {};
let TEAM_BALANCE_ROWS = [];

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function badgeFor(status) {
  return `<span class="badge badge-${status}">${status[0].toUpperCase()}${status.slice(1)}</span>`;
}

async function loadTeam() {
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("supervisor_id", ME.id)
    .order("full_name");

  if (error || !data) return [];
  TEAM_BY_ID = Object.fromEntries(data.map(e => [e.id, e]));
  document.getElementById("teamCount").textContent = `${data.length} direct report${data.length === 1 ? "" : "s"}`;
  return data;
}

async function loadBalances() {
  const { data, error } = await db.from("leave_balances").select("*");
  const body = document.getElementById("teamBody");
  body.innerHTML = "";
  if (error || !data) return;

  // leave_balances RLS already restricts this to "my team + me"
  const rows = data.filter(r => TEAM_BY_ID[r.employee_id]);
  TEAM_BALANCE_ROWS = rows;
  for (const r of rows) {
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
}

async function loadRequests() {
  const { data, error } = await db
    .from("leave_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  const pendingBody = document.getElementById("pendingBody");
  const noPending = document.getElementById("noPending");
  const historyBody = document.getElementById("historyBody");
  const noHistory = document.getElementById("noHistory");
  pendingBody.innerHTML = "";
  historyBody.innerHTML = "";

  if (error || !data) return;

  const pending = data.filter(r => r.status === "pending");
  const history = data.filter(r => r.status !== "pending");

  noPending.style.display = pending.length ? "none" : "block";
  noHistory.style.display = history.length ? "none" : "block";

  for (const r of pending) {
    const emp = TEAM_BY_ID[r.employee_id];
    if (!emp) continue;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
      <td>${r.days_requested}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${r.reason ? r.reason : "—"}</td>
      <td>${r.document_path ? `<button type="button" class="btn btn-blue btn-sm" data-doc="${r.document_path}">View</button>` : "—"}</td>
      <td class="row-actions">
        <button class="btn btn-primary btn-sm" data-action="approved" data-id="${r.id}">Approve</button>
        <button class="btn btn-danger btn-sm" data-action="rejected" data-id="${r.id}">Reject</button>
      </td>
    `;
    pendingBody.appendChild(tr);
  }

  pendingBody.querySelectorAll("button[data-doc]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { data, error } = await db.storage.from("leave-documents").createSignedUrl(btn.dataset.doc, 60);
      if (error || !data) { showToast("Could not open that document."); return; }
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
      if (error) { showToast("Could not update that request."); }
      else {
        showToast(`Request ${btn.dataset.action}.`);
        db.functions.invoke("clever-api", {
          body: { leave_request_id: btn.dataset.id, type: "decided" }
        }).catch(() => {});
      }
      await refreshAll();
    });
  });

  for (const r of history.slice(0, 50)) {
    const emp = TEAM_BY_ID[r.employee_id];
    if (!emp) continue;
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

document.getElementById("downloadReportBtn").addEventListener("click", () => {
  const rows = TEAM_BALANCE_ROWS.map(r => [r.full_name, r.file_number, String(r.annual_entitlement), String(r.taken), String(r.remaining), String(r.pending), String(r.sick_entitlement), String(r.sick_taken), String(r.sick_remaining)]);
  downloadPDF(
    "My Team — Leave Report",
    `Generated ${new Date().toLocaleDateString()} by ${ME.full_name}`,
    ["Name", "File #", "Annual", "Taken", "Remaining", "Pending", "Sick", "Sick Taken", "Sick Remaining"],
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
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  if (ME.role === "admin") document.getElementById("adminLink").style.display = "";
  if (ME.role === "admin") document.getElementById("clientsLink").style.display = "";
  await refreshAll();
})();
