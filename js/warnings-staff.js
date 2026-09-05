function warningStatusBadge(status) {
  const cls = { draft: "cancelled", sent: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("warningStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

let ME = null;
let WARNINGS_LIST = [];
let WARNING_ALT_TEXT = "";
let WARNING_LANG = "ar";

function updateWarningConvertBtnLabel() {
  const btn = document.getElementById("warningConvertBtn");
  btn.style.display = WARNING_ALT_TEXT ? "" : "none";
  btn.textContent = WARNING_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
}

async function loadWarnings() {
  const { data, error } = await db
    .from("warnings")
    .select("*")
    .eq("employee_id", ME.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  if (error || !data) {
    document.getElementById("noWarningsMsg").style.display = "block";
    return;
  }
  WARNINGS_LIST = data;
  renderWarnings();
}

function ensureWarningsSearch() {
  let input = document.getElementById("warningsSearchInput");
  if (input) return input;
  const tbody = document.getElementById("warningsBody");
  const table = tbody && tbody.closest("table");
  if (!table) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative; max-width:480px; margin-bottom:14px";
  wrap.innerHTML = `
    <span style="position:absolute; inset-inline-start:12px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:.55">🔍</span>
    <input type="text" id="warningsSearchInput" placeholder="Reason or status" style="width:100%; padding-inline-start:36px">
  `;
  table.parentNode.insertBefore(wrap, table);
  input = document.getElementById("warningsSearchInput");
  input.addEventListener("input", () => renderWarnings());
  return input;
}

function renderWarnings() {
  const body = document.getElementById("warningsBody");
  const empty = document.getElementById("noWarningsMsg");
  body.innerHTML = "";

  if (WARNINGS_LIST.length === 0) {
    empty.style.display = "block";
    return;
  }

  ensureWarningsSearch();
  const query = (document.getElementById("warningsSearchInput") || {}).value.trim().toLowerCase() || "";
  const filtered = query
    ? WARNINGS_LIST.filter(w => (w.reason || "").toLowerCase().includes(query) || (w.status || "").toLowerCase().includes(query))
    : WARNINGS_LIST;

  notifyIfNoSearchResults(document.getElementById("warningsSearchInput"), query, filtered.length);
  empty.style.display = filtered.length ? "none" : "block";

  for (const w of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ME.full_name}</td>
      <td>${ME.file_number}</td>
      <td>${ME.client_company || "—"}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>${warningStatusBadge(w.status)}${w.acknowledged_at ? ` <span class="badge badge-approved" style="margin-inline-start:6px" title="Acknowledged on ${fmtDate(w.acknowledged_at.slice(0,10))}">Acknowledged</span>` : ""}</td>
      <td>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-warning="${w.id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll("button[data-view-warning]").forEach(btn => {
    btn.addEventListener("click", () => openWarningView(btn.dataset.viewWarning));
  });
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
    const closeBtn = document.getElementById("closeWarningViewBtn");
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
    const display = document.getElementById("warningTextDisplay");
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
  await loadWarnings();
}

function openWarningView(id) {
  const w = WARNINGS_LIST.find(x => x.id === id);
  if (!w) return;
  const display = document.getElementById("warningTextDisplay");
  display.textContent = w.warning_text || w.reason;
  WARNING_ALT_TEXT = w.warning_text_alt || "";
  WARNING_LANG = w.language === "en" ? "en" : "ar";
  display.dir = WARNING_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = WARNING_LANG === "ar" ? "right" : "left";
  updateWarningConvertBtnLabel();

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

  document.getElementById("warningViewOverlay").style.display = "flex";
}
document.getElementById("closeWarningViewBtn").addEventListener("click", () => {
  document.getElementById("warningViewOverlay").style.display = "none";
});
document.getElementById("warningConvertBtn").addEventListener("click", () => {
  const display = document.getElementById("warningTextDisplay");
  const current = display.textContent;
  display.textContent = WARNING_ALT_TEXT;
  WARNING_ALT_TEXT = current;
  WARNING_LANG = WARNING_LANG === "ar" ? "en" : "ar";
  display.dir = WARNING_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = WARNING_LANG === "ar" ? "right" : "left";
  updateWarningConvertBtnLabel();
});

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  document.getElementById("warningsSub").textContent = ME.department ? `${ME.department}` : "";
  await loadWarnings();
  localStorage.setItem(`fwx_lastSeenWarnings_${ME.id}`, new Date().toISOString());
})();
