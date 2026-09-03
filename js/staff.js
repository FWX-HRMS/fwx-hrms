let ME = null;
let LAST_LOCATION_PUSH = 0;
const LOCATION_PUSH_INTERVAL_MS = 35000;

function setLocationBadge(text, statusClass) {
  const badge = document.getElementById("locationStatusBadge");
  badge.textContent = text;
  badge.className = `badge ${statusClass}`;
}

function startLocationSharing() {
  if (!navigator.geolocation) {
    setLocationBadge(t("locationUnsupported"), "badge-cancelled");
    return;
  }
  setLocationBadge(t("locationRequesting"), "badge-pending");

  navigator.geolocation.watchPosition(
    async (pos) => {
      setLocationBadge(t("locationActive"), "badge-approved");
      const now = Date.now();
      if (now - LAST_LOCATION_PUSH < LOCATION_PUSH_INTERVAL_MS) return;
      LAST_LOCATION_PUSH = now;
      await db.from("employee_locations").upsert({
        employee_id: ME.id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        updated_at: new Date().toISOString()
      });
    },
    () => {
      setLocationBadge(t("locationDenied"), "badge-rejected");
    },
    { enableHighAccuracy: true, maximumAge: 20000, timeout: 20000 }
  );
}

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
      setBtnLoading(btn, true);
      const { error } = await db
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", btn.dataset.id);
      if (error) { showToast(t("couldNotCancelToast")); setBtnLoading(btn, false); return; }
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
  setBtnLoading(btn, true, t("submitting"));

  let document_path = null;

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    document_path = `${ME.id}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await db.storage.from("leave-documents").upload(document_path, file);
    if (uploadError) {
      setBtnLoading(btn, false);
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

  setBtnLoading(btn, false);

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

function warningStatusBadge(status) {
  const cls = { draft: "cancelled", sent: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("warningStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

let DASHBOARD_WARNINGS = [];
let DOC_ALT_TEXT = "";
let DOC_LANG = "ar";

async function loadDashboardWarnings() {
  const { data, error } = await db
    .from("warnings")
    .select("*")
    .eq("employee_id", ME.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  const body = document.getElementById("dashboardWarningsBody");
  const empty = document.getElementById("noDashboardWarnings");
  body.innerHTML = "";

  if (error || !data || data.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  DASHBOARD_WARNINGS = data;

  for (const w of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ME.full_name}</td>
      <td>${ME.client_company || "—"}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>${warningStatusBadge(w.status)}</td>
      <td>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-dash-warning="${w.id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll("button[data-view-dash-warning]").forEach(btn => {
    btn.addEventListener("click", () => {
      const w = DASHBOARD_WARNINGS.find(x => x.id === btn.dataset.viewDashWarning);
      if (!w) return;
      const display = document.getElementById("docTextDisplay");
      display.textContent = w.warning_text || w.reason;
      DOC_ALT_TEXT = w.warning_text_alt || "";
      DOC_LANG = w.language === "en" ? "en" : "ar";
      display.dir = DOC_LANG === "ar" ? "rtl" : "ltr";
      display.style.textAlign = DOC_LANG === "ar" ? "right" : "left";
      const convertBtn = document.getElementById("docConvertBtn");
      convertBtn.style.display = DOC_ALT_TEXT ? "" : "none";
      convertBtn.textContent = DOC_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
      document.getElementById("docViewOverlay").style.display = "flex";
    });
  });
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

async function checkNewDocsNotification() {
  const contractBox = document.getElementById("contractNotification");
  const warningBox = document.getElementById("warningNotification");

  // Any contract visible to this employee via RLS is already shared/commented/signed.
  // We only need to flag it if it's awaiting the employee's attention.
  const { data: contracts } = await db.from("contracts").select("status").eq("employee_id", ME.id).in("status", ["shared", "commented"]);
  if (contracts && contracts.length > 0) {
    contractBox.textContent = t("notifNewContract");
    contractBox.style.display = "block";
  } else {
    contractBox.style.display = "none";
  }

  const lastSeenKey = `fwx_lastSeenWarnings_${ME.id}`;
  const lastSeen = localStorage.getItem(lastSeenKey);
  const { data: warnings } = await db.from("warnings").select("sent_at").eq("employee_id", ME.id).eq("status", "sent").order("sent_at", { ascending: false });
  const newWarnings = (warnings || []).filter(w => !lastSeen || (w.sent_at && new Date(w.sent_at) > new Date(lastSeen)));
  if (newWarnings.length > 0) {
    warningBox.textContent = tv("notifNewWarnings", { n: newWarnings.length });
    warningBox.style.display = "block";

    // Show the popup once per distinct "latest new warning" — won't nag on
    // every page load, but re-appears if a genuinely newer warning arrives.
    const latestNewTs = newWarnings[0].sent_at;
    const popupSeenKey = `fwx_warningPopupSeen_${ME.id}`;
    if (sessionStorage.getItem(popupSeenKey) !== latestNewTs) {
      document.getElementById("newWarningPopupText").textContent = tv("notifNewWarnings", { n: newWarnings.length });
      document.getElementById("newWarningOverlay").style.display = "flex";
      sessionStorage.setItem(popupSeenKey, latestNewTs);
    }
  } else {
    warningBox.style.display = "none";
  }
}
document.getElementById("closeNewWarningBtn").addEventListener("click", () => {
  document.getElementById("newWarningOverlay").style.display = "none";
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
  startLocationSharing();
  await Promise.all([loadBalance(), loadRequests(), checkNewDocsNotification(), loadDashboardWarnings()]);
})();
