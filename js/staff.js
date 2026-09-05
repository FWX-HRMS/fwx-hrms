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

let MY_REQUESTS_LIST = [];

async function loadRequests() {
  const { data, error } = await db
    .from("leave_requests")
    .select("*")
    .eq("employee_id", ME.id)
    .order("requested_at", { ascending: false });

  if (error || !data) {
    document.getElementById("noRequests").style.display = "block";
    return;
  }
  MY_REQUESTS_LIST = data;
  renderRequests();
}

function ensureRequestsSearch() {
  let input = document.getElementById("requestsSearchInput");
  if (input) return input;
  const tbody = document.getElementById("requestsBody");
  const table = tbody && tbody.closest("table");
  if (!table) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative; max-width:480px; margin-bottom:14px";
  wrap.innerHTML = `
    <span style="position:absolute; inset-inline-start:12px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:.55">🔍</span>
    <input type="text" id="requestsSearchInput" placeholder="Type or status" style="width:100%; padding-inline-start:36px">
  `;
  table.parentNode.insertBefore(wrap, table);
  input = document.getElementById("requestsSearchInput");
  input.addEventListener("input", () => { MY_REQUESTS_PAGE = 0; renderRequests(); });
  return input;
}

const MY_REQUESTS_PAGE_SIZE = 10;
let MY_REQUESTS_PAGE = 0;

function ensureRequestsPagination() {
  let wrap = document.getElementById("requestsPagination");
  if (wrap) return wrap;
  const tbody = document.getElementById("requestsBody");
  const table = tbody && tbody.closest("table");
  if (!table) return null;
  wrap = document.createElement("div");
  wrap.id = "requestsPagination";
  wrap.style.cssText = "display:flex; align-items:center; justify-content:space-between; margin-top:14px";
  wrap.innerHTML = `
    <span id="requestsPageInfo" class="help-text"></span>
    <div style="display:flex; gap:8px">
      <button type="button" class="btn btn-paginate" id="requestsPrevBtn" style="width:100px">‹ Prev</button>
      <button type="button" class="btn btn-paginate" id="requestsNextBtn" style="width:100px">Next ›</button>
    </div>
  `;
  table.parentNode.insertBefore(wrap, table.nextSibling);
  document.getElementById("requestsPrevBtn").addEventListener("click", () => {
    if (MY_REQUESTS_PAGE > 0) { MY_REQUESTS_PAGE--; renderRequests(); }
  });
  document.getElementById("requestsNextBtn").addEventListener("click", () => {
    MY_REQUESTS_PAGE++;
    renderRequests();
  });
  return wrap;
}

function updateRequestsPaginationControls(totalCount) {
  const wrap = ensureRequestsPagination();
  if (!wrap) return;
  if (totalCount <= MY_REQUESTS_PAGE_SIZE) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "flex";
  const start = MY_REQUESTS_PAGE * MY_REQUESTS_PAGE_SIZE + 1;
  const end = Math.min((MY_REQUESTS_PAGE + 1) * MY_REQUESTS_PAGE_SIZE, totalCount);
  document.getElementById("requestsPageInfo").textContent = `Showing ${start}–${end} of ${totalCount}`;
  document.getElementById("requestsPrevBtn").disabled = MY_REQUESTS_PAGE === 0;
  document.getElementById("requestsNextBtn").disabled = end >= totalCount;
}

function renderRequests() {
  const body = document.getElementById("requestsBody");
  const empty = document.getElementById("noRequests");
  body.innerHTML = "";

  if (MY_REQUESTS_LIST.length === 0) {
    empty.style.display = "block";
    return;
  }

  ensureRequestsSearch();
  const query = (document.getElementById("requestsSearchInput") || {}).value.trim().toLowerCase() || "";
  const filtered = query
    ? MY_REQUESTS_LIST.filter(r => (r.leave_type || "").toLowerCase().includes(query) || (r.status || "").toLowerCase().includes(query))
    : MY_REQUESTS_LIST;

  notifyIfNoSearchResults(document.getElementById("requestsSearchInput"), query, filtered.length);
  empty.style.display = filtered.length ? "none" : "block";

  const start = MY_REQUESTS_PAGE * MY_REQUESTS_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + MY_REQUESTS_PAGE_SIZE);

  for (const r of pageItems) {
    const tr = document.createElement("tr");
    const canCancel = r.status === "pending";
    tr.innerHTML = `
      <td>${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}</td>
      <td>${r.days_requested}</td>
      <td style="text-transform:capitalize">${r.leave_type}</td>
      <td>${badgeFor(r.status)}</td>
      <td>${canCancel ? `<button class="btn btn-danger btn-sm" data-id="${r.id}" data-confirm-close="1">${t("cancelBtn")}</button>` : ""}</td>
    `;
    body.appendChild(tr);
  }
  updateRequestsPaginationControls(filtered.length);

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
  const docLabel = document.getElementById("documentLabel");
  if (docLabel) docLabel.textContent = isSick ? t("attachDocRequiredLabel") : t("attachDocOptionalLabel");
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
      showToast(t("couldNotUploadDoc"));
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
    showToast(t("somethingWrongSubmitting"));
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
      <td>${ME.file_number}</td>
      <td>${ME.client_company || "—"}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}</td>
      <td>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-dash-warning="${w.id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }
