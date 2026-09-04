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
      <td>${warningStatusBadge(w.status)}</td>
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
      // acknowledged, only Close remains from then on.
      const ackBtn = ensureAckWarningBtn();
      const needsAck = w.status === "sent" && !w.acknowledged_at;
      ackBtn.style.display = needsAck ? "" : "none";
      ackBtn.onclick = () => acknowledgeWarning(w, ackBtn);

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
        <button type="button" class="btn btn-danger" id="leaveWizardCancelBtn" style="width:120px">Cancel</button>
        <button type="button" class="btn btn-blue" id="leaveWizardBackBtn" style="width:120px; display:none">‹ Back</button>
        <button type="button" class="btn btn-blue" id="leaveWizardSkipBtn" style="width:120px; display:none">Skip</button>
        <button type="button" class="btn btn-primary" id="leaveWizardNextBtn" style="width:160px">Next ›</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const LEAVE_WIZARD = { stepIndex: 0 };

  function fieldStep(key, title, label, elementId) {
    return {
      key, title,
      render(container) {
        const lbl = document.createElement("label");
        lbl.textContent = label;
        lbl.setAttribute("for", elementId);
        container.appendChild(lbl);
        container.appendChild(document.getElementById(elementId));
      },
    };
  }

  const LEAVE_WIZARD_STEPS = [
    { ...fieldStep("type", "Leave type", "Type", "leaveType"), valid: () => !!document.getElementById("leaveType").value },
    { ...fieldStep("start_date", "Start date", "Start date", "startDate"),
      valid: () => !!document.getElementById("startDate").value,
      errorMsg: "Please select a start date." },
    { ...fieldStep("end_date", "End date", "End date", "endDate"),
      valid: () => {
        const s = document.getElementById("startDate").value;
        const eVal = document.getElementById("endDate").value;
        return !!eVal && eVal >= s;
      },
      errorMsg: "Please select a valid end date (on or after the start date)." },
    { ...fieldStep("reason", "Reason (optional)", "Reason", "reason"),
      valid: () => true, skippable: true },
    {
      key: "document", title: "Attach supporting document",
      render(container) {
        const isSick = document.getElementById("leaveType").value === "sick";
        const note = document.createElement("p");
        note.className = "help-text";
        note.style.margin = "0 0 10px";
        note.textContent = isSick
          ? "A supporting document is required for sick leave."
          : "Attach a supporting document if you have one. This is optional — click Skip if you don't want to attach anything.";
        container.appendChild(note);
        const lbl = document.createElement("label");
        lbl.id = "documentLabel";
        lbl.textContent = isSick ? t("attachDocRequiredLabel") : t("attachDocOptionalLabel");
        lbl.setAttribute("for", "document");
        container.appendChild(lbl);
        container.appendChild(document.getElementById("document"));
      },
      valid: () => {
        const isSick = document.getElementById("leaveType").value === "sick";
        return !isSick || !!document.getElementById("document").files[0];
      },
      skippable: () => document.getElementById("leaveType").value !== "sick",
      errorMsg: "A supporting document is required for sick leave.",
    },
  ];

  function lwShowError(msg) {
    const box = document.getElementById("leaveWizardError");
    box.textContent = msg;
    box.classList.add("show");
  }

  function lwRenderCurrentStep() {
    const stepDef = LEAVE_WIZARD_STEPS[LEAVE_WIZARD.stepIndex];
    document.getElementById("leaveWizardStepCounter").textContent = `Step ${LEAVE_WIZARD.stepIndex + 1} of ${LEAVE_WIZARD_STEPS.length}`;
    document.getElementById("leaveWizardTitle").textContent = stepDef.title;
    document.getElementById("leaveWizardError").classList.remove("show");

    const body = document.getElementById("leaveWizardBody");
    body.innerHTML = "";
    stepDef.render(body);

    document.getElementById("leaveWizardBackBtn").style.display = LEAVE_WIZARD.stepIndex === 0 ? "none" : "";

    const isSkippable = typeof stepDef.skippable === "function" ? stepDef.skippable() : !!stepDef.skippable;
    document.getElementById("leaveWizardSkipBtn").style.display = isSkippable ? "" : "none";

    const isLast = LEAVE_WIZARD.stepIndex === LEAVE_WIZARD_STEPS.length - 1;
    document.getElementById("leaveWizardNextBtn").textContent = isLast ? "Submit request" : "Next ›";
  }

  function lwSubmit() {
    document.getElementById("leaveWizardOverlay").style.display = "none";
    document.getElementById("leaveForm").requestSubmit();
  }

  document.getElementById("openLeaveWizardBtn").addEventListener("click", () => {
    LEAVE_WIZARD.stepIndex = 0;
    // These fields were moved out of #leaveForm into the wizard steps, so
    // form.reset() (called after a successful submit) no longer reaches
    // them — clear them manually here to avoid stale data on reopen.
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("leaveType").selectedIndex = 0;
    document.getElementById("reason").value = "";
    document.getElementById("document").value = "";
    document.getElementById("leaveWizardOverlay").style.display = "flex";
    lwRenderCurrentStep();
  });

  document.getElementById("leaveWizardBackBtn").addEventListener("click", () => {
    LEAVE_WIZARD.stepIndex = Math.max(0, LEAVE_WIZARD.stepIndex - 1);
    lwRenderCurrentStep();
  });

  document.getElementById("leaveWizardCancelBtn").addEventListener("click", () => {
    document.getElementById("leaveWizardOverlay").style.display = "none";
  });

  document.getElementById("leaveWizardSkipBtn").addEventListener("click", () => {
    const isLast = LEAVE_WIZARD.stepIndex === LEAVE_WIZARD_STEPS.length - 1;
    if (isLast) { lwSubmit(); return; }
    LEAVE_WIZARD.stepIndex++;
    lwRenderCurrentStep();
  });

  document.getElementById("leaveWizardNextBtn").addEventListener("click", () => {
    const stepDef = LEAVE_WIZARD_STEPS[LEAVE_WIZARD.stepIndex];
    if (!stepDef.valid()) {
      lwShowError(stepDef.errorMsg || "Please complete this step before continuing.");
      return;
    }
    const isLast = LEAVE_WIZARD.stepIndex === LEAVE_WIZARD_STEPS.length - 1;
    if (isLast) { lwSubmit(); return; }
    LEAVE_WIZARD.stepIndex++;
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