function ensureAckWarningBtn() {
  let btn = document.getElementById("ackWarningBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "ackWarningBtn";
    btn.className = "btn btn-primary btn-sm";
    btn.textContent = "Acknowledge";
    btn.style.marginInlineEnd = "8px";
    const closeBtn = document.getElementById("closeDocViewBtn");
    closeBtn.parentNode.insertBefore(btn, closeBtn);
  }
  return btn;
}

function ensureAckWarningNote() {
  let note = document.getElementById("ackWarningNote");
  if (!note) {
    note = document.createElement("div");
    note.id = "ackWarningNote";
    note.className = "success-msg";
    note.style.marginTop = "10px";
    note.style.fontWeight = "600";
    const display = document.getElementById("docTextDisplay");
    display.parentNode.insertBefore(note, display.nextSibling);
  }
  return note;
}

async function acknowledgeWarning(warning, btn) {
  setBtnLoading(btn, true);
  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "acknowledge_warning", warning_id: warning.id }
  });
  setBtnLoading(btn, false);
  if (error || (data && data.error)) {
    showToast("Could not acknowledge this warning. Please try again.");
    return;
  }
  warning.acknowledged_at = new Date().toISOString();
  btn.style.display = "none";
  const note = ensureAckWarningNote();
  note.textContent = `Acknowledged on ${fmtDate(warning.acknowledged_at.slice(0,10))}`;
  note.classList.add("show");
  showToast("Warning acknowledged.");
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

      // Pending acknowledgment: show Acknowledge alongside Close. Once
      // acknowledged, only Close remains, with a clear confirmation note.
      const ackBtn = ensureAckWarningBtn();
      const needsAck = w.status === "sent" && !w.acknowledged_at;
      ackBtn.style.display = needsAck ? "" : "none";
      ackBtn.onclick = () => acknowledgeWarning(w, ackBtn);

      const ackNote = ensureAckWarningNote();
      if (w.acknowledged_at) {
        ackNote.textContent = `Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}`;
        ackNote.classList.add("show");
      } else {
        ackNote.classList.remove("show");
      }

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

function checkNewContractPopup(contract) {
  const seenKey = `fwx_seenNewContract_${ME.id}_${contract.id}_${contract.updated_at || ""}`;
  if (sessionStorage.getItem(seenKey)) return;
  document.getElementById("newContractOverlay").style.display = "flex";
  sessionStorage.setItem(seenKey, "1");
}
document.getElementById("closeNewContractBtn").dataset.skipConfirm = "1";
document.getElementById("closeNewContractBtn").addEventListener("click", () => {
  document.getElementById("newContractOverlay").style.display = "none";
});

async function checkNewDocsNotification() {
  const contractBox = document.getElementById("contractNotification");
  const warningBox = document.getElementById("warningNotification");

  // Any contract visible to this employee via RLS is already shared/commented/signed.
  // We only need to flag it if it's awaiting the employee's attention.
  const { data: contracts } = await db.from("contracts").select("id, status, updated_at").eq("employee_id", ME.id).in("status", ["shared", "commented"]);
  if (contracts && contracts.length > 0) {
    contractBox.textContent = t("notifNewContract");
    contractBox.style.display = "block";
    // Only the centered popup is reserved for a genuinely new share from
    // admin — "commented" just means the employee is waiting on their own
    // follow-up, which doesn't need an intrusive popup.
    const freshlyShared = contracts.find(c => c.status === "shared");
    if (freshlyShared) checkNewContractPopup(freshlyShared);
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
document.getElementById("closeNewWarningBtn").dataset.skipConfirm = "1";
document.getElementById("closeNewWarningBtn").addEventListener("click", () => {
  document.getElementById("newWarningOverlay").style.display = "none";
});

// ================= Apply for Leave wizard =================
// Reuses the existing #leaveForm and its fields/submit logic exactly as
// they already work — this just adds a guided, step-by-step way to fill
// them in. No submission logic is duplicated here.
(function setupLeaveWizard() {
  const originalPanel = document.getElementById("leaveForm").closest(".panel");
  if (!originalPanel) return;
  originalPanel.style.display = "none";

  const trigger = document.createElement("div");
  trigger.className = "panel";
  trigger.innerHTML = `
    <h2 style="margin:0 0 10px">Apply for leave</h2>
    <p class="help-text" style="margin:0 0 16px">Request annual, sick, or other leave in a few quick steps.</p>
    <button type="button" class="btn btn-blue" id="openLeaveWizardBtn" style="max-width:220px">Apply for Vacation</button>
  `;
  originalPanel.parentNode.insertBefore(trigger, originalPanel);

  const overlay = document.createElement("div");
  overlay.id = "leaveWizardOverlay";
  overlay.className = "modal-overlay";
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px">
      <h2 id="leaveWizardTitle" style="margin:0 0 4px"></h2>
      <p class="help-text" id="leaveWizardStepCounter" style="margin:0 0 18px"></p>
      <div id="leaveWizardBody"></div>
      <div class="error-msg" id="leaveWizardError"></div>
      <div style="display:flex; gap:10px; margin-top:20px">
        <button type="button" class="btn btn-danger" id="leaveWizardCancelBtn" data-skip-confirm="1" style="width:120px">Cancel</button>
        <button type="button" class="btn btn-blue" id="leaveWizardBackBtn" style="width:120px; display:none">‹ Back</button>
        <button type="button" class="btn btn-blue" id="leaveWizardSkipBtn" style="width:120px; display:none">Skip</button>
        <button type="button" class="btn btn-blue" id="leaveWizardNextBtn" style="width:160px">Next ›</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Independent state, kept separate from the original (now-hidden) form.
  // Values only get copied into the real form at the very last step, right
  // before submitting — the original form and its fields are never touched
  // or moved, so nothing about its existing validation/upload/reset logic
  // needs to change.
  const LW = {
    stepIndex: 0,
    values: { type: "annual", start_date: "", end_date: "", reason: "", file: null },
  };

  function lwField(id, labelText, inputHtml) {
    return `<label for="${id}">${labelText}</label>${inputHtml}`;
  }

  const LW_STEPS = [
    {
      key: "type", title: "Leave type",
      render(container) {
        container.innerHTML = lwField("lw_type", t("typeLabel"), `
          <select id="lw_type">
            <option value="annual" ${LW.values.type === "annual" ? "selected" : ""}>${t("typeAnnual")}</option>
            <option value="sick" ${LW.values.type === "sick" ? "selected" : ""}>${t("typeSick")}</option>
            <option value="unpaid" ${LW.values.type === "unpaid" ? "selected" : ""}>${t("typeUnpaid")}</option>
            <option value="other" ${LW.values.type === "other" ? "selected" : ""}>${t("typeOther")}</option>
          </select>
        `);
      },
      save() { LW.values.type = document.getElementById("lw_type").value; },
      valid() { return true; },
    },
    {
      key: "start_date", title: "Start date",
      render(container) {
        container.innerHTML = lwField("lw_start", t("startDateLabel"), `<input type="date" id="lw_start" value="${LW.values.start_date}">`);
      },
      save() { LW.values.start_date = document.getElementById("lw_start").value; },
      valid() { return !!LW.values.start_date || !!document.getElementById("lw_start").value; },
      errorMsg: "Please select a start date.",
    },
    {
      key: "end_date", title: "End date",
      render(container) {
        container.innerHTML = lwField("lw_end", t("endDateLabel"), `<input type="date" id="lw_end" value="${LW.values.end_date}">`);
      },
      save() { LW.values.end_date = document.getElementById("lw_end").value; },
      valid() {
        const v = document.getElementById("lw_end").value;
        return !!v && v >= LW.values.start_date;
      },
      errorMsg: "Please select a valid end date (on or after the start date).",
    },
    {
      key: "reason", title: "Reason (optional)", skippable: true,
      render(container) {
        container.innerHTML = lwField("lw_reason", t("reasonOptionalLabel"), `<textarea id="lw_reason" rows="3">${LW.values.reason}</textarea>`);
      },
      save() { LW.values.reason = document.getElementById("lw_reason").value.trim(); },
      valid() { return true; },
    },
    {
      key: "document", title: "Attach supporting document",
      render(container) {
        const isSick = LW.values.type === "sick";
        container.innerHTML = `
          <p class="help-text" style="margin:0 0 10px">${isSick
            ? "A supporting document is required for sick leave."
            : "Attach a supporting document if you have one. This is optional — click Skip if you don't want to attach anything."}</p>
          <label for="lw_document">${isSick ? t("attachDocRequiredLabel") : t("attachDocOptionalLabel")}</label>
          <input type="file" id="lw_document" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
        `;
        document.getElementById("lw_document").addEventListener("change", (e) => {
          LW.values.file = e.target.files[0] || null;
        });
      },
      save() {},
      valid() { return LW.values.type !== "sick" || !!LW.values.file; },
      skippable() { return LW.values.type !== "sick"; },
      errorMsg: "A supporting document is required for sick leave.",
    },
    {
      key: "review", title: "Review",
      render(container) {
        const typeLabels = { annual: "Annual", sick: "Sick", unpaid: "Unpaid", other: "Other" };
        container.innerHTML = `
          <div style="font-size:13.5px; line-height:1.9">
            <p><strong>Type:</strong> ${typeLabels[LW.values.type] || LW.values.type}</p>
            <p><strong>Start date:</strong> ${LW.values.start_date || "—"}</p>
            <p><strong>End date:</strong> ${LW.values.end_date || "—"}</p>
            <p><strong>Reason:</strong> ${LW.values.reason ? LW.values.reason : "—"}</p>
            <p><strong>Document:</strong> ${LW.values.file ? LW.values.file.name : "None"}</p>
          </div>
        `;
      },
      save() {},
      valid() { return true; },
    },
  ];

  function lwShowError(msg) {
    const box = document.getElementById("leaveWizardError");
    box.textContent = msg;
    box.classList.add("show");
  }

  function lwRenderCurrentStep() {
    const stepDef = LW_STEPS[LW.stepIndex];
    document.getElementById("leaveWizardStepCounter").textContent = `Step ${LW.stepIndex + 1} of ${LW_STEPS.length}`;
    document.getElementById("leaveWizardTitle").textContent = "Apply for Vacation";
    document.getElementById("leaveWizardError").classList.remove("show");

    const body = document.getElementById("leaveWizardBody");
    body.innerHTML = "";
    stepDef.render(body);

    document.getElementById("leaveWizardBackBtn").style.display = LW.stepIndex === 0 ? "none" : "";

    const isSkippable = typeof stepDef.skippable === "function" ? stepDef.skippable() : !!stepDef.skippable;
    document.getElementById("leaveWizardSkipBtn").style.display = isSkippable ? "" : "none";

    const isLast = LW.stepIndex === LW_STEPS.length - 1;
    document.getElementById("leaveWizardNextBtn").textContent = isLast ? "Submit request" : "Next ›";
  }

  function lwSubmit() {
    // Bridge collected values into the real (hidden) form fields, then
    // submit it through its existing, unmodified logic.
    document.getElementById("startDate").value = LW.values.start_date;
    document.getElementById("endDate").value = LW.values.end_date;
    document.getElementById("leaveType").value = LW.values.type;
    document.getElementById("reason").value = LW.values.reason;

    const fileInput = document.getElementById("document");
    if (LW.values.file) {
      const dt = new DataTransfer();
      dt.items.add(LW.values.file);
      fileInput.files = dt.files;
    } else {
      fileInput.value = "";
    }

    document.getElementById("leaveWizardOverlay").style.display = "none";
    document.getElementById("leaveForm").requestSubmit();
  }

  document.getElementById("openLeaveWizardBtn").addEventListener("click", () => {
    LW.stepIndex = 0;
    LW.values = { type: "annual", start_date: "", end_date: "", reason: "", file: null };
    document.getElementById("leaveWizardOverlay").style.display = "flex";
    lwRenderCurrentStep();
  });

  document.getElementById("leaveWizardBackBtn").addEventListener("click", () => {
    const stepDef = LW_STEPS[LW.stepIndex];
    if (stepDef.save) stepDef.save();
    LW.stepIndex = Math.max(0, LW.stepIndex - 1);
    lwRenderCurrentStep();
  });

  document.getElementById("leaveWizardCancelBtn").addEventListener("click", async () => {
    document.getElementById("leaveWizardOverlay").style.display = "none";
    const confirmed = await showCloseConfirm();
    if (!confirmed) {
      document.getElementById("leaveWizardOverlay").style.display = "flex";
    }
  });

  document.getElementById("leaveWizardSkipBtn").addEventListener("click", () => {
    const isLast = LW.stepIndex === LW_STEPS.length - 1;
    if (isLast) { lwSubmit(); return; }
    const stepDef = LW_STEPS[LW.stepIndex];
    if (stepDef.save) stepDef.save();
    LW.stepIndex++;
    lwRenderCurrentStep();
  });

  document.getElementById("leaveWizardNextBtn").addEventListener("click", () => {
    const stepDef = LW_STEPS[LW.stepIndex];
    if (stepDef.save) stepDef.save();
    if (!stepDef.valid()) {
      lwShowError(stepDef.errorMsg || "Please complete this step before continuing.");
      return;
    }
    const isLast = LW.stepIndex === LW_STEPS.length - 1;
    if (isLast) { lwSubmit(); return; }
    LW.stepIndex++;
    lwRenderCurrentStep();
  });
})();

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
